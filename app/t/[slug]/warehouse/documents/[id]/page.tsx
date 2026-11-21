import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { DOC_STATUS, DOC_TYPES } from '@/lib/warehouse/catalog';
import { fmtCost, fmtDate, fmtQty, signed } from '@/lib/warehouse/format';
import { DocumentActions } from '@/components/warehouse/document-actions';
import { STATUS_TONE } from '@/components/warehouse/recent-documents';
import { DataTable, Panel, Pill, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** Detalle de un documento de inventario con su trazabilidad. */
export default async function DocumentPage({ params }: { params: { slug: string; id: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const { data: doc } = await ctx.service
    .from('warehouse_documents')
    .select('*, warehouse_warehouses(code, name), warehouse_supplier_profiles(name), warehouse_document_lines(*, warehouse_items(sku, name, warehouse_units(symbol)))')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', params.id)
    .maybeSingle();
  if (!doc) notFound();
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);
  const lines = ((doc.warehouse_document_lines ?? []) as Record<string, unknown>[]).sort((a, b) => Number(a.line_no) - Number(b.line_no));
  const cost = ctx.can('cost.view');
  const type = doc.doc_type as keyof typeof DOC_TYPES;
  const canApprove = ctx.can('stock.adjust.approve');
  const selfBlocked = doc.created_by === ctx.userId && !['tenant_admin', 'super_admin'].includes(ctx.role);

  const meta: [string, string][] = [
    ['Tipo', DOC_TYPES[type]],
    ['Almacén', `${one(doc.warehouse_warehouses)?.code ?? ''} · ${one(doc.warehouse_warehouses)?.name ?? ''}`],
    ['Creado', fmtDate(doc.created_at)],
    ['Contabilizado', fmtDate(doc.posted_at)],
    ['Motivo', doc.reason ?? '—'],
    ['Referencia', doc.reference ?? '—'],
  ];
  if (one(doc.warehouse_supplier_profiles)) meta.push(['Proveedor', one(doc.warehouse_supplier_profiles)!.name]);
  if (doc.decided_at) meta.push(['Decisión', `${fmtDate(doc.decided_at)}${doc.decision_note ? ` · ${doc.decision_note}` : ''}`]);

  return (
    <div className="space-y-4">
      <WhHeader code={doc.number} title={`${DOC_TYPES[type]} ${doc.number}`} subtitle="Documento de inventario">
        <Pill tone={STATUS_TONE[doc.status as keyof typeof STATUS_TONE]}>{DOC_STATUS[doc.status as keyof typeof DOC_STATUS]}</Pill>
      </WhHeader>

      <Panel title="Datos">
        <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-slate-500">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          {doc.evidence_path && (
            <div>
              <dt className="text-[11px] text-slate-500">Evidencia</dt>
              <dd>
                <a href={`/api/t/${params.slug}/warehouse/evidence?path=${encodeURIComponent(doc.evidence_path)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#285C49] hover:underline">
                  Ver archivo adjunto
                </a>
              </dd>
            </div>
          )}
          {doc.evidence_url && (
            <div>
              <dt className="text-[11px] text-slate-500">Evidencia</dt>
              <dd><a href={doc.evidence_url} target="_blank" rel="noopener noreferrer" className="text-[#285C49] underline">Abrir enlace</a></dd>
            </div>
          )}
        </dl>
        {doc.notes && <p className="mt-3 text-[13px] text-slate-600">{doc.notes}</p>}
      </Panel>

      <Panel title="Líneas">
        <DataTable
          head={[
            'SKU', 'Producto',
            ...(type === 'adjustment' ? ['Existencia', 'Conteo', 'Diferencia'] : ['Cantidad']),
            ...(type === 'return' ? ['Condición'] : []),
            ...(type === 'receipt' && cost ? ['Costo unitario'] : []),
          ]}
        >
          {lines.map((l) => {
            const item = one(l.warehouse_items as { sku: string; name: string; warehouse_units: { symbol: string } | null } | null);
            return (
              <tr key={String(l.id)}>
                <td className="font-mono text-[11px]">{item?.sku}</td>
                <td>{item?.name}</td>
                {type === 'adjustment' ? (
                  <>
                    <td className="tabular-nums">{fmtQty(l.system_qty as number)}</td>
                    <td className="tabular-nums">{fmtQty(l.counted_qty as number)}</td>
                    <td className="tabular-nums">{signed(Number(l.quantity))}</td>
                  </>
                ) : (
                  <td className="tabular-nums">
                    {fmtQty(l.quantity as number)} {one(item?.warehouse_units ?? null)?.symbol}
                    {Number(l.entered_qty) !== Number(l.quantity) && <span className="text-slate-500"> (ingresado: {fmtQty(l.entered_qty as number)})</span>}
                  </td>
                )}
                {type === 'return' && <td>{l.condition === 'damaged' ? <Pill tone="red">Dañado</Pill> : <Pill tone="green">Vendible</Pill>}</td>}
                {type === 'receipt' && cost && <td className="tabular-nums">{fmtCost(l.unit_cost as number)}</td>}
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      {doc.status === 'pending_approval' && canApprove && (
        <Panel title="Aprobación">
          {selfBlocked ? <p className="text-[13px] text-slate-600">Otro usuario debe aprobar tu solicitud.</p> : <DocumentActions slug={params.slug} documentId={doc.id} mode="decide" />}
        </Panel>
      )}
      {doc.status === 'posted' && canApprove && (
        <Panel title="Reverso auditado">
          <p className="mb-3 text-[12px] text-slate-500">Genera movimientos inversos; no se puede si el stock ya fue consumido.</p>
          <DocumentActions slug={params.slug} documentId={doc.id} mode="reverse" />
        </Panel>
      )}
      <p className="text-[12px]">
        <Link href={`/t/${params.slug}/warehouse/kardex`} className="text-[#285C49] underline">Ver kardex</Link>
      </p>
    </div>
  );
}
