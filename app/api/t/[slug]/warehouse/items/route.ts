import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';
import { validateItemInput } from '@/lib/warehouse/validation';

export const dynamic = 'force-dynamic';

/** GET: búsqueda para selectores (SKU, nombre o código de barras). */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 64);
  const stockOnly = url.searchParams.get('stock') === '1';

  let query = ctx.service
    .from('warehouse_items')
    .select('id, sku, name, item_type, track_stock, unit_id, price_usd, status, warehouse_units(code, symbol)')
    .eq('tenant_id', ctx.tenantId)
    .order('name')
    .limit(20);
  if (stockOnly) query = query.eq('track_stock', true);
  if (q) {
    const { data: byCode } = await ctx.service
      .from('warehouse_item_barcodes')
      .select('item_id')
      .eq('tenant_id', ctx.tenantId)
      .eq('code', q);
    const safe = q.replace(/[%_,()]/g, ' ');
    const ids = (byCode ?? []).map((b) => b.item_id);
    query = ids.length
      ? query.or(`sku.ilike.%${safe}%,name.ilike.%${safe}%,id.in.(${ids.join(',')})`)
      : query.or(`sku.ilike.%${safe}%,name.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) return dbErrorResponse(error);
  return NextResponse.json({ items: data ?? [] });
}

/** POST: alta de artículo (WH-03). */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'catalog.create' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });

  const { item, errors } = await validateItemInput(ctx, body);
  if (!item) return NextResponse.json({ error: 'Revisa los campos marcados.', fields: errors }, { status: 400 });

  const { barcodes, ...fields } = item;
  const { data: created, error } = await ctx.service
    .from('warehouse_items')
    .insert({ ...fields, tenant_id: ctx.tenantId, created_by: ctx.userId })
    .select('id')
    .single();
  if (error || !created) return dbErrorResponse(error, 'No se pudo crear el artículo.');

  if (barcodes.length) {
    const { error: codeError } = await ctx.service
      .from('warehouse_item_barcodes')
      .insert(barcodes.map((code) => ({ tenant_id: ctx.tenantId, item_id: created.id, code })));
    if (codeError) {
      // Sin transacción entre llamadas: deshacer el alta para no dejar un artículo a medias.
      await ctx.service.from('warehouse_items').delete().eq('id', created.id).eq('tenant_id', ctx.tenantId);
      return codeError.code === '23505'
        ? NextResponse.json({ error: 'Un código de barras ya pertenece a otro artículo.' }, { status: 409 })
        : dbErrorResponse(codeError);
    }
  }
  await auditWarehouse(ctx, 'item.create', 'warehouse_items', created.id, { sku: item.sku });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
