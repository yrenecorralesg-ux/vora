import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import {
  PosError,
  buildSalePayload,
  getSale,
  getShift,
  listSales,
  loadPosConfig,
  resolveActorFromOfflineProof,
  sqlErrorMessage,
  userDisplayNames,
  verifyOfflinePinProof,
} from '@/lib/pos/server';

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
 * Soporta también sincronización de ventas offline con firma de operador y/o
 * autorización de descuento firmada por PIN de supervisor.
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
  const idempotencyKey = String(body.idempotency_key ?? '').trim();

  const actorCheck = await resolveActorFromOfflineProof({
    service,
    tenantId,
    authUserId: userId,
    offlineOperatorAuth: body.offline_operator_auth,
    requiredPermission: 'pos.sales.create',
    actionScope: `sale:${idempotencyKey}`,
  });
  if (!actorCheck.ok) {
    return NextResponse.json({ ok: false, error: actorCheck.error }, { status: actorCheck.status });
  }
  const effectiveUserId = actorCheck.actorId;
  let effectiveAccess = auth.access;
  if (effectiveUserId !== userId) {
    const { data: mem } = await service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', effectiveUserId)
      .eq('status', 'active')
      .maybeSingle();
    if (!mem) return permissionDenied('El operador de la venta no está activo en la empresa.');
    effectiveAccess = { ...auth.access, userId: effectiveUserId, role: mem.role };
  }

  let createdOfflineAuthId: string | null = null;
  try {
    // Si la venta fue autorizada offline (o su pre-autorización venció mientras estaba en cola),
    // validamos la firma criptográfica del supervisor y generamos la autorización atómica.
    let discountAuthId = body.discount_authorization_id ? String(body.discount_authorization_id) : null;
    if (discountAuthId && body.offline_discount_auth) {
      const { data: existingAuth } = await service
        .from('pos_authorizations')
        .select('id, consumed_at, expires_at')
        .eq('tenant_id', tenantId)
        .eq('id', discountAuthId)
        .maybeSingle();
      const expired =
        !existingAuth ||
        existingAuth.consumed_at !== null ||
        (existingAuth.expires_at && new Date(existingAuth.expires_at) <= new Date());
      if (expired && !existingAuth?.consumed_at) {
        discountAuthId = null;
      }
    }

    if (!discountAuthId && body.offline_discount_auth && typeof body.offline_discount_auth === 'object') {
      const offAuth = body.offline_discount_auth as Record<string, any>;
      const supervisorId = String(offAuth.supervisor_id ?? '').trim();
      const proof = String(offAuth.proof ?? '').trim();
      const check = await verifyOfflinePinProof({
        service,
        tenantId,
        userId: supervisorId,
        permission: 'pos.sales.discount.override',
        proof,
        message: `supervisor:${tenantId}:${supervisorId}:discount_override:${idempotencyKey}`,
      });
      if (!check.ok) {
        return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
      }
      const shift = body.shift_id ? await getShift(service, tenantId, String(body.shift_id)) : null;
      const branchId = shift?.branch_id ?? body.branch_id ?? null;
      if (!branchId) {
        return NextResponse.json({ ok: false, error: 'Sede no válida para autorización offline.' }, { status: 400 });
      }
      const names = await userDisplayNames(service, [supervisorId]);
      const authInsert = {
        tenant_id: tenantId,
        branch_id: branchId,
        shift_id: shift?.id ?? null,
        operation_type: 'discount_override',
        requested_by: effectiveUserId,
        approved_by: supervisorId,
        approver_name_snapshot: names.get(supervisorId) ?? null,
        reason: String(offAuth.reason ?? 'Descuento autorizado sin conexión').trim().slice(0, 500) || 'Autorización offline',
        limit_snapshot: (offAuth.limit_snapshot ?? {}) as Record<string, unknown>,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        ...(offAuth.authorized_at ? { offline_authorized_at: String(offAuth.authorized_at) } : {}),
      };
      let authRowRes = await service
        .from('pos_authorizations')
        .insert(authInsert)
        .select('id')
        .single();
      if (authRowRes.error && authInsert.offline_authorized_at) {
        const { offline_authorized_at: _omit, ...compatInsert } = authInsert;
        authRowRes = await service.from('pos_authorizations').insert(compatInsert).select('id').single();
      }
      if (authRowRes.error || !authRowRes.data) {
        return NextResponse.json({ ok: false, error: 'No se pudo registrar la autorización de descuento offline.' }, { status: 500 });
      }
      discountAuthId = authRowRes.data.id;
      createdOfflineAuthId = discountAuthId;
    }

    const config = await loadPosConfig(service, tenantId);
    const payload = await buildSalePayload({
      service,
      tenantId,
      config,
      body: discountAuthId ? { ...body, discount_authorization_id: discountAuthId } : body,
      canOverrideDiscount: await hasTenantPermission(effectiveAccess, 'pos.sales.discount.override'),
    });
    const { data, error } = await service.rpc('pos_record_sale', {
      p_tenant: tenantId,
      p_actor: effectiveUserId,
      p_sale: payload,
    });
    if (error) {
      if (createdOfflineAuthId) {
        await service.from('pos_authorizations').delete().eq('id', createdOfflineAuthId).eq('tenant_id', tenantId);
      }
      return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo registrar la venta.') }, { status: 409 });
    }

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
    if (createdOfflineAuthId) {
      await service.from('pos_authorizations').delete().eq('id', createdOfflineAuthId).eq('tenant_id', tenantId);
    }
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message || 'Error en servidor.' }, { status: e.status ?? 500 });
  }
}
