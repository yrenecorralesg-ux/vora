import Link from 'next/link';
import { AlertTriangle, ArrowDownToLine, Boxes, DollarSign, Download, PackageCheck, PackageX, ShieldAlert } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadStock } from '@/lib/warehouse/queries';
import { fmtCost, fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { DataTable, DownloadLink, EmptyState, FilterBar, Kpi, KpiGrid, Panel, Pill, PrimaryLink, SearchInput, WhHeader, btn } from '@/components/warehouse/wh-ui';

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
  const filtered = Boolean(q || searchParams.alert || searchParams.warehouse);
  const cost = ctx.can('cost.view');
  const exportHref = `/api/t/${params.slug}/warehouse/export?kind=stock${searchParams.warehouse ? `&warehouse=${searchParams.warehouse}` : ''}`;
  const out = all.filter((r) => r.alert === 'Sin stock').length;
  const low = all.filter((r) => r.alert === 'Stock bajo').length;

  return (
    <div className="space-y-5">
      <WhHeader code="WH-09" icon={Boxes} title="Stock y alertas" subtitle="Stock disponible, reservado y mínimo">
        <DownloadLink href={exportHref}>
          <Download className="h-4 w-4" /> Exportar
        </DownloadLink>
        {ctx.can('stock.receive') && (
          <PrimaryLink href={`${base}/receipts`}>
            <ArrowDownToLine className="h-4 w-4" /> Ver reposición
          </PrimaryLink>
        )}
      </WhHeader>

      <KpiGrid>
        <Kpi icon={Boxes} label="Líneas de stock" value={fmtQty(all.length)} hint="Artículo × almacén" />
        <Kpi icon={PackageX} label="Agotados" value={fmtQty(out)} tone={out ? 'danger' : 'good'} hint={out ? 'Sin unidades disponibles' : 'Ninguno'} href={`${base}/stock?alert=1`} />
        <Kpi icon={AlertTriangle} label="Bajo mínimo" value={fmtQty(low)} tone={low ? 'warn' : 'good'} hint={low ? 'Conviene reponer' : 'Ninguno'} href={`${base}/stock?alert=1`} />
        {cost ? (
          <Kpi icon={DollarSign} label="Valor del inventario" value={fmtMoney(all.reduce((s, r) => s + r.value, 0))} hint="A costo promedio ponderado" />
        ) : (
          <Kpi icon={ShieldAlert} label="Dañado (unidades)" value={fmtQty(all.reduce((s, r) => s + r.damaged, 0))} hint="No disponible para la venta" />
        )}
      </KpiGrid>

      <Panel title="Existencias" description="Disponible = físico − reservado. El stock dañado no se puede vender.">
        <div className="space-y-4">
          <FilterBar resetHref={filtered ? `${base}/stock` : undefined}>
            <SearchInput defaultValue={searchParams.q} placeholder="Buscar por SKU o nombre" />
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
            head={['Artículo', 'Almacén', 'Físico', 'Reservado', 'Disponible', 'Dañado', 'En tránsito', 'Mínimo', 'Estado', ...(cost ? ['Costo prom.'] : [])]}
            empty={
              filtered ? (
                <EmptyState icon={PackageCheck} title="Sin resultados" description="Nada coincide con los filtros elegidos." action={<Link href={`${base}/stock`} className={btn.secondary}>Ver todo el stock</Link>} />
              ) : (
                <EmptyState
                  icon={Boxes}
                  title="Aún no hay existencias"
                  description="Registra una entrada o importa el stock inicial."
                  action={ctx.can('stock.receive') ? <Link href={`${base}/receipts`} className={btn.primary}>Registrar entrada</Link> : undefined}
                />
              )
            }
          >
            {rows.map((r) => {
              const pct = r.min_stock > 0 ? Math.min(100, (r.available / (r.min_stock * 2)) * 100) : 100;
              return (
                <tr key={`${r.item_id}-${r.warehouse_id}`}>
                  <td>
                    <Link href={`${base}/catalog/${r.item_id}`} className="font-medium hover:text-[#285C49] hover:underline">{r.name}</Link>
                    <p className="font-mono text-[11px] text-slate-500">{r.sku}</p>
                  </td>
                  <td className="text-slate-600">{r.warehouse_code}</td>
                  <td className="tabular-nums">{fmtQty(r.on_hand)} <span className="text-slate-500">{r.unit}</span></td>
                  <td className="tabular-nums text-slate-600">{fmtQty(r.reserved)}</td>
                  <td>
                    <span className="tabular-nums font-semibold">{fmtQty(r.available)}</span>
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-[#F1EDE5]">
                      <div
                        className={`h-full rounded-full ${r.alert === 'Sin stock' ? 'bg-rose-500' : r.alert ? 'bg-amber-500' : 'bg-[#1E7A55]'}`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </td>
                  <td className="tabular-nums text-slate-600">{r.damaged ? fmtQty(r.damaged) : '—'}</td>
                  <td className="tabular-nums text-slate-600">{r.in_transit ? fmtQty(r.in_transit) : '—'}</td>
                  <td className="tabular-nums text-slate-600">{fmtQty(r.min_stock)}</td>
                  <td>{r.alert === 'Sin stock' ? <Pill tone="red">Agotado</Pill> : r.alert ? <Pill tone="amber">Bajo</Pill> : <Pill tone="green">Normal</Pill>}</td>
                  {cost && <td className="tabular-nums text-slate-600">{fmtCost(r.avg_cost)}</td>}
                </tr>
              );
            })}
          </DataTable>
        </div>
      </Panel>
    </div>
  );
}
