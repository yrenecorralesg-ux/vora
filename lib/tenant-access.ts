import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { isSuperAdmin, requireSession } from '@/lib/auth';

export async function requireTenantFeature(
  slug: string,
  featureKey: string,
): Promise<void> {
  const user = await requireSession();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/t/${slug}`)}`);

  const supabase = getSupabaseServerClient();
  // Consultas independientes en paralelo: 2 rondas a Supabase en lugar de 4.
  const [{ data: tenant }, admin] = await Promise.all([
    supabase.from('tenants').select('id,technical_status,commercial_status').eq('slug', slug).maybeSingle(),
    isSuperAdmin(user.id),
  ]);
  if (!tenant) redirect('/access-pending');

  const [{ data: membership }, { data: feature }] = await Promise.all([
    admin
      ? Promise.resolve({ data: { id: 'super_admin' } })
      : supabase
          .from('tenant_memberships')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('auth_user_id', user.id)
          .eq('status', 'active')
          .maybeSingle(),
    supabase
      .from('tenant_features')
      .select('enabled,contracted')
      .eq('tenant_id', tenant.id)
      .eq('feature_key', featureKey)
      .maybeSingle(),
  ]);
  if (!membership) redirect('/access-pending');

  const preview = admin && headers().get('x-vora-preview') === '1';
  if (
    !preview &&
    (tenant.technical_status !== 'ready' ||
      ['suspended', 'cancelled'].includes(tenant.commercial_status))
  )
    redirect(`/t/${slug}`);
  if (!feature?.enabled || !feature.contracted) redirect(`/t/${slug}`);
}


export async function requirePosPermission(
  slug: string,
  permission: string,
): Promise<{ tenantId: string; userId: string; role: string }> {
  const user = await requireSession();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/t/${slug}/pos`)}`);

  const supabase = getSupabaseServerClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, technical_status, commercial_status')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) redirect('/access-pending');

  const admin = await isSuperAdmin(user.id, supabase);
  let userRole = 'super_admin';

  if (!admin) {
    const { data: membership } = await supabase
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) redirect('/access-pending');
    userRole = membership.role;

    if (userRole !== 'tenant_admin') {
      const { data: perm } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role_key', userRole)
        .eq('permission', permission)
        .eq('scope', 'tenant')
        .maybeSingle();

      if (!perm) redirect(`/t/${slug}`);
    }
  }

  return { tenantId: tenant.id, userId: user.id, role: userRole };
}
