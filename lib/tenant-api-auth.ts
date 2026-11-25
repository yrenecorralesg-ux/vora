import 'server-only';
import { NextResponse } from 'next/server';
import { isSuperAdmin, requireSession } from '@/lib/auth';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import { getTenantSession } from '@/lib/tenant-session';
import { getTenantConfigRoles } from '@/lib/config-permissions';

export interface TenantApiAccess {
  tenantId: string;
  userId: string;
  /** Rol de la membresía en la empresa. */
  role: string;
  /** Correo de la sesión, para registrar quién autoriza una operación. */
  email: string | null;
}

export type TenantApiAuthResult =
  | { ok: true; access: TenantApiAccess }
  | { ok: false; response: NextResponse };

/**
 * Autorización común de las rutas /api/t/[slug]/*: exige sesión activa
 * y membresía exclusiva en el tenant del slug.
 * Los tokens del Gestor de Gestores (super_admin sin membresía en la empresa)
 * son rechazados para garantizar el aislamiento total por empresa.
 */
export async function authorizeTenantApi(
  slug: string,
): Promise<TenantApiAuthResult> {
  // 1. Prioridad: Sesión dedicada de empresa mediante cookie vora_session_[slug]
  try {
    const tenantSession = await getTenantSession(slug);
    if (tenantSession && tenantSession.slug.toLowerCase() === slug.toLowerCase()) {
      return {
        ok: true,
        access: {
          tenantId: tenantSession.tenantId,
          userId: tenantSession.userId,
          role: tenantSession.role,
          email: tenantSession.email,
        },
      };
    }
  } catch {
    // Si no se puede leer el cookieStore, continuar con la verificación estándar
  }

  // 2. Sesión estándar de Supabase Auth
  const session = getSupabaseServerClient();
  const user = await requireSession(session);
  if (!user)
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }),
    };

  const denied = {
    ok: false as const,
    response: NextResponse.json({ error: 'Sin acceso a esta empresa.' }, { status: 403 }),
  };

  const service = getSupabaseServiceClient();
  const { data: tenant } = await service.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (!tenant) return denied;

  // 3. Exigir membresía activa específica en esta empresa
  const { data: membership } = await service
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenant.id)
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return denied;
  }

  return {
    ok: true,
    access: { tenantId: tenant.id, userId: user.id, role: membership.role, email: user.email ?? null },
  };
}

/** Roles con todos los permisos del tenant. */
const FULL_ACCESS_ROLES = new Set(['super_admin', 'tenant_admin']);

/**
 * Comprueba un permiso de acción (p. ej. 'pos.sales.create') para el rol de la
 * membresía ya autorizada, según role_permissions (scope 'tenant') y las
 * políticas de configuración definidas desde Gestor de Gestores.
 */
export async function hasTenantPermission(
  access: TenantApiAccess,
  permission: string,
): Promise<boolean> {
  if (FULL_ACCESS_ROLES.has(access.role)) return true;
  const service = getSupabaseServiceClient();
  if (permission === 'pos.settings.manage') {
    const customRoles = await getTenantConfigRoles(service, access.tenantId);
    if (customRoles !== null) {
      return customRoles.includes(access.role);
    }
  }
  const { data } = await service
    .from('role_permissions')
    .select('permission')
    .eq('role_key', access.role)
    .eq('permission', permission)
    .eq('scope', 'tenant')
    .maybeSingle();
  return Boolean(data);
}

/**
 * Comprueba si el rol tiene acceso a configuración general / de algún módulo en la empresa.
 */
export async function hasConfigPermission(access: TenantApiAccess): Promise<boolean> {
  if (FULL_ACCESS_ROLES.has(access.role)) return true;
  const service = getSupabaseServiceClient();
  const customRoles = await getTenantConfigRoles(service, access.tenantId);
  if (customRoles !== null) {
    return customRoles.includes(access.role);
  }
  const { data } = await service
    .from('role_permissions')
    .select('permission')
    .eq('role_key', access.role)
    .in('permission', ['pos.settings.manage', 'warehouse.configure'])
    .eq('scope', 'tenant')
    .limit(1);
  return Boolean(data && data.length > 0);
}

/** Respuesta 403 estándar cuando falta un permiso de acción. */
export function permissionDenied(message = 'No tienes permiso para esta operación.'): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}
