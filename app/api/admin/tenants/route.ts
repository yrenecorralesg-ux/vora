import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { auditTenantAction, requireSuperAdminApi } from '@/lib/admin-guard';
import {
  TENANT_COUNTRIES,
  normalizeTaxId,
  subscriptionStatusFor,
  tenantCreateSchema,
  zodFieldErrors,
} from '@/lib/tenant-management';

const TENANT_LIST_COLUMNS =
  'id, commercial_name, legal_name, tax_id, slug, commercial_status, technical_status, infrastructure_mode, plan_id, contact_email, country, currency, business_type, created_at, plans ( name )';

/**
 * POST /api/admin/tenants
 * Registers a company (super_admin only).
 * - Validates required fields, formats (RIF, email, phone) and plan.
 * - Rejects duplicate slug and tax ID (409).
 * - New companies start as commercial_status = 'pending' and technical_status = 'pending_setup':
 *   registering never marks a company as operational.
 * - Creates the initial subscription for the chosen plan and records an audit entry.
 */
export async function POST(req: Request) {
  const guard = await requireSuperAdminApi();
  if (guard.response) return guard.response;
  const { user } = guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const parsed = tenantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revisa los campos marcados.', fields: zodFieldErrors(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  const taxId = normalizeTaxId(input.tax_id, input.country) as string;
  const country = TENANT_COUNTRIES.find((c) => c.value === input.country);
  const service = getSupabaseServiceClient();

  /* Plan must exist and be active ----------------------------------------- */
  const { data: plan } = await service.from('plans').select('id, name, is_active').eq('id', input.plan_id).maybeSingle();
  if (!plan || plan.is_active === false) {
    return NextResponse.json({ error: 'El plan seleccionado no existe o no está activo.', fields: { plan_id: 'Plan no disponible.' } }, { status: 400 });
  }

  /* Uniqueness (also enforced by DB constraints) ---------------------------- */
  const [{ data: slugTaken }, { data: taxTaken }] = await Promise.all([
    service.from('tenants').select('id').eq('slug', input.slug).maybeSingle(),
    service.from('tenants').select('id').ilike('tax_id', taxId).maybeSingle(),
  ]);
  if (slugTaken) {
    return NextResponse.json({ error: `Ya existe una empresa con el slug "${input.slug}".`, fields: { slug: 'Slug en uso.' } }, { status: 409 });
  }
  if (taxTaken) {
    return NextResponse.json({ error: `Ya existe una empresa con el RIF ${taxId}.`, fields: { tax_id: 'RIF ya registrado.' } }, { status: 409 });
  }

  const { data: tenant, error } = await service
    .from('tenants')
    .insert({
      commercial_name: input.commercial_name,
      legal_name: input.legal_name,
      tax_id: taxId,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone || null,
      slug: input.slug,
      country: input.country,
      currency: input.currency,
      language: input.language ?? 'es',
      timezone: input.timezone ?? country?.timezone ?? 'America/Caracas',
      business_type: input.business_type,
      business_template_id: input.business_template_id || null,
      infrastructure_mode: input.infrastructure_mode,
      plan_id: input.plan_id,
      commercial_status: 'pending',
      technical_status: 'pending_setup',
      wizard_step: 1,
      wizard_completed: false,
    })
    .select('id, slug, commercial_name')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'El slug o el RIF ya están registrados en otra empresa.' }, { status: 409 });
    }
    console.error('[api/admin/tenants] insert error', error.message);
    return NextResponse.json({ error: 'No se pudo crear la empresa.' }, { status: 500 });
  }

  const { error: subError } = await service.from('tenant_subscriptions').insert({
    tenant_id: tenant.id,
    plan_id: input.plan_id,
    status: subscriptionStatusFor('pending'),
  });
  if (subError) console.error('[api/admin/tenants] subscription insert error', subError.message);

  await auditTenantAction({
    actorId: user.id,
    tenantId: tenant.id,
    action: 'tenant.create',
    details: {
      commercial_name: input.commercial_name,
      slug: input.slug,
      tax_id: taxId,
      infrastructure_mode: input.infrastructure_mode,
      plan: plan.name,
      business_type: input.business_type,
    },
  });

  return NextResponse.json({ tenant, subscription_created: !subError }, { status: 201 });
}

/**
 * GET /api/admin/tenants
 * Company list for admin tooling (super_admin only).
 */
export async function GET() {
  const guard = await requireSuperAdminApi();
  if (guard.response) return guard.response;

  const { data, error } = await getSupabaseServiceClient()
    .from('tenants')
    .select(TENANT_LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/admin/tenants] list error', error.message);
    return NextResponse.json({ error: 'Error al listar empresas.' }, { status: 500 });
  }
  return NextResponse.json({ tenants: data ?? [] });
}
