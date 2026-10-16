import { NextResponse } from 'next/server';
import { isSuperAdmin, type SessionUser } from '@/lib/auth';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { UUID_RE } from '@/lib/tenant-management';

type GuardResult = { user: SessionUser; response?: never } | { user?: never; response: NextResponse };

/**
 * Server-side authorization for super admin API routes.
 * Returns 401 without a session and 403 when the user is not super_admin.
 */
export async function requireSuperAdminApi(): Promise<GuardResult> {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  }
  if (!(await isSuperAdmin(user.id, supabase))) {
    return {
      response: NextResponse.json({ error: 'Permisos insuficientes. Se requiere rol super_admin.' }, { status: 403 }),
    };
  }
  return { user: { id: user.id, email: user.email ?? '' } };
}

export function invalidTenantIdResponse(id: string): NextResponse | null {
  return UUID_RE.test(id) ? null : NextResponse.json({ error: 'Identificador de empresa inválido.' }, { status: 400 });
}

/** Records a sensitive change; failures are logged but do not break the main action. */
export async function auditTenantAction(entry: {
  actorId: string;
  tenantId: string;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseServiceClient()
    .from('platform_audit_logs')
    .insert({
      actor_id: entry.actorId,
      tenant_id: entry.tenantId,
      action: entry.action,
      resource: entry.resource ?? 'tenants',
      resource_id: entry.tenantId,
      details: entry.details ?? {},
    });
  if (error) console.error('[audit] insert error', entry.action, error.message);
}
