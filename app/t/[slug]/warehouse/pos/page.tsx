import Link from 'next/link';
import { ArrowRightLeft, CheckCircle2, Scale, ShoppingCart, TriangleAlert, Undo2 } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadKardex } from '@/lib/warehouse/queries';
import { reconcilePos, type ReconStatus } from '@/lib/warehouse/reconcile';
import { MOVEMENT_TYPES } from '@/lib/warehouse/catalog';
import { fmtDate, fmtQty, signed } from '@/lib/warehouse/format';
import { DataTable, EmptyState, Kpi, KpiGrid, Panel, Pill, WhHeader, btn } from '@/components/warehouse/wh-ui';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS: Record<ReconStatus, { label: string; tone: 'green' | 'red' | 'amber' }> = {
  ok: { label: 'Conciliado', tone: 'green' },
  missing_movement: { label: 'Sin salida de stock', tone: 'red' },
  orphan_movement: { label: 'Movimiento sin venta', tone: 'red' },
  qty_mismatch: { label: 'Cantidad distinta', tone: 'amber' },
};

/** WH-14 · Integración POS: venta, reverso y conciliación. */
export default async function PosIntegrationPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { tab?: string; days?: string; all?: string };
}) {
  const ctx = await requireWarehousePage(params.slug, { fn: 'wh_pos_integration' });
  const base = `/t/${params.slug}/warehouse/pos`;
  const tab = searchParams.tab === 'conciliacion' ? 'conciliacion' : 'transacciones';
  const days = [7, 30, 90].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;

  const [sales, returns, recon] = await Promise.all([
    loadKardex(ctx, { type: 'pos_sale' }, 100),
    loadKardex(ctx, { type: 'pos_return' }, 100),
    reconcilePos(ctx, days),
  ]);
  const events = [...sales, ...returns].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  const shown = searchParams.all ? recon.rows : recon.issues;

  return (
    <div className="space-y-5">
      <WhHeader code="WH-14" icon={ShoppingCart} title="Integración POS" subtitle="Venta, reverso y conciliación con el inventario">
        <Link href={`${base}?tab=conciliacion`} className={btn.primary}>
          <Scale className="h-4 w-4" /> Conciliar
        </Link>
      </WhHeader>

      <KpiGrid>
        <Kpi icon={ShoppingCart} label="Ventas y devoluciones" value={fmtQty(recon.references)} hint={`Últimos ${days} días`} />
        <Kpi icon={ArrowRightLeft} label="Unidades vendidas" value={fmtQty(-sales.reduce((s, m) => s + m.quantity, 0))} hint="Últimos 100 movimientos" />
        <Kpi icon={Undo2} label="Unidades repuestas" value={fmtQty(returns.reduce((s, m) => s + m.quantity, 0))} hint="Devoluciones vendibles" />
        <Kpi
          icon={recon.issues.length ? TriangleAlert : CheckCircle2}
          label="Descuadres"
          value={fmtQty(recon.issues.length)}
          tone={recon.issues.length ? 'danger' : 'good'}
          hint={recon.issues.length ? 'Revisar en Conciliación' : 'Todo cuadra'}
          href={`${base}?tab=conciliacion`}
        />
      </KpiGrid>

      <nav className="flex gap-1 rounded-xl border border-[#E7E2D7] bg-white p-1 text-[13px] font-medium shadow-sm sm:w-fit" aria-label="Secciones">
        {[
          ['transacciones', 'Transacciones'],
          ['conciliacion', 'Conciliación'],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`${base}?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={cn('rounded-lg px-4 py-1.5 transition', tab === key ? 'bg-[#285C49] text-white shadow-sm' : 'text-slate-600 hover:bg-[#F8F6F1]')}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'transacciones' ? (
        <Panel title="Transacciones" description="Movimientos de stock generados por ventas y devoluciones del POS">
          <DataTable
            head={['Fecha', 'Evento', 'Referencia', 'Artículo', 'Stock', 'Saldo']}
            empty={<EmptyState icon={ShoppingCart} title="Aún no hay ventas del POS" description="Cuando el POS venda con el catálogo de Warehouse, cada venta aparecerá aquí." />}
          >
            {events.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-slate-600">{fmtDate(m.created_at)}</td>
                <td><Pill tone={m.quantity < 0 ? 'amber' : 'green'}>{MOVEMENT_TYPES[m.movement_type]}</Pill></td>
                <td className="font-mono text-[12px]">{m.reference}</td>
                <td>
                  <span className="font-medium">{m.item_name}</span>
                  <p className="font-mono text-[11px] text-slate-500">{m.sku}</p>
                </td>
                <td className={`tabular-nums font-semibold ${m.quantity > 0 ? 'text-emerald-700' : 'text-[#9A4B2E]'}`}>{signed(m.quantity)}</td>
                <td className="tabular-nums text-slate-600">{fmtQty(m.on_hand_after)}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      ) : (
        <Panel
          title={searchParams.all ? 'Conciliación completa' : 'Descuadres'}
          description={`Ventas y devoluciones del POS con catálogo de Warehouse frente a los movimientos de stock, últimos ${days} días`}
          actions={
            <div className="flex flex-wrap items-center gap-1">
              {[7, 30, 90].map((d) => (
                <Link
                  key={d}
                  href={`${base}?tab=conciliacion&days=${d}${searchParams.all ? '&all=1' : ''}`}
                  className={cn(btn.ghost, d === days && 'bg-[#285C49]/10')}
                >
                  {d} días
                </Link>
              ))}
              <Link href={`${base}?tab=conciliacion&days=${days}${searchParams.all ? '' : '&all=1'}`} className={btn.ghost}>
                {searchParams.all ? 'Solo descuadres' : 'Ver todo'}
              </Link>
            </div>
          }
        >
          <DataTable
            head={['Fecha', 'Referencia', 'Tipo', 'Artículo', 'Según POS', 'En stock', 'Estado']}
            empty={
              <EmptyState
                icon={CheckCircle2}
                title={recon.rows.length ? 'Todo cuadra' : 'Sin operaciones en el período'}
                description={
                  recon.rows.length
                    ? `${fmtQty(recon.matched)} líneas del POS tienen exactamente su movimiento de stock.`
                    : 'No hubo ventas ni devoluciones del POS con catálogo de Warehouse en este período.'
                }
              />
            }
          >
            {shown.map((r) => (
              <tr key={`${r.kind}-${r.reference}-${r.sku}`}>
                <td className="whitespace-nowrap text-slate-600">{fmtDate(r.date)}</td>
                <td className="font-mono text-[12px]">{r.reference}</td>
                <td className="text-slate-600">{r.kind}</td>
                <td>
                  <span className="font-medium">{r.name}</span>
                  <p className="font-mono text-[11px] text-slate-500">{r.sku}</p>
                </td>
                <td className="tabular-nums">{fmtQty(r.expected)}</td>
                <td className="tabular-nums">{fmtQty(r.actual)}</td>
                <td><Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill></td>
              </tr>
            ))}
          </DataTable>
          {recon.issues.length > 0 && (
            <div className="mt-4 rounded-xl bg-[#F8F6F1] px-4 py-3 text-[12px] leading-relaxed text-slate-600">
              <p className="font-semibold text-[#1B3D2F]">Cómo resolver</p>
              <p><strong>Sin salida de stock:</strong> la venta se hizo con la integración apagada; regulariza con una salida (WH-06) usando la referencia de la venta.</p>
              <p><strong>Movimiento sin venta:</strong> se descontó stock por la ruta de eventos sin una venta registrada en el POS; revisa quién lo envió en el Kardex y revierte si corresponde.</p>
              <p><strong>Cantidad distinta:</strong> compara la venta y el Kardex del artículo; corrige con un ajuste aprobado (WH-07).</p>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
