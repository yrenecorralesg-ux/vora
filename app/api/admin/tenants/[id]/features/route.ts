import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
const schema = z.object({
  features: z
    .array(
      z.object({
        feature_key: z.string().trim().min(1).max(100),
        enabled: z.boolean(),
        contracted: z.boolean().optional(),
        config: z
          .object({ functions: z.record(z.boolean()).optional() })
          .catchall(z.unknown())
          .default({}),
      }),
    )
    .max(200),
});
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
  const [catalog, features] = await Promise.all([
    db
      .from('features')
      .select(
        'key,name,description,category,dependencies,implementation_status,sort_order,available_functions',
      )
      .order('sort_order'),
    db
      .from('tenant_features')
      .select(
        'feature_key,enabled,contracted,config,config_state,release_status',
      )
      .eq('tenant_id', params.id),
  ]);
  if (catalog.error || features.error)
    return NextResponse.json(
      { error: 'No se pudieron cargar los servicios.' },
      { status: 500 },
    );
  return NextResponse.json({
    catalog: catalog.data,
    tenantFeatures: features.data,
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
      { error: 'La configuración de servicios no es válida.' },
      { status: 400 },
    );
  const entries = parsed.data.features;
  if (new Set(entries.map((f) => f.feature_key)).size !== entries.length)
    return NextResponse.json(
      { error: 'Hay servicios duplicados.' },
      { status: 400 },
    );
  const db = getSupabaseServiceClient();
  const { data: tenant } = await db
    .from('tenants')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant)
    return NextResponse.json(
      { error: 'Empresa no encontrada.' },
      { status: 404 },
    );
  const { data: catalog, error } = await db
    .from('features')
    .select('key,implementation_status,dependencies,available_functions');
  if (error)
    return NextResponse.json(
      { error: 'No se pudo validar el catálogo.' },
      { status: 500 },
    );
  const byKey = new Map((catalog ?? []).map((f) => [f.key, f]));
  const { data: current, error: readError } = await db
    .from('tenant_features')
    .select('feature_key,enabled')
    .eq('tenant_id', params.id);
  if (readError)
    return NextResponse.json(
      { error: 'No se pudo leer la configuración actual.' },
      { status: 500 },
    );
  const active = new Set(
    (current ?? []).filter((f) => f.enabled).map((f) => f.feature_key),
  );
  for (const f of entries)
    f.enabled ? active.add(f.feature_key) : active.delete(f.feature_key);
  for (const f of entries) {
    const item = byKey.get(f.feature_key);
    if (!item)
      return NextResponse.json(
        { error: `Servicio desconocido: ${f.feature_key}` },
        { status: 400 },
      );
    if (
      f.enabled &&
      (!(f.contracted ?? f.enabled) ||
        item.implementation_status !== 'implemented')
    )
      return NextResponse.json(
        {
          error: `${f.feature_key} debe estar contratado e implementado antes de activarse.`,
        },
        { status: 409 },
      );
    const functions = (item.available_functions ?? []) as { key: string }[];
    if (
      Object.keys(f.config.functions ?? {}).some(
        (k) => !functions.some((fn) => fn.key === k),
      )
    )
      return NextResponse.json(
        { error: `Función desconocida en ${f.feature_key}.` },
        { status: 400 },
      );
  }
  for (const key of Array.from(active)) {
    const item = byKey.get(key);
    if ((item?.dependencies ?? []).some((dep: string) => !active.has(dep)))
      return NextResponse.json(
        { error: `Revisa las dependencias de ${key}.` },
        { status: 409 },
      );
  }
  if (!entries.length) return NextResponse.json({ ok: true, count: 0 });
  const rows = entries.map((f) => ({
    tenant_id: params.id,
    feature_key: f.feature_key,
    contracted: f.contracted ?? f.enabled,
    enabled: f.enabled,
    config: f.config,
    config_state: f.enabled ? 'enabled' : 'pending_config',
    release_status:
      byKey.get(f.feature_key)?.implementation_status === 'implemented'
        ? 'released_for_testing'
        : 'planned',
  }));
  const { error: saveError } = await db
    .from('tenant_features')
    .upsert(rows, { onConflict: 'tenant_id,feature_key' });
  if (saveError)
    return NextResponse.json(
      { error: 'No se pudieron guardar los servicios.' },
      { status: 500 },
    );
  const { error: auditError } = await db
    .from('platform_audit_logs')
    .insert({
      actor_id: user.id,
      tenant_id: params.id,
      action: 'tenant.features.save',
      resource: 'tenant_features',
      resource_id: params.id,
      details: { count: rows.length, keys: rows.map((f) => f.feature_key) },
    });
  if (auditError)
    return NextResponse.json(
      { error: 'Servicios guardados, pero falló el registro de auditoría.' },
      { status: 500 },
    );
  return NextResponse.json({ ok: true, count: rows.length });
}
