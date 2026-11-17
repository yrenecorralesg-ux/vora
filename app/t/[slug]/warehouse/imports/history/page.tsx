import Link from 'next/link';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { IMPORT_OPERATIONS } from '@/lib/warehouse/catalog';
import { JOB_STATUS } from '@/lib/warehouse/imports-data';
import { fmtDate, fmtQty } from '@/lib/warehouse/format';
import { ActionsBar, DataTable, Panel, Pill, PrimaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-27 · Historial de importaciones: auditoría y reintentos seguros. */
export default async function ImportHistoryPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'import.validate', fn: 'wh_imports' });
  const { data: jobs } = await ctx.service
    .from('warehouse_import_jobs')
    .select('id, operation, file_name, file_sha256, status, apply_mode, total_rows, valid_rows, error_rows, created_by, created_at, applied_at')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  const base = `/t/${params.slug}/warehouse/imports`;

  return (
    <div className="space-y-4">
      <WhHeader code="WH-27" title="Historial de importaciones" subtitle="Auditoría y reintentos seguros">
        <PrimaryLink href={base}>Nueva importación</PrimaryLink>
      </WhHeader>
      <Panel>
        <DataTable head={['ID', 'Tipo', 'Archivo', 'Filas', 'Errores', 'Fecha', 'Aplicada', 'Estado']} empty="Aún no hay importaciones.">
          {(jobs ?? []).map((j) => {
            const st = JOB_STATUS[j.status as keyof typeof JOB_STATUS];
            return (
              <tr key={j.id}>
                <td className="font-mono text-[11px]">
                  <Link href={`${base}/${j.id}`} className="text-[#285C49] underline">{j.id.slice(0, 8)}</Link>
                </td>
                <td>{IMPORT_OPERATIONS[j.operation as keyof typeof IMPORT_OPERATIONS].label}</td>
                <td className="max-w-[200px] truncate" title={`SHA-256 ${j.file_sha256}`}>{j.file_name}</td>
                <td className="tabular-nums">{fmtQty(j.total_rows)}</td>
                <td className="tabular-nums">{fmtQty(j.error_rows)}</td>
                <td className="whitespace-nowrap">{fmtDate(j.created_at)}</td>
                <td className="whitespace-nowrap">{j.applied_at ? `${fmtDate(j.applied_at)}${j.apply_mode === 'partial' ? ' (parcial)' : ''}` : '—'}</td>
                <td><Pill tone={st.tone}>{st.label}</Pill></td>
              </tr>
            );
          })}
        </DataTable>
        <p className="mt-2 text-[12px] text-slate-500">
          Reintentar es seguro: un archivo ya aplicado (mismo contenido y operación) no puede aplicarse otra vez, así no se duplican movimientos.
        </p>
      </Panel>
      <ActionsBar items={['Ver detalle', 'Exportar']} />
    </div>
  );
}
