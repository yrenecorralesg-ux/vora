import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { PosClient } from './pos-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PosPage({ params }: { params: { slug: string } }) {
  const supabase = getSupabaseServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, commercial_name, slug, currency, country, commercial_status, tenant_branding(*)')
    .eq('slug', params.slug)
    .maybeSingle();

  const rawBranding = Array.isArray(tenant?.tenant_branding)
    ? tenant?.tenant_branding[0]
    : tenant?.tenant_branding;

  return (
    <PosClient
      initialSlug={params.slug}
      initialTenant={
        tenant
          ? {
              id: tenant.id,
              commercial_name: tenant.commercial_name,
              currency: tenant.currency,
              country: tenant.country,
            }
          : null
      }
      initialBranding={rawBranding || null}
    />
  );
}
