import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission } from '@/lib/tenant-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const APPROVER_PERMISSIONS = ['pos.refunds.approve', 'pos.sales.discount.override', 'pos.sales.void'];

/**
 * Personal del POS = usuarios reales de la empresa (tenant_memberships).
 * Devuelve también el usuario de la sesión con su rol y permisos de acción.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const { tenantId, userId, role } = auth.access;

  const [{ data: members }, { data: pins }] = await Promise.all([
    service
      .from('tenant_memberships')
      .select('auth_user_id, role, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    service.from('pos_staff_pins').select('auth_user_id').eq('tenant_id', tenantId),
  ]);
  const withPin = new Set((pins ?? []).map((p) => p.auth_user_id as string));
  const ids = Array.from(new Set([...(members ?? []).map((m) => m.auth_user_id as string), userId]));
  const profiles = new Map<string, { name: string; email: string | null }>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await service.auth.admin.getUserById(id);
      const u = data?.user;
      if (u)
        profiles.set(id, {
          name: (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || 'Usuario',
          email: u.email ?? null,
        });
    }),
  );

  const users = (members ?? []).map((m) => ({
    id: m.auth_user_id as string,
    name: profiles.get(m.auth_user_id)?.name ?? 'Usuario',
    email: profiles.get(m.auth_user_id)?.email ?? null,
    role: m.role as string,
    is_active: m.status === 'active',
    has_pin: withPin.has(m.auth_user_id),
    created_at: m.created_at as string,
  }));

  const permissions: Record<string, boolean> = {};
  for (const p of [
    'pos.sales.create',
    'pos.cash.open',
    'pos.cash.close',
    'pos.payments.register',
    'pos.reports.view',
    'pos.settings.manage',
    'pos.fiscal.issue',
    ...APPROVER_PERMISSIONS,
  ])
    permissions[p] = await hasTenantPermission(auth.access, p);

  return NextResponse.json({
    ok: true,
    me: {
      id: userId,
      name: profiles.get(userId)?.name ?? 'Usuario',
      email: profiles.get(userId)?.email ?? auth.access.email,
      role,
      has_pin: withPin.has(userId),
      can_approve: APPROVER_PERMISSIONS.some((p) => permissions[p]),
      permissions,
    },
    users,
  });
}

const managedInGestor = () =>
  NextResponse.json(
    {
      ok: false,
      error:
        'Los usuarios y roles se administran desde el gestor de VORA (empresa → Usuarios). Cada supervisor define su PIN en Configuración → Mi PIN.',
    },
    { status: 410 },
  );

export async function POST(_request: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  return managedInGestor();
}

export async function PUT(_request: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  return managedInGestor();
}

export async function DELETE(_request: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  return managedInGestor();
}
