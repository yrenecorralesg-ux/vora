import { Sparkles, TrendingUp, Users, BrainCircuit, ArrowRight, Star } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';

export const dynamic = 'force-dynamic';

export default async function PredictivePage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'analytics.repurchase_pilot');

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

  const predictiveCandidates = [
    { name: 'Laura Méndez', score: 94, cycleDays: 56, product: 'Difusor Bosque', reason: 'Ciclo habitual cumplido + alta fidelidad' },
    { name: 'Andrea Pérez', score: 88, cycleDays: 42, product: 'Esencia Calma', reason: 'Recompra esperada tras 6 semanas' },
    { name: 'Carlos Rojas', score: 79, cycleDays: 70, product: 'Vela Ámbar', reason: 'Interés activo en WhatsApp' },
    { name: 'Natalia Gómez', score: 73, cycleDays: 45, product: 'Lámpara de Vela', reason: 'Compra en feria stand 12' },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <CrmHeader
        tenantName={tenantName}
        title="Predictivo de recompra"
        subtitle="Algoritmo inteligente de scoring para anticipar reposiciones y maximizar el LTV."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Precisión del Modelo</p>
              <p className="text-xl font-bold text-slate-900">89.4%</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Clientes en Ventana Óptima</p>
              <p className="text-xl font-bold text-slate-900">28 clientes</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Ingreso Potencial Estimado</p>
              <p className="text-xl font-bold text-slate-900">$4.8 M COP</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Candidates List */}
      <Card className="rounded-2xl border-slate-100 bg-white shadow-xs p-6">
        <CardTitle className="text-base font-bold text-slate-900 mb-4">
          Cola priorizada de clientes por probabilidad de recompra
        </CardTitle>

        <div className="divide-y divide-slate-100">
          {predictiveCandidates.map((c) => (
            <div key={c.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                <p className="text-xs text-slate-500">{c.product} • {c.reason}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Score:</span>
                  <Badge className="bg-purple-50 text-[#5136db] border-purple-200 text-xs font-bold">
                    {c.score}/100
                  </Badge>
                </div>

                <Button size="sm" variant="outline" className="rounded-xl text-xs h-8">
                  Asignar a asesora
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
