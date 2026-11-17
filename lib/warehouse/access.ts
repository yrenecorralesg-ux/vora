import 'server-only';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeTenantApi, type TenantApiAccess } from '@/lib/tenant-api-auth';
import { isSuperAdmin, requireSession } from '@/lib/auth';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

export const WAREHOUSE_FEATURE = 'warehouse.inventory';

/** Permisos granulares de la sección 7 del documento. */
export const WAREHOUSE_PERMISSIONS = [
  'catalog.create',
  'stock.receive',
  'stock.issue',
  'stock.return',
  'stock.adjust.request',
  'stock.adjust.approve',
  'import.validate',
  'import.apply',
  'cost.view',
  'report.view',
  'warehouse.configure',
] as const;
export type WarehousePermission = (typeof WAREHOUSE_PERMISSIONS)[number];

/** Funciones del módulo activables por empresa desde Core. */
export type WarehouseFunction = 'wh_imports' | 'wh_scanner' | 'wh_pos_integration' | 'wh_reports';

export interface WarehouseContext extends TenantApiAccess {
  tenantName: string;
  permissions: Set<string>;
  functions: Record<WarehouseFunction, boolean>;
  service: SupabaseClient;
  can: (permission: WarehousePermission) => boolean;
}

type Loaded =
  | { ok: true; ctx: WarehouseContext }
  | { ok: false; status: number; error: string; reason: 'suspended' | 'inactive' | 'setup' };

/** Comprueba módulo contratado/activo, carga permisos del rol y prepara la configuración inicial. */
async function loadContext(access: TenantApiAccess): Promise<Loaded> {
  const service = getSupabaseServiceClient();
  const [{ data: tenant }, { data: feature }] = await Promise.all([
    service.from('tenants').select('commercial_name, commercial_status').eq('id', access.tenantId).maybeSingle(),
    service
      .from('tenant_features')
      .select('enabled, contracted, config')
      .eq('tenant_id', access.tenantId)
      .eq('feature_key', WAREHOUSE_FEATURE)
      .maybeSingle(),
  ]);
  if (!tenant || ['suspended', 'cancelled'].includes(tenant.commercial_status))
    return { ok: false, status: 403, error: 'La operación de la empresa no está habilitada.', reason: 'suspended' };
  if (!feature?.enabled || !feature.contracted)
    return { ok: false, status: 403, error: 'El módulo de inventario no está activo para esta empresa.', reason: 'inactive' };

  const fullAccess = access.role === 'super_admin' || access.role === 'tenant_admin';
  let permissions = new Set<string>(fullAccess ? WAREHOUSE_PERMISSIONS : []);
  if (!fullAccess) {
    const { data } = await service
      .from('role_permissions')
      .select('permission')
      .eq('role_key', access.role)
      .eq('scope', 'tenant');
    permissions = new Set((data ?? []).map((r) => r.permission as string));
  }

  const configured = ((feature.config as { functions?: Record<string, boolean> } | null)?.functions ?? {});
  const fn = (key: WarehouseFunction) => configured[key] ?? true;

  const { data: settings } = await service
    .from('warehouse_settings')
    .select('tenant_id')
    .eq('tenant_id', access.tenantId)
    .maybeSingle();
  if (!settings) {
    const { error } = await service.rpc('warehouse_bootstrap', { p_tenant: access.tenantId });
    if (error) return { ok: false, status: 500, error: 'No se pudo preparar el inventario.', reason: 'setup' };
  }

  return {
    ok: true,
    ctx: {
      ...access,
      tenantName: tenant.commercial_name,
      permissions,
      functions: {
        wh_imports: fn('wh_imports'),
        wh_scanner: fn('wh_scanner'),
        wh_pos_integration: fn('wh_pos_integration'),
        wh_reports: fn('wh_reports'),
      },
      service,
      can: (p) => permissions.has(p),
    },
  };
}

export type WarehouseApiResult = { ok: true; ctx: WarehouseContext } | { ok: false; response: NextResponse };

/** Guardia de las rutas API de Warehouse. */
export async function authorizeWarehouse(
  slug: string,
  opts: { permission?: WarehousePermission; anyOf?: string[]; fn?: WarehouseFunction } = {},
): Promise<WarehouseApiResult> {
  const auth = await authorizeTenantApi(slug);
  if (!auth.ok) return auth;
  const loaded = await loadContext(auth.access);
  if (!loaded.ok)
    return { ok: false, response: NextResponse.json({ error: loaded.error }, { status: loaded.status }) };
  const { ctx } = loaded;
  const denied = () => ({
    ok: false as const,
    response: NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 }),
  });
  if (opts.fn && !ctx.functions[opts.fn])
    return { ok: false, response: NextResponse.json({ error: 'Función no activada para esta empresa.' }, { status: 403 }) };
  if (opts.permission && !ctx.can(opts.permission)) return denied();
  if (opts.anyOf && !opts.anyOf.some((p) => ctx.permissions.has(p))) return denied();
  return { ok: true, ctx };
}

/** Guardia de las páginas: redirige en lugar de responder JSON. */
export async function requireWarehousePage(
  slug: string,
  opts: { permission?: WarehousePermission; fn?: WarehouseFunction } = {},
): Promise<WarehouseContext> {
  const session = getSupabaseServerClient();
  const user = await requireSession(session);
  if (!user) redirect(`/t/${slug}/login`);
  const service = getSupabaseServiceClient();
  const { data: tenant } = await service.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (!tenant) redirect('/access-pending');

  let role = 'super_admin';
  if (!(await isSuperAdmin(user.id, session))) {
    const { data: membership } = await service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) redirect('/access-pending');
    role = membership.role;
  }

  const loaded = await loadContext({ tenantId: tenant.id, userId: user.id, role });
  if (!loaded.ok) redirect(`/t/${slug}/warehouse/inactive?reason=${loaded.reason}`);
  const { ctx } = loaded;
  if (opts.fn && !ctx.functions[opts.fn]) redirect(`/t/${slug}/warehouse`);
  if (opts.permission && !ctx.can(opts.permission)) redirect(`/t/${slug}/warehouse`);
  return ctx;
}

/** Registro de cambios de configuración y catálogo (sección 11: cambios auditables). */
export async function auditWarehouse(
  ctx: WarehouseContext,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await ctx.service.from('warehouse_audit_events').insert({
    tenant_id: ctx.tenantId,
    actor_id: ctx.userId,
    action,
    entity,
    entity_id: entityId,
    details,
  });
}

/** Traduce errores de PostgreSQL a mensajes para el usuario sin filtrar detalles internos. */
export function dbErrorResponse(error: { code?: string; message?: string } | null, fallback = 'No se pudo completar la operación.') {
  if (!error) return NextResponse.json({ error: fallback }, { status: 500 });
  if (error.code === '23505')
    return NextResponse.json({ error: 'Ya existe un registro con ese código o nombre.' }, { status: 409 });
  if (error.code === '23503')
    return NextResponse.json({ error: 'El registro está en uso o hace referencia a un dato inexistente.' }, { status: 409 });
  if (error.code === '23514')
    return NextResponse.json({ error: 'Algún valor no cumple las reglas permitidas.' }, { status: 400 });
  // P0001: excepciones RAISE de las funciones, redactadas para el usuario.
  if (error.code === 'P0001' && error.message)
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}
