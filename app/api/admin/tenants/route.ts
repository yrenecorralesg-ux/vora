import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';

/**
 * POST /api/admin/tenants
 * Creates a new tenant (company) row.
 * - Validates the session and the super_admin role.
 * - Prevents duplicate slug.
 * - New tenants always start as commercial_status = 'trial' and
 *   technical_status = 'pending_setup' (incomplete setup stays pending).
 * - Records an audit log entry.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  /* ----------------------------- session ------------------------------ */
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

  /* ------------------------------ input ------------------------------- */
  const commercial_name = typeof body?.commercial_name === 'string' ? body.commercial_name.trim() : '';
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const legal_name =
    typeof body?.legal_name === 'string' && body.legal_name.trim()
      ? body.legal_name.trim()
      : null;
  const country =
    typeof body?.country === 'string' && body.country.trim() ? body.country.trim() : null;
  const currency =
    typeof body?.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'COP';
  const language =
    typeof body?.language === 'string' && body.language.trim() ? body.language.trim() : 'es';
  const timezone =
    typeof body?.timezone === 'string' && body.timezone.trim()
      ? body.timezone.trim()
      : 'America/Bogota';
  const business_type =
    typeof body?.business_type === 'string' && body.business_type.trim()
      ? body.business_type.trim()
      : null;
  const business_template_id =
    typeof body?.business_template_id === 'string' && body.business_template_id.trim()
      ? body.business_template_id.trim()
      : null;

  if (!commercial_name) {
    return NextResponse.json({ error: 'El nombre comercial es obligatorio.' }, { status: 400 });
  }
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(slug)) {
    return NextResponse.json(
      {
        error:
          'El slug es obligatorio y debe contener solo minusculas, numeros y guiones (inicio/fin alfanumerico).',
      },
      { status: 400 },
    );
  }

  /* ------------------------ duplicate slug check ---------------------- */
  const service = getSupabaseServiceClient();
  const { data: existing } = await service
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `Ya existe una empresa con el slug "${slug}". Elige otro.` },
      { status: 409 },
    );
  }

  /* ------------------------------ create ------------------------------ */
  const { data: tenant, error } = await service
    .from('tenants')
    .insert({
      commercial_name,
      legal_name,
      slug,
      country,
      currency,
      language,
      timezone,
      business_type,
      business_template_id,
      commercial_status: 'trial',
      technical_status: 'pending_setup',
      wizard_step: 1,
      wizard_completed: false,
    })
    .select('id, slug, commercial_name')
    .single();

  if (error) {
    console.error('[api/admin/tenants] insert error', error.message);
    return NextResponse.json(
      { error: 'No se pudo crear la empresa.', detail: error.message },
      { status: 500 },
    );
  }

  /* ------------------------------ audit ------------------------------- */
  await service.from('platform_audit_logs').insert({
    actor_id: user.id,
    tenant_id: tenant.id,
    action: 'tenant.create',
    resource: 'tenants',
    resource_id: tenant.id,
    details: {
      commercial_name: tenant.commercial_name,
      slug: tenant.slug,
      business_type,
      business_template_id,
    },
  });

  return NextResponse.json({ tenant }, { status: 201 });
}

/**
 * GET /api/admin/tenants
 * Returns a lightweight list of tenants for admin tooling.
 */
export async function GET() {
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
  const { data, error } = await service
    .from('tenants')
    .select(
      'id, commercial_name, slug, commercial_status, technical_status, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Error al listar empresas.', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ tenants: data ?? [] });
}
