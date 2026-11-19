import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branch_id');
  const shiftId = searchParams.get('shift_id');
  const cashierId = searchParams.get('cashier_id');
  const commercialStatus = searchParams.get('commercial_status');
  const paymentStatus = searchParams.get('payment_status');
  const query = searchParams.get('query')?.toLowerCase();

  let list = posStore.sales;

  if (branchId) {
    list = list.filter((s) => s.branch_id === branchId);
  }
  if (shiftId) {
    list = list.filter((s) => s.shift_id === shiftId);
  }
  if (cashierId) {
    list = list.filter((s) => s.cashier_user_id === cashierId);
  }
  if (commercialStatus) {
    list = list.filter((s) => s.commercial_status === commercialStatus);
  }
  if (paymentStatus) {
    list = list.filter((s) => s.payment_status === paymentStatus);
  }
  if (query) {
    list = list.filter(
      (s) =>
        s.sale_number.toLowerCase().includes(query) ||
        s.customer?.legal_name.toLowerCase().includes(query) ||
        s.customer?.document_number.toLowerCase().includes(query),
    );
  }

  return NextResponse.json({
    ok: true,
    sales: list,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  try {
    const payload = await request.json();
    const supabase = getSupabaseServiceClient();

    // 1. Resolver tenant e info de módulos
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle();

    let isWarehouseIntegrationActive = false;
    let stockPolicy = 'warn_and_allow'; // 'strict_block' | 'warn_and_allow' | 'allow_unrestricted'

    if (tenant) {
      const { data: tfRows } = await supabase
        .from('tenant_features')
        .select('feature_key, enabled, config')
        .eq('tenant_id', tenant.id);

      const whFeature = (tfRows || []).find((f) => f.feature_key === 'warehouse.inventory');
      const whConfig = (whFeature?.config as Record<string, any>) || {};
      const whFunctions = whConfig.functions || {};

      isWarehouseIntegrationActive = Boolean(whFeature?.enabled) && whFunctions.wh_pos_integration !== false;
      if (whConfig.pos_stock_policy) {
        stockPolicy = whConfig.pos_stock_policy;
      }
    }

    // 2. Validación de política de stock estricta ('strict_block')
    if (isWarehouseIntegrationActive && stockPolicy === 'strict_block' && Array.isArray(payload.lines)) {
      for (const line of payload.lines) {
        if (!line.isService) {
          const prod = posStore.products.find((p) => p.sku === line.sku || p.id === line.productId);
          if (prod && prod.stock_quantity < line.quantity) {
            return NextResponse.json(
              {
                ok: false,
                error: `Bloqueo de inventario: Stock insuficiente para ${prod.name} (${prod.sku}). Solicitado: ${line.quantity}, disponible: ${prod.stock_quantity}.`,
                stock_policy: stockPolicy,
              },
              { status: 400 },
            );
          }
        }
      }
    }

    // 3. Confirmación de venta
    let confirmedSale: any = null;
    let saleSource = 'local_in_memory';
    let isIdempotentReplay = false;

    // Intento RPC de Supabase si existe
    if (tenant) {
      try {
        payload.tenant_id = tenant.id;
        const { data: rpcData, error: rpcError } = await supabase.rpc('vora_pos_confirm_sale', {
          p_payload: payload,
        });

        if (!rpcError && rpcData?.ok) {
          confirmedSale = rpcData;
          saleSource = 'supabase_rpc';
          isIdempotentReplay = rpcData.idempotent_replay ?? false;
        }
      } catch {
        // Fallback a motor local
      }
    }

    // Fallback de alta disponibilidad en memoria
    const memRes = posStore.confirmSale({
      branchId: payload.branch_id,
      shiftId: payload.shift_id,
      registerId: payload.register_id,
      cashierUserId: payload.cashier_user_id,
      customerId: payload.customer_id,
      idempotencyKey: payload.idempotency_key,
      correlationId: payload.correlation_id || `corr-${Date.now()}`,
      lines: payload.lines || [],
      payments: payload.payments || [],
      notes: payload.notes,
      discountAuthorizationId: payload.discount_authorization_id,
    });

    if (!memRes.ok) {
      return NextResponse.json({ ok: false, error: memRes.error }, { status: 400 });
    }

    if (!confirmedSale) {
      confirmedSale = memRes.sale;
      isIdempotentReplay = memRes.idempotentReplay ?? false;
    }

    // 4. Integración Warehouse: registrar evento de salida por venta (WH-14 / Kardex)
    let warehouseSynced = false;
    if (tenant && isWarehouseIntegrationActive && !isIdempotentReplay) {
      try {
        const saleLines = (payload.lines || []).filter((l: any) => !l.isService && l.sku);
        if (saleLines.length > 0) {
          const { error: whErr } = await supabase.rpc('warehouse_register_pos_event', {
            p_tenant: tenant.id,
            p_actor: auth.access.userId,
            p_event: {
              kind: 'sale',
              reference: confirmedSale.sale_number,
              warehouse_id: payload.warehouse_id || null,
              lines: saleLines.map((l: any) => ({
                sku: String(l.sku),
                quantity: Number(l.quantity),
              })),
            },
          });

          if (!whErr) {
            warehouseSynced = true;
          } else {
            console.warn('[pos/sales] warehouse_register_pos_event warning:', whErr.message);
          }
        }
      } catch (err: any) {
        console.warn('[pos/sales] Error al registrar evento warehouse:', err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      sale: confirmedSale,
      source: saleSource,
      warehouse_synced: warehouseSynced,
      stock_policy: stockPolicy,
      idempotent_replay: isIdempotentReplay,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
