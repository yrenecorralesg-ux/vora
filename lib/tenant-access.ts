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
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id,technical_status,commercial_status')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) redirect('/access-pending');

  const admin = await isSuperAdmin(user.id);
  if (!admin) {
    const { data: membership } = await supabase
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) redirect('/access-pending');
  }

  if (
    tenant.technical_status !== 'ready' ||
    ['suspended', 'cancelled'].includes(tenant.commercial_status)
  )
    redirect(`/t/${slug}`);
  const { data: feature } = await supabase
    .from('tenant_features')
    .select('enabled,contracted')
    .eq('tenant_id', tenant.id)
    .eq('feature_key', featureKey)
    .maybeSingle();
  if (!feature?.enabled || !feature.contracted) redirect(`/t/${slug}`);
}
