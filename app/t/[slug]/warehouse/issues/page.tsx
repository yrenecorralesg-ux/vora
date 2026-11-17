import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadFormOptions } from '@/lib/warehouse/queries';
import { ISSUE_REASONS } from '@/lib/warehouse/catalog';
import { DocumentForm } from '@/components/warehouse/document-form';
import { RecentDocuments } from '@/components/warehouse/recent-documents';
import { ActionsBar, Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-06 · Salida de inventario: consumo, merma y salida autorizada. */
export default async function IssuesPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'stock.issue' });
  const opts = await loadFormOptions(ctx);
  return (
    <div className="space-y-4">
      <WhHeader code="WH-06" title="Salida de inventario" subtitle="Consumo, merma y salida autorizada" />
      <Panel title="Nueva salida">
        <DocumentForm
          slug={params.slug}
          docType="issue"
          warehouses={opts.warehouses}
          defaultWarehouseId={opts.settings?.default_warehouse_id ?? null}
          units={opts.units}
          reasons={ISSUE_REASONS}
        />
        <p className="mt-3 text-[12px] text-slate-500">Si alguna línea supera el disponible no se registra ninguna: el stock nunca queda negativo.</p>
      </Panel>
      <RecentDocuments ctx={ctx} slug={params.slug} type="issue" title="Salidas recientes" />
      <ActionsBar items={['Registrar salida', 'Añadir línea']} />
    </div>
  );
}
