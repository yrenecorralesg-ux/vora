import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';
import { posStore } from '@/lib/pos-service';
import type { PosProduct } from '@/lib/types';
import { NON_STOCK_TYPES } from '@/lib/warehouse/catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  try {
    const supabase = getSupabaseServiceClient();

    // 1. Resolver tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, commercial_name')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ ok: true, source: 'fallback', products: posStore.products });
    }

    // 2. Verificar si warehouse.inventory y wh_pos_integration están activos
    const { data: tfRows } = await supabase
      .from('tenant_features')
      .select('feature_key, enabled, config')
      .eq('tenant_id', tenant.id);

    const whFeature = (tfRows || []).find((f) => f.feature_key === 'warehouse.inventory');
    const isWarehouseEnabled = Boolean(whFeature?.enabled);
    const whFunctions = (whFeature?.config as Record<string, any>)?.functions || {};
    const isPosIntegrationActive = whFunctions.wh_pos_integration !== false;

    // Si Warehouse no está activo o la integración está apagada, usar POS standalone
    if (!isWarehouseEnabled || !isPosIntegrationActive) {
      return NextResponse.json({
        ok: true,
        source: 'pos_standalone',
        is_warehouse_enabled: false,
        products: posStore.products,
      });
    }

    // 3. Resolver almacén predeterminado del tenant
    const { data: warehouses } = await supabase
      .from('warehouse_warehouses')
      .select('id, name, is_default, active')
      .eq('tenant_id', tenant.id)
      .eq('active', true)
      .order('is_default', { ascending: false });

    const activeWarehouse = warehouses?.[0] || null;

    // 4. Consultar catálogo de warehouse_items con sus existencias y códigos de barra
    const { data: items, error: itemsErr } = await supabase
      .from('warehouse_items')
      .select(`
        id,
        sku,
        name,
        item_type,
        track_stock,
        price_usd,
        status,
        warehouse_units(code, symbol),
        warehouse_item_barcodes(code),
        warehouse_balances(on_hand, reserved, warehouse_id)
      `)
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .order('name');

    if (itemsErr || !items || items.length === 0) {
      // Si aún no hay ítems en la BD de warehouse, fallback a productos base para no interrumpir
      return NextResponse.json({
        ok: true,
        source: 'pos_standalone_fallback',
        is_warehouse_enabled: true,
        warehouse: activeWarehouse,
        products: posStore.products,
      });
    }

    // 5. Mapear warehouse_items al formato unificado PosProduct
    const mappedProducts: PosProduct[] = items.map((item: any) => {
      const isService = !item.track_stock || NON_STOCK_TYPES.includes(item.item_type);
      const whBalances = Array.isArray(item.warehouse_balances) ? item.warehouse_balances : [];
      const balance = activeWarehouse
        ? whBalances.find((b: any) => b.warehouse_id === activeWarehouse.id) || whBalances[0]
        : whBalances[0];

      const onHand = Number(balance?.on_hand ?? 0);
      const reserved = Number(balance?.reserved ?? 0);
      const availableStock = Math.max(0, onHand - reserved);

      const barcodes = Array.isArray(item.warehouse_item_barcodes) ? item.warehouse_item_barcodes : [];
      const primaryBarcode = barcodes[0]?.code || item.sku;

      return {
        id: item.id,
        tenant_id: tenant.id,
        branch_id: '',
        sku: item.sku,
        name: item.name,
        category: 'Inventario Warehouse',
        is_service: isService,
        price_usd: Number(item.price_usd || 0),
        tax_rate_percent: 16,
        stock_quantity: isService ? 999 : availableStock,
        barcode: primaryBarcode,
        status: isService || availableStock > 0 ? 'disponible' : 'agotado',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Sincronizar en memoria de posStore para que el motor de venta y checkout tengan los mismos productos
    posStore.products = mappedProducts;

    return NextResponse.json({
      ok: true,
      source: 'warehouse_unified',
      is_warehouse_enabled: true,
      warehouse: activeWarehouse,
      products: mappedProducts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Error al obtener productos de warehouse' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const sku = (body.sku || '').trim().toUpperCase();
    const name = (body.name || '').trim();
    const priceUsd = Number(body.price_usd || 0);
    const initialStock = Math.max(0, Number(body.initial_stock || 0));
    const barcode = (body.barcode || sku).trim();
    const isService = Boolean(body.is_service);
    const category = (body.category || 'General').trim();

    if (!sku || !name) {
      return NextResponse.json({ ok: false, error: 'SKU y Nombre son requeridos.' }, { status: 400 });
    }

    if (priceUsd < 0) {
      return NextResponse.json({ ok: false, error: 'El precio no puede ser negativo.' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    // 1. Resolver tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, commercial_name')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 });
    }

    // 2. Verificar si warehouse.inventory está habilitado
    const { data: tfRows } = await supabase
      .from('tenant_features')
      .select('feature_key, enabled')
      .eq('tenant_id', tenant.id);

    const whFeature = (tfRows || []).find((f) => f.feature_key === 'warehouse.inventory');
    const isWarehouseEnabled = Boolean(whFeature?.enabled);

    let createdProduct: PosProduct;

    if (isWarehouseEnabled) {
      // 3. Buscar unidad estándar (UND)
      const { data: units } = await supabase
        .from('warehouse_units')
        .select('id')
        .eq('tenant_id', tenant.id)
        .order('created_at');

      const unitId = units?.[0]?.id;
      if (!unitId) {
        return NextResponse.json({ ok: false, error: 'No se encontraron unidades de medida en el almacén.' }, { status: 500 });
      }

      // 4. Crear artículo en warehouse_items
      const { data: itemRow, error: itemErr } = await supabase
        .from('warehouse_items')
        .insert({
          tenant_id: tenant.id,
          sku,
          name,
          item_type: isService ? 'service' : 'physical',
          unit_id: unitId,
          price_usd: priceUsd,
          tax_rate: 16.00,
          min_stock: 3,
          status: 'active',
          created_by: auth.access.userId,
        })
        .select('id, sku, name, price_usd, status')
        .single();

      if (itemErr || !itemRow) {
        const msg = itemErr?.code === '23505'
          ? `El SKU ${sku} ya existe en el catálogo.`
          : itemErr?.message || 'Error al guardar producto en almacén.';
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }

      // 5. Asignar código de barras
      if (barcode) {
        await supabase.from('warehouse_item_barcodes').insert({
          tenant_id: tenant.id,
          item_id: itemRow.id,
          code: barcode,
          type: 'ean13',
        });
      }

      // 6. Si se indicó stock inicial y no es servicio, asentar movimiento en Kardex
      let realStock = 0;
      if (initialStock > 0 && !isService) {
        const { data: whSettings } = await supabase
          .from('warehouse_settings')
          .select('default_warehouse_id')
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        const { data: warehouses } = await supabase
          .from('warehouse_warehouses')
          .select('id')
          .eq('tenant_id', tenant.id)
          .order('created_at');

        const warehouseId = whSettings?.default_warehouse_id || warehouses?.[0]?.id;

        if (warehouseId) {
          try {
            await supabase.rpc('warehouse_apply_movement', {
              p_tenant: tenant.id,
              p_item: itemRow.id,
              p_warehouse: warehouseId,
              p_type: 'receipt',
              p_qty: initialStock,
              p_unit_cost: priceUsd * 0.6,
              p_bucket: 'on_hand',
              p_document: null,
              p_ref_type: 'pos_direct_create',
              p_ref_id: 'INIT-STOCK',
              p_reason: 'Carga inicial de existencias desde el Punto de Venta',
              p_key: `pos:init:${tenant.id}:${itemRow.id}`,
              p_actor: auth.access.userId,
            });
            realStock = initialStock;
          } catch (mErr: any) {
            console.warn('[pos/products] Error aplicando stock inicial:', mErr.message);
          }
        }
      }

      createdProduct = {
        id: itemRow.id,
        tenant_id: tenant.id,
        branch_id: '',
        sku: itemRow.sku,
        name: itemRow.name,
        category,
        is_service: isService,
        price_usd: Number(itemRow.price_usd),
        tax_rate_percent: 16,
        stock_quantity: isService ? 999 : realStock,
        barcode,
        status: isService || realStock > 0 ? 'disponible' : 'agotado',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      // Standalone POS
      createdProduct = {
        id: `p-${Date.now()}`,
        tenant_id: tenant.id,
        branch_id: '',
        sku,
        name,
        category,
        is_service: isService,
        price_usd: priceUsd,
        tax_rate_percent: 16,
        stock_quantity: isService ? 999 : initialStock,
        barcode,
        status: isService || initialStock > 0 ? 'disponible' : 'agotado',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Actualizar catálogo en memoria de posStore
    posStore.products = [createdProduct, ...posStore.products.filter((p) => p.sku !== sku)];

    return NextResponse.json({
      ok: true,
      product: createdProduct,
      message: `Producto ${createdProduct.name} (${createdProduct.sku}) creado con éxito.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Error en el servidor al crear producto.' },
      { status: 500 },
    );
  }
}

