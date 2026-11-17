import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadFormOptions } from '@/lib/warehouse/queries';
import { DocumentForm } from '@/components/warehouse/document-form';
import { RecentDocuments } from '@/components/warehouse/recent-documents';
import { ActionsBar, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-05 · Entrada de inventario: recepción controlada de mercancía. */
export default async function ReceiptsPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'stock.receive' });
  const opts = await loadFormOptions(ctx);
  return (
    <div className="space-y-4">
      <WhHeader code="WH-05" title="Entrada de inventario" subtitle="Recepción controlada de mercancía" />
      <Panel title="Nueva entrada">
        <DocumentForm
          slug={params.slug}
          docType="receipt"
          warehouses={opts.warehouses}
          defaultWarehouseId={opts.settings?.default_warehouse_id ?? null}
          units={opts.units}
          suppliers={opts.suppliers}
          canSeeCost={ctx.can('cost.view')}
        />
        {!ctx.can('cost.view') && (
          <p className="mt-3 text-[12px] text-slate-500">Sin permiso de costos: la entrada se valora al costo promedio vigente del artículo.</p>
        )}
      </Panel>
      <RecentDocuments ctx={ctx} slug={params.slug} type="receipt" title="Entradas recientes" />
      <ActionsBar items={['Registrar entrada', 'Agregar línea']} />
    </div>
  );
}
