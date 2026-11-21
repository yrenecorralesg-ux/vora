import { FileCheck2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { IMPORT_OPERATIONS } from '@/lib/warehouse/catalog';
import { JOB_STATUS, loadImportJob } from '@/lib/warehouse/imports-data';
import { fmtDate, fmtQty } from '@/lib/warehouse/format';
import { ImportConfirm } from '@/components/warehouse/import-wizard';
import { DataTable, Panel, Pill, SecondaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = { create: 'Alta', update: 'Actualización', movement: 'Movimiento de stock', skip: 'Omitida' };

/** WH-22 · Confirmación de importación: previsualizar cambios y aplicar. */
export default async function ImportConfirmPage({ params }: { params: { slug: string; id: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'import.validate', fn: 'wh_imports' });
  const job = await loadImportJob(ctx, params.id);
  if (!job) notFound();
  const { data: preview } = await ctx.service
    .from('warehouse_import_rows')
    .select('row_number, action, data')
    .eq('tenant_id', ctx.tenantId)
    .eq('job_id', job.id)
    .eq('errors', '[]')
    .order('row_number')
    .limit(20);
  const s = job.summary;
  const actions: [string, number | undefined][] = [
    ['create', s.create],
    ['update', s.update],
    ['movement', s.movement],
  ];
  const open = ['validated', 'invalid'].includes(job.status);
  const st = JOB_STATUS[job.status];

  return (
    <div className="space-y-4">
      <WhHeader code="WH-22" icon={FileCheck2} title="Confirmación de importación" subtitle={`${IMPORT_OPERATIONS[job.operation].label} · ${job.file_name}`}>
        <Pill tone={st.tone}>{st.label}</Pill>
        <SecondaryLink href={`/t/${params.slug}/warehouse/imports/${job.id}`}>Ver validación</SecondaryLink>
      </WhHeader>

      <Panel title="Cambios a aplicar">
        <DataTable head={['Acción', 'Registros', 'Resultado']}>
          {actions.filter(([, n]) => n).map(([a, n]) => (
            <tr key={a}>
              <td>{ACTION_LABEL[a]}</td>
              <td className="tabular-nums">{fmtQty(n ?? 0)}</td>
              <td>{job.status === 'applied' ? 'Aplicado' : 'Pendiente de confirmar'}</td>
            </tr>
          ))}
          {job.error_rows > 0 && (
            <tr>
              <td>Filas rechazadas por errores</td>
              <td className="tabular-nums">{fmtQty(job.error_rows)}</td>
              <td>{job.status === 'applied' ? 'No aplicadas' : 'No se aplicarán'}</td>
            </tr>
          )}
        </DataTable>
        {job.status === 'applied' && (
          <p className="mt-3 text-[13px] text-emerald-700">
            Aplicada el {fmtDate(job.applied_at)} ({job.apply_mode === 'partial' ? 'parcial' : 'todo o nada'}): {s.applied_created ?? 0} altas, {s.applied_updated ?? 0} actualizaciones, {s.applied_movements ?? 0} movimientos. Identificador: <span className="font-mono text-[11px]">{job.id}</span>
          </p>
        )}
      </Panel>

      <Panel title="Vista previa (primeras 20 filas válidas)">
        <DataTable head={['Fila', 'Acción', 'SKU', 'Detalle']}>
          {(preview ?? []).map((r) => {
            const d = r.data as Record<string, unknown>;
            const detail = job.operation === 'items' ? String(d.name ?? '') : job.operation === 'initial_stock' ? `+${d.quantity} a ${d.unit_cost} USD` : `${d.price_usd} USD`;
            return (
              <tr key={r.row_number}>
                <td className="tabular-nums">{r.row_number}</td>
                <td>{ACTION_LABEL[r.action]}</td>
                <td className="font-mono text-[11px]">{String(d.sku ?? '')}</td>
                <td>{detail}</td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      {open && !s.duplicate_of && (
        <Panel title="Aplicar">
          <p className="mb-3 text-[12px] text-slate-500">Por defecto se aplica todo o nada en una sola transacción: si falla una fila, no cambia nada.</p>
          <ImportConfirm slug={params.slug} jobId={job.id} hasErrors={job.error_rows > 0} validRows={job.valid_rows} canApply={ctx.can('import.apply')} />
        </Panel>
      )}
      {open && s.duplicate_of && <p className="rounded-xl bg-amber-50 px-4 py-2 text-[13px] text-amber-900">Este archivo ya fue aplicado anteriormente; no puede aplicarse otra vez.</p>}
    </div>
  );
}
