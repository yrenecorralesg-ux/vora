import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission } from '@/lib/tenant-api-auth';
import { verifyUserPin } from '@/lib/pos/server';
import { setTenantSessionCookie } from '@/lib/tenant-session';
import { FULL_ACCESS_ROLES, resolveRolePermissions } from '@/lib/warehouse/access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const POS_PERMISSIONS = [
  'pos.sales.create',
  'pos.cash.open',
  'pos.cash.close',
  'pos.payments.register',
  'pos.reports.view',
  'pos.settings.manage',
  'pos.fiscal.issue',
  'pos.refunds.approve',
  'pos.sales.discount.override',
  'pos.sales.void',
];
const APPROVER_PERMISSIONS = ['pos.refunds.approve', 'pos.sales.discount.override', 'pos.sales.void'];

/**
 * Cambio rápido de operador en el terminal POS mediante su PIN personal.
 * Exige una sesión de terminal ya autenticada en la empresa.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  const targetUserId = String(body.userId ?? body.user_id ?? '').trim();
  const pin = String(body.pin ?? '').trim();
  if (!targetUserId || !pin) {
    return NextResponse.json({ ok: false, error: 'Selecciona el operador e ingresa su PIN.' }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { tenantId } = auth.access;
  const check = await verifyUserPin({
    service,
    tenantId,
    userId: targetUserId,
    pin,
  });
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }

  const { data: userRes } = await service.auth.admin.getUserById(targetUserId);
  const targetUser = userRes?.user;
  const name =
    (targetUser?.user_metadata?.full_name as string) ||
    (targetUser?.user_metadata?.name as string) ||
    targetUser?.email?.split('@')[0] ||
    'Operador';
  const email = targetUser?.email ?? '';

  const permissions: Record<string, boolean> = {};
  for (const p of POS_PERMISSIONS) {
    permissions[p] = await hasTenantPermission(
      { tenantId, userId: targetUserId, role: check.role, email: email || null },
      p,
    );
  }
  const whPerms = FULL_ACCESS_ROLES.includes(check.role)
    ? null
    : await resolveRolePermissions(service, tenantId, check.role);
  permissions['warehouse.configure'] = whPerms === null ? true : whPerms.has('warehouse.configure');

  const response = NextResponse.json({
    ok: true,
    me: {
      id: targetUserId,
      name,
      email: email || null,
      role: check.role,
      has_pin: true,
      offline_pin_ready: true,
      can_approve: APPROVER_PERMISSIONS.some((p) => permissions[p]),
      permissions,
    },
  });

  setTenantSessionCookie(response, params.slug, {
    userId: targetUserId,
    email,
    name,
    role: check.role,
    tenantId,
    slug: params.slug,
  });

  return response;
}
