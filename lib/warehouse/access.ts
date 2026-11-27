import 'server-only';
import * as React from 'react';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeTenantModuleApi, type TenantApiAccess } from '@/lib/tenant-api-auth';
import { isSuperAdmin, requireSession } from '@/lib/auth';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { getTenantSession } from '@/lib/tenant-session';
import { getTenantConfigRoles } from '@/lib/config-permissions';
import { canAccessModule, homePathForRole } from '@/lib/role-modules';

export const WAREHOUSE_FEATURE = 'warehouse.inventory';

/** Permisos granulares de la sección 7 del documento. */
export const WAREHOUSE_PERMISSIONS = [
  'catalog.create',
  'stock.receive',
  'stock.issue',
  'stock.return',
  'stock.transfer',
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
export type WarehouseFunction =
  | 'wh_dashboard'
  | 'wh_catalog'
  | 'wh_stock'
  | 'wh_receipts'
  | 'wh_issues'
  | 'wh_adjustments'
  | 'wh_returns'
  | 'wh_transfers'
  | 'wh_kardex'
  | 'wh_scanner'
  | 'wh_warehouses'
  | 'wh_imports'
  | 'wh_suppliers'
  | 'wh_reports'
  | 'wh_pos_integration'
  | 'wh_settings'
  | 'wh_sector'
  | 'wh_attributes'
  | 'wh_units'
  | 'wh_roles';

export interface WarehouseContext extends TenantApiAccess {
  tenantName: string;
  permissions: Set<string>;
  functions: Record<WarehouseFunction, boolean>;
  service: SupabaseClient;
  can: (permission: WarehousePermission) => boolean;
  /** Almacenes permitidos al usuario; null = todos los de la empresa. */
  allowedWarehouses: string[] | null;
  canUseWarehouse: (warehouseId: string | null | undefined) => boolean;
}

/** Roles con todos los permisos (no se editan en la matriz). */
export const FULL_ACCESS_ROLES = ['super_admin', 'tenant_admin'];

/**
 * Permisos efectivos de un rol en una empresa: los de role_permissions, con los
 * de Warehouse sustituidos por la matriz de la empresa si existe (WH-12).
 */
export async function resolveRolePermissions(service: SupabaseClient, tenantId: string, role: string): Promise<Set<string>> {
  const [{ data: defaults }, { data: matrix }, customConfigRoles] = await Promise.all([
    service.from('role_permissions').select('permission').eq('role_key', role).eq('scope', 'tenant'),
    service.from('tenant_role_matrix').select('permissions').eq('tenant_id', tenantId).eq('role_key', role).maybeSingle(),
    getTenantConfigRoles(service, tenantId),
  ]);
  const base = new Set((defaults ?? []).map((r) => r.permission as string));
  const wh = new Set<string>(WAREHOUSE_PERMISSIONS);
  const result = matrix
    ? new Set(Array.from(base).filter((p) => !wh.has(p)))
    : base;
  if (matrix) {
    for (const p of (matrix.permissions ?? []) as string[]) if (wh.has(p)) result.add(p);
  }
  if (customConfigRoles !== null && !FULL_ACCESS_ROLES.includes(role)) {
    if (customConfigRoles.includes(role)) result.add('warehouse.configure');
    else result.delete('warehouse.configure');
  }
  return result;
}

type Loaded =
  | { ok: true; ctx: WarehouseContext }
  | { ok: false; status: number; error: string; reason: 'suspended' | 'inactive' | 'setup' };

interface TenantSnapshot {
  commercial_name: string;
  commercial_status: string;
}

/**
 * Comprueba módulo contratado/activo, carga permisos del rol y prepara la configuración inicial.
 * Las consultas independientes van en paralelo (2 rondas en lugar de 5): cada ida y vuelta a
 * Supabase cuesta ~150-200 ms y se pagaba en cada cambio de sección.
 */
async function loadContext(access: TenantApiAccess, knownTenant?: TenantSnapshot | null): Promise<Loaded> {
  const service = getSupabaseServiceClient();
  const fullAccess = FULL_ACCESS_ROLES.includes(access.role);
  const [tenantRes, { data: feature }, { data: settings }, permissions, scopesRes] = await Promise.all([
    knownTenant
      ? Promise.resolve({ data: knownTenant })
      : service.from('tenants').select('commercial_name, commercial_status').eq('id', access.tenantId).maybeSingle(),
    service
      .from('tenant_features')
      .select('enabled, contracted, config')
      .eq('tenant_id', access.tenantId)
      .eq('feature_key', WAREHOUSE_FEATURE)
      .maybeSingle(),
    service.from('warehouse_settings').select('tenant_id').eq('tenant_id', access.tenantId).maybeSingle(),
    fullAccess
      ? Promise.resolve(new Set<string>(WAREHOUSE_PERMISSIONS))
      : resolveRolePermissions(service, access.tenantId, access.role),
    // Alcance por almacén: sin filas, el usuario opera en todos.
    fullAccess
      ? Promise.resolve({ data: null as { warehouse_id: string }[] | null })
      : service.from('warehouse_user_scopes').select('warehouse_id').eq('tenant_id', access.tenantId).eq('auth_user_id', access.userId),
  ]);
  const tenant = tenantRes.data as TenantSnapshot | null;
  if (!tenant || ['suspended', 'cancelled'].includes(tenant.commercial_status))
    return { ok: false, status: 403, error: 'La operación de la empresa no está habilitada.', reason: 'suspended' };
  if (!feature?.enabled || !feature.contracted)
    return { ok: false, status: 403, error: 'El módulo de inventario no está activo para esta empresa.', reason: 'inactive' };

  const scopes = scopesRes.data;
  const allowedWarehouses: string[] | null = scopes && scopes.length ? scopes.map((s) => s.warehouse_id as string) : null;

  const configured = ((feature.config as { functions?: Record<string, boolean> } | null)?.functions ?? {});
  const fn = (key: WarehouseFunction) => configured[key] ?? true;

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
        wh_dashboard: fn('wh_dashboard'),
        wh_catalog: fn('wh_catalog'),
        wh_stock: fn('wh_stock'),
        wh_receipts: fn('wh_receipts'),
        wh_issues: fn('wh_issues'),
        wh_adjustments: fn('wh_adjustments'),
        wh_returns: fn('wh_returns'),
        wh_transfers: fn('wh_transfers'),
        wh_kardex: fn('wh_kardex'),
        wh_scanner: fn('wh_scanner'),
        wh_warehouses: fn('wh_warehouses'),
        wh_imports: fn('wh_imports'),
        wh_suppliers: fn('wh_suppliers'),
        wh_reports: fn('wh_reports'),
        wh_pos_integration: fn('wh_pos_integration'),
        wh_settings: fn('wh_settings'),
        wh_sector: fn('wh_sector'),
        wh_attributes: fn('wh_attributes'),
        wh_units: fn('wh_units'),
        wh_roles: fn('wh_roles'),
      },
      service,
      can: (p) => permissions.has(p),
      allowedWarehouses,
      canUseWarehouse: (id) => !allowedWarehouses || (Boolean(id) && allowedWarehouses.includes(String(id))),
    },
  };
}

