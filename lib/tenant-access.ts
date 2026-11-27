import { redirect } from 'next/navigation';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { getTenantSession } from '@/lib/tenant-session';
import { hasTenantPermission } from '@/lib/tenant-api-auth';
import { canAccessModule, canAccessTenantFeature, homePathForRole } from '@/lib/role-modules';

export async function requireTenantFeature(
  slug: string,
  featureKey: string,
): Promise<void> {
  const tenantSession = await getTenantSession(slug);
  if (!tenantSession || tenantSession.slug.toLowerCase() !== slug.toLowerCase()) {
    redirect(`/t/${slug}/login`);
  }

  const service = getSupabaseServiceClient();
  const [{ data: tenant }, { data: membership }] = await Promise.all([
    service
      .from('tenants')
      .select('id,technical_status,commercial_status')
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

  if (!tenant || !membership) redirect(`/t/${slug}/login`);
  if (!canAccessTenantFeature(membership.role, featureKey)) {
    redirect(homePathForRole(slug, membership.role));
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
  if (!tenantSession || tenantSession.slug.toLowerCase() !== slug.toLowerCase()) {
    redirect(`/t/${slug}/login`);
  }

  const service = getSupabaseServiceClient();
  const [{ data: tenant }, { data: membership }] = await Promise.all([
    service
      .from('tenants')
      .select('id, technical_status, commercial_status')
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

  if (!tenant || !membership) redirect(`/t/${slug}/login`);
  if (!canAccessModule(membership.role, 'pos')) {
    redirect(homePathForRole(slug, membership.role));
  }

  const allowed = await hasTenantPermission(
    {
      tenantId: tenant.id,
      userId: tenantSession.userId,
      role: membership.role,
      email: tenantSession.email,
    },
    permission,
  );
  if (!allowed) redirect(`/t/${slug}`);

  return { tenantId: tenant.id, userId: tenantSession.userId, role: membership.role };
}
