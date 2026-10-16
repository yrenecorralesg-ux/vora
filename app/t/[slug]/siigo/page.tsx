import { FileText, CheckCircle2, AlertCircle, Building2, ShieldCheck, ArrowRight } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';

export const dynamic = 'force-dynamic';

export default async function SiigoPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'integration.siigo');

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
        title="Facturación electrónica SIIGO"
        subtitle="Emisión automática autorizada ante la DIAN y sincronización contable."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-slate-100 bg-white shadow-xs p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Configuración DIAN & SIIGO</CardTitle>
              <CardDescription className="text-xs">Estado de credenciales de API</CardDescription>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span>Resolución de Facturación</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Vigente 2026</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span>Ambiente</span>
              <span className="font-semibold text-slate-800">Producción DIAN</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span>Prefijo Autorizado</span>
              <span className="font-mono font-bold text-slate-900">FE-2026</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Facturación Automática</CardTitle>
                <CardDescription className="text-xs">Disparada desde ventas en feria o tienda virtual</CardDescription>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cada venta registrada con medio de pago confirmado genera su documento equivalente con cálculo de IVA y retenciones en tiempo real.
            </p>
          </div>

          <div className="pt-4">
            <Button size="sm" variant="outline" className="w-full text-xs rounded-xl">
              Ver últimas 50 facturas emitidas
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
