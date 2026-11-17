import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadRotation, loadStock } from '@/lib/warehouse/queries';
import { fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { ActionsBar, DataTable, DownloadLink, FilterBar, Kpi, KpiGrid, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-11 · Reportes Warehouse: valorización, rotación y movimientos. */
export default async function ReportsPage({ params, searchParams }: { params: { slug: string }; searchParams: { days?: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'report.view', fn: 'wh_reports' });
  const days = [7, 30, 90, 180, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const cost = ctx.can('cost.view');
  const [stock, rotation] = await Promise.all([loadStock(ctx, {}), loadRotation(ctx, days)]);
  const byWarehouse = new Map<string, { qty: number; value: number }>();
  for (const r of stock) {
    if (!r.warehouse_id) continue;
    const w = byWarehouse.get(r.warehouse_code) ?? { qty: 0, value: 0 };
    w.qty += r.on_hand;
    w.value += r.value;
    byWarehouse.set(r.warehouse_code, w);
  }
  const api = `/api/t/${params.slug}/warehouse/export`;
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <WhHeader code="WH-11" title="Reportes Warehouse" subtitle="Valorización, rotación y movimientos" />

      <Panel title="Reportes disponibles">
        <DataTable head={['Reporte', 'Período', 'Estado', '']}>
          {cost && (
            <tr>
              <td>Valorización a costo promedio ponderado</td>
              <td>Al día de hoy</td>
              <td>Disponible</td>
              <td><DownloadLink href={`${api}?kind=valuation`}>Exportar</DownloadLink></td>
            </tr>
          )}
          <tr>
            <td>Rotación por artículo</td>
            <td>Últimos {days} días</td>
            <td>Disponible</td>
            <td><DownloadLink href={`${api}?kind=rotation&days=${days}`}>Exportar</DownloadLink></td>
          </tr>
          <tr>
            <td>Movimientos (kardex)</td>
            <td>Últimos {days} días</td>
            <td>Disponible</td>
            <td><DownloadLink href={`${api}?kind=kardex&from=${from}&to=${today}`}>Exportar</DownloadLink></td>
          </tr>
          <tr>
            <td>Existencias y alertas</td>
            <td>Al día de hoy</td>
            <td>Disponible</td>
            <td><DownloadLink href={`${api}?kind=stock`}>Exportar</DownloadLink></td>
          </tr>
        </DataTable>
        <p className="mt-2 text-[11px] text-slate-500">La programación de envíos automáticos queda para una siguiente entrega; por ahora los reportes se generan a demanda.</p>
      </Panel>

      {cost && (
        <KpiGrid>
          <Kpi label="Valor total del inventario" value={fmtMoney(stock.reduce((s, r) => s + r.value, 0))} />
          {Array.from(byWarehouse.entries()).slice(0, 3).map(([code, w]) => (
            <Kpi key={code} label={`Valor ${code}`} value={fmtMoney(w.value)} hint={`${fmtQty(w.qty)} unidades`} />
          ))}
        </KpiGrid>
      )}

      <Panel
        title={`Rotación (últimos ${days} días)`}
        actions={
          <FilterBar>
            <select name="days" defaultValue={String(days)} aria-label="Período">
              {[7, 30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </FilterBar>
        }
      >
        <DataTable head={['SKU', 'Artículo', 'Salidas', 'Existencia', 'Rotación', 'Días de inventario']} empty="Sin artículos con existencias.">
          {rotation.slice(0, 50).map((r) => (
            <tr key={r.item_id}>
              <td className="font-mono text-[11px]">{r.sku}</td>
              <td>{r.name}</td>
              <td className="tabular-nums">{fmtQty(r.outflow)}</td>
              <td className="tabular-nums">{fmtQty(r.on_hand)}</td>
              <td className="tabular-nums">{r.rotation ?? '—'}</td>
              <td className="tabular-nums">{r.days_of_stock ?? '—'}</td>
            </tr>
          ))}
        </DataTable>
        <p className="mt-2 text-[11px] text-slate-500">Salidas = salidas manuales, ventas POS y ajustes negativos del período. Rotación = salidas ÷ existencia actual.</p>
      </Panel>
      <ActionsBar items={['Exportar', 'Programar (próximamente)']} />
    </div>
  );
}
