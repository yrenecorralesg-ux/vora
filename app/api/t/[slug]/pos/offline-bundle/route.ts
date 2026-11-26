import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission } from '@/lib/tenant-api-auth';
import { userDisplayNames, type OfflinePinBundle } from '@/lib/pos/server';

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
 * Devuelve el paquete cifrado de operadores y supervisores para que la caja
 * autenticada pueda validar PINes y cambiar de operador sin conexión.
 * Nunca expone PINes ni hashes de Supabase Auth.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const { tenantId } = auth.access;

  const [{ data: members }, pinsRes] = await Promise.all([
    service
      .from('tenant_memberships')
      .select('auth_user_id, role, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    service
      .from('pos_staff_pins')
      .select('auth_user_id, offline_bundle')
      .eq('tenant_id', tenantId),
  ]);

  const pinRows = pinsRes.error
    ? (await service.from('pos_staff_pins').select('auth_user_id').eq('tenant_id', tenantId)).data
    : pinsRes.data;

  const bundleMap = new Map<string, OfflinePinBundle | null>();
  for (const p of (pinRows ?? []) as Array<{ auth_user_id: string; offline_bundle?: OfflinePinBundle | null }>) {
    bundleMap.set(p.auth_user_id, p.offline_bundle ?? null);
  }

  const activeMembers = members ?? [];
  const names = await userDisplayNames(
    service,
    activeMembers.map((m) => m.auth_user_id as string),
  );

  const permsByRole = new Map<string, Record<string, boolean>>();
  for (const role of Array.from(new Set(activeMembers.map((m) => m.role as string)))) {
    const perms: Record<string, boolean> = {};
    for (const p of POS_PERMISSIONS) {
      perms[p] = await hasTenantPermission({ tenantId, userId: auth.access.userId, role, email: null }, p);
    }
    permsByRole.set(role, perms);
  }

  const operators = activeMembers.map((m) => {
    const uid = m.auth_user_id as string;
    const role = m.role as string;
    const permissions = permsByRole.get(role) ?? {};
    const bundle = bundleMap.get(uid) ?? null;
    return {
      id: uid,
      name: names.get(uid) ?? 'Operador',
      role,
      can_approve: APPROVER_PERMISSIONS.some((p) => permissions[p]),
      permissions,
      has_pin: bundleMap.has(uid),
      offline_pin_ready: Boolean(bundle),
      offline_bundle: bundle,
    };
  });

  return NextResponse.json({
    ok: true,
    tenant_id: tenantId,
    operators,
  });
}
