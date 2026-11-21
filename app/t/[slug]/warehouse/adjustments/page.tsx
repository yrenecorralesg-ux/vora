import { ClipboardCheck } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadFormOptions } from '@/lib/warehouse/queries';
import { ADJUSTMENT_REASONS } from '@/lib/warehouse/catalog';
import { DocumentForm } from '@/components/warehouse/document-form';
import { DocumentActions } from '@/components/warehouse/document-actions';
import { RecentDocuments } from '@/components/warehouse/recent-documents';
import { Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-07 · Ajustes de inventario: diferencias con autorización y evidencia. */
export default async function AdjustmentsPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'stock.adjust.request' });
  const opts = await loadFormOptions(ctx);
  const canApprove = ctx.can('stock.adjust.approve');
  const autoApprove = !(opts.settings?.require_adjustment_approval ?? true) || canApprove;
  const selfApproveAllowed = ['tenant_admin', 'super_admin'].includes(ctx.role);
  return (
    <div className="space-y-4">
      <WhHeader code="WH-07" icon={ClipboardCheck} title="Ajustes de inventario" subtitle="Diferencias con autorización y evidencia" />
      <Panel title="Nuevo ajuste">
        <DocumentForm
          slug={params.slug}
          docType="adjustment"
          warehouses={opts.warehouses}
          defaultWarehouseId={opts.settings?.default_warehouse_id ?? null}
          units={opts.units}
          reasons={ADJUSTMENT_REASONS}
          autoApprove={autoApprove}
        />
        <p className="mt-3 text-[12px] text-slate-500">
          {autoApprove
            ? 'Tu rol puede aprobar: el ajuste se aplica al registrarlo y queda auditado a tu nombre.'
            : 'El ajuste quedará pendiente hasta que un supervisor lo apruebe. Adjunta un enlace a la evidencia si la tienes.'}
        </p>
      </Panel>
      <RecentDocuments
        ctx={ctx}
        slug={params.slug}
        type="adjustment"
        status="pending_approval"
        title="Pendientes de aprobación"
        actions={
          canApprove
            ? (d) =>
                d.created_by === ctx.userId && !selfApproveAllowed ? (
                  <span className="text-[11px] text-slate-500">Otro usuario debe aprobarlo</span>
                ) : (
                  <DocumentActions slug={params.slug} documentId={d.id} mode="decide" compact />
                )
            : undefined
        }
      />
      <RecentDocuments ctx={ctx} slug={params.slug} type="adjustment" title="Historial de ajustes" />
    </div>
  );
}
