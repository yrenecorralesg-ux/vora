import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import { validateTenantSupabaseTarget } from '@/lib/tenant-connection';
const schema = z.discriminatedUnion('section', [
  z.object({ section: z.literal('plan'), plan_id: z.string().uuid() }),
  z.object({
    section: z.literal('database'),
    mode: z.enum(['shared', 'dedicated']),
    project_ref: z.string().max(80).default(''),
    supabase_url: z.string().max(200).default(''),
    secret_ref: z.string().max(128).default(''),
  }),
  z.object({ section: z.literal('verify_domain') }),
  z.object({ section: z.literal('readiness') }),
]);
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await requireSuperAdmin()))
    return NextResponse.json(
      { error: 'Permisos insuficientes.' },
      { status: 403 },
    );
  const db = getSupabaseServiceClient();
  const results = await Promise.all([
    db
      .from('tenants')
      .select('id,slug,infrastructure_mode,plan_id,tax_id')
      .eq('id', params.id)
      .maybeSingle(),
    db
      .from('plans')
      .select('id,name,monthly_price_usd,infrastructure_mode,limits')
      .eq('is_active', true),
    db
      .from('tenant_databases')
      .select('*')
      .eq('tenant_id', params.id)
      .maybeSingle(),
    db
      .from('tenant_domains')
      .select('*')
      .eq('tenant_id', params.id)
      .eq('is_primary', true)
      .maybeSingle(),
    db
      .from('tenant_memberships')
      .select('id,role,status')
      .eq('tenant_id', params.id),
    db
      .from('tenant_invitations')
      .select('id,email,status,expires_at')
      .eq('tenant_id', params.id),
    db
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', params.id)
      .maybeSingle(),
  ]);
  if (results.some((r) => r.error))
    return NextResponse.json(
      { error: 'No se pudo cargar Core. Verifica la migración incremental.' },
      { status: 500 },
    );
  if (!results[0].data)
    return NextResponse.json(
      { error: 'Empresa no encontrada.' },
      { status: 404 },
    );
  return NextResponse.json({
    tenant: results[0].data,
    plans: results[1].data,
    database: results[2].data,
    domain: results[3].data,
    memberships: results[4].data,
    invitations: results[5].data,
    subscription: results[6].data,
  });
}
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireSuperAdmin();
  if (!user)
    return NextResponse.json(
      { error: 'Permisos insuficientes.' },
      { status: 403 },
    );
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const d = parsed.data,
    service = getSupabaseServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id,slug,infrastructure_mode,plan_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant)
    return NextResponse.json(
      { error: 'Empresa no encontrada.' },
      { status: 404 },
    );
  if (d.section === 'readiness') {
    const { data, error } = await getSupabaseServerClient().rpc(
      'vora_validate_readiness',
      { p_tenant: params.id },
    );
    return error
      ? NextResponse.json(
          {
            error:
              'Revisa plan, administrador activo y conexión de base de datos.',
          },
          { status: 409 },
        )
      : NextResponse.json({
          ok: true,
          message: data
            ? 'Core preparado. El dominio conserva su estado independiente.'
            : 'Core continúa pendiente.',
        });
  }
  if (d.section === 'plan') {
    const { error } = await getSupabaseServerClient().rpc('vora_assign_plan', {
      p_tenant: params.id,
      p_plan: d.plan_id,
    });
    return error
      ? NextResponse.json(
          {
            error:
              'No se pudo asignar el plan. Debe coincidir con Shared/Dedicated.',
          },
          { status: 409 },
        )
      : NextResponse.json({ ok: true });
  }
  if (d.section === 'database') {
    if (d.mode !== tenant.infrastructure_mode)
      return NextResponse.json(
        {
          error:
            'La modalidad se define al crear la empresa. Su cambio requiere una migración de datos planificada.',
        },
        { status: 409 },
      );
    if (d.mode === 'shared') {
      const { error } = await service
        .from('tenant_workspaces')
        .upsert({ tenant_id: params.id }, { onConflict: 'tenant_id' });
      if (error)
        return NextResponse.json(
          { error: 'No se pudo preparar el espacio Shared.' },
          { status: 500 },
        );
    } else {
      if (d.project_ref && !/^[a-z0-9-]{6,80}$/i.test(d.project_ref))
        return NextResponse.json(
          { error: 'Project ref inválido.' },
          { status: 400 },
        );
      if (
        d.supabase_url &&
        (!d.project_ref ||
          !validateTenantSupabaseTarget(d.project_ref, d.supabase_url))
      )
        return NextResponse.json(
          { error: 'URL y proyecto Supabase no coinciden.' },
          { status: 400 },
        );
      if (d.secret_ref && !/^[A-Z][A-Z0-9_]{2,127}$/.test(d.secret_ref))
        return NextResponse.json(
          {
            error:
              'Indica el nombre de la variable del secreto, nunca la clave.',
          },
          { status: 400 },
        );
    }
    const { data: existing } = await service
      .from('tenant_databases')
      .select('connection_status,project_ref,supabase_url,secret_ref')
      .eq('tenant_id', params.id)
      .maybeSingle();
    if (
      existing?.connection_status === 'connected' &&
      (existing.project_ref !== (d.project_ref || null) ||
        existing.supabase_url !== (d.supabase_url || null) ||
        existing.secret_ref !== (d.secret_ref || null))
    )
      return NextResponse.json(
        {
          error:
            'La conexión activa no se puede sustituir sin una migración de datos.',
        },
        { status: 409 },
      );
    const { error } = await service
      .from('tenant_databases')
      .upsert(
        {
          tenant_id: params.id,
          provider: 'supabase',
          project_ref: d.mode === 'shared' ? null : d.project_ref || null,
          supabase_url: d.mode === 'shared' ? null : d.supabase_url || null,
          secret_ref: d.mode === 'shared' ? null : d.secret_ref || null,
          connection_status:
            existing?.connection_status === 'connected'
              ? 'connected'
              : 'not_configured',
          error_message: null,
        },
        { onConflict: 'tenant_id' },
      );
    if (error)
      return NextResponse.json(
        { error: 'No se pudo guardar la configuración.' },
        { status: 500 },
      );
  } else {
    const { data: domain } = await service
      .from('tenant_domains')
      .select('id,hostname,verification_token')
      .eq('tenant_id', params.id)
      .eq('is_primary', true)
      .maybeSingle();
    if (!domain || domain.hostname !== `${tenant.slug}.vora.venesoftca.com`)
      return NextResponse.json(
        { error: 'No hay un subdominio VORA reservado.' },
        { status: 409 },
      );
    let verified = false;
    try {
      const response = await fetch(
        `https://${domain.hostname}/api/tenant-domain-check`,
        {
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        },
      );
      const result = await response.json();
      verified =
        response.ok &&
        result.token === domain.verification_token &&
        result.hostname === domain.hostname;
    } catch {
      /* DNS, TLS or deployment is still pending. */
    }
    const { error } = await service
      .from('tenant_domains')
      .update({
        verification_status: verified ? 'verified' : 'failed',
        last_checked_at: new Date().toISOString(),
        verification_error: verified
          ? null
          : 'Configura el dominio en el hosting, DNS y HTTPS; luego reintenta.',
      })
      .eq('id', domain.id);
    if (error)
      return NextResponse.json(
        { error: 'No se pudo guardar la verificación.' },
        { status: 500 },
      );
    if (!verified)
      return NextResponse.json(
        {
          error:
            'DNS/HTTPS o asociación al despliegue pendientes. Puedes continuar con las otras configuraciones.',
        },
        { status: 409 },
      );
  }
  const { error: auditError } = await service
    .from('platform_audit_logs')
    .insert({
      actor_id: user.id,
      tenant_id: params.id,
      action: `tenant.setup.${d.section}`,
      resource: 'tenants',
      resource_id: params.id,
      details: { section: d.section },
    });
  if (auditError)
    return NextResponse.json(
      {
        error:
          'Configuración guardada, pero no se pudo registrar la auditoría. Revisa antes de continuar.',
      },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
