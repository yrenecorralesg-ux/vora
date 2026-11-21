import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import {
  PosError,
  getShift,
  getTenantSettings,
  listCashMovements,
  listShifts,
  sqlErrorMessage,
  userDisplayNames,
  verifySupervisorPin,
} from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Turnos de caja (POS-02 y POS-15): Supabase es la fuente de verdad. */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const { searchParams } = new URL(request.url);
  const tenantId = auth.access.tenantId;

  try {
    const registerId = searchParams.get('register_id');
    const shifts = await listShifts(service, tenantId, {
      branchId: searchParams.get('branch_id'),
      registerId,
      status: searchParams.get('status'),
    });
    const activeShift = registerId ? shifts.find((s) => s.status === 'abierto') ?? null : null;
    // Turno abierto del usuario en cualquier caja (para avisarle si está en otra).
    const { data: mine } = await service
      .from('pos_shifts')
      .select('id, register_id')
      .eq('tenant_id', tenantId)
      .eq('cashier_user_id', auth.access.userId)
      .eq('status', 'abierto')
      .maybeSingle();
    const movements = await listCashMovements(service, tenantId, searchParams.get('shift_id') ?? activeShift?.id);
    return NextResponse.json({ ok: true, shifts, active_shift: activeShift, my_open_shift: mine ?? null, movements });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const { tenantId, userId } = auth.access;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (body.action === 'open') {
    if (!(await hasTenantPermission(auth.access, 'pos.cash.open')))
      return permissionDenied('Tu rol no permite abrir turnos de caja.');
    const { data: id, error } = await service.rpc('pos_open_shift', {
      p_tenant: tenantId,
      p_actor: userId,
      p_branch: body.branch_id,
      p_register: body.register_id,
      p_cashier_name: String(body.cashier_name ?? '').slice(0, 150),
      p_opening_usd: Number(body.opening_usd ?? 0),
      p_opening_ves: Number(body.opening_ves ?? 0),
      p_notes: body.notes ? String(body.notes).slice(0, 1000) : null,
    });
    if (error) return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo abrir el turno.') }, { status: 409 });
    return NextResponse.json({ ok: true, shift: await getShift(service, tenantId, id as string) });
  }

  if (body.action === 'movement') {
    if (!(await hasTenantPermission(auth.access, 'pos.cash.open')))
      return permissionDenied('Tu rol no permite registrar movimientos de caja.');
    let authorizationId: string | null = null;
    if (body.movement_type === 'retiro_efectivo') {
      const settings = await getTenantSettings(service, tenantId);
      const isSupervisor = await hasTenantPermission(auth.access, 'pos.refunds.approve');
      if (settings.require_pin_for_withdrawals && !isSupervisor) {
        if (!body.supervisor_id || !body.supervisor_pin)
          return permissionDenied('Los retiros de efectivo requieren el PIN de un supervisor.');
        const check = await verifySupervisorPin({
          service,
          tenantId,
          supervisorId: String(body.supervisor_id),
          pin: String(body.supervisor_pin),
          permission: 'pos.refunds.approve',
        });
        if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
        const shift = await getShift(service, tenantId, String(body.shift_id));
        if (!shift) return NextResponse.json({ ok: false, error: 'Turno no encontrado.' }, { status: 404 });
        const { data: authRow, error: authErr } = await service
          .from('pos_authorizations')
          .insert({
            tenant_id: tenantId,
            branch_id: shift.branch_id,
            shift_id: shift.id,
            operation_type: 'cash_movement',
            requested_by: userId,
            approved_by: body.supervisor_id,
            approver_name_snapshot: (await userDisplayNames(service, [String(body.supervisor_id)])).get(String(body.supervisor_id)) ?? null,
            reason: String(body.reason ?? 'Retiro de efectivo').slice(0, 500) || 'Retiro de efectivo',
            limit_snapshot: { amount: Number(body.amount), currency: body.currency },
            consumed_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (authErr || !authRow) return NextResponse.json({ ok: false, error: 'No se pudo registrar la autorización.' }, { status: 500 });
        authorizationId = authRow.id;
      }
    }
    const { data: id, error } = await service.rpc('pos_add_cash_movement', {
      p_tenant: tenantId,
      p_actor: userId,
      p_shift: body.shift_id,
      p_type: body.movement_type,
      p_currency: body.currency,
      p_amount: Number(body.amount),
      p_reason: String(body.reason ?? '').slice(0, 500),
      p_authorization: authorizationId,
    });
    if (error) return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo registrar el movimiento.') }, { status: 400 });
    const shift = await getShift(service, tenantId, String(body.shift_id));
    return NextResponse.json({ ok: true, movement_id: id, shift });
  }

  if (body.action === 'close') {
    if (!(await hasTenantPermission(auth.access, 'pos.cash.close')))
      return permissionDenied('Tu rol no permite cerrar turnos de caja.');
    const shift = await getShift(service, tenantId, String(body.shift_id ?? ''));
    if (!shift) return NextResponse.json({ ok: false, error: 'Turno no encontrado.' }, { status: 404 });
    // Solo el cajero del turno o un supervisor puede cerrarlo.
    if (shift.cashier_user_id !== userId && !(await hasTenantPermission(auth.access, 'pos.refunds.approve')))
      return permissionDenied('Solo el cajero del turno o un supervisor puede cerrarlo.');
    const declared = Object.fromEntries(
      Object.entries((body.declared ?? {}) as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 0]),
    );
    const { error } = await service.rpc('pos_close_shift', {
      p_tenant: tenantId,
      p_actor: userId,
      p_shift: shift.id,
      p_declared: declared,
      p_justification: body.justification ? String(body.justification).slice(0, 2000) : null,
    });
    if (error) return NextResponse.json({ ok: false, error: sqlErrorMessage(error, 'No se pudo cerrar el turno.') }, { status: 400 });
    return NextResponse.json({ ok: true, shift: await getShift(service, tenantId, shift.id) });
  }

  return NextResponse.json({ ok: false, error: 'Acción no reconocida.' }, { status: 400 });
}
