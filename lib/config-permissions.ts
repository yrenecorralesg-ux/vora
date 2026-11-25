import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConfigurableRoleDef {
  key: string;
  label: string;
  group: 'empresa' | 'pos' | 'warehouse';
  locked?: boolean;
}

export const CONFIGURABLE_ROLES: ConfigurableRoleDef[] = [
  { key: 'tenant_admin', label: 'Administrador de Empresa (Acceso total)', group: 'empresa', locked: true },
  { key: 'pos_store_admin', label: 'Administrador de Tienda (POS)', group: 'pos' },
  { key: 'pos_supervisor', label: 'Supervisor de Caja (POS)', group: 'pos' },
  { key: 'pos_cashier', label: 'Cajero(a) (POS)', group: 'pos' },
  { key: 'pos_sales_rep', label: 'Asesor de Ventas (POS)', group: 'pos' },
  { key: 'pos_auditor', label: 'Auditor / Contador (POS)', group: 'pos' },
  { key: 'wh_manager', label: 'Administrador de Almacén (Warehouse)', group: 'warehouse' },
  { key: 'wh_supervisor', label: 'Supervisor de Almacén (Warehouse)', group: 'warehouse' },
  { key: 'wh_clerk', label: 'Almacenista (Warehouse)', group: 'warehouse' },
  { key: 'wh_scanner', label: 'Operador de Escaneo (Warehouse)', group: 'warehouse' },
  { key: 'wh_auditor', label: 'Auditor de Almacén (Warehouse)', group: 'warehouse' },
  { key: 'member', label: 'Miembro estándar CRM', group: 'empresa' },
];

export const VALID_CONFIG_ROLE_KEYS = new Set(CONFIGURABLE_ROLES.map((r) => r.key));

export const DEFAULT_CONFIG_ALLOWED_ROLES = ['tenant_admin', 'pos_store_admin', 'wh_manager'];

export const CONFIG_PRESETS = [
  {
    id: 'admin_only',
    label: 'Solo Admin. de Empresa',
    roles: ['tenant_admin'],
  },
  {
    id: 'admins',
    label: 'Administradores (Empresa, Tienda y Almacén)',
    roles: ['tenant_admin', 'pos_store_admin', 'wh_manager'],
  },
  {
    id: 'admins_supervisors',
    label: 'Administradores y Supervisores',
    roles: ['tenant_admin', 'pos_store_admin', 'pos_supervisor', 'wh_manager', 'wh_supervisor'],
  },
] as const;

export function normalizeConfigRoles(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const set = new Set<string>(['tenant_admin']);
  for (const item of raw) {
    if (typeof item === 'string' && VALID_CONFIG_ROLE_KEYS.has(item)) {
      set.add(item);
    }
  }
  return Array.from(set);
}

/**
 * Lee los roles autorizados a configurar módulos de la empresa (guardados en
 * tenant_features.crm.dashboard -> config.config_allowed_roles).
 * Devuelve null si aún no hay personalización explícita (aplica defaults del sistema).
 */
export async function getTenantConfigRoles(
  service: SupabaseClient,
  tenantId: string,
): Promise<string[] | null> {
  try {
    const { data } = await service
      .from('tenant_features')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('feature_key', 'crm.dashboard')
      .maybeSingle();
    const cfg = data?.config as Record<string, unknown> | null | undefined;
    return normalizeConfigRoles(cfg?.config_allowed_roles);
  } catch {
    return null;
  }
}
