import Link from 'next/link';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadStock } from '@/lib/warehouse/queries';
import { fmtCost, fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { ActionsBar, DataTable, DownloadLink, FilterBar, Kpi, KpiGrid, Panel, Pill, PrimaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-09 · Stock y alertas: físico, reservado, disponible y mínimo. */
export default async function StockPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { warehouse?: string; alert?: string; q?: string };
}) {
  const ctx = await requireWarehousePage(params.slug);
  const base = `/t/${params.slug}/warehouse`;
  const [all, { data: warehouses }] = await Promise.all([
    loadStock(ctx, { warehouseId: searchParams.warehouse || null }),
    ctx.service.from('warehouse_warehouses').select('id, code, name').eq('tenant_id', ctx.tenantId).order('code'),
  ]);
  const q = (searchParams.q ?? '').toLowerCase().trim();
  const rows = all.filter((r) => (!searchParams.alert || r.alert) && (!q || r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)));
  const cost = ctx.can('cost.view');
  const exportHref = `/api/t/${params.slug}/warehouse/export?kind=stock${searchParams.warehouse ? `&warehouse=${searchParams.warehouse}` : ''}`;

  return (
    <div className="space-y-4">
      <WhHeader code="WH-09" title="Stock y alertas" subtitle="Stock disponible, reservado y mínimo">
        <DownloadLink href={exportHref}>Exportar</DownloadLink>
        {ctx.can('stock.receive') && <PrimaryLink href={`${base}/receipts`}>Ver reposición</PrimaryLink>}
      </WhHeader>

      <KpiGrid>
        <Kpi label="Líneas de stock" value={fmtQty(all.length)} />
        <Kpi label="Agotados" value={fmtQty(all.filter((r) => r.alert === 'Sin stock').length)} tone="danger" />
        <Kpi label="Bajo mínimo" value={fmtQty(all.filter((r) => r.alert === 'Stock bajo').length)} tone="warn" />
        {cost ? <Kpi label="Valor (costo promedio)" value={fmtMoney(all.reduce((s, r) => s + r.value, 0))} /> : <Kpi label="Dañado (unidades)" value={fmtQty(all.reduce((s, r) => s + r.damaged, 0))} />}
      </KpiGrid>

      <Panel>
        <div className="space-y-3">
          <FilterBar>
            <input name="q" defaultValue={searchParams.q} placeholder="SKU o nombre" aria-label="Buscar" />
            <select name="warehouse" defaultValue={searchParams.warehouse ?? ''} aria-label="Almacén">
              <option value="">Todos los almacenes</option>
              {(warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
              ))}
            </select>
            <select name="alert" defaultValue={searchParams.alert ?? ''} aria-label="Alertas">
              <option value="">Todo el stock</option>
              <option value="1">Solo alertas</option>
            </select>
          </FilterBar>
          <DataTable
            head={['SKU', 'Artículo', 'Almacén', 'Físico', 'Reservado', 'Disponible', 'Dañado', 'Mínimo', 'Alerta', ...(cost ? ['Costo prom.'] : [])]}
            empty="Sin existencias para los filtros elegidos."
          >
            {rows.map((r) => (
              <tr key={`${r.item_id}-${r.warehouse_id}`}>
                <td className="font-mono text-[11px]">
                  <Link href={`${base}/catalog/${r.item_id}`} className="text-[#285C49] underline">{r.sku}</Link>
                </td>
                <td>{r.name}</td>
                <td>{r.warehouse_code}</td>
                <td className="tabular-nums">{fmtQty(r.on_hand)} {r.unit}</td>
                <td className="tabular-nums">{fmtQty(r.reserved)}</td>
                <td className="tabular-nums font-medium">{fmtQty(r.available)}</td>
                <td className="tabular-nums">{fmtQty(r.damaged)}</td>
                <td className="tabular-nums">{fmtQty(r.min_stock)}</td>
                <td>{r.alert ? <Pill tone={r.alert === 'Sin stock' ? 'red' : 'amber'}>{r.alert}</Pill> : <Pill tone="green">OK</Pill>}</td>
                {cost && <td className="tabular-nums">{fmtCost(r.avg_cost)}</td>}
              </tr>
            ))}
          </DataTable>
          <p className="text-[11px] text-slate-500">Disponible = físico − reservado. El stock dañado no se puede vender. En tránsito se habilitará con las transferencias entre almacenes.</p>
        </div>
      </Panel>
      <ActionsBar items={['Ver reposición', 'Exportar']} />
    </div>
  );
}
