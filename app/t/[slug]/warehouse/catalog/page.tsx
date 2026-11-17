import Link from 'next/link';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { ITEM_TYPES } from '@/lib/warehouse/catalog';
import { fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { ActionsBar, DataTable, FilterBar, Panel, Pill, PrimaryLink, SecondaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-02 · Catálogo unificado: productos, servicios, variantes y activos. */
export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { q?: string; type?: string; status?: string; category?: string };
}) {
  const ctx = await requireWarehousePage(params.slug);
  const base = `/t/${params.slug}/warehouse`;
  const q = (searchParams.q ?? '').trim().slice(0, 64).replace(/[%_,()]/g, ' ');

  let query = ctx.service
    .from('warehouse_items')
    .select('id, sku, name, item_type, track_stock, price_usd, status, warehouse_categories(name), warehouse_units(symbol)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('name')
    .limit(200);
  if (q) query = query.or(`sku.ilike.%${q}%,name.ilike.%${q}%`);
  if (searchParams.type && searchParams.type in ITEM_TYPES) query = query.eq('item_type', searchParams.type);
  if (searchParams.status === 'active' || searchParams.status === 'inactive') query = query.eq('status', searchParams.status);
  if (searchParams.category) query = query.eq('category_id', searchParams.category);
  const [{ data: items, count }, { data: categories }, { data: balances }] = await Promise.all([
    query,
    ctx.service.from('warehouse_categories').select('id, name').eq('tenant_id', ctx.tenantId).order('name'),
    ctx.service.from('warehouse_balances').select('item_id, on_hand').eq('tenant_id', ctx.tenantId).limit(10000),
  ]);
  const stock = new Map<string, number>();
  for (const b of balances ?? []) stock.set(b.item_id, (stock.get(b.item_id) ?? 0) + Number(b.on_hand));
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);

  return (
    <div className="space-y-4">
      <WhHeader code="WH-02" title="Catálogo unificado" subtitle="Productos, servicios, variantes y activos">
        {ctx.functions.wh_imports && ctx.can('import.validate') && <SecondaryLink href={`${base}/imports`}>Importar</SecondaryLink>}
        {ctx.can('catalog.create') && <PrimaryLink href={`${base}/catalog/new`}>Nuevo ítem</PrimaryLink>}
      </WhHeader>

      <Panel>
        <div className="space-y-3">
          <FilterBar>
            <input name="q" defaultValue={searchParams.q} placeholder="SKU o nombre" aria-label="Buscar" />
            <select name="type" defaultValue={searchParams.type ?? ''} aria-label="Tipo">
              <option value="">Todos los tipos</option>
              {Object.entries(ITEM_TYPES).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
            <select name="category" defaultValue={searchParams.category ?? ''} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="status" defaultValue={searchParams.status ?? ''} aria-label="Estado">
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </FilterBar>

          <DataTable head={['SKU', 'Artículo', 'Tipo', 'Categoría', 'Precio', 'Stock', 'Estado']} empty="No hay artículos. Crea uno o impórtalos desde un archivo.">
            {(items ?? []).map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-[11px]">
                  <Link href={`${base}/catalog/${i.id}`} className="text-[#285C49] underline">{i.sku}</Link>
                </td>
                <td>{i.name}</td>
                <td>{ITEM_TYPES[i.item_type as keyof typeof ITEM_TYPES]}</td>
                <td>{one(i.warehouse_categories)?.name ?? '—'}</td>
                <td className="tabular-nums">{fmtMoney(i.price_usd)}</td>
                <td className="tabular-nums">
                  {i.track_stock ? `${fmtQty(stock.get(i.id) ?? 0)} ${one(i.warehouse_units)?.symbol ?? ''}` : 'No aplica'}
                </td>
                <td>{i.status === 'active' ? <Pill tone="green">Activo</Pill> : <Pill>Inactivo</Pill>}</td>
              </tr>
            ))}
          </DataTable>
          {(count ?? 0) > 200 && <p className="text-[12px] text-slate-500">Mostrando 200 de {fmtQty(count ?? 0)}. Usa los filtros para acotar.</p>}
        </div>
      </Panel>

      <ActionsBar items={['Nuevo ítem', 'Importar', 'Filtrar']} />
    </div>
  );
}
