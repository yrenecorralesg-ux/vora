import { ShoppingCart, PackageCheck, Truck, Clock, AlertCircle } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CrmHeader } from '@/components/crm-header';
import { demoOrders, orderStatusLabel } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

const estadoBadge: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  procesando: 'bg-blue-50 text-blue-700 border-blue-200',
  enviado: 'bg-purple-50 text-purple-700 border-purple-200',
  entregado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelado: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default async function OrdersPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'crm.orders');

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

  const totalOrdersAmount = demoOrders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <CrmHeader
        tenantName={tenantName}
        title="Gestión de pedidos"
        subtitle="Control de despachos, medios de pago y eventos de entrega por canal."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Total Pedidos</p>
              <p className="text-xl font-bold text-slate-900">{demoOrders.length}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">En Proceso</p>
              <p className="text-xl font-bold text-slate-900">
                {demoOrders.filter((o) => o.estado === 'procesando' || o.estado === 'pendiente').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Entregados</p>
              <p className="text-xl font-bold text-slate-900">
                {demoOrders.filter((o) => o.estado === 'entregado').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Facturación Total</p>
              <p className="text-xl font-bold text-slate-900">${(totalOrdersAmount / 1000).toLocaleString('es-CO')} k</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Orders Table */}
      <Card className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Pedido</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4 text-center">Items</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demoOrders.map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-purple-700">
                    {o.id}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {o.cliente}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {o.fecha}
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-slate-700">
                    {o.items}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    ${o.total.toLocaleString('es-CO')}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`text-xs font-semibold capitalize ${estadoBadge[o.estado] || ''}`}>
                      {orderStatusLabel[o.estado] || o.estado}
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
