import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantModuleApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import {
  PosError,
  getSale,
  listReturns,
  loadPosConfig,
  resolveActorFromOfflineProof,
  sqlErrorMessage,
  userDisplayNames,
  verifyOfflinePinProof,
  verifySupervisorPin,
} from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, returns: await listReturns(getSupabaseServiceClient(), auth.access.tenantId) });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 500 });
  }
}

/**
 * Devolución / anulación (POS-14). La aprueba un supervisor: o bien quien tiene
 * la sesión posee pos.refunds.approve, o el cajero envía supervisor_id + PIN
 * (online) o prueba offline firmada por el PIN del supervisor.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  const { tenantId, userId } = auth.access;
  const service = getSupabaseServiceClient();

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  const idempotencyKey = body.idempotency_key ? String(body.idempotency_key).trim() : '';
  const actorCheck = await resolveActorFromOfflineProof({
    service,
    tenantId,
    authUserId: userId,
    offlineOperatorAuth: body.offline_operator_auth,
    requiredPermission: 'pos.sales.create',
    actionScope: `return:${idempotencyKey}`,
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
    if (!mem) return permissionDenied('El operador no está activo en la empresa.');
    effectiveAccess = { ...auth.access, userId: effectiveUserId, role: mem.role };
  }

  const isSupervisor = await hasTenantPermission(effectiveAccess, 'pos.refunds.approve');
  if (!isSupervisor && !(await hasTenantPermission(effectiveAccess, 'pos.sales.create')))
    return permissionDenied('Tu rol no permite registrar devoluciones.');

  let approvedBy = effectiveUserId;
  let authorizationId: string | null = null;
  let offlineAuthorizedAt: string | null = null;
  if (!isSupervisor) {
    if (body.offline_supervisor_auth && typeof body.offline_supervisor_auth === 'object') {
      const offAuth = body.offline_supervisor_auth as Record<string, any>;
      const supId = String(offAuth.supervisor_id ?? '').trim();
      const check = await verifyOfflinePinProof({
        service,
        tenantId,
        userId: supId,
        permission: 'pos.refunds.approve',
        proof: String(offAuth.proof ?? ''),
        message: `supervisor:${tenantId}:${supId}:sale_return:${idempotencyKey}`,
      });
      if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
      approvedBy = supId;
      offlineAuthorizedAt = offAuth.authorized_at ? String(offAuth.authorized_at) : null;
    } else {
      if (!body.supervisor_id || !body.supervisor_pin)
        return permissionDenied('Las devoluciones requieren el PIN de un supervisor.');
      const check = await verifySupervisorPin({
        service,
        tenantId,
        supervisorId: String(body.supervisor_id),
        pin: String(body.supervisor_pin),
        permission: 'pos.refunds.approve',
      });
      if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
      approvedBy = String(body.supervisor_id);
    }
  }

  try {
    const config = await loadPosConfig(service, tenantId);
    const sale = await getSale(service, tenantId, String(body.original_sale_id ?? ''));
    if (!sale) return NextResponse.json({ ok: false, error: 'Venta de referencia no encontrada.' }, { status: 404 });

    const authInsert = {
      tenant_id: tenantId,
      branch_id: sale.branch_id,
      shift_id: body.shift_id || null,
      sale_id: sale.id,
      operation_type: 'sale_return',
      requested_by: effectiveUserId,
      approved_by: approvedBy,
      approver_name_snapshot: (await userDisplayNames(service, [approvedBy])).get(approvedBy) ?? null,
      reason: String(body.reason ?? '').trim().slice(0, 500) || 'Devolución',
      limit_snapshot: { return_type: body.return_type, refund_method: body.refund_method },
      consumed_at: new Date().toISOString(),
      ...(offlineAuthorizedAt ? { offline_authorized_at: offlineAuthorizedAt } : {}),
    };
    let authRes = await service
      .from('pos_authorizations')
      .insert(authInsert)
      .select('id')
      .single();
    if (authRes.error && offlineAuthorizedAt) {
      const { offline_authorized_at: _omit, ...compatInsert } = authInsert;
      authRes = await service.from('pos_authorizations').insert(compatInsert).select('id').single();
    }
    if (authRes.error || !authRes.data)
      return NextResponse.json({ ok: false, error: 'No se pudo registrar la autorización.' }, { status: 500 });
    authorizationId = authRes.data.id;

    // Si la devolución se registró sin conexión contra una venta también offline,
    // los líneas pueden referenciar índice/sku en lugar de sale_line_id.
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const lines = rawLines.map((l: any) => {
      let saleLineId = l.sale_line_id;
      if (!saleLineId && typeof l.line_index === 'number' && sale.lines?.[l.line_index]) {
        saleLineId = sale.lines[l.line_index].id;
      }
      if (!saleLineId && l.sku && Array.isArray(sale.lines)) {
        const match = sale.lines.find((sl) => sl.sku_snapshot === String(l.sku));
        if (match) saleLineId = match.id;
      }
      return {
        sale_line_id: saleLineId,
        quantity: Number(l.quantity_returned ?? l.quantity),
        condition: l.condition === 'damaged' ? 'damaged' : 'sellable',
      };
    });
    const { data, error } = await service.rpc('pos_record_return', {
      p_tenant: tenantId,
      p_actor: effectiveUserId,
      p_return: {
        idempotency_key: idempotencyKey ? idempotencyKey.slice(0, 200) : null,
        original_sale_id: sale.id,
        shift_id: body.shift_id,
        return_type: body.return_type,
        reason: String(body.reason ?? '').slice(0, 500),
        notes: body.notes ? String(body.notes).slice(0, 2000) : null,
        refund_method: body.refund_method,
        approved_by: approvedBy,
        authorization_id: authorizationId,
        // Repone según el catálogo del que salió la venta, no según la configuración actual.
        track_stock: (sale as { catalog_source?: string }).catalog_source === 'warehouse' ? config.warehouseStockSync : true,
        warehouse_id: body.warehouse_id || null,
        lines,
      },
    });
    if (error) {
      await service.from('pos_authorizations').delete().eq('id', authorizationId).eq('tenant_id', tenantId);
      return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo procesar la devolución.') }, { status: 409 });
    }
    const result = data as { return_id: string };
    const returns = await listReturns(service, tenantId);
    return NextResponse.json({
      ok: true,
      return_record: returns.find((r) => r.id === result.return_id) ?? null,
      sale: await getSale(service, tenantId, sale.id),
    });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message || 'Error en servidor.' }, { status: e.status ?? 500 });
  }
}
