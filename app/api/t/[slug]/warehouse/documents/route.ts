import { NextResponse } from 'next/server';
import { authorizeWarehouse, dbErrorResponse, type WarehousePermission } from '@/lib/warehouse/access';
import type { DocType } from '@/lib/warehouse/catalog';

export const dynamic = 'force-dynamic';

const PERMISSION_BY_TYPE: Record<DocType, WarehousePermission> = {
  receipt: 'stock.receive',
  issue: 'stock.issue',
  return: 'stock.return',
  adjustment: 'stock.adjust.request',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST: entrada (WH-05), salida (WH-06), ajuste (WH-07) o devolución (WH-10).
 * Se contabiliza en la misma transacción, salvo ajustes que requieren aprobación.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const docType = body?.doc_type as DocType | undefined;
  if (!body || !docType || !(docType in PERMISSION_BY_TYPE))
    return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 });
  if (!ctx.can(PERMISSION_BY_TYPE[docType]))
    return NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 });

  if (!ctx.canUseWarehouse(body.warehouse_id as string))
    return NextResponse.json({ error: 'No tienes acceso a ese almacén.' }, { status: 403 });

  const key = String(body.idempotency_key ?? '');
  if (!UUID_RE.test(key)) return NextResponse.json({ error: 'Falta la clave de idempotencia.' }, { status: 400 });
  if (!Array.isArray(body.lines) || body.lines.length === 0)
    return NextResponse.json({ error: 'Agrega al menos una línea.' }, { status: 400 });
  if (body.evidence_url && !/^https:\/\/\S+$/.test(String(body.evidence_url)))
    return NextResponse.json({ error: 'La evidencia debe ser un enlace https.' }, { status: 400 });

  const evidencePath = body.evidence_path ? String(body.evidence_path) : null;
  if (evidencePath && (docType !== 'adjustment' || !evidencePath.startsWith(`${ctx.tenantId}/`) || evidencePath.includes('..')))
    return NextResponse.json({ error: 'Evidencia inválida.' }, { status: 400 });

  const lines = (body.lines as Record<string, unknown>[]).map((l) => ({
    item_id: l.item_id,
    quantity: l.quantity,
    counted_qty: l.counted_qty,
    unit_id: l.unit_id || null,
    // El costo solo se acepta en entradas y únicamente de quien puede verlo.
    unit_cost: docType === 'receipt' ? l.unit_cost : null,
    condition: l.condition,
    reason: l.reason,
  }));

  let post = true;
  if (docType === 'adjustment') {
    const { data: settings } = await ctx.service
      .from('warehouse_settings')
      .select('require_adjustment_approval')
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    post = !(settings?.require_adjustment_approval ?? true) || ctx.can('stock.adjust.approve');
  }
  if (docType === 'receipt') {
    // Sin permiso de costos (p. ej. operador de escaneo), o si se pide explícitamente (escaneo, WH-23),
    // las líneas sin costo se valoran al costo promedio vigente del artículo en ese almacén.
    const useAverage = !ctx.can('cost.view') || body.cost_mode === 'average';
    for (const line of lines) {
      if (!useAverage) break;
      if (ctx.can('cost.view') && line.unit_cost !== null && line.unit_cost !== undefined && line.unit_cost !== '') continue;
      const { data: balance } = await ctx.service
        .from('warehouse_balances')
        .select('avg_cost')
        .eq('tenant_id', ctx.tenantId)
        .eq('item_id', String(line.item_id))
        .eq('warehouse_id', String(body.warehouse_id))
        .maybeSingle();
      line.unit_cost = balance?.avg_cost ?? 0;
    }
  }

  const payload = {
    doc_type: docType,
    warehouse_id: body.warehouse_id,
    supplier_id: body.supplier_id || null,
    reason: body.reason,
    reference: body.reference,
    notes: body.notes,
    evidence_url: body.evidence_url || null,
    idempotency_key: key,
    lines,
  };

  const { data, error } = await ctx.service.rpc('warehouse_create_document', {
    p_tenant: ctx.tenantId,
    p_actor: ctx.userId,
    p_doc: payload,
    p_post: post,
  });
  if (error) return dbErrorResponse(error, 'No se pudo registrar el documento.');
  if (evidencePath)
    await ctx.service.from('warehouse_documents').update({ evidence_path: evidencePath }).eq('tenant_id', ctx.tenantId).eq('id', data as string);
  const { data: doc } = await ctx.service
    .from('warehouse_documents')
    .select('id, number, status')
    .eq('id', data as string)
    .single();
  return NextResponse.json({ document: doc }, { status: 201 });
}
