import { redirect } from 'next/navigation';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { getTenantSession } from '@/lib/tenant-session';
import { canAccessModule, homePathForRole } from '@/lib/role-modules';

export const dynamic = 'force-dynamic';

/**
 * Guardia de páginas del módulo POS (/t/[slug]/pos/*):
 * exige sesión de la empresa y rol habilitado para POS; roles de otros
 * módulos son redirigidos a su propio módulo.
 */
export default async function PosModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const tenantSession = await getTenantSession(params.slug);
  if (!tenantSession || tenantSession.slug.toLowerCase() !== params.slug.toLowerCase()) {
    redirect(`/t/${params.slug}/login`);
  }

  const service = getSupabaseServiceClient();
  const [{ data: tenant }, { data: membership }] = await Promise.all([
    service.from('tenants').select('id').eq('slug', params.slug).maybeSingle(),
    service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantSession.tenantId)
      .eq('auth_user_id', tenantSession.userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (!tenant || !membership) {
    redirect(`/t/${params.slug}/login`);
  }

  if (!canAccessModule(membership.role, 'pos')) {
    redirect(homePathForRole(params.slug, membership.role));
  }

  return <>{children}</>;
}
