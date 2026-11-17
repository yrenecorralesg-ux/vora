import { NextResponse } from 'next/server';
import { authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';

/**
 * GET ?code=: resuelve un código escaneado o tecleado (WH-23). Escáner y entrada manual
 * usan esta misma ruta, sin atajos: código de barras exacto primero, luego SKU exacto.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const auth = await authorizeWarehouse(params.slug);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const code = (new URL(req.url).searchParams.get('code') ?? '').trim();
  if (!code || code.length > 64) return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });

  const select = 'id, sku, name, item_type, track_stock, unit_id, status, warehouse_units(code, symbol)';
  const { data: barcode } = await ctx.service
    .from('warehouse_item_barcodes')
    .select('item_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('code', code)
    .maybeSingle();
  const { data: item, error } = barcode
    ? await ctx.service.from('warehouse_items').select(select).eq('tenant_id', ctx.tenantId).eq('id', barcode.item_id).maybeSingle()
    : await ctx.service.from('warehouse_items').select(select).eq('tenant_id', ctx.tenantId).eq('sku', code).maybeSingle();
  if (error) return dbErrorResponse(error);
  if (!item) {
    const { data: settings } = await ctx.service
      .from('warehouse_settings')
      .select('unknown_code_action')
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    return NextResponse.json(
      {
        error: 'Código desconocido.',
        can_create: settings?.unknown_code_action !== 'block' && ctx.can('catalog.create'),
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ item, matched: barcode ? 'barcode' : 'sku' });
}
