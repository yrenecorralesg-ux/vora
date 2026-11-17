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
  const { data: tenant } = await service
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) return denied;

  if (await isSuperAdmin(user.id, session))
    return { ok: true, access: { tenantId: tenant.id, userId: user.id, role: 'super_admin' } };

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
    access: { tenantId: tenant.id, userId: user.id, role: membership.role },
  };
}
