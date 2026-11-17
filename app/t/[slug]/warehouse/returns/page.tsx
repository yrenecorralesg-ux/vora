import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadFormOptions } from '@/lib/warehouse/queries';
import { DocumentForm } from '@/components/warehouse/document-form';
import { RecentDocuments } from '@/components/warehouse/recent-documents';
import { ActionsBar, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-10 · Devoluciones: recepción y condición de artículos. */
export default async function ReturnsPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'stock.return' });
  const opts = await loadFormOptions(ctx);
  return (
    <div className="space-y-4">
      <WhHeader code="WH-10" title="Devoluciones" subtitle="Recepción y condición de artículos" />
      <Panel title="Registrar devolución">
        <DocumentForm
          slug={params.slug}
          docType="return"
          warehouses={opts.warehouses}
          defaultWarehouseId={opts.settings?.default_warehouse_id ?? null}
          units={opts.units}
        />
        <p className="mt-3 text-[12px] text-slate-500">
          Inspecciona cada línea: lo vendible vuelve al stock disponible; lo dañado queda separado y no se puede vender.
        </p>
      </Panel>
      <RecentDocuments ctx={ctx} slug={params.slug} type="return" title="Devoluciones recientes" />
      <ActionsBar items={['Registrar devolución', 'Inspeccionar']} />
    </div>
  );
}
