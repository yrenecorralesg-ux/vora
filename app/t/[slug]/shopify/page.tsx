import { ShoppingBag, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';

export const dynamic = 'force-dynamic';

export default async function ShopifyPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'integration.shopify');

  const supabase = getSupabaseServerClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, commercial_name, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  const { data: branding } = await supabase
    .from('tenant_branding')
    .select('secondary_color, banner_url')
    .eq('tenant_id', tenant?.id ?? '')
    .maybeSingle();

  let headerBannerUrl: string | null = null;
  if (branding?.banner_url) {
    try {
      const parsed = JSON.parse(branding.banner_url);
      headerBannerUrl = parsed.header || null;
    } catch {
      headerBannerUrl = branding.banner_url;
    }
  }

  const isSolee = params.slug === 'solee';
  const tenantName = tenant?.commercial_name ?? (isSolee ? 'SOLEÉ' : 'CRM');
  const secondaryColor = branding?.secondary_color ?? (isSolee ? '#7c3aed' : '#63DCE5');

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <CrmHeader
        tenantName={tenantName}
        title="Sincronización con Shopify"
        subtitle="Conexión en tiempo real para actualización de pedidos, inventario y carritos abandonados."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-slate-100 bg-white shadow-xs p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Estado de Tienda Shopify</CardTitle>
              <CardDescription className="text-xs">Webhooks activos y API GraphQL</CardDescription>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span>Estado del Webhook</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Sincronizado</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span>Última sincronización</span>
              <span className="font-semibold text-slate-800">Hace 4 minutos</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span>Productos vinculados</span>
              <span className="font-bold text-purple-700">14 referencias</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Sincronización Manual</CardTitle>
                <CardDescription className="text-xs">Forzar actualización de catálogo</CardDescription>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Descarga pedidos y actualiza niveles de stock entre Shopify y el inventario local del CRM.
            </p>
          </div>

          <div className="pt-4">
            <Button size="sm" className="w-full text-xs rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white">
              Sincronizar ahora
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
