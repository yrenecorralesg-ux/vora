import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireSession, isSuperAdmin } from '@/lib/auth';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import {
  getTenantSecret,
  validateTenantSupabaseTarget,
} from '@/lib/tenant-connection';
/** Server-only resolution. Shared queries still MUST filter by tenant_id; RLS remains enabled.
 * Dedicated uses a privileged server connection only after platform authorization.
 * Future module repositories own tenant filters, transactions and module permissions.
 */
export async function resolveTenantData(
  slug: string,
): Promise<{
  tenantId: string;
  mode: 'shared' | 'dedicated';
  client: SupabaseClient;
}> {
  const session = getSupabaseServerClient(),
    user = await requireSession(session);
  if (!user) throw new Error('No autenticado.');
  const { data: t } = await session
    .from('tenants')
    .select('id,infrastructure_mode,commercial_status,technical_status')
    .eq('slug', slug)
    .maybeSingle();
  if (!t) throw new Error('Empresa no autorizada.');
  const admin = await isSuperAdmin(user.id, session);
  if (!admin) {
    const { data: m } = await session
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', t.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!m) throw new Error('Sin membresía activa.');
  }
  if (
    ['suspended', 'cancelled'].includes(t.commercial_status) ||
    t.technical_status !== 'ready'
  )
    throw new Error('La operación de la empresa no está habilitada.');
  const { data: db } = await getSupabaseServiceClient()
    .from('tenant_databases')
    .select('project_ref,supabase_url,secret_ref,connection_status')
    .eq('tenant_id', t.id)
    .maybeSingle();
  if (db?.connection_status !== 'connected')
    throw new Error('Base de datos pendiente de verificación.');
  if (t.infrastructure_mode === 'shared')
    return { tenantId: t.id, mode: 'shared', client: session };
  const target = validateTenantSupabaseTarget(
    db.project_ref ?? '',
    db.supabase_url ?? '',
  );
  const secret = db.secret_ref ? getTenantSecret(db.secret_ref) : null;
  if (!target || !secret)
    throw new Error('Configuración Dedicated incompleta.');
  return {
    tenantId: t.id,
    mode: 'dedicated',
    client: createClient(target.origin, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
