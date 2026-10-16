import { TrendingUp, Plus, DollarSign, Target, CheckCircle2 } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';
import { demoSales, saleStageLabel } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

const etapaBadge: Record<string, string> = {
  prospeccion: 'bg-slate-100 text-slate-700 border-slate-200',
  calificacion: 'bg-blue-50 text-blue-700 border-blue-200',
  propuesta: 'bg-purple-50 text-purple-700 border-purple-200',
  negociacion: 'bg-amber-50 text-amber-700 border-amber-200',
  ganada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  perdida: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default async function SalesPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'crm.sales');

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

  const totalPipeline = demoSales.reduce((acc, s) => acc + s.valor, 0);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <CrmHeader
        tenantName={tenantName}
        title="Ventas y oportunidades"
        subtitle="Embudo de ventas, seguimiento de acuerdos comerciales y probabilidad de cierre."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
        action={
          <Button size="sm" className="rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white text-xs h-9">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva oportunidad
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Pipeline Total</p>
              <p className="text-xl font-bold text-slate-900">${(totalPipeline / 1000).toLocaleString('es-CO')} k</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Oportunidades Abiertas</p>
              <p className="text-xl font-bold text-slate-900">{demoSales.length}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Etapa Negociación / Cierre</p>
              <p className="text-xl font-bold text-slate-900">
                {demoSales.filter((s) => s.etapa === 'negociacion' || s.etapa === 'ganada').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Oportunidad</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Etapa</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Probabilidad</th>
                <th className="px-6 py-4">Cierre estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demoSales.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {s.titulo}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {s.cliente}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`text-xs font-semibold capitalize ${etapaBadge[s.etapa] || ''}`}>
                      {saleStageLabel[s.etapa] || s.etapa}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    ${s.valor.toLocaleString('es-CO')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5136db] rounded-full"
                          style={{ width: `${s.probabilidad}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">{s.probabilidad}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {s.fechaCierre}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
