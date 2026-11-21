import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import { PosError, buildSalePayload, getSale, listSales, loadPosConfig, sqlErrorMessage } from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  try {
    const sales = await listSales(getSupabaseServiceClient(), auth.access.tenantId, {
      branchId: searchParams.get('branch_id'),
      shiftId: searchParams.get('shift_id'),
      cashierId: searchParams.get('cashier_id'),
      commercialStatus: searchParams.get('commercial_status'),
      paymentStatus: searchParams.get('payment_status'),
      query: searchParams.get('query'),
      limit: Number(searchParams.get('limit')) || undefined,
    });
    return NextResponse.json({ ok: true, sales });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 500 });
  }
}

/**
 * Confirma una venta. El servidor recalcula precios, impuestos y totales desde
 * el catálogo, y pos_record_sale guarda venta, pagos y salida de stock en una
 * sola transacción (idempotente por idempotency_key).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  if (!(await hasTenantPermission(auth.access, 'pos.sales.create')))
    return permissionDenied('Tu rol no permite registrar ventas en el POS.');

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { tenantId, userId } = auth.access;
  try {
    const config = await loadPosConfig(service, tenantId);
    const payload = await buildSalePayload({
      service,
      tenantId,
      config,
      body,
      canOverrideDiscount: await hasTenantPermission(auth.access, 'pos.sales.discount.override'),
    });
    const { data, error } = await service.rpc('pos_record_sale', {
      p_tenant: tenantId,
      p_actor: userId,
      p_sale: payload,
    });
    if (error)
      return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo registrar la venta.') }, { status: 409 });

    const result = data as { sale_id: string; replay: boolean };
    const sale = await getSale(service, tenantId, result.sale_id);
    return NextResponse.json({
      ok: true,
      sale,
      source: 'supabase',
      catalog_source: config.catalogSource,
      warehouse_synced: config.catalogSource === 'warehouse' && config.trackStock,
      idempotent_replay: result.replay,
    });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message || 'Error en servidor.' }, { status: e.status ?? 500 });
  }
}
