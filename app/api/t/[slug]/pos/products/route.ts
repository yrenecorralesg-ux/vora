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
