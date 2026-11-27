import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantModuleApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import { getTenantSettings, loadPosConfig, resolveActorFromOfflineProof, toClientSettings } from '@/lib/pos/server';
import { validatePagoMovilConfig } from '@/lib/pos-pago-movil';
import type { PosPaymentMethod } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const METHODS: PosPaymentMethod[] = ['efectivo', 'pago_movil', 'tarjeta', 'cashea'];

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const tenantId = auth.access.tenantId;
  const config = await loadPosConfig(service, tenantId);
  const { data: audit } = await service
    .from('pos_audit_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  return NextResponse.json({
    ok: true,
    settings: toClientSettings(config.settings, config.pagoMovilConfig),
    catalog_source: config.catalogSource,
    stock_policy: config.stockPolicy,
    track_stock: config.trackStock,
    audit_events: audit ?? [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const { tenantId } = auth.access;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  const offlineOpKey = String(body.offline_op_key ?? '').trim();
  const actorCheck = await resolveActorFromOfflineProof({
    service,
    tenantId,
    authUserId: auth.access.userId,
    offlineOperatorAuth: body.offline_operator_auth,
    requiredPermission: 'pos.settings.manage',
    actionScope: `settings:${offlineOpKey}`,
  });
  if (!actorCheck.ok) {
    return NextResponse.json({ ok: false, error: actorCheck.error }, { status: actorCheck.status });
  }
  const userId = actorCheck.actorId;
  let effectiveAccess = auth.access;
  if (userId !== auth.access.userId) {
    const { data: mem } = await service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (!mem) return permissionDenied('El operador no está activo en la empresa.');
    effectiveAccess = { ...auth.access, userId, role: mem.role };
  }
  if (!(await hasTenantPermission(effectiveAccess, 'pos.settings.manage')))
    return permissionDenied('Tu rol no permite cambiar la configuración del POS.');

  if (body.action === 'update_settings') {
    await getTenantSettings(service, tenantId);
    const patch: Record<string, unknown> = { updated_by: userId, updated_at: new Date().toISOString() };
    if (body.max_cashier_discount_percent !== undefined) {
      const v = Number(body.max_cashier_discount_percent);
      if (!Number.isFinite(v) || v < 0 || v > 100)
        return NextResponse.json({ ok: false, error: 'El descuento máximo debe estar entre 0 y 100.' }, { status: 400 });
      patch.max_cashier_discount_percent = v;
    }
    if (body.allow_partial_payments !== undefined) patch.allow_partial_payments = Boolean(body.allow_partial_payments);
    if (body.require_pin_for_withdrawals !== undefined)
      patch.require_pin_for_withdrawals = Boolean(body.require_pin_for_withdrawals);
    if (body.active_methods !== undefined) {
      const methods = Array.isArray(body.active_methods) ? body.active_methods.filter((m: string) => METHODS.includes(m as PosPaymentMethod)) : [];
      if (!methods.length) return NextResponse.json({ ok: false, error: 'Activa al menos un método de pago.' }, { status: 400 });
      patch.active_methods = methods;
    }
    if (body.active_exchange_rate !== undefined) {
      const v = Number(body.active_exchange_rate);
      if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ ok: false, error: 'Tasa de cambio inválida.' }, { status: 400 });
      patch.active_exchange_rate = v;
      patch.exchange_rate_source = 'manual';
      patch.exchange_rate_updated_at = new Date().toISOString();
    }
    if (body.internal_doc_prefix !== undefined) {
      const prefix = String(body.internal_doc_prefix).trim();
      if (!/^[A-Z0-9\-]{1,20}$/i.test(prefix))
        return NextResponse.json({ ok: false, error: 'Prefijo de comprobante inválido.' }, { status: 400 });
      patch.internal_doc_prefix = prefix;
    }

    let validatedPagoMovil: ReturnType<typeof validatePagoMovilConfig> | null = null;
    if (body.pago_movil_config !== undefined) {
      validatedPagoMovil = validatePagoMovilConfig(body.pago_movil_config);
      if (!validatedPagoMovil.ok) {
        return NextResponse.json({ ok: false, error: validatedPagoMovil.error }, { status: 400 });
      }
    }

    const { data, error } = await service
      .from('pos_tenant_settings')
      .update(patch)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error || !data) return NextResponse.json({ ok: false, error: 'No se pudo guardar la configuración.' }, { status: 500 });

    if (validatedPagoMovil?.ok) {
      const { data: existingFeature } = await service
        .from('tenant_features')
        .select('enabled, contracted, config')
        .eq('tenant_id', tenantId)
        .eq('feature_key', 'commerce.pos')
        .maybeSingle();
      const baseCfg =
        existingFeature?.config && typeof existingFeature.config === 'object'
          ? (existingFeature.config as Record<string, unknown>)
          : {};
      const nextCfg = { ...baseCfg, pago_movil: validatedPagoMovil.value };
      const { error: tfError } = await service.from('tenant_features').upsert(
        {
          tenant_id: tenantId,
          feature_key: 'commerce.pos',
          enabled: existingFeature?.enabled ?? true,
          contracted: existingFeature?.contracted ?? true,
          config: nextCfg,
        },
        { onConflict: 'tenant_id,feature_key' },
      );
      if (tfError) {
        return NextResponse.json({ ok: false, error: 'No se pudieron guardar los datos de Pago Móvil.' }, { status: 500 });
      }
    }

    const updatedConfig = await loadPosConfig(service, tenantId);
    await service.from('pos_audit_events').insert({
      tenant_id: tenantId,
      actor_id: userId,
      event_type: 'actualizacion_configuracion',
      entity_type: 'pos_tenant_settings',
      entity_id: tenantId,
      description: 'Actualización de parámetros operativos del POS',
      metadata: validatedPagoMovil?.ok
        ? { ...patch, pago_movil_config: validatedPagoMovil.value }
        : patch,
    });
    return NextResponse.json({
      ok: true,
      settings: toClientSettings(updatedConfig.settings, updatedConfig.pagoMovilConfig),
    });
  }

  if (body.action === 'toggle_register') {
    const status = ['active', 'inactive', 'maintenance'].includes(body.status) ? body.status : null;
    if (!status) return NextResponse.json({ ok: false, error: 'Estado de caja inválido.' }, { status: 400 });
    const { data: reg, error } = await service
      .from('pos_registers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', String(body.register_id ?? ''))
      .select('*')
      .maybeSingle();
    if (error || !reg) return NextResponse.json({ ok: false, error: 'Caja no encontrada.' }, { status: 404 });
    await service.from('pos_audit_events').insert({
      tenant_id: tenantId,
      branch_id: reg.branch_id,
      actor_id: userId,
      event_type: 'estado_caja',
      entity_type: 'pos_registers',
      entity_id: reg.id,
      description: `Caja ${reg.name} actualizada a estado ${status}`,
    });
    return NextResponse.json({ ok: true, register: reg });
  }

  return NextResponse.json({ ok: false, error: 'Acción de configuración no reconocida.' }, { status: 400 });
}
