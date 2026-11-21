import { CheckCircle2, Clock, Truck, XCircle } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { fmtDate, fmtQty } from '@/lib/warehouse/format';
import { DataTable, EmptyState, Kpi, KpiGrid, Panel, Pill, WhHeader } from '@/components/warehouse/wh-ui';
import { TransferActions, TransferForm } from '@/components/warehouse/transfer-form';

export const dynamic = 'force-dynamic';

const STATUS = {
  in_transit: { label: 'En tránsito', tone: 'amber' as const },
  received: { label: 'Recibida', tone: 'green' as const },
  cancelled: { label: 'Cancelada', tone: 'slate' as const },
};

/** WH-04 · Transferencias entre almacenes (stock en tránsito). */
export default async function TransfersPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'stock.transfer' });
  const [{ data: warehouses }, { data: transfers }] = await Promise.all([
    ctx.service.from('warehouse_warehouses').select('id, code, name').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('code'),
    ctx.service
      .from('warehouse_transfers')
      .select('id, number, status, shipped_at, closed_at, created_by, notes, from:from_warehouse_id(code), to:to_warehouse_id(code), warehouse_transfer_lines(quantity)')
      .eq('tenant_id', ctx.tenantId)
      .order('shipped_at', { ascending: false })
      .limit(100),
  ]);
  const usable = (warehouses ?? []).filter((w) => ctx.canUseWarehouse(w.id));
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);
  const list = transfers ?? [];
  const inTransit = list.filter((t) => t.status === 'in_transit');

  return (
    <div className="space-y-5">
      <WhHeader code="WH-04" icon={Truck} title="Transferencias" subtitle="Movimiento de mercancía entre almacenes y sedes" />

      <KpiGrid>
        <Kpi icon={Clock} label="En tránsito" value={fmtQty(inTransit.length)} tone={inTransit.length ? 'warn' : 'default'} hint="Pendientes de recibir" />
        <Kpi icon={Truck} label="Unidades en tránsito" value={fmtQty(inTransit.reduce((s, t) => s + (t.warehouse_transfer_lines ?? []).reduce((a: number, l: { quantity: number }) => a + Number(l.quantity), 0), 0))} />
        <Kpi icon={CheckCircle2} label="Recibidas" value={fmtQty(list.filter((t) => t.status === 'received').length)} tone="good" hint="Últimas 100" />
        <Kpi icon={XCircle} label="Canceladas" value={fmtQty(list.filter((t) => t.status === 'cancelled').length)} hint="Últimas 100" />
      </KpiGrid>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Nueva transferencia" description="La mercancía sale del origen al costo promedio y entra al destino cuando se recibe." className="lg:col-span-2">
          <TransferForm slug={params.slug} warehouses={usable.map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` }))} />
        </Panel>

        <Panel title="Transferencias recientes" className="lg:col-span-3">
          <DataTable
            head={['Número', 'Ruta', 'Unidades', 'Estado', 'Fecha', '']}
            empty={<EmptyState icon={Truck} title="Aún no hay transferencias" description="Envía mercancía de un almacén a otro con el formulario." />}
          >
            {list.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-[12px] font-medium">{t.number}</td>
                <td className="whitespace-nowrap text-slate-600">
                  {one(t.from as any)?.code} → {one(t.to as any)?.code}
                </td>
                <td className="tabular-nums">{fmtQty((t.warehouse_transfer_lines ?? []).reduce((a: number, l: { quantity: number }) => a + Number(l.quantity), 0))}</td>
                <td><Pill tone={STATUS[t.status as keyof typeof STATUS].tone}>{STATUS[t.status as keyof typeof STATUS].label}</Pill></td>
                <td className="whitespace-nowrap text-slate-600">{fmtDate(t.closed_at ?? t.shipped_at)}</td>
                <td>
                  {t.status === 'in_transit' && (
                    <TransferActions slug={params.slug} id={t.id} canCancel={t.created_by === ctx.userId || ctx.can('stock.adjust.approve')} />
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>
    </div>
  );
}
