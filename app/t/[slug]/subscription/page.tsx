import { redirect } from 'next/navigation';
import { BillingPanel } from '@/components/billing-panel';
import { requireSession, isSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
export default async function SubscriptionPage({
  params,
}: {
  params: { slug: string };
}) {
  const db = getSupabaseServerClient(),
    user = await requireSession(db);
  if (!user) redirect('/login');
  const { data: tenant } = await db
    .from('tenants')
    .select('id')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!tenant) redirect('/access-pending');
  const { data: m } = await db
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenant.id)
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (
    !(await isSuperAdmin(user.id, db)) &&
    (!m || !['tenant_admin', 'admin'].includes(m.role))
  )
    redirect('/access-pending');
  return <BillingPanel slug={params.slug} />;
}
