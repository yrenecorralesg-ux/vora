import { notFound } from 'next/navigation';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadItemFormData } from '@/lib/warehouse/item-data';
import { loadKardex, loadStock } from '@/lib/warehouse/queries';
import { MOVEMENT_TYPES, type ItemType } from '@/lib/warehouse/catalog';
import { fmtCost, fmtDate, fmtQty, signed } from '@/lib/warehouse/format';
import { ItemForm } from '@/components/warehouse/item-form';
import { ActionsBar, DataTable, Panel, Pill, SecondaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-03 · Ficha de producto: datos, atributos, precio y stock. */
export default async function ItemPage({ params }: { params: { slug: string; id: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const { data: item } = await ctx.service
    .from('warehouse_items')
    .select('*, warehouse_item_barcodes(code)')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', params.id)
    .maybeSingle();
  if (!item) notFound();
  const [data, stock, moves] = await Promise.all([
    loadItemFormData(ctx),
    item.track_stock ? loadStock(ctx, { itemId: item.id }) : Promise.resolve([]),
    item.track_stock ? loadKardex(ctx, { itemId: item.id }, 10) : Promise.resolve([]),
  ]);
  const base = `/t/${params.slug}/warehouse`;
  const cost = ctx.can('cost.view');
  const attrs = (item.attributes ?? {}) as Record<string, string | number | boolean>;

  return (
    <div className="space-y-4">
      <WhHeader code="WH-03" title="Ficha de producto" subtitle={`${item.sku} · ${item.name}`}>
        {item.track_stock && <SecondaryLink href={`${base}/kardex?item=${item.id}`}>Ver movimientos</SecondaryLink>}
      </WhHeader>

      <Panel title="Datos del artículo">
        <ItemForm
          slug={params.slug}
          units={data.units}
          categories={data.categories}
          attributes={data.attributes}
          canEdit={ctx.can('catalog.create')}
          canCreateCategory={ctx.can('warehouse.configure')}
          initial={{
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description ?? '',
            item_type: item.item_type as ItemType,
            category_id: item.category_id ?? '',
            unit_id: item.unit_id,
            price_usd: String(item.price_usd),
            tax_rate: String(item.tax_rate),
            min_stock: String(item.min_stock),
            status: item.status,
            barcodes: ((item.warehouse_item_barcodes ?? []) as { code: string }[]).map((b) => b.code).join('\n'),
            attributes: Object.fromEntries(Object.entries(attrs).map(([k, val]) => [k, typeof val === 'boolean' ? (val ? 'sí' : 'no') : String(val)])),
          }}
        />
      </Panel>

      {item.track_stock ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Stock por almacén">
            <DataTable head={['Almacén', 'Físico', 'Reservado', 'Disponible', 'Dañado', ...(cost ? ['Costo prom.'] : [])]} empty="Sin existencias registradas.">
              {stock.map((s) => (
                <tr key={s.warehouse_code}>
                  <td>{s.warehouse_code}</td>
                  <td className="tabular-nums">{fmtQty(s.on_hand)}</td>
                  <td className="tabular-nums">{fmtQty(s.reserved)}</td>
                  <td className="tabular-nums">{fmtQty(s.available)} {s.alert && <Pill tone={s.alert === 'Sin stock' ? 'red' : 'amber'}>{s.alert}</Pill>}</td>
                  <td className="tabular-nums">{fmtQty(s.damaged)}</td>
                  {cost && <td className="tabular-nums">{fmtCost(s.avg_cost)}</td>}
                </tr>
              ))}
            </DataTable>
          </Panel>
          <Panel title="Últimos movimientos">
            <DataTable head={['Fecha', 'Movimiento', 'Cantidad', 'Saldo']} empty="Sin movimientos.">
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  <td>{MOVEMENT_TYPES[m.movement_type]}</td>
                  <td className="tabular-nums">{signed(m.quantity)}</td>
                  <td className="tabular-nums">{fmtQty(m.on_hand_after)}</td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>
      ) : (
        <Panel>
          <p className="text-[13px] text-slate-600">Este tipo de ítem no maneja existencias. Los materiales que consume se registran como salidas de sus propios artículos.</p>
        </Panel>
      )}

      <ActionsBar items={['Guardar cambios', 'Ver movimientos']} />
    </div>
  );
}
