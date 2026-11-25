import { redirect } from 'next/navigation';
import { requireSession, isSuperAdmin } from '@/lib/auth';
import { canPreviewTenant, parseTenantBanners } from '@/lib/tenant-preview';
import { hasConfigPermission } from '@/lib/tenant-api-auth';
import {
  TenantDashboardPreview,
  type PreviewModule,
} from '@/components/tenant-dashboard-preview';

import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function TenantDashboardPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { preview?: string };
}) {
  const core = getSupabaseServerClient();
  const { data: profile } = await core
    .from('tenants')
    .select('id,commercial_name,technical_status')
    .eq('slug', params.slug)
    .maybeSingle();
  const viewer = await requireSession(core);
  if (profile && viewer) {
    const admin = await isSuperAdmin(viewer.id, core);
    const { data: member } = await core
      .from('tenant_memberships')
      .select('id,role')
      .eq('tenant_id', profile.id)
      .eq('auth_user_id', viewer.id)
      .eq('status', 'active')
      .maybeSingle();
    const preview = canPreviewTenant(admin, searchParams.preview === '1', !!member);
    const canConfig =
      admin ||
      (member
        ? await hasConfigPermission({
            tenantId: profile.id,
            userId: viewer.id,
            role: member.role,
            email: viewer.email ?? null,
          })
        : false);
    if (preview || profile.technical_status === 'ready') {
      const [{ data: brand }, { data: assignments }] = await Promise.all([
        core
          .from('tenant_branding')
          .select(
            'primary_color,secondary_color,accent_color,logo_url,banner_url',
          )
          .eq('tenant_id', profile.id)
          .maybeSingle(),
        core
          .from('tenant_features')
          .select('feature_key,enabled,contracted,features(name,description)')
          .eq('tenant_id', profile.id),
      ]);
      // El portal de la empresa abre su sistema operativo principal: POS si lo
      // tiene activo; si solo tiene Warehouse, Warehouse; si no, el panel CRM.
      const active = (key: string) =>
        assignments?.some((row) => row.feature_key === key && row.enabled && row.contracted) ?? false;
      if (!preview) {
        if (active('commerce.pos')) redirect(`/t/${params.slug}/pos`);
        if (active('warehouse.inventory') && !active('crm.dashboard')) redirect(`/t/${params.slug}/warehouse`);
        // Acceso de cliente: mantiene las comprobaciones de estado, membresía y contratación.
        await requireTenantFeature(params.slug, 'crm.dashboard');
      }

      const modules: PreviewModule[] = (assignments ?? [])
        .filter((row) => row.contracted || row.enabled)
        .map((row) => {
          const feature = Array.isArray(row.features)
            ? row.features[0]
            : row.features;
          return {
            key: row.feature_key,
            name: feature?.name ?? row.feature_key,
            description: feature?.description ?? '',
            enabled: row.enabled,
            contracted: row.contracted,
          };
        });
      return (
        <TenantDashboardPreview
          name={profile.commercial_name}
          tenantId={profile.id}
          logoUrl={brand?.logo_url ?? null}
          bannerUrl={parseTenantBanners(brand?.banner_url).header}
          primary={brand?.primary_color ?? '#285C49'}
          secondary={brand?.secondary_color ?? '#A9BEA5'}
          accent={brand?.accent_color ?? '#C97857'}
          modules={modules}
          canConfigure={canConfig}
          preview={preview}
        />
      );
    }
  }
  if (profile?.technical_status !== 'ready')
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8">
        <h1 className="text-2xl font-bold">
          {profile?.commercial_name ?? 'VORA'}
        </h1>
        <p className="mt-3">
          Tu espacio empresarial está creado. Estamos preparando los servicios
          contratados.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada configuración se completa de forma independiente desde VORA Core.
          Los módulos estarán disponibles después de su validación.
        </p>
      </div>
    );
  await requireTenantFeature(params.slug, 'crm.dashboard');
  return null;
}
