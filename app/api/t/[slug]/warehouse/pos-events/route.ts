import { NextResponse } from 'next/server';
import { authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

/**
 * POST {kind: 'sale'|'return', reference, warehouse_id?, lines: [{sku, quantity}]} (WH-14).
 * Punto único para que el POS descuente o reponga stock; idempotente por referencia y SKU.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug, { fn: 'wh_pos_integration' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !['sale', 'return'].includes(String(body.kind)))
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  // Una devolución repone stock: exige permiso de devoluciones, no basta el de vender.
  const allowed = body.kind === 'sale' ? ['pos.sales.create', 'stock.issue'] : ['pos.refunds.approve', 'stock.return'];
  if (!allowed.some((p) => ctx.permissions.has(p)))
    return NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 });
  const reference = String(body.reference ?? '').trim();
  if (!reference || reference.length > 64) return NextResponse.json({ error: 'Referencia inválida.' }, { status: 400 });
  if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 500)
    return NextResponse.json({ error: 'Líneas inválidas.' }, { status: 400 });

  const { data, error } = await ctx.service.rpc('warehouse_register_pos_event', {
    p_tenant: ctx.tenantId,
    p_actor: ctx.userId,
    p_event: {
      kind: body.kind,
      reference,
      warehouse_id: body.warehouse_id || null,
      lines: (body.lines as Record<string, unknown>[]).map((l) => ({ sku: String(l.sku ?? ''), quantity: l.quantity })),
    },
  });
  if (error) return dbErrorResponse(error, 'No se pudo registrar el movimiento POS.');
  return NextResponse.json({ ok: true, lines: data });
}
