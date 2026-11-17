import { NextResponse } from 'next/server';
import { auditWarehouse, authorizeWarehouse, dbErrorResponse } from '@/lib/warehouse/access';
import { validateItemInput } from '@/lib/warehouse/validation';

export const dynamic = 'force-dynamic';

/** PATCH: guardar cambios de la ficha (WH-03). El SKU no se reutiliza para otro artículo. */
export async function PATCH(req: Request, { params }: { params: { slug: string; id: string } }) {
  const auth = await authorizeWarehouse(params.slug, { permission: 'catalog.create' });
  if (!auth.ok) return auth.response;
  const { ctx } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });

  const { data: current } = await ctx.service
    .from('warehouse_items')
    .select('id, sku, item_type')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', params.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: 'Artículo no encontrado.' }, { status: 404 });

  const { item, errors } = await validateItemInput(ctx, body);
  if (!item) return NextResponse.json({ error: 'Revisa los campos marcados.', fields: errors }, { status: 400 });

  // Cambiar entre "maneja stock" y "no maneja stock" con movimientos dejaría saldos huérfanos.
  if (item.item_type !== current.item_type) {
    const { count } = await ctx.service
      .from('warehouse_movements')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('item_id', params.id);
    if (count)
      return NextResponse.json(
        { error: 'No se puede cambiar el tipo de un artículo con movimientos.', fields: [{ field: 'item_type', message: 'Tiene movimientos registrados.' }] },
        { status: 409 },
      );
  }

  const { barcodes, ...fields } = item;
  const { data: existingCodes } = await ctx.service
    .from('warehouse_item_barcodes')
    .select('code')
    .eq('tenant_id', ctx.tenantId)
    .eq('item_id', params.id);
  const before = new Set((existingCodes ?? []).map((c) => c.code));
  const toAdd = barcodes.filter((c) => !before.has(c));
  const toRemove = Array.from(before).filter((c) => !barcodes.includes(c));

  if (toAdd.length) {
    const { error } = await ctx.service
      .from('warehouse_item_barcodes')
      .insert(toAdd.map((code) => ({ tenant_id: ctx.tenantId, item_id: params.id, code })));
    if (error)
      return error.code === '23505'
        ? NextResponse.json({ error: 'Un código de barras ya pertenece a otro artículo.' }, { status: 409 })
        : dbErrorResponse(error);
  }
  const { error } = await ctx.service
    .from('warehouse_items')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('tenant_id', ctx.tenantId)
    .eq('id', params.id);
  if (error) return dbErrorResponse(error, 'No se pudo guardar el artículo.');
  if (toRemove.length)
    await ctx.service
      .from('warehouse_item_barcodes')
      .delete()
      .eq('tenant_id', ctx.tenantId)
      .eq('item_id', params.id)
      .in('code', toRemove);

  await auditWarehouse(ctx, 'item.update', 'warehouse_items', params.id, {
    sku: item.sku,
    previous_sku: current.sku !== item.sku ? current.sku : undefined,
    barcodes_added: toAdd,
    barcodes_removed: toRemove,
  });
  return NextResponse.json({ ok: true });
}
