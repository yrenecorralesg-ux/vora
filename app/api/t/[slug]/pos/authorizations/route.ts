import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';
import { getShift, userDisplayNames, verifySupervisorPin } from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPERATION_PERMISSION: Record<string, string> = {
  discount_override: 'pos.sales.discount.override',
  sale_void: 'pos.sales.void',
  sale_return: 'pos.refunds.approve',
  cash_movement: 'pos.refunds.approve',
};

/** Supervisores que pueden autorizar con PIN (rol con permiso y PIN configurado). */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const tenantId = auth.access.tenantId;

  const [{ data: members }, { data: pins }, { data: perms }] = await Promise.all([
    service.from('tenant_memberships').select('auth_user_id, role').eq('tenant_id', tenantId).eq('status', 'active'),
    service.from('pos_staff_pins').select('auth_user_id').eq('tenant_id', tenantId),
    service
      .from('role_permissions')
      .select('role_key, permission')
      .eq('scope', 'tenant')
      .in('permission', Object.values(OPERATION_PERMISSION)),
  ]);
  const withPin = new Set((pins ?? []).map((p) => p.auth_user_id as string));
  const permsByRole = new Map<string, string[]>();
  for (const p of perms ?? []) permsByRole.set(p.role_key, [...(permsByRole.get(p.role_key) ?? []), p.permission]);

  const eligible = (members ?? []).filter(
    (m) => withPin.has(m.auth_user_id) && (m.role === 'tenant_admin' || (permsByRole.get(m.role) ?? []).length > 0),
  );
  const names = await userDisplayNames(service, eligible.map((m) => m.auth_user_id));
  return NextResponse.json({
    ok: true,
    supervisors: eligible.map((m) => ({
      id: m.auth_user_id,
      name: names.get(m.auth_user_id) ?? 'Supervisor',
      role: m.role,
      permissions: m.role === 'tenant_admin' ? Object.values(OPERATION_PERMISSION) : permsByRole.get(m.role) ?? [],
    })),
  });
}

/**
 * Autorización de supervisor con PIN validado en el servidor. Devuelve un id
 * de pos_authorizations de un solo uso que caduca en 10 minutos (p. ej. para
 * un descuento por encima del máximo del cajero).
 */
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
  const operation = String(body.operationType ?? body.operation_type ?? '');
  const permission = OPERATION_PERMISSION[operation];
  if (!permission) return NextResponse.json({ ok: false, error: 'Operación no reconocida.' }, { status: 400 });
  const supervisorId = String(body.supervisorId ?? body.supervisor_id ?? '');
  if (!supervisorId) return NextResponse.json({ ok: false, error: 'Selecciona el supervisor que autoriza.' }, { status: 400 });

  const check = await verifySupervisorPin({ service, tenantId, supervisorId, pin: String(body.pin ?? ''), permission });
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });

  const shiftId = body.shiftId ?? body.shift_id;
  const shift = shiftId ? await getShift(service, tenantId, String(shiftId)) : null;
  let branchId = shift?.branch_id ?? body.branchId ?? body.branch_id;
  const { data: branch } = await service
    .from('tenant_branches')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', branchId ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle();
  if (!branch) return NextResponse.json({ ok: false, error: 'Sede no válida.' }, { status: 400 });
  branchId = branch.id;

  const names = await userDisplayNames(service, [supervisorId]);
  const { data: row, error } = await service
    .from('pos_authorizations')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      shift_id: shift?.id ?? null,
      operation_type: operation,
      requested_by: userId,
      approved_by: supervisorId,
      approver_name_snapshot: names.get(supervisorId) ?? null,
      reason: String(body.reason ?? '').trim().slice(0, 500) || 'Autorización de supervisor',
      limit_snapshot: (body.limitSnapshot ?? body.limit_snapshot ?? {}) as Record<string, unknown>,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
    .select('id, operation_type, approved_by, approver_name_snapshot, expires_at, created_at')
    .single();
  if (error || !row) return NextResponse.json({ ok: false, error: 'No se pudo registrar la autorización.' }, { status: 500 });
  return NextResponse.json({ ok: true, authorization: row });
}
