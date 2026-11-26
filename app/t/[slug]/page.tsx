import { redirect } from 'next/navigation';
import { requireSession, isSuperAdmin } from '@/lib/auth';
import { canPreviewTenant, parseTenantBanners } from '@/lib/tenant-preview';
import {
  TenantDashboardPreview,
  type PreviewModule,
} from '@/components/tenant-dashboard-preview';

import { getTenantSession } from '@/lib/tenant-session';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function TenantDashboardPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { preview?: string };
}) {
  const tenantSession = await getTenantSession(params.slug);
  const service = getSupabaseServiceClient();
  const core = getSupabaseServerClient();
  const db = tenantSession ? service : core;

  const { data: profile } = await db
    .from('tenants')
    .select('id,commercial_name,technical_status')
    .eq('slug', params.slug)
    .maybeSingle();

  const viewer = tenantSession ? null : await requireSession(core);
  if (profile && (viewer || tenantSession)) {
    const admin = viewer ? await isSuperAdmin(viewer.id, core) : false;
    const actorUserId = tenantSession?.userId ?? viewer?.id ?? '';
    const { data: member } = await db
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', profile.id)
      .eq('auth_user_id', actorUserId)
      .eq('status', 'active')
      .maybeSingle();
    const preview = viewer ? canPreviewTenant(admin, searchParams.preview === '1', !!member) : false;
    if (preview || (profile.technical_status === 'ready' && (admin || !!member))) {
      const [{ data: brand }, { data: assignments }] = await Promise.all([
        db
          .from('tenant_branding')
          .select(
            'primary_color,secondary_color,accent_color,logo_url,banner_url',
          )
          .eq('tenant_id', profile.id)
          .maybeSingle(),
        db
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
          canConfigure={admin}
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
