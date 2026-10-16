import { getSupabaseServerClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SessionUser {
  id: string;
  email: string;
}

export async function requireSession(
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<SessionUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? '' };
}

export async function isSuperAdmin(
  userId: string,
  supabase: SupabaseClient = getSupabaseServerClient(),
): Promise<boolean> {
  const { data } = await supabase
    .from('platform_user_roles')
    .select('role_id, platform_roles!inner(key)')
    .eq('user_id', userId);
  if (!data) return false;
  return data.some((r: { platform_roles: { key: string } | { key: string }[] }) => {
    const roles = Array.isArray(r.platform_roles) ? r.platform_roles : [r.platform_roles];
    return roles.some((pr) => pr?.key === 'super_admin');
  });
}

export async function requireSuperAdmin(): Promise<SessionUser | null> {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = await isSuperAdmin(user.id, supabase);
  if (!admin) return null;
  return { id: user.id, email: user.email ?? '' };
}

export async function getUserMemberships(
  userId: string,
  supabase: SupabaseClient = getSupabaseServerClient(),
) {
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select(`
      id,
      tenant_id,
      role,
      status,
      tenants!inner(
        id,
        commercial_name,
        slug,
        commercial_status,
        technical_status,
        tenant_branding(
          primary_color,
          secondary_color,
          logo_url
        )
      )
    `)
    .eq('auth_user_id', userId)
    .eq('status', 'active');
  if (error) return [];
  return data ?? [];
}
