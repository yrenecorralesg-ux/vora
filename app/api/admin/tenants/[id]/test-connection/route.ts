import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';
import { getTenantSecret, validateTenantSupabaseTarget } from '@/lib/tenant-connection';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (!(await isSuperAdmin(user.id))) return NextResponse.json({ error: 'Permisos insuficientes.' }, { status: 403 });

  const service = getSupabaseServiceClient();
  const { data: dbRow, error: dbErr } = await service
    .from('tenant_databases')
    .select('id, supabase_url, project_ref, secret_ref, connection_status')
    .eq('tenant_id', params.id)
    .maybeSingle();
  if (dbErr) return NextResponse.json({ error: 'Error al leer la configuracion.' }, { status: 500 });
  if (!dbRow) return NextResponse.json({ error: 'No hay conexion registrada.' }, { status: 404 });

  const target = dbRow.supabase_url && dbRow.project_ref
    ? validateTenantSupabaseTarget(dbRow.project_ref, dbRow.supabase_url)
    : null;
  if (!target) return NextResponse.json({ error: 'La URL y el project_ref no forman un destino Supabase valido.' }, { status: 400 });

  await service.from('tenant_databases').update({ connection_status: 'checking', error_message: null }).eq('id', dbRow.id);
  const secret = dbRow.secret_ref ? getTenantSecret(dbRow.secret_ref) : null;
  let connectionStatus: 'connected' | 'error' = 'error';
  let errorMessage: string | null = 'Falta el secreto del proyecto asociado; la conexion queda pendiente de configuracion.';

  if (secret) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${target.origin}/rest/v1/rpc/ekoscrm_health_check`, {
        method: 'POST',
        signal: controller.signal,
        headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_tenant_id: params.id }),
      });
      const body = await response.json().catch(() => null) as { tenant_id?: string; schema_version?: string; ok?: boolean } | null;
      if (response.ok && body?.ok === true && body.tenant_id === params.id) {
        connectionStatus = 'connected';
        errorMessage = null;
        await service.from('tenant_databases').update({ schema_version: body.schema_version ?? null }).eq('id', dbRow.id);
      } else {
        errorMessage = response.status === 404
          ? 'El proyecto responde, pero no tiene instalado el health check EKOSCRM.'
          : 'El proyecto no confirma el tenant UUID esperado.';
      }
    } catch (error) {
      errorMessage = error instanceof Error && error.name === 'AbortError' ? 'Tiempo de espera agotado.' : 'No se pudo verificar el proyecto asociado.';
    } finally {
      clearTimeout(timeout);
    }
  }

  const { data: database } = await service.from('tenant_databases').update({ connection_status: connectionStatus, last_checked_at: new Date().toISOString(), error_message: errorMessage }).eq('id', dbRow.id).select('id, connection_status, last_checked_at, error_message, schema_version').maybeSingle();
  // Only a verified Dedicated infrastructure marks the company as technically ready.
  if (connectionStatus === 'connected') await service.from('tenants').update({ technical_status: 'ready' }).eq('id', params.id).eq('infrastructure_mode', 'dedicated');
  await service.from('platform_audit_logs').insert({ actor_id: user.id, tenant_id: params.id, action: 'tenant.database.test_connection', resource: 'tenant_databases', resource_id: params.id, details: { connection_status: connectionStatus, error_message: errorMessage } });
  return NextResponse.json({ connection_status: connectionStatus, error_message: errorMessage, database });
}
