import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadItemFormData } from '@/lib/warehouse/item-data';
import { ItemForm } from '@/components/warehouse/item-form';
import { Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-03 · Ficha de producto (alta). */
export default async function NewItemPage({ params, searchParams }: { params: { slug: string }; searchParams: { barcode?: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'catalog.create' });
  const data = await loadItemFormData(ctx);
  return (
    <div className="space-y-4">
      <WhHeader code="WH-03" title="Nuevo artículo" subtitle="Datos, atributos, precio y códigos" />
      <Panel>
        <ItemForm
          slug={params.slug}
          units={data.units}
          categories={data.categories}
          attributes={data.attributes}
          canEdit
          canCreateCategory={ctx.can('warehouse.configure')}
          initial={{
            sku: '',
            name: '',
            description: '',
            item_type: 'physical',
            category_id: '',
            unit_id: data.units.find((u) => u.code === 'UND')?.id ?? data.units[0]?.id ?? '',
            price_usd: '0',
            tax_rate: '16',
            min_stock: '0',
            status: 'active',
            barcodes: (searchParams.barcode ?? '').slice(0, 64),
            attributes: {},
          }}
        />
      </Panel>
    </div>
  );
}
