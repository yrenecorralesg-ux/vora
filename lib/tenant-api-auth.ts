import 'server-only';
import { NextResponse } from 'next/server';
import { isSuperAdmin, requireSession } from '@/lib/auth';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';

export interface TenantApiAccess {
  tenantId: string;
  userId: string;
  /** Rol de la membresía, o 'super_admin' para Venesoft. */
  role: string;
  /** Correo de la sesión, para registrar quién autoriza una operación. */
  email: string | null;
}

export type TenantApiAuthResult =
  | { ok: true; access: TenantApiAccess }
  | { ok: false; response: NextResponse };

/**
 * Autorización común de las rutas /api/t/[slug]/*: exige sesión y membresía
 * activa en el tenant del slug (o Super Admin). Las consultas posteriores con
 * el cliente de servicio DEBEN filtrar por access.tenantId.
 */
export async function authorizeTenantApi(
  slug: string,
): Promise<TenantApiAuthResult> {
  const session = getSupabaseServerClient();
  const user = await requireSession(session);
  if (!user)
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }),
    };

  const denied = {
    ok: false as const,
    response: NextResponse.json({ error: 'Sin acceso.' }, { status: 403 }),
  };

  const service = getSupabaseServiceClient();
  // Empresa y rol de plataforma son independientes: se consultan en paralelo.
  const [{ data: tenant }, admin] = await Promise.all([
    service.from('tenants').select('id').eq('slug', slug).maybeSingle(),
    isSuperAdmin(user.id, session),
  ]);
  if (!tenant) return denied;

  if (admin)
    return { ok: true, access: { tenantId: tenant.id, userId: user.id, role: 'super_admin', email: user.email ?? null } };

  const { data: membership } = await service
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenant.id)
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return denied;

  return {
    ok: true,
    access: { tenantId: tenant.id, userId: user.id, role: membership.role, email: user.email ?? null },
  };
}

/** Roles con todos los permisos del tenant. */
const FULL_ACCESS_ROLES = new Set(['super_admin', 'tenant_admin']);

/**
 * Comprueba un permiso de acción (p. ej. 'pos.sales.create') para el rol de la
 * membresía ya autorizada, según role_permissions (scope 'tenant').
 */
export async function hasTenantPermission(
  access: TenantApiAccess,
  permission: string,
): Promise<boolean> {
  if (FULL_ACCESS_ROLES.has(access.role)) return true;
  const { data } = await getSupabaseServiceClient()
    .from('role_permissions')
    .select('permission')
    .eq('role_key', access.role)
    .eq('permission', permission)
    .eq('scope', 'tenant')
    .maybeSingle();
  return Boolean(data);
}

/** Respuesta 403 estándar cuando falta un permiso de acción. */
export function permissionDenied(message = 'No tienes permiso para esta operación.'): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}
