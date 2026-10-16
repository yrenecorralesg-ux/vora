import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';

interface FeatureInput {
  feature_key: string;
  enabled: boolean;
  config?: Record<string, any>;
}

/**
 * GET /api/admin/tenants/[id]/features
 * Returns features catalog with available_functions and tenant_features configuration.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const service = getSupabaseServiceClient();

  const [{ data: catalog, error: catErr }, { data: tenantFeats, error: tfErr }] =
    await Promise.all([
      service
        .from('features')
        .select('key, name, description, category, dependencies, implementation_status, sort_order, available_functions')
        .order('sort_order', { ascending: true }),
      service
        .from('tenant_features')
        .select('feature_key, enabled, config, config_state, release_status')
        .eq('tenant_id', params.id),
    ]);

  if (catErr || tfErr) {
    return NextResponse.json({ error: 'Error al consultar módulos.' }, { status: 500 });
  }

  return NextResponse.json({
    catalog: catalog ?? [],
    tenantFeatures: tenantFeats ?? [],
  });
}

/**
 * POST /api/admin/tenants/[id]/features
 * Saves the set of feature flags and sub-function configs for a tenant.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
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

  const features: FeatureInput[] = Array.isArray(body?.features) ? body.features : null;
  if (!features) {
    return NextResponse.json(
      { error: 'Se requiere un arreglo "features" de { feature_key, enabled, config? }.' },
      { status: 400 },
    );
  }

  /* Validate each entry */
  const seen = new Set<string>();
  for (const f of features) {
    if (typeof f?.feature_key !== 'string' || !f.feature_key.trim()) {
      return NextResponse.json(
        { error: 'Cada feature debe tener un feature_key válido.' },
        { status: 400 },
      );
    }
    if (typeof f?.enabled !== 'boolean') {
      return NextResponse.json(
        { error: `El campo "enabled" de "${f.feature_key}" debe ser booleano.` },
        { status: 400 },
      );
    }
    if (seen.has(f.feature_key)) {
      return NextResponse.json(
        { error: `Feature duplicado: "${f.feature_key}".` },
        { status: 400 },
      );
    }
    seen.add(f.feature_key);
  }

  const service = getSupabaseServiceClient();

  /* Verify tenant exists */
  const { data: tenant } = await service
    .from('tenants')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  }

  const { data: catalog, error: catalogErr } = await service
    .from('features')
    .select('key, implementation_status');
  if (catalogErr) {
    return NextResponse.json({ error: 'No se pudo validar el catálogo de módulos.' }, { status: 500 });
  }
  const catalogByKey = new Map((catalog ?? []).map((feature) => [feature.key, feature.implementation_status]));
  const unknownKeys = features.map((feature) => feature.feature_key).filter((key) => !catalogByKey.has(key));
  if (unknownKeys.length > 0) {
    return NextResponse.json({ error: `Módulos no reconocidos: ${unknownKeys.join(', ')}` }, { status: 400 });
  }

  const premature = features.filter((f) => f.enabled && catalogByKey.get(f.feature_key) !== 'implemented');
  if (premature.length) {
    return NextResponse.json({ error: `Módulos todavía no implementados: ${premature.map((f) => f.feature_key).join(', ')}` }, { status: 409 });
  }

  const rows = features.map((f) => {
    const implemented = catalogByKey.get(f.feature_key) === 'implemented';
    return {
      tenant_id: params.id,
      feature_key: f.feature_key,
      enabled: f.enabled,
      config: f.config ?? { functions: {} },
      config_state: (implemented ? 'enabled' : 'pending_config') as any,
      release_status: (implemented ? 'released_for_testing' : 'planned') as any,
    };
  });

  const { data: insertedRows, error: upsertErr } = await service
    .from('tenant_features')
    .upsert(rows, { onConflict: 'tenant_id,feature_key' })
    .select('id, feature_key, enabled, config, config_state, release_status');
  if (upsertErr) {
    return NextResponse.json({ error: 'No se pudieron guardar los módulos: ' + upsertErr.message }, { status: 500 });
  }
  const inserted = insertedRows ?? [];

  await service.from('platform_audit_logs').insert({
    actor_id: user.id,
    tenant_id: params.id,
    action: 'tenant.features.save',
    resource: 'tenant_features',
    resource_id: params.id,
    details: { count: inserted.length, keys: inserted.map((f) => f.feature_key) },
  });

  return NextResponse.json({ features: inserted, count: inserted.length });
}
