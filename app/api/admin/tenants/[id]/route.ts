import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { auditTenantAction, invalidTenantIdResponse, requireSuperAdminApi } from '@/lib/admin-guard';
import { normalizeTaxId, tenantUpdateSchema, zodFieldErrors } from '@/lib/tenant-management';

/**
 * GET /api/admin/tenants/[id]
 * Company detail with plan, subscription, branding, database, features and memberships (super_admin only).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireSuperAdminApi();
  if (guard.response) return guard.response;
  const invalid = invalidTenantIdResponse(params.id);
  if (invalid) return invalid;

  const { data: tenant, error } = await getSupabaseServiceClient()
    .from('tenants')
    .select(
      `
        id, commercial_name, legal_name, tax_id, contact_email, contact_phone, slug,
        commercial_status, technical_status, infrastructure_mode,
        country, currency, language, timezone, business_type, business_template_id, plan_id,
        wizard_step, wizard_completed, created_at, updated_at,
        plans ( id, name ),
        tenant_subscriptions ( id, plan_id, status, started_at, ended_at, updated_at ),
        business_templates ( id, name, key ),
        tenant_branding ( * ),
        tenant_databases ( id, provider, project_ref, supabase_url, secret_ref, connection_status, last_checked_at, error_message ),
        tenant_features ( id, feature_key, enabled, config, config_state, release_status ),
        tenant_memberships ( id, auth_user_id, role, status, created_at )
      `,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('[api/admin/tenants/[id]] fetch error', error.message);
    return NextResponse.json({ error: 'Error al obtener la empresa.' }, { status: 500 });
  }
  if (!tenant) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  return NextResponse.json({ tenant });
}

/**
 * PATCH /api/admin/tenants/[id]
 * Edits company data (super_admin only). Plan changes use /plan and status changes use /status.
 * - Validates formats; tax ID and slug must stay unique.
 * - The infrastructure mode can only change while the infrastructure is not verified yet.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireSuperAdminApi();
  if (guard.response) return guard.response;
  const { user } = guard;
  const invalid = invalidTenantIdResponse(params.id);
  if (invalid) return invalid;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const parsed = tenantUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revisa los campos marcados.', fields: zodFieldErrors(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar.' }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { data: current } = await service
    .from('tenants')
    .select('id, country, tax_id, slug, infrastructure_mode, technical_status')
    .eq('id', params.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });

  const patch: Record<string, unknown> = { ...input };

  /* Tax ID: normalize with the effective country and keep it unique ---------- */
  const effectiveCountry = input.country ?? current.country ?? 'VE';
  if (input.tax_id !== undefined || (input.country !== undefined && current.tax_id)) {
    const rawTaxId = input.tax_id ?? current.tax_id ?? '';
    const taxId = normalizeTaxId(rawTaxId, effectiveCountry);
    if (!taxId) {
      return NextResponse.json(
        { error: 'Revisa los campos marcados.', fields: { tax_id: effectiveCountry === 'VE' ? 'RIF inválido. Formato: J-12345678-9.' : 'Identificación fiscal inválida.' } },
        { status: 400 },
      );
    }
    const { data: taxTaken } = await service.from('tenants').select('id').ilike('tax_id', taxId).neq('id', params.id).maybeSingle();
    if (taxTaken) {
      return NextResponse.json({ error: `El RIF ${taxId} ya está registrado en otra empresa.`, fields: { tax_id: 'RIF ya registrado.' } }, { status: 409 });
    }
    patch.tax_id = taxId;
  }

  if (input.slug !== undefined && input.slug !== current.slug) {
    const { data: slugTaken } = await service.from('tenants').select('id').eq('slug', input.slug).neq('id', params.id).maybeSingle();
    if (slugTaken) {
      return NextResponse.json({ error: `El slug "${input.slug}" ya está en uso.`, fields: { slug: 'Slug en uso.' } }, { status: 409 });
    }
  }

  if (input.infrastructure_mode !== undefined && input.infrastructure_mode !== current.infrastructure_mode && current.technical_status === 'ready') {
    return NextResponse.json(
      { error: 'No se puede cambiar la modalidad de una empresa con infraestructura ya verificada.' },
      { status: 409 },
    );
  }

  if (patch.contact_phone === '') patch.contact_phone = null;

  const { data: updated, error } = await service
    .from('tenants')
    .update(patch)
    .eq('id', params.id)
    .select('id, slug, commercial_name, tax_id, infrastructure_mode, wizard_step, wizard_completed')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'El slug o el RIF ya están registrados en otra empresa.' }, { status: 409 });
    }
    console.error('[api/admin/tenants/[id]] update error', error.message);
    return NextResponse.json({ error: 'No se pudo actualizar la empresa.' }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });

  await auditTenantAction({ actorId: user.id, tenantId: params.id, action: 'tenant.update', details: patch });
  return NextResponse.json({ tenant: updated });
}
