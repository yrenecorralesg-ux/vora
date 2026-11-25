import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import {
  authorizeTenantApi,
  hasConfigPermission,
  permissionDenied,
} from '@/lib/tenant-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/t/[slug]/modules
 * Fetches available modules and their enabled state for the tenant.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const tenantId = auth.access.tenantId;

  const [{ data: catalog }, { data: tenantFeats }] = await Promise.all([
    service
      .from('features')
      .select(
        'key, name, description, category, implementation_status, sort_order, available_functions',
      )
      .order('sort_order', { ascending: true }),
    service
      .from('tenant_features')
      .select('feature_key, enabled, contracted, config, config_state, release_status')
      .eq('tenant_id', tenantId),
  ]);

  return NextResponse.json({
    tenantId,
    catalog: catalog ?? [],
    tenantFeatures: tenantFeats ?? [],
  });
}

/**
 * PATCH /api/t/[slug]/modules
 * Persiste en la base de datos los módulos activos y sus sub-funciones para la empresa.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  if (!(await hasConfigPermission(auth.access))) {
    return permissionDenied('Tu rol no permite cambiar la configuración de módulos.');
  }

  const service = getSupabaseServiceClient();
  const tenantId = auth.access.tenantId;

  const body = await req.json().catch(() => ({}));
  const { feature_key, enabled, config } = body;

  if (!feature_key || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Parámetros inválidos (feature_key, enabled).' },
      { status: 400 },
    );
  }

  // Un módulo planificado no puede activarse aún.
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
    .select('contracted, config')
    .eq('tenant_id', tenantId)
    .eq('feature_key', feature_key)
    .maybeSingle();
  if (!assignment?.contracted)
    return NextResponse.json(
      { error: 'El servicio no está contratado. Solo los módulos contratados pueden configurarse.' },
      { status: 409 },
    );

  const existingCfg =
    assignment?.config && typeof assignment.config === 'object'
      ? (assignment.config as Record<string, unknown>)
      : {};
  const incomingCfg =
    config && typeof config === 'object' ? (config as Record<string, unknown>) : undefined;
  const mergedCfg = incomingCfg
    ? {
        ...existingCfg,
        ...incomingCfg,
        functions: {
          ...((existingCfg.functions as Record<string, boolean> | undefined) ?? {}),
          ...((incomingCfg.functions as Record<string, boolean> | undefined) ?? {}),
        },
      }
    : existingCfg;

  const { data, error } = await service
    .from('tenant_features')
    .upsert(
      {
        tenant_id: tenantId,
        feature_key,
        contracted: assignment.contracted,
        enabled,
        config: mergedCfg,
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
