import { Megaphone, Plus, Users, Send, CheckCircle2 } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';
import { demoCampaigns, campaignStatusLabel } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

const estadoBadge: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-200',
  activa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pausada: 'bg-amber-50 text-amber-700 border-amber-200',
  finalizada: 'bg-purple-50 text-purple-700 border-purple-200',
};

const canalLabel: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  qr: 'QR',
  redes: 'Redes',
};

export default async function CampaignsPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'crm.campaigns');

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
        title="Campañas comerciales"
        subtitle="Estrategias dirigidas a segmentos específicos con seguimiento de impacto."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
        action={
          <Button size="sm" className="rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white text-xs h-9">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva campaña
          </Button>
        }
      />

      {/* Campaigns Table */}
      <Card className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Campaña</th>
                <th className="px-6 py-4">Canal</th>
                <th className="px-6 py-4">Segmento objetivo</th>
                <th className="px-6 py-4 text-center">Alcance</th>
                <th className="px-6 py-4 text-center">Conversión</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demoCampaigns.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{c.nombre}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.fechaInicio}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className="text-xs font-medium bg-slate-50">
                      {canalLabel[c.canal] || c.canal}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {c.segmento}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-800">
                    {c.enviados.toLocaleString('es-CO')}
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-emerald-600">
                    {c.aperturas} ({Math.round((c.aperturas / (c.enviados || 1)) * 100)}%)
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`text-xs font-semibold capitalize ${estadoBadge[c.estado] || ''}`}>
                      {campaignStatusLabel[c.estado] || c.estado}
                    </Badge>
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
