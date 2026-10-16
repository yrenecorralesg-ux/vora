import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';

/**
 * GET /api/admin/tenants/[id]
 * Fetch tenant details (with related branding, database, features, memberships).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
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

  const service = getSupabaseServiceClient();
  const { data: tenant, error } = await service
    .from('tenants')
    .select(
      `
        id,
        commercial_name,
        legal_name,
        slug,
        commercial_status,
        technical_status,
        country,
        currency,
        language,
        timezone,
        business_type,
        business_template_id,
        plan_id,
        wizard_step,
        wizard_completed,
        created_at,
        updated_at,
        business_templates ( id, name, key ),
        tenant_branding ( * ),
        tenant_databases ( * ),
        tenant_features ( id, feature_key, enabled, config, config_state, release_status )
      `,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Error al obtener la empresa.', detail: error.message },
      { status: 500 },
    );
  }
  if (!tenant) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ tenant });
}

/**
 * PATCH /api/admin/tenants/[id]
 * Update editable tenant fields. Does NOT allow changing id, created_at, or
 * commercial_status/technical_status via this endpoint (use /status for those).
 */
export async function PATCH(
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

  /* Build patch from allowed fields only */
  const allowed: Record<string, unknown> = {};
  const fields = [
    'commercial_name',
    'legal_name',
    'country',
    'currency',
    'language',
    'timezone',
    'business_type',
    'business_template_id',
    'plan_id',
    'wizard_step',
    'wizard_completed',
  ];
  for (const f of fields) {
    if (body?.[f] !== undefined) allowed[f] = body[f];
  }

  /* slug can be changed but must remain unique */
  if (typeof body?.slug === 'string' && body.slug.trim()) {
    const newSlug = body.slug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(newSlug)) {
      return NextResponse.json(
        { error: 'Slug invalido: solo minusculas, numeros y guiones.' },
        { status: 400 },
      );
    }
    const service = getSupabaseServiceClient();
    const { data: dup } = await service
      .from('tenants')
      .select('id')
      .eq('slug', newSlug)
      .neq('id', params.id)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { error: `El slug "${newSlug}" ya esta en uso.` },
        { status: 409 },
      );
    }
    allowed.slug = newSlug;
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar.' }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { data: updated, error } = await service
    .from('tenants')
    .update(allowed)
    .eq('id', params.id)
    .select('id, slug, commercial_name, wizard_step, wizard_completed')
    .maybeSingle();

  if (error) {
    console.error('[api/admin/tenants/[id]] update error', error.message);
    return NextResponse.json(
      { error: 'No se pudo actualizar la empresa.', detail: error.message },
      { status: 500 },
    );
  }
  if (!updated) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  }

  await service.from('platform_audit_logs').insert({
    actor_id: user.id,
    tenant_id: params.id,
    action: 'tenant.update',
    resource: 'tenants',
    resource_id: params.id,
    details: allowed,
  });

  return NextResponse.json({ tenant: updated });
}
