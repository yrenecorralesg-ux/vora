import { Package, Plus, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { demoProducts, productStatusLabel } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

const estadoBadge: Record<string, string> = {
  disponible: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  agotado: 'bg-amber-50 text-amber-700 border-amber-200',
  descontinuado: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default async function ProductsPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'crm.products');

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
        title="Catálogo de productos"
        subtitle="Administración de referencias, inventario, precios y colecciones de venta."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
        action={
          <Button size="sm" className="rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white text-xs h-9">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nuevo producto
          </Button>
        }
      />

      {/* Product Grid / Table */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {demoProducts.map((p) => (
          <Card key={p.sku} className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs p-4 flex flex-col justify-between">
            <div>
              {/* Image without crop */}
              <div className="rounded-xl overflow-hidden bg-slate-50 mb-3">
                <ImagePlaceholder
                  aspectRatio="aspect-[4/3]"
                  label={p.nombre}
                  sublabel="Espacio para foto"
                  objectFit="contain"
                />
              </div>

              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-[10.5px] text-slate-400 font-semibold">{p.sku}</span>
                <Badge variant="outline" className={`text-[10px] font-semibold capitalize ${estadoBadge[p.estado] || ''}`}>
                  {productStatusLabel[p.estado] || p.estado}
                </Badge>
              </div>

              <h4 className="font-bold text-slate-900 text-sm">{p.nombre}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{p.categoria}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Precio</span>
                <span className="text-base font-bold text-slate-900">${p.precio.toLocaleString('es-CO')}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-medium block">Stock</span>
                <span className="text-xs font-semibold text-slate-700">{p.stock} unid.</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
