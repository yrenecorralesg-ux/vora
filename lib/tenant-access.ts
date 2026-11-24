import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin, requireSession } from '@/lib/auth';
import { getTenantSession } from '@/lib/tenant-session';

export async function requireTenantFeature(
  slug: string,
  featureKey: string,
): Promise<void> {
  const tenantSession = await getTenantSession(slug);

  const service = getSupabaseServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id,technical_status,commercial_status')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) redirect(`/t/${slug}/login`);

  let userId: string;
  let userRole: string;

  if (tenantSession && tenantSession.slug.toLowerCase() === slug.toLowerCase()) {
    userId = tenantSession.userId;
    userRole = tenantSession.role;
  } else {
    // Si no hay cookie de empresa, verificar si hay sesión con membresía activa
    const user = await requireSession();
    if (!user) redirect(`/t/${slug}/login`);

    const { data: membership } = await service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) redirect(`/t/${slug}/login`);
    userId = user.id;
    userRole = membership.role;
  }

  const { data: feature } = await service
    .from('tenant_features')
    .select('enabled,contracted')
    .eq('tenant_id', tenant.id)
    .eq('feature_key', featureKey)
    .maybeSingle();

  if (
    tenant.technical_status !== 'ready' ||
    ['suspended', 'cancelled'].includes(tenant.commercial_status)
  ) {
    redirect(`/t/${slug}`);
  }

  if (!feature?.enabled || !feature.contracted) {
    redirect(`/t/${slug}`);
  }
}

export async function requirePosPermission(
  slug: string,
  permission: string,
): Promise<{ tenantId: string; userId: string; role: string }> {
  const tenantSession = await getTenantSession(slug);

  const service = getSupabaseServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id, technical_status, commercial_status')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) redirect(`/t/${slug}/login`);

  let userId: string;
  let userRole: string;

  if (tenantSession && tenantSession.slug.toLowerCase() === slug.toLowerCase()) {
    userId = tenantSession.userId;
    userRole = tenantSession.role;
  } else {
    const user = await requireSession();
    if (!user) redirect(`/t/${slug}/login`);

    const { data: membership } = await service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) redirect(`/t/${slug}/login`);
    userId = user.id;
    userRole = membership.role;
  }

  if (userRole !== 'tenant_admin' && userRole !== 'pos_store_admin') {
    const { data: perm } = await service
      .from('role_permissions')
      .select('id')
      .eq('role_key', userRole)
      .eq('permission', permission)
      .eq('scope', 'tenant')
      .maybeSingle();

    if (!perm) redirect(`/t/${slug}`);
  }

  return { tenantId: tenant.id, userId, role: userRole };
}
