import { NextResponse } from 'next/server';
import { authorizeWarehouse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

/** GET ?item=&warehouse=: existencia actual de un artículo en un almacén (para ajustes y salidas). */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const url = new URL(req.url);
  const item = url.searchParams.get('item') ?? '';
  const warehouse = url.searchParams.get('warehouse') ?? '';
  const { data } = await ctx.service
    .from('warehouse_balances')
    .select('on_hand, reserved, damaged, avg_cost')
    .eq('tenant_id', ctx.tenantId)
    .eq('item_id', item)
    .eq('warehouse_id', warehouse)
    .maybeSingle();
  const onHand = Number(data?.on_hand ?? 0);
  const reserved = Number(data?.reserved ?? 0);
  return NextResponse.json({
    on_hand: onHand,
    reserved,
    available: onHand - reserved,
    damaged: Number(data?.damaged ?? 0),
    avg_cost: ctx.can('cost.view') ? Number(data?.avg_cost ?? 0) : null,
  });
}
