import Link from 'next/link';
import { FileSpreadsheet, Package, Plus } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { ITEM_TYPES } from '@/lib/warehouse/catalog';
import { fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { DataTable, EmptyState, FilterBar, Panel, Pill, PrimaryLink, SearchInput, SecondaryLink, WhHeader, btn } from '@/components/warehouse/wh-ui';

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
  const filtered = Boolean(q || searchParams.type || searchParams.status || searchParams.category);

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
  const canCreate = ctx.can('catalog.create');
  const canImport = ctx.functions.wh_imports && ctx.can('import.validate');

  return (
    <div className="space-y-5">
      <WhHeader code="WH-02" icon={Package} title="Catálogo unificado" subtitle="Productos, servicios, variantes y activos">
        {canImport && (
          <SecondaryLink href={`${base}/imports`}>
            <FileSpreadsheet className="h-4 w-4" /> Importar
          </SecondaryLink>
        )}
        {canCreate && (
          <PrimaryLink href={`${base}/catalog/new`}>
            <Plus className="h-4 w-4" /> Nuevo ítem
          </PrimaryLink>
        )}
      </WhHeader>

      <Panel
        title={`${fmtQty(count ?? 0)} artículo${count === 1 ? '' : 's'}`}
        description={filtered ? 'Resultado de los filtros aplicados' : 'Todo el catálogo de la empresa'}
      >
        <div className="space-y-4">
          <FilterBar resetHref={filtered ? `${base}/catalog` : undefined}>
            <SearchInput defaultValue={searchParams.q} placeholder="Buscar por SKU o nombre" />
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
              <option value="">Activos e inactivos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </FilterBar>

          <DataTable
            head={['Artículo', 'Tipo', 'Categoría', 'Precio', 'Existencia', 'Estado']}
            empty={
              filtered ? (
                <EmptyState icon={Package} title="Sin resultados" description="Ningún artículo coincide con los filtros." action={<Link href={`${base}/catalog`} className={btn.secondary}>Limpiar filtros</Link>} />
              ) : (
                <EmptyState
                  icon={Package}
                  title="Tu catálogo está vacío"
                  description="Crea tu primer artículo o impórtalos desde una plantilla CSV."
                  action={
                    <div className="flex gap-2">
                      {canImport && <Link href={`${base}/imports`} className={btn.secondary}>Importar</Link>}
                      {canCreate && <Link href={`${base}/catalog/new`} className={btn.primary}>Nuevo ítem</Link>}
                    </div>
                  }
                />
              )
            }
          >
            {(items ?? []).map((i) => {
              const qty = stock.get(i.id) ?? 0;
              return (
                <tr key={i.id}>
                  <td>
                    <Link href={`${base}/catalog/${i.id}`} className="font-medium hover:text-[#285C49] hover:underline">{i.name}</Link>
                    <p className="font-mono text-[11px] text-slate-500">{i.sku}</p>
                  </td>
                  <td className="text-slate-600">{ITEM_TYPES[i.item_type as keyof typeof ITEM_TYPES]}</td>
                  <td className="text-slate-600">{one(i.warehouse_categories)?.name ?? '—'}</td>
                  <td className="tabular-nums font-medium">{fmtMoney(i.price_usd)}</td>
                  <td className="tabular-nums">
                    {i.track_stock ? (
                      <span className={qty <= 0 ? 'font-semibold text-rose-700' : ''}>
                        {fmtQty(qty)} <span className="text-slate-500">{one(i.warehouse_units)?.symbol ?? ''}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">No aplica</span>
                    )}
                  </td>
                  <td>{i.status === 'active' ? <Pill tone="green">Activo</Pill> : <Pill>Inactivo</Pill>}</td>
                </tr>
              );
            })}
          </DataTable>
          {(count ?? 0) > 200 && <p className="text-[12px] text-slate-500">Mostrando 200 de {fmtQty(count ?? 0)}. Usa los filtros para acotar.</p>}
        </div>
      </Panel>
    </div>
  );
}
