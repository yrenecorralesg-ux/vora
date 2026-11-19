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

  return NextResponse.json({
    ok: true,
    returns: posStore.returns,
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

    // 1. Procesar devolución en el motor transaccional
    const result = posStore.processReturn({
      branchId: payload.branch_id,
      shiftId: payload.shift_id,
      originalSaleId: payload.original_sale_id,
      returnType: payload.return_type,
      reason: payload.reason,
      notes: payload.notes,
      refundMethod: payload.refund_method,
      requestedBy: payload.requested_by,
      approvedBy: payload.approved_by,
      lines: payload.lines || [],
    });

    if (!result.ok || !result.returnRecord) {
      return NextResponse.json({ ok: false, error: result.error || 'Error al procesar devolución' }, { status: 400 });
    }

    const returnRecord = result.returnRecord;

    // 2. Resolver tenant y verificar integración con Warehouse
    let warehouseRestored = false;
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle();

    if (tenant) {
      const { data: tfRows } = await supabase
        .from('tenant_features')
        .select('feature_key, enabled, config')
        .eq('tenant_id', tenant.id);

      const whFeature = (tfRows || []).find((f) => f.feature_key === 'warehouse.inventory');
      const whConfig = (whFeature?.config as Record<string, any>) || {};
      const whFunctions = whConfig.functions || {};
      const isWarehouseIntegrationActive = Boolean(whFeature?.enabled) && whFunctions.wh_pos_integration !== false;

      if (isWarehouseIntegrationActive && returnRecord.lines && returnRecord.lines.length > 0) {
        try {
          // Reconstruir líneas devueltas con SKU
          const linesToRestore: Array<{ sku: string; quantity: number }> = [];
          const originalSale = posStore.sales.find((s) => s.id === payload.original_sale_id);

          for (const retLine of returnRecord.lines) {
            const origLine = originalSale?.lines?.find((l) => l.id === retLine.sale_line_id);
            const lineSku = origLine?.sku_snapshot;
            if (origLine && !origLine.is_service && lineSku) {
              linesToRestore.push({
                sku: lineSku,
                quantity: retLine.quantity_returned,
              });
            }
          }

          if (linesToRestore.length > 0) {
            const { error: whErr } = await supabase.rpc('warehouse_register_pos_event', {
              p_tenant: tenant.id,
              p_actor: auth.access.userId,
              p_event: {
                kind: 'return',
                reference: returnRecord.return_number,
                warehouse_id: payload.warehouse_id || null,
                lines: linesToRestore,
              },
            });

            if (!whErr) {
              warehouseRestored = true;
            } else {
              console.warn('[pos/returns] warehouse_register_pos_event warning:', whErr.message);
            }
          }
        } catch (err: any) {
          console.warn('[pos/returns] Error al reintegrar inventario en warehouse:', err.message);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      return_record: returnRecord,
      warehouse_restored: warehouseRestored,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
