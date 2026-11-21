import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST: envía una transferencia entre almacenes (WH-04). La mercancía sale del
 * origen y queda "en tránsito" en el destino hasta que se reciba.
 * {idempotency_key, from_warehouse_id, to_warehouse_id, notes?, lines: [{item_id, quantity}]}
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'stock.transfer' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  const key = String(body.idempotency_key ?? '');
  if (!UUID_RE.test(key)) return NextResponse.json({ error: 'Falta la clave de idempotencia.' }, { status: 400 });
  const from = String(body.from_warehouse_id ?? '');
  const to = String(body.to_warehouse_id ?? '');
  if (!ctx.canUseWarehouse(from)) return NextResponse.json({ error: 'No tienes acceso al almacén de origen.' }, { status: 403 });
  const lines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
  if (!lines.length || lines.length > 300) return NextResponse.json({ error: 'Agrega entre 1 y 300 artículos.' }, { status: 400 });
  for (const l of lines) {
    const q = Number(l.quantity);
    if (!UUID_RE.test(String(l.item_id ?? '')) || !Number.isFinite(q) || q <= 0)
      return NextResponse.json({ error: 'Hay una línea con artículo o cantidad inválidos.' }, { status: 400 });
  }

  const { data, error } = await ctx.service.rpc('warehouse_ship_transfer', {
    p_tenant: ctx.tenantId,
    p_actor: ctx.userId,
    p_transfer: {
      idempotency_key: key,
      from_warehouse_id: from,
      to_warehouse_id: to,
      notes: body.notes ? String(body.notes).slice(0, 1000) : null,
      lines: lines.map((l) => ({ item_id: l.item_id, quantity: Number(l.quantity) })),
    },
  });
  if (error) return dbErrorResponse(error, 'No se pudo enviar la transferencia.');
  const { data: transfer } = await ctx.service.from('warehouse_transfers').select('id, number, status').eq('id', data as string).single();
  await auditWarehouse(ctx, 'transfer.ship', 'warehouse_transfers', data as string, { from, to, lines: lines.length });
  return NextResponse.json({ transfer }, { status: 201 });
}
