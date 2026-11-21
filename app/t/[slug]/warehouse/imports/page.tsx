import { FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { IMPORT_OPERATIONS, type ImportOperation } from '@/lib/warehouse/catalog';
import { JOB_STATUS } from '@/lib/warehouse/imports-data';
import { fmtDate } from '@/lib/warehouse/format';
import { ImportWizard } from '@/components/warehouse/import-wizard';
import { DataTable, Panel, Pill, SecondaryLink, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-19 · Centro de importaciones: Excel, CSV y cargas masivas. */
export default async function ImportsPage({ params, searchParams }: { params: { slug: string }; searchParams: { operation?: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'import.validate', fn: 'wh_imports' });
  const base = `/t/${params.slug}/warehouse/imports`;
  const { data: jobs } = await ctx.service
    .from('warehouse_import_jobs')
    .select('id, operation, status, created_at, file_name')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100);
  const last = (op: string) => (jobs ?? []).find((j) => j.operation === op);

  return (
    <div className="space-y-4">
      <WhHeader code="WH-19" icon={FileSpreadsheet} title="Centro de importaciones" subtitle="Excel, CSV y cargas masivas">
        <SecondaryLink href={`${base}/templates`}>Descargar plantilla</SecondaryLink>
        <SecondaryLink href={`${base}/history`}>Ver historial</SecondaryLink>
      </WhHeader>

      <Panel title="Operaciones">
        <DataTable head={['Operación', 'Plantilla', 'Última carga', 'Estado']}>
          {(Object.keys(IMPORT_OPERATIONS) as ImportOperation[]).map((op) => {
            const j = last(op);
            return (
              <tr key={op}>
                <td>{IMPORT_OPERATIONS[op].label}</td>
                <td>
                  <a href={`/api/t/${params.slug}/warehouse/export?kind=template&operation=${op}`} className="text-[#285C49] underline">CSV v1</a>
                </td>
                <td>{j ? <Link href={`${base}/${j.id}`} className="text-[#285C49] underline">{fmtDate(j.created_at)}</Link> : '—'}</td>
                <td>{j ? <Pill tone={JOB_STATUS[j.status as keyof typeof JOB_STATUS].tone}>{JOB_STATUS[j.status as keyof typeof JOB_STATUS].label}</Pill> : 'Sin cargas'}</td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <Panel title="Nueva importación">
        <ImportWizard slug={params.slug} initialOperation={searchParams.operation as ImportOperation | undefined} />
      </Panel>
    </div>
  );
}
