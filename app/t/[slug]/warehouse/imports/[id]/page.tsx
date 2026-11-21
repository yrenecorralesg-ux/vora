import { FileWarning } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { IMPORT_OPERATIONS } from '@/lib/warehouse/catalog';
import { JOB_STATUS, loadImportJob } from '@/lib/warehouse/imports-data';
import { fmtDate, fmtQty } from '@/lib/warehouse/format';
import { DataTable, DownloadLink, Kpi, KpiGrid, Panel, Pill, PrimaryLink, SecondaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-21 · Validación de importación: errores por fila, columna y regla. */
export default async function ImportValidationPage({ params }: { params: { slug: string; id: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'import.validate', fn: 'wh_imports' });
  const job = await loadImportJob(ctx, params.id);
  if (!job) notFound();
  const { data: rows } = await ctx.service
    .from('warehouse_import_rows')
    .select('row_number, errors')
    .eq('tenant_id', ctx.tenantId)
    .eq('job_id', job.id)
    .neq('errors', '[]')
    .order('row_number')
    .limit(500);
  const errors = (rows ?? []).flatMap((r) => (r.errors as { field: string; value?: string; message: string }[]).map((e, i) => ({ ...e, row: r.row_number, key: `${r.row_number}-${i}` })));
  const base = `/t/${params.slug}/warehouse/imports`;
  const st = JOB_STATUS[job.status];

  return (
    <div className="space-y-4">
      <WhHeader code="WH-21" icon={FileWarning} title="Validación de importación" subtitle={`${IMPORT_OPERATIONS[job.operation].label} · ${job.file_name}`}>
        <Pill tone={st.tone}>{st.label}</Pill>
        {job.error_rows > 0 && <DownloadLink href={`/api/t/${params.slug}/warehouse/export?kind=import-errors&job=${job.id}`}>Descargar errores</DownloadLink>}
        <SecondaryLink href={`${base}?operation=${job.operation}`}>Validar de nuevo</SecondaryLink>
        {['validated', 'invalid'].includes(job.status) && job.valid_rows > 0 && <PrimaryLink href={`${base}/${job.id}/confirm`}>Continuar</PrimaryLink>}
      </WhHeader>

      <KpiGrid>
        <Kpi label="Filas" value={fmtQty(job.total_rows)} />
        <Kpi label="Válidas" value={fmtQty(job.valid_rows)} tone="good" />
        <Kpi label="Con errores" value={fmtQty(job.error_rows)} tone={job.error_rows ? 'danger' : 'good'} />
        <Kpi label="Validada" value={fmtDate(job.created_at)} />
      </KpiGrid>

      {job.summary.duplicate_of && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-[13px] text-amber-900">
          Este mismo archivo ya fue importado y aplicado antes. Para no duplicar movimientos, no podrá aplicarse de nuevo.
        </p>
      )}

      <Panel title={job.error_rows ? 'Errores' : 'Resultado'}>
        {job.error_rows === 0 ? (
          <p className="text-[13px] text-emerald-700">Todas las filas son válidas. Revisa la vista previa y confirma.</p>
        ) : (
          <DataTable head={['Fila', 'Campo', 'Valor', 'Error']}>
            {errors.map((e) => (
              <tr key={e.key}>
                <td className="tabular-nums">{e.row}</td>
                <td className="font-mono text-[11px]">{e.field}</td>
                <td className="max-w-[200px] truncate" title={e.value}>{e.value || '—'}</td>
                <td>{e.message}</td>
              </tr>
            ))}
          </DataTable>
        )}
        {errors.length >= 500 && <p className="mt-2 text-[12px] text-slate-500">Se muestran los primeros errores; descarga el archivo para verlos todos.</p>}
      </Panel>
    </div>
  );
}
