import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

/**
 * POST {action: 'receive' | 'cancel'}: recibe la transferencia en el destino o
 * la cancela (la mercancía vuelve al origen). Requiere acceso al almacén donde
 * entra la mercancía; cancelar exige además permiso de aprobar ajustes.
 */
export async function POST(req: Request, { params }: { params: { slug: string; id: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'stock.transfer' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? '');
  if (action !== 'receive' && action !== 'cancel') return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });

  const { data: transfer } = await ctx.service
    .from('warehouse_transfers')
    .select('id, number, status, from_warehouse_id, to_warehouse_id, created_by')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', params.id)
    .maybeSingle();
  if (!transfer) return NextResponse.json({ error: 'Transferencia no encontrada.' }, { status: 404 });
  const target = action === 'receive' ? transfer.to_warehouse_id : transfer.from_warehouse_id;
  if (!ctx.canUseWarehouse(target)) return NextResponse.json({ error: 'No tienes acceso a ese almacén.' }, { status: 403 });
  if (action === 'cancel' && transfer.created_by !== ctx.userId && !ctx.can('stock.adjust.approve'))
    return NextResponse.json({ error: 'Solo quien la envió o un supervisor puede cancelarla.' }, { status: 403 });

  const { error } = await ctx.service.rpc('warehouse_close_transfer', {
    p_tenant: ctx.tenantId,
    p_actor: ctx.userId,
    p_transfer: transfer.id,
    p_action: action,
  });
  if (error) return dbErrorResponse(error, 'No se pudo cerrar la transferencia.');
  await auditWarehouse(ctx, `transfer.${action}`, 'warehouse_transfers', transfer.id, { number: transfer.number });
  return NextResponse.json({ ok: true });
}