export type WarehouseApiResult = { ok: true; ctx: WarehouseContext } | { ok: false; response: NextResponse };

/** Guardia de las rutas API de Warehouse. */
export async function authorizeWarehouse(
  slug: string,
  opts: { permission?: WarehousePermission; anyOf?: string[]; fn?: WarehouseFunction } = {},
): Promise<WarehouseApiResult> {
  const auth = await authorizeTenantModuleApi(slug, 'warehouse');
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

type PageLoad =
  | { ok: true; ctx: WarehouseContext }
  | { ok: false; to: string };

/**
 * Contexto de la página, memoizado por petición: el layout y la página lo piden en la misma
 * petición y antes se resolvía dos veces. Sin React.cache (fuera de Next) no memoiza.
 */
const memo: <T extends (...args: never[]) => unknown>(fn: T) => T =
  ((React as unknown as { cache?: <T>(fn: T) => T }).cache) ?? ((fn) => fn);

const loadPageContext = memo(async (slug: string): Promise<PageLoad> => {
  const tenantSession = await getTenantSession(slug);
  if (!tenantSession || tenantSession.slug.toLowerCase() !== slug.toLowerCase()) {
    return { ok: false, to: `/t/${slug}/login` };
  }

  const service = getSupabaseServiceClient();
  const [{ data: tenant }, { data: membership }] = await Promise.all([
    service
      .from('tenants')
      .select('id, commercial_name, commercial_status')
      .eq('slug', slug)
      .maybeSingle(),
    service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantSession.tenantId)
      .eq('auth_user_id', tenantSession.userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (!tenant || !membership) return { ok: false, to: `/t/${slug}/login` };
  if (!canAccessModule(membership.role, 'warehouse')) {
    return { ok: false, to: homePathForRole(slug, membership.role) };
  }

  const loaded = await loadContext(
    {
      tenantId: tenant.id,
      userId: tenantSession.userId,
      role: membership.role,
      email: tenantSession.email ?? null,
    },
    tenant,
  );
  if (!loaded.ok) return { ok: false, to: `/t/${slug}/warehouse/inactive?reason=${loaded.reason}` };
  return { ok: true, ctx: loaded.ctx };
});

/** Guardia de las páginas: redirige en lugar de responder JSON. */
export async function requireWarehousePage(
  slug: string,
  opts: { permission?: WarehousePermission; fn?: WarehouseFunction } = {},
): Promise<WarehouseContext> {
  const loaded = await loadPageContext(slug);
  if (!loaded.ok) redirect(loaded.to);
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
