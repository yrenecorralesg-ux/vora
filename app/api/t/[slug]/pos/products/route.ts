import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import { authorizeWarehouse } from '@/lib/warehouse/access';
import { PosError, listCatalog, loadPosConfig } from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Catálogo del POS: warehouse_items o pos_products según config.catalog_source. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  try {
    const config = await loadPosConfig(service, auth.access.tenantId);
    const products = await listCatalog(service, auth.access.tenantId, config);
    return NextResponse.json({
      ok: true,
      source: config.catalogSource,
      is_warehouse_enabled: config.warehouseActive,
      track_stock: config.trackStock,
      stock_policy: config.stockPolicy,
      products,
    });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 500 });
  }
}

/**
 * Alta rápida de producto desde el POS. Con catálogo de Warehouse exige sus
 * permisos (catalog.create y, si hay stock inicial, stock.receive); con el
 * catálogo propio del POS exige pos.settings.manage.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const { tenantId, userId } = auth.access;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }
  const sku = String(body.sku ?? '').trim().toUpperCase();
  const name = String(body.name ?? '').trim();
  const priceUsd = Number(body.price_usd ?? 0);
  const initialStock = Math.max(0, Number(body.initial_stock ?? 0));
  const barcode = String(body.barcode ?? '').trim();
  const isService = Boolean(body.is_service);
  const category = String(body.category ?? 'General').trim() || 'General';
  const unitCost = body.unit_cost === undefined || body.unit_cost === null || body.unit_cost === '' ? null : Number(body.unit_cost);

  if (!sku || !name) return NextResponse.json({ ok: false, error: 'SKU y nombre son requeridos.' }, { status: 400 });
  if (!/^[A-Z0-9][A-Z0-9\-_.]{0,63}$/.test(sku))
    return NextResponse.json({ ok: false, error: 'El SKU solo admite letras, números, guion, punto y guion bajo.' }, { status: 400 });
  if (!Number.isFinite(priceUsd) || priceUsd < 0)
    return NextResponse.json({ ok: false, error: 'El precio no puede ser negativo.' }, { status: 400 });
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0))
    return NextResponse.json({ ok: false, error: 'El costo unitario no es válido.' }, { status: 400 });
  if (barcode && !/^[A-Za-z0-9\-._/]{1,64}$/.test(barcode))
    return NextResponse.json({ ok: false, error: 'El código de barras tiene caracteres no válidos.' }, { status: 400 });
  const wantsStock = initialStock > 0 && !isService;

  const service = getSupabaseServiceClient();
  const config = await loadPosConfig(service, tenantId);

  if (config.catalogSource === 'warehouse') {
    if (config.warehouseActive) {
      const wh = await authorizeWarehouse(params.slug, { permission: 'catalog.create' });
      if (!wh.ok) return wh.response;
      if (wantsStock && !wh.ctx.can('stock.receive'))
        return permissionDenied('Tu rol no permite registrar stock inicial en el almacén.');
      if (wantsStock && unitCost === null)
        return NextResponse.json({ ok: false, error: 'Indica el costo unitario para registrar el stock inicial.' }, { status: 400 });
    } else {
      if (!(await hasTenantPermission(auth.access, 'pos.settings.manage')))
        return permissionDenied('Tu rol no permite crear productos en el POS.');
      if (wantsStock)
        return NextResponse.json(
          { ok: false, error: 'Sin Warehouse activo no se registran existencias; crea el producto sin stock inicial.' },
          { status: 400 },
        );
      await service.rpc('warehouse_bootstrap', { p_tenant: tenantId });
    }

    const { data: unit } = await service
      .from('warehouse_units')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('code', 'UND')
      .maybeSingle();
    if (!unit) return NextResponse.json({ ok: false, error: 'No hay unidad base (UND) en el catálogo.' }, { status: 500 });

    await service
      .from('warehouse_categories')
      .upsert({ tenant_id: tenantId, name: category }, { onConflict: 'tenant_id,name', ignoreDuplicates: true });
    const { data: cat } = await service
      .from('warehouse_categories')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', category)
      .maybeSingle();

    const { data: item, error: itemErr } = await service
      .from('warehouse_items')
      .insert({
        tenant_id: tenantId,
        sku,
        name,
        item_type: isService ? 'service' : 'physical',
        unit_id: unit.id,
        category_id: cat?.id ?? null,
        price_usd: priceUsd,
        tax_rate: 16,
        status: 'active',
        created_by: userId,
      })
      .select('id')
      .single();
    if (itemErr || !item) {
      const msg = itemErr?.code === '23505' ? `El SKU ${sku} ya existe en el catálogo.` : 'No se pudo crear el producto.';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const warnings: string[] = [];
    if (barcode) {
      const { error } = await service.from('warehouse_item_barcodes').insert({ tenant_id: tenantId, item_id: item.id, code: barcode });
      if (error) warnings.push('El código de barras ya pertenece a otro artículo; no se asignó.');
    }
    if (wantsStock) {
      const { data: settings } = await service
        .from('warehouse_settings')
        .select('default_warehouse_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const { error: movErr } = await service.rpc('warehouse_apply_movement', {
        p_tenant: tenantId,
        p_item: item.id,
        p_warehouse: settings?.default_warehouse_id,
        p_type: 'receipt',
        p_qty: initialStock,
        p_unit_cost: unitCost,
        p_bucket: 'on_hand',
        p_document: null,
        p_ref_type: 'pos_direct_create',
        p_ref_id: 'INIT-STOCK',
        p_reason: 'Carga inicial de existencias desde el Punto de Venta',
        p_key: `pos:init:${tenantId}:${item.id}`,
        p_actor: userId,
      });
      if (movErr) warnings.push(`No se registró el stock inicial: ${movErr.message}`);
    }
    const product = (await listCatalog(service, tenantId, config)).find((p) => p.id === item.id) ?? null;
    return NextResponse.json({ ok: true, product, warnings, message: `Producto ${name} (${sku}) creado.` });
  }

  // Catálogo propio del POS (pos_products, por sede).
  if (!(await hasTenantPermission(auth.access, 'pos.settings.manage')))
    return permissionDenied('Tu rol no permite crear productos en el POS.');
  let branchId: string | null = null;
  if (body.branch_id) {
    const { data } = await service
      .from('tenant_branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', String(body.branch_id))
      .maybeSingle();
    branchId = data?.id ?? null;
  }
  if (!branchId) {
    const { data } = await service
      .from('tenant_branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();
    branchId = data?.id ?? null;
  }
  if (!branchId) return NextResponse.json({ ok: false, error: 'Crea una sede antes de registrar productos.' }, { status: 400 });

  const stock = isService ? 0 : initialStock;
  const { data: created, error } = await service
    .from('pos_products')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      sku,
      barcode: barcode || null,
      name,
      category,
      is_service: isService,
      price_usd: priceUsd,
      tax_rate_percent: 16,
      stock_quantity: stock,
      status: isService || stock > 0 ? 'disponible' : 'agotado',
    })
    .select('*')
    .single();
  if (error || !created) {
    const msg = error?.code === '23505' ? `El SKU ${sku} ya existe en la sede.` : 'No se pudo crear el producto.';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  if (stock > 0)
    await service.from('pos_inventory_kardex').insert({
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: created.id,
      movement_type: 'ajuste_inicial',
      quantity_delta: stock,
      stock_before: 0,
      stock_after: stock,
      actor_id: userId,
    });
  return NextResponse.json({
    ok: true,
    product: { ...created, price_usd: Number(created.price_usd), stock_quantity: Number(created.stock_quantity) },
    warnings: [],
    message: `Producto ${name} (${sku}) creado.`,
  });
}
