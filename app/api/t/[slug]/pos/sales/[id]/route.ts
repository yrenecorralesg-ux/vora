import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantModuleApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import { getSale, resolveActorFromOfflineProof, sqlErrorMessage } from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DISPATCH_STATUSES = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string; id: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  const sale = await getSale(getSupabaseServiceClient(), auth.access.tenantId, params.id);
  if (!sale) return NextResponse.json({ ok: false, error: 'Venta no encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true, sale });
}

/**
 * action 'debt_payment': abono a una venta a crédito (POS-13).
 * action 'dispatch': estado de la comanda de despacho (POS-20), guardado en la venta.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  const baseAccess = auth.access;
  const service = getSupabaseServiceClient();
  const { tenantId, userId } = baseAccess;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  async function resolveEffective(requiredPermission: string, scope: string) {
    const check = await resolveActorFromOfflineProof({
      service,
      tenantId,
      authUserId: userId,
      offlineOperatorAuth: body.offline_operator_auth,
      requiredPermission,
      actionScope: scope,
    });
    if (!check.ok) {
      return { ok: false as const, response: NextResponse.json({ ok: false, error: check.error }, { status: check.status }) };
    }
    if (check.actorId === userId) return { ok: true as const, access: baseAccess };
    const { data: mem } = await service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', check.actorId)
      .eq('status', 'active')
      .maybeSingle();
    if (!mem) return { ok: false as const, response: permissionDenied('El operador no está activo en la empresa.') };
    return { ok: true as const, access: { ...baseAccess, userId: check.actorId, role: mem.role } };
  }

  if (body.action === 'debt_payment') {
    const key = body.idempotency_key ? String(body.idempotency_key).slice(0, 200) : '';
    const actorRes = await resolveEffective('pos.payments.register', `debt:${key}`);
    if (!actorRes.ok) return actorRes.response;
    if (!(await hasTenantPermission(actorRes.access, 'pos.payments.register')))
      return permissionDenied('Tu rol no permite registrar abonos.');
    const { error } = await service.rpc('pos_record_debt_payment', {
      p_tenant: tenantId,
      p_actor: actorRes.access.userId,
      p_sale: params.id,
      p_shift: body.shift_id,
      p_payment: {
        method: body.method,
        currency: body.currency,
        amount: Number(body.amount),
        reference_number: body.reference_number ? String(body.reference_number).slice(0, 100) : null,
        idempotency_key: key || null,
      },
    });
    if (error) return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo registrar el abono.') }, { status: 409 });
    return NextResponse.json({ ok: true, sale: await getSale(service, tenantId, params.id) });
  }

  if (body.action === 'dispatch') {
    const opKey = String(body.offline_op_key ?? '').trim();
    const actorRes = await resolveEffective('pos.sales.create', `dispatch:${params.id}:${opKey}`);
    if (!actorRes.ok) return actorRes.response;
    if (!(await hasTenantPermission(actorRes.access, 'pos.sales.create')))
      return permissionDenied('Tu rol no permite gestionar comandas.');
    const { data: row } = await service
      .from('pos_sales')
      .select('id, metadata')
      .eq('tenant_id', tenantId)
      .eq('id', params.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: 'Venta no encontrada.' }, { status: 404 });
    const meta = (row.metadata ?? {}) as Record<string, any>;
    const dispatch = { status: 'pendiente', completed_skus: [] as string[], ...(meta.dispatch ?? {}) };
    if (body.status !== undefined) {
      if (!DISPATCH_STATUSES.includes(body.status))
        return NextResponse.json({ ok: false, error: 'Estado de comanda inválido.' }, { status: 400 });
      dispatch.status = body.status;
      dispatch.prepared_by = body.prepared_by ? String(body.prepared_by).slice(0, 100) : dispatch.prepared_by ?? null;
      if (body.status === 'listo' || body.status === 'entregado') dispatch.completed_at = new Date().toISOString();
    }
    if (body.toggle_sku) {
      const sku = String(body.toggle_sku);
      const set = new Set<string>(dispatch.completed_skus ?? []);
      if (set.has(sku)) set.delete(sku);
      else set.add(sku);
      dispatch.completed_skus = Array.from(set);
    }
    const { error } = await service
      .from('pos_sales')
      .update({ metadata: { ...meta, dispatch } })
      .eq('tenant_id', tenantId)
      .eq('id', params.id);
    if (error) return NextResponse.json({ ok: false, error: 'No se pudo actualizar la comanda.' }, { status: 500 });
    return NextResponse.json({ ok: true, dispatch });
  }

  return NextResponse.json({ ok: false, error: 'Acción no reconocida.' }, { status: 400 });
}
