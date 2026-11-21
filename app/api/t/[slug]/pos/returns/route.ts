import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import {
  PosError,
  getSale,
  listReturns,
  loadPosConfig,
  sqlErrorMessage,
  userDisplayNames,
  verifySupervisorPin,
} from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, returns: await listReturns(getSupabaseServiceClient(), auth.access.tenantId) });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 500 });
  }
}

/**
 * Devolución / anulación (POS-14). La aprueba un supervisor: o bien quien tiene
 * la sesión posee pos.refunds.approve, o el cajero envía supervisor_id + PIN y
 * el servidor lo valida contra pos_staff_pins. El aprobador nunca sale de un
 * nombre enviado por el navegador.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const { tenantId, userId } = auth.access;
  const service = getSupabaseServiceClient();

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  const isSupervisor = await hasTenantPermission(auth.access, 'pos.refunds.approve');
  if (!isSupervisor && !(await hasTenantPermission(auth.access, 'pos.sales.create')))
    return permissionDenied('Tu rol no permite registrar devoluciones.');

  let approvedBy = userId;
  let authorizationId: string | null = null;
  if (!isSupervisor) {
    if (!body.supervisor_id || !body.supervisor_pin)
      return permissionDenied('Las devoluciones requieren el PIN de un supervisor.');
    const check = await verifySupervisorPin({
      service,
      tenantId,
      supervisorId: String(body.supervisor_id),
      pin: String(body.supervisor_pin),
      permission: 'pos.refunds.approve',
    });
    if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
    approvedBy = String(body.supervisor_id);
  }

  try {
    const config = await loadPosConfig(service, tenantId);
    const sale = await getSale(service, tenantId, String(body.original_sale_id ?? ''));
    if (!sale) return NextResponse.json({ ok: false, error: 'Venta de referencia no encontrada.' }, { status: 404 });

    const { data: authRow, error: authErr } = await service
      .from('pos_authorizations')
      .insert({
        tenant_id: tenantId,
        branch_id: sale.branch_id,
        shift_id: body.shift_id || null,
        sale_id: sale.id,
        operation_type: 'sale_return',
        requested_by: userId,
        approved_by: approvedBy,
        approver_name_snapshot: (await userDisplayNames(service, [approvedBy])).get(approvedBy) ?? null,
        reason: String(body.reason ?? '').trim().slice(0, 500) || 'Devolución',
        limit_snapshot: { return_type: body.return_type, refund_method: body.refund_method },
        consumed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (authErr || !authRow) return NextResponse.json({ ok: false, error: 'No se pudo registrar la autorización.' }, { status: 500 });
    authorizationId = authRow.id;

    const lines = (Array.isArray(body.lines) ? body.lines : []).map((l: any) => ({
      sale_line_id: l.sale_line_id,
      quantity: Number(l.quantity_returned ?? l.quantity),
      condition: l.condition === 'damaged' ? 'damaged' : 'sellable',
    }));
    const { data, error } = await service.rpc('pos_record_return', {
      p_tenant: tenantId,
      p_actor: userId,
      p_return: {
        idempotency_key: body.idempotency_key ? String(body.idempotency_key).slice(0, 200) : null,
        original_sale_id: sale.id,
        shift_id: body.shift_id,
        return_type: body.return_type,
        reason: String(body.reason ?? '').slice(0, 500),
        notes: body.notes ? String(body.notes).slice(0, 2000) : null,
        refund_method: body.refund_method,
        approved_by: approvedBy,
        authorization_id: authorizationId,
        // Repone según el catálogo del que salió la venta, no según la configuración actual.
        track_stock: (sale as { catalog_source?: string }).catalog_source === 'warehouse' ? config.warehouseStockSync : true,
        warehouse_id: body.warehouse_id || null,
        lines,
      },
    });
    if (error) {
      await service.from('pos_authorizations').delete().eq('id', authorizationId).eq('tenant_id', tenantId);
      return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo procesar la devolución.') }, { status: 409 });
    }
    const result = data as { return_id: string };
    const returns = await listReturns(service, tenantId);
    return NextResponse.json({
      ok: true,
      return_record: returns.find((r) => r.id === result.return_id) ?? null,
      sale: await getSale(service, tenantId, sale.id),
    });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message || 'Error en servidor.' }, { status: e.status ?? 500 });
  }
}
