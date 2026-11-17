import Link from 'next/link';
import type { WarehouseContext } from '@/lib/warehouse/access';
import { DOC_STATUS, type DocType } from '@/lib/warehouse/catalog';
import { fmtDate } from '@/lib/warehouse/format';
import { DataTable, Panel, Pill } from '@/components/warehouse/wh-ui';

export const STATUS_TONE = { pending_approval: 'amber', posted: 'green', rejected: 'red', reversed: 'slate' } as const;

/** Lista de documentos recientes de un tipo (servidor). */
export async function RecentDocuments({
  ctx,
  slug,
  type,
  status,
  title = 'Documentos recientes',
  actions,
}: {
  ctx: WarehouseContext;
  slug: string;
  type: DocType;
  status?: string;
  title?: string;
  actions?: (doc: { id: string; created_by: string | null }) => React.ReactNode;
}) {
  let q = ctx.service
    .from('warehouse_documents')
    .select('id, number, status, reason, reference, created_at, created_by, warehouse_warehouses(code), warehouse_document_lines(count)')
    .eq('tenant_id', ctx.tenantId)
    .eq('doc_type', type)
    .order('created_at', { ascending: false })
    .limit(25);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);
  return (
    <Panel title={title}>
      <DataTable head={['Número', 'Fecha', 'Almacén', 'Líneas', 'Motivo / referencia', 'Estado', ...(actions ? [''] : [])]} empty="Sin documentos.">
        {(data ?? []).map((d) => (
          <tr key={d.id}>
            <td className="font-mono text-[11px]">
              <Link href={`/t/${slug}/warehouse/documents/${d.id}`} className="text-[#285C49] underline">{d.number}</Link>
            </td>
            <td className="whitespace-nowrap">{fmtDate(d.created_at)}</td>
            <td>{one(d.warehouse_warehouses)?.code}</td>
            <td className="tabular-nums">{one(d.warehouse_document_lines)?.count ?? 0}</td>
            <td>{[d.reason, d.reference].filter(Boolean).join(' · ') || '—'}</td>
            <td><Pill tone={STATUS_TONE[d.status as keyof typeof STATUS_TONE]}>{DOC_STATUS[d.status as keyof typeof DOC_STATUS]}</Pill></td>
            {actions && <td>{d.status === 'pending_approval' ? actions(d) : null}</td>}
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}
