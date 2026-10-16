import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';
import { validateTenantSupabaseTarget } from '@/lib/tenant-connection';

/**
 * POST /api/admin/tenants/[id]/database
 * Registers / updates the tenant's dedicated Supabase project connection.
 * Stores secret_ref (an opaque identifier) — never the actual service-role key.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const admin = await isSuperAdmin(user.id);
  if (!admin) {
    return NextResponse.json(
      { error: 'Permisos insuficientes. Se requiere rol super_admin.' },
      { status: 403 },
    );
  }

  const project_ref =
    typeof body?.project_ref === 'string' ? body.project_ref.trim() : '';
  const supabase_url =
    typeof body?.supabase_url === 'string' ? body.supabase_url.trim() : '';
  const secret_ref =
    typeof body?.secret_ref === 'string' ? body.secret_ref.trim() : '';

  if (!project_ref) {
    return NextResponse.json({ error: 'El project_ref es obligatorio.' }, { status: 400 });
  }
  if (!supabase_url) {
    return NextResponse.json({ error: 'La supabase_url es obligatoria.' }, { status: 400 });
  }
  if (!secret_ref) {
    return NextResponse.json(
      { error: 'El secret_ref es obligatorio.' },
      { status: 400 },
    );
  }
  if (!validateTenantSupabaseTarget(project_ref, supabase_url)) {
    return NextResponse.json(
      { error: 'La URL debe ser https://<project_ref>.supabase.co y coincidir con el proyecto indicado.' },
      { status: 400 },
    );
  }
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(secret_ref)) {
    return NextResponse.json(
      { error: 'El secret_ref debe ser el nombre seguro de una variable del adaptador de secretos.' },
      { status: 400 },
    );
  }

  const service = getSupabaseServiceClient();

  /* Verify tenant exists */
  const { data: tenant } = await service
    .from('tenants')
    .select('id, infrastructure_mode')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  }
  if (tenant.infrastructure_mode !== 'dedicated') {
    return NextResponse.json(
      { error: 'La conexión dedicada solo aplica a empresas en modalidad Dedicated.' },
      { status: 409 },
    );
  }

  const row = {
    tenant_id: params.id,
    provider: 'supabase',
    project_ref,
    supabase_url,
    secret_ref,
    connection_status: 'not_configured' as const,
  };

  const { data: db, error } = await service
    .from('tenant_databases')
    .upsert(row, { onConflict: 'tenant_id' })
    .select(
      'id, tenant_id, project_ref, supabase_url, secret_ref, connection_status',
    )
    .maybeSingle();

  if (error) {
    console.error('[database] upsert error', error.message);
    return NextResponse.json(
      { error: 'No se pudo registrar la conexion.' },
      { status: 500 },
    );
  }

  await service.from('platform_audit_logs').insert({
    actor_id: user.id,
    tenant_id: params.id,
    action: 'tenant.database.register',
    resource: 'tenant_databases',
    resource_id: params.id,
    details: { project_ref, supabase_url, secret_ref, connection_status: 'not_configured' },
  });

  return NextResponse.json({ database: db });
}
