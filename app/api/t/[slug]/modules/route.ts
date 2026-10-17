import { NextResponse } from 'next/server';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import { isSuperAdmin, requireSession } from '@/lib/auth';

/**
 * GET /api/t/[slug]/modules
 * Fetches available modules and their enabled state for the tenant.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const session = await getSupabaseServerClient().auth.getUser();
  if (!session.data.user)
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const service = getSupabaseServiceClient();

  const { data: tenant } = await service
    .from('tenants')
    .select('id')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json(
      { error: 'Tenant no encontrado.' },
      { status: 404 },
    );
  }

  if (!(await isSuperAdmin(session.data.user.id))) {
    const { data: membership } = await service
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', session.data.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership)
      return NextResponse.json(
        { error: 'Permisos insuficientes.' },
        { status: 403 },
      );
  }
  const [{ data: catalog }, { data: tenantFeats }] = await Promise.all([
    service
      .from('features')
      .select(
        'key, name, description, category, implementation_status, sort_order, available_functions',
      )
      .order('sort_order', { ascending: true }),
    service
      .from('tenant_features')
      .select('feature_key, enabled, config, config_state, release_status')
      .eq('tenant_id', tenant.id),
  ]);

  return NextResponse.json({
    tenantId: tenant.id,
    catalog: catalog ?? [],
    tenantFeatures: tenantFeats ?? [],
  });
}

/**
 * PATCH /api/t/[slug]/modules
 * Allows toggling a module or sub-function for this tenant.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = getSupabaseServerClient();
  const user = await requireSession(supabase);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const session = await getSupabaseServerClient().auth.getUser();
  if (!session.data.user)
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const service = getSupabaseServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json(
      { error: 'Tenant no encontrado.' },
      { status: 404 },
    );
  }

  const admin = await isSuperAdmin(user.id, supabase);
  if (!admin) {
    const { data: membership } = await service
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership || !['tenant_admin', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes.' },
        { status: 403 },
      );
    }
  }

  if (!admin)
    return NextResponse.json(
      { error: 'La contratación de servicios se administra desde VORA Core.' },
      { status: 403 },
    );
  const body = await req.json().catch(() => ({}));
  const { feature_key, enabled, config } = body;

  if (!feature_key || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Parámetros inválidos (feature_key, enabled).' },
      { status: 400 },
    );
  }

  // A planned module is visible in the catalog but cannot be activated yet.
  const { data: catalogFeature, error: catalogError } = await service
    .from('features')
    .select('implementation_status')
    .eq('key', feature_key)
    .maybeSingle();
  if (catalogError)
    return NextResponse.json(
      { error: 'Error al validar el módulo.' },
      { status: 500 },
    );
  if (!catalogFeature)
    return NextResponse.json(
      { error: 'Módulo no reconocido.' },
      { status: 400 },
    );
  if (enabled && catalogFeature.implementation_status !== 'implemented') {
    return NextResponse.json(
      { error: 'Este módulo todavía está planificado y no puede activarse.' },
      { status: 409 },
    );
  }

  const { data: assignment } = await service
    .from('tenant_features')
    .select('contracted')
    .eq('tenant_id', tenant.id)
    .eq('feature_key', feature_key)
    .maybeSingle();
  if (enabled && !assignment?.contracted)
    return NextResponse.json(
      { error: 'El servicio no está contratado.' },
      { status: 409 },
    );
  const updateData: Record<string, unknown> = { enabled };
  if (config !== undefined) {
    updateData.config = config;
  }

  const { data, error } = await service
    .from('tenant_features')
    .upsert(
      {
        tenant_id: tenant.id,
        feature_key,
        ...updateData,
      },
      { onConflict: 'tenant_id,feature_key' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feature: data });
}
