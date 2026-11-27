import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantModuleApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import { TheFactoryHkaProvider } from '@/lib/pos-hka-provider';
import { getSale } from '@/lib/pos/server';
import type { PosFiscalIntegration, PosFiscalStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Configuración fiscal de la empresa; sin fila, la integración está apagada. */
async function loadIntegration(service: SupabaseClient, tenantId: string): Promise<PosFiscalIntegration> {
  const { data } = await service.from('pos_fiscal_integrations').select('*').eq('tenant_id', tenantId).maybeSingle();
  return (
    (data as PosFiscalIntegration | null) ?? {
      id: '',
      tenant_id: tenantId,
      provider: 'HKA',
      environment: 'sandbox',
      enabled: false,
      company_rif: null,
      company_legal_name: null,
      fiscal_address: null,
      secret_reference: null,
      legal_status: 'sin_configurar',
      last_checked_at: null,
      updated_at: new Date().toISOString(),
    }
  );
}

async function saveFiscalRequest(
  service: SupabaseClient,
  tenantId: string,
  saleId: string,
  idempotencyKey: string,
  result: {
    status: PosFiscalStatus;
    providerReference?: string;
    fiscalInvoiceNumber?: string;
    fiscalControlNumber?: string;
    errorCode?: string;
    message: string;
  },
) {
  const { data } = await service
    .from('pos_fiscal_requests')
    .upsert(
      {
        tenant_id: tenantId,
        sale_id: saleId,
        idempotency_key: idempotencyKey,
        provider_reference: result.providerReference ?? null,
        fiscal_invoice_number: result.fiscalInvoiceNumber ?? null,
        fiscal_control_number: result.fiscalControlNumber ?? null,
        status: result.status,
        error_code: result.errorCode ?? null,
        response_summary: { provider: 'The Factory HKA (SENIAT)', status: result.status, message: result.message },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'idempotency_key' },
    )
    .select('*')
    .single();
  return data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  const integration = await loadIntegration(getSupabaseServiceClient(), auth.access.tenantId);
  return NextResponse.json({ ok: true, integration });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  if (!(await hasTenantPermission(auth.access, 'pos.fiscal.issue')))
    return permissionDenied('Tu rol no permite operaciones fiscales.');
  const service = getSupabaseServiceClient();
  const tenantId = auth.access.tenantId;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (body.action === 'save_config') {
    const ref = body.secret_reference ? String(body.secret_reference).trim().toUpperCase() : null;
    if (ref && !/^[A-Z][A-Z0-9_]{2,63}$/.test(ref))
      return NextResponse.json(
        { ok: false, error: 'La referencia de credenciales debe ser un nombre de variable (p. ej. HKA_EMPRESA).' },
        { status: 400 },
      );
    const environment = body.environment === 'production' ? 'production' : 'sandbox';
    const { data, error } = await service
      .from('pos_fiscal_integrations')
      .upsert(
        {
          tenant_id: tenantId,
          provider: 'HKA',
          environment,
          enabled: Boolean(body.enabled),
          company_rif: body.company_rif ? String(body.company_rif).trim().slice(0, 20) : null,
          company_legal_name: body.company_legal_name ? String(body.company_legal_name).trim().slice(0, 200) : null,
          fiscal_address: body.fiscal_address ? String(body.fiscal_address).trim().slice(0, 500) : null,
          secret_reference: ref,
          legal_status: 'sin_configurar',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      )
      .select('*')
      .single();
    if (error || !data) return NextResponse.json({ ok: false, error: 'No se pudo guardar la configuración fiscal.' }, { status: 500 });
    return NextResponse.json({ ok: true, integration: data });
  }

  const integration = await loadIntegration(service, tenantId);
  const hka = new TheFactoryHkaProvider(integration);

  if (body.action === 'validate') {
    const res = await hka.validateConfiguration(integration);
    if (res.valid && integration.id)
      await service
        .from('pos_fiscal_integrations')
        .update({
          legal_status: integration.environment === 'production' ? 'productivo_activo' : 'sandbox_verificado',
          last_checked_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);
    return NextResponse.json({ ok: res.valid, message: res.message, data: res.data });
  }

  if (body.action === 'issue' || body.action === 'simulate_timeout') {
    const sale = await getSale(service, tenantId, String(body.sale_id ?? ''));
    if (!sale) return NextResponse.json({ ok: false, error: 'Venta no encontrada.' }, { status: 404 });
    const key = `hka:${sale.id}`;
    if (body.action === 'simulate_timeout') {
      const res = await hka.simulateTimeout();
      const fiscalRequest = await saveFiscalRequest(service, tenantId, sale.id, key, res);
      return NextResponse.json({ ok: false, result: res, fiscal_request: fiscalRequest });
    }
    if (!integration.enabled)
      return NextResponse.json({ ok: false, error: 'La integración fiscal de la empresa no está habilitada.' }, { status: 409 });
    const { data: previous } = await service
      .from('pos_fiscal_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (previous?.status === 'emitido')
      return NextResponse.json({ ok: true, result: { success: true, status: 'emitido', message: 'Documento ya emitido.' }, fiscal_request: previous });
    const res = await hka.issueDocument(sale, key);
    const fiscalRequest = await saveFiscalRequest(service, tenantId, sale.id, key, res);
    return NextResponse.json({ ok: res.success, result: res, fiscal_request: fiscalRequest });
  }

  if (body.action === 'status') {
    const res = await hka.getDocumentStatus(String(body.sale_id ?? ''), String(body.idempotency_key ?? ''), body.numero_documento);
    return NextResponse.json({ ok: true, result: res });
  }

  if (body.action === 'cancel') {
    const res = await hka.cancelDocument(body.numero_documento, body.motivo);
    return NextResponse.json({ ok: res.success, result: res });
  }

  return NextResponse.json({ ok: false, error: 'Acción fiscal no reconocida.' }, { status: 400 });
}
