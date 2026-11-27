export type VoraModule = 'pos' | 'warehouse' | 'crm';

export const FULL_CROSS_MODULE_ROLES = new Set(['super_admin', 'tenant_admin']);

export const POS_MODULE_ROLES = new Set([
  'super_admin',
  'tenant_admin',
  'pos_store_admin',
  'pos_supervisor',
  'pos_cashier',
  'pos_sales_rep',
  'pos_auditor',
]);

export const WAREHOUSE_MODULE_ROLES = new Set([
  'super_admin',
  'tenant_admin',
  'wh_manager',
  'wh_supervisor',
  'wh_clerk',
  'wh_scanner',
  'wh_auditor',
]);

export const CRM_MODULE_ROLES = new Set([
  'super_admin',
  'tenant_admin',
  'member',
]);

const POS_STAFF_MGMT_ROLES = new Set([
  'super_admin',
  'tenant_admin',
  'pos_store_admin',
  'pos_supervisor',
]);

const POS_AUDITOR_ALLOWED_VIEWS = new Set(['POS-12', 'POS-13', 'POS-16']);

export function isFullCrossModuleRole(role: string | null | undefined): boolean {
  return Boolean(role && FULL_CROSS_MODULE_ROLES.has(role));
}

export function canAccessModule(role: string | null | undefined, mod: VoraModule): boolean {
  if (!role) return false;
  if (mod === 'pos') return POS_MODULE_ROLES.has(role);
  if (mod === 'warehouse') return WAREHOUSE_MODULE_ROLES.has(role);
  return CRM_MODULE_ROLES.has(role);
}

export function canAccessTenantFeature(role: string | null | undefined, featureKey: string): boolean {
  if (!role) return false;
  if (isFullCrossModuleRole(role)) return true;
  if (featureKey === 'commerce.pos') return canAccessModule(role, 'pos');
  if (featureKey.startsWith('warehouse.')) return canAccessModule(role, 'warehouse');
  return canAccessModule(role, 'crm');
}

/** Operadores y administradores habilitados para operar o cambiar sesión dentro del POS. */
export function isPosOperatorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role === 'tenant_admin' || role.startsWith('pos_');
}

export function homePathForRole(slug: string, role: string | null | undefined): string {
  if (role && !isFullCrossModuleRole(role)) {
    if (canAccessModule(role, 'pos')) return `/t/${slug}/pos`;
    if (canAccessModule(role, 'warehouse')) return `/t/${slug}/warehouse`;
  }
  return `/t/${slug}`;
}

export function defaultPosViewForRole(role: string | null | undefined): 'POS-01' | 'POS-13' {
  return role === 'pos_auditor' ? 'POS-13' : 'POS-01';
}

export function canAccessPosView(params: {
  view: string;
  role: string | null | undefined;
  can: (permission: string) => boolean;
  isFuncActive: (funcKey: string) => boolean;
}): boolean {
  const { view, role, can, isFuncActive } = params;
  if (!role || !canAccessModule(role, 'pos')) return false;
  if (role === 'pos_auditor') {
    if (!POS_AUDITOR_ALLOWED_VIEWS.has(view)) return false;
    if (view === 'POS-16') return isFuncActive('pos_reports') && can('pos.reports.view');
    return true;
  }
  if (view === 'POS-16') {
    return isFuncActive('pos_reports') && can('pos.reports.view');
  }
  if (view === 'POS-19') {
    return isFuncActive('pos_supervisor_users_crud') && POS_STAFF_MGMT_ROLES.has(role);
  }
  if (view === 'POS-17' || view === 'POS-18') {
    return isFuncActive('pos_settings') && can('pos.settings.manage');
  }
  if (view === 'POS-20') {
    return isFuncActive('pos_order_dispatch_kds');
  }
  return true;
}
