import Link from 'next/link';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadDashboard } from '@/lib/warehouse/queries';
import { MOVEMENT_TYPES } from '@/lib/warehouse/catalog';
import { fmtDate, fmtMoney, fmtQty, signed } from '@/lib/warehouse/format';
import { ActionsBar, DataTable, Kpi, KpiGrid, Panel, Pill, PrimaryLink, SecondaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

function trend(today: number, yesterday: number) {
  if (!yesterday) return today ? 'sin registros ayer' : 'sin cambios';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `${pct > 0 ? '+' : ''}${pct}% vs. ayer`;
}

/** WH-01 · Dashboard de inventario */
export default async function WarehouseDashboard({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const d = await loadDashboard(ctx);
  const base = `/t/${params.slug}/warehouse`;

  return (
    <div className="space-y-4">
      <WhHeader code="WH-01" title="Dashboard de inventario" subtitle="Indicadores, movimientos y alertas">
        <SecondaryLink href={`${base}/stock?alert=1`}>Ver alertas</SecondaryLink>
        {ctx.can('stock.receive') && <PrimaryLink href={`${base}/receipts`}>Nueva entrada</PrimaryLink>}
      </WhHeader>

      <KpiGrid>
        <Kpi label="Artículos activos" value={fmtQty(d.items)} />
        <Kpi label="Almacenes" value={fmtQty(d.warehouses)} />
        <Kpi label="Alertas de stock" value={fmtQty(d.alerts)} tone={d.alerts ? 'warn' : 'good'} hint={d.alerts ? 'Revisar reposición' : 'Todo en orden'} />
        <Kpi label="Movimientos hoy" value={fmtQty(d.movesToday)} hint={trend(d.movesToday, d.movesYesterday)} />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Indicadores">
          <DataTable head={['Indicador', 'Valor', 'Tendencia']}>
            <tr><td>Artículos activos</td><td className="tabular-nums">{fmtQty(d.items)}</td><td>—</td></tr>
            <tr><td>Stock bajo o agotado</td><td className="tabular-nums">{fmtQty(d.alerts)}</td><td>{d.alerts ? <Pill tone="amber">Revisar</Pill> : <Pill tone="green">OK</Pill>}</td></tr>
            <tr><td>Movimientos hoy</td><td className="tabular-nums">{fmtQty(d.movesToday)}</td><td>{trend(d.movesToday, d.movesYesterday)}</td></tr>
            <tr>
              <td>Ajustes pendientes de aprobación</td>
              <td className="tabular-nums">{fmtQty(d.pending)}</td>
              <td>{d.pending ? <Link className="text-[#285C49] underline" href={`${base}/adjustments`}>Revisar</Link> : '—'}</td>
            </tr>
            {ctx.can('cost.view') && (
              <tr><td>Valor del inventario (costo promedio)</td><td className="tabular-nums">{fmtMoney(d.value)}</td><td>—</td></tr>
            )}
          </DataTable>
        </Panel>

        <Panel title="Alertas" actions={<Link className="text-[12px] text-[#285C49] underline" href={`${base}/stock?alert=1`}>Ver todas</Link>}>
          <DataTable head={['SKU', 'Artículo', 'Almacén', 'Disponible', 'Mínimo']} empty="Sin alertas de stock.">
            {d.topAlerts.map((a) => (
              <tr key={`${a.item_id}-${a.warehouse_id}`}>
                <td className="font-mono text-[11px]">{a.sku}</td>
                <td>{a.name}</td>
                <td>{a.warehouse_code}</td>
                <td className="tabular-nums">{fmtQty(a.available)}</td>
                <td className="tabular-nums">{fmtQty(a.min_stock)}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>

      <Panel title="Últimos movimientos" actions={<Link className="text-[12px] text-[#285C49] underline" href={`${base}/kardex`}>Ver kardex</Link>}>
        <DataTable head={['Fecha', 'SKU', 'Artículo', 'Movimiento', 'Cantidad', 'Saldo']} empty="Aún no hay movimientos. Registra una entrada o importa el stock inicial.">
          {d.recent.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap">{fmtDate(m.created_at)}</td>
              <td className="font-mono text-[11px]">{m.sku}</td>
              <td>{m.item_name}</td>
              <td>{MOVEMENT_TYPES[m.movement_type]}</td>
              <td className="tabular-nums">{signed(m.quantity)}</td>
              <td className="tabular-nums">{fmtQty(m.on_hand_after)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <ActionsBar items={['Nueva entrada', 'Ver alertas']} />
    </div>
  );
}
