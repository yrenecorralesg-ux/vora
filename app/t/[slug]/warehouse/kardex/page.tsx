import { History } from 'lucide-react';
import Link from 'next/link';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadKardex } from '@/lib/warehouse/queries';
import { MOVEMENT_TYPES } from '@/lib/warehouse/catalog';
import { fmtCost, fmtDate, fmtQty, signed } from '@/lib/warehouse/format';
import { DataTable, DownloadLink, FilterBar, Panel, Pill, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-08 · Kardex y auditoría: historial inmutable por artículo. */
export default async function KardexPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { item?: string; warehouse?: string; type?: string; from?: string; to?: string };
}) {
  const ctx = await requireWarehousePage(params.slug);
  const filters = {
    itemId: searchParams.item || null,
    warehouseId: searchParams.warehouse || null,
    type: searchParams.type && searchParams.type in MOVEMENT_TYPES ? searchParams.type : null,
    from: searchParams.from || null,
    to: searchParams.to || null,
  };
  const [rows, { data: warehouses }, item] = await Promise.all([
    loadKardex(ctx, filters, 300),
    ctx.service.from('warehouse_warehouses').select('id, code').eq('tenant_id', ctx.tenantId).order('code'),
    filters.itemId
      ? ctx.service.from('warehouse_items').select('sku, name').eq('tenant_id', ctx.tenantId).eq('id', filters.itemId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const cost = ctx.can('cost.view');
  const qs = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]).toString();
  const base = `/t/${params.slug}/warehouse`;

  return (
    <div className="space-y-4">
      <WhHeader code="WH-08" icon={History} title="Kardex y auditoría" subtitle={item.data ? `${item.data.sku} · ${item.data.name}` : 'Historial inmutable por artículo'}>
        <DownloadLink href={`/api/t/${params.slug}/warehouse/export?kind=kardex${qs ? `&${qs}` : ''}`}>Exportar</DownloadLink>
      </WhHeader>
      <Panel>
        <div className="space-y-3">
          <FilterBar>
            {filters.itemId && <input type="hidden" name="item" value={filters.itemId} />}
            <select name="warehouse" defaultValue={searchParams.warehouse ?? ''} aria-label="Almacén">
              <option value="">Todos los almacenes</option>
              {(warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id}>{w.code}</option>
              ))}
            </select>
            <select name="type" defaultValue={searchParams.type ?? ''} aria-label="Movimiento">
              <option value="">Todos los movimientos</option>
              {Object.entries(MOVEMENT_TYPES).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
            <input type="date" name="from" defaultValue={searchParams.from} aria-label="Desde" />
            <input type="date" name="to" defaultValue={searchParams.to} aria-label="Hasta" />
          </FilterBar>
          {filters.itemId && (
            <p className="text-[12px]">
              Filtrando un artículo. <Link href={`${base}/kardex`} className="text-[#285C49] underline">Ver todos</Link>
            </p>
          )}
          <DataTable
            head={['Fecha', 'SKU', 'Almacén', 'Origen', 'Movimiento', 'Cantidad', 'Saldo', ...(cost ? ['Costo', 'Costo prom.'] : []), 'Motivo']}
            empty="Sin movimientos para los filtros elegidos."
          >
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{fmtDate(m.created_at)}</td>
                <td className="font-mono text-[11px]">
                  <Link href={`${base}/kardex?item=${m.item_id}`} className="text-[#285C49] underline">{m.sku}</Link>
                </td>
                <td>{m.warehouse_code}</td>
                <td>
                  {m.document_id ? (
                    <Link href={`${base}/documents/${m.document_id}`} className="text-[#285C49] underline">{m.reference}</Link>
                  ) : (
                    m.reference ?? '—'
                  )}
                </td>
                <td>
                  {MOVEMENT_TYPES[m.movement_type]}
                  {m.bucket === 'damaged' && <span className="ml-1"><Pill tone="red">dañado</Pill></span>}
                </td>
                <td className={`tabular-nums ${m.quantity < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{signed(m.quantity)}</td>
                <td className="tabular-nums">{fmtQty(m.bucket === 'damaged' ? m.damaged_after : m.on_hand_after)}</td>
                {cost && (
                  <>
                    <td className="tabular-nums">{fmtCost(m.unit_cost)}</td>
                    <td className="tabular-nums">{fmtCost(m.avg_cost_after)}</td>
                  </>
                )}
                <td className="max-w-[200px] truncate" title={m.reason ?? ''}>{m.reason ?? '—'}</td>
              </tr>
            ))}
          </DataTable>
          <p className="text-[11px] text-slate-500">Los movimientos no se editan ni se eliminan: las correcciones se registran como reversos. Se muestran los 300 más recientes; exporta para ver hasta 5.000.</p>
        </div>
      </Panel>
    </div>
  );
}
