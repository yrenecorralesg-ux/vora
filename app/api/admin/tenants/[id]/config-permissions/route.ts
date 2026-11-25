import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import {
  DEFAULT_CONFIG_ALLOWED_ROLES,
  getTenantConfigRoles,
  normalizeConfigRoles,
  VALID_CONFIG_ROLE_KEYS,
} from '@/lib/config-permissions';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  allowed_roles: z
    .array(z.string())
    .refine((arr) => arr.every((r) => VALID_CONFIG_ROLE_KEYS.has(r)), {
      message: 'Rol inválido en la lista de permisos.',
    }),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'Permisos insuficientes. Requiere Super Admin.' }, { status: 403 });
  }
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: 'ID de empresa inválido.' }, { status: 400 });
  }
  const service = getSupabaseServiceClient();
  const custom = await getTenantConfigRoles(service, params.id);
  return NextResponse.json({
    ok: true,
    is_custom: custom !== null,
    allowed_roles: custom ?? DEFAULT_CONFIG_ALLOWED_ROLES,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'Permisos insuficientes. Requiere Super Admin.' }, { status: 403 });
  }
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: 'ID de empresa inválido.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos.' },
      { status: 400 },
    );
  }

  const service = getSupabaseServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  }

  const nextRoles = normalizeConfigRoles(parsed.data.allowed_roles) ?? ['tenant_admin'];

  const { data: existing } = await service
    .from('tenant_features')
    .select('enabled, contracted, config')
    .eq('tenant_id', params.id)
    .eq('feature_key', 'crm.dashboard')
    .maybeSingle();

  const baseConfig =
    existing?.config && typeof existing.config === 'object'
      ? (existing.config as Record<string, unknown>)
      : {};

  const { error } = await service.from('tenant_features').upsert(
    {
      tenant_id: params.id,
      feature_key: 'crm.dashboard',
      enabled: existing?.enabled ?? true,
      contracted: existing?.contracted ?? true,
      config: { ...baseConfig, config_allowed_roles: nextRoles },
    },
    { onConflict: 'tenant_id,feature_key' },
  );

  if (error) {
    return NextResponse.json(
      { error: 'No se pudieron guardar los permisos de configuración.' },
      { status: 500 },
    );
  }

  await service.from('platform_audit_logs').insert({
    actor_id: actor.id,
    tenant_id: params.id,
    action: 'tenant.config_permissions.update',
    resource: 'tenant_features',
    resource_id: params.id,
    details: { config_allowed_roles: nextRoles },
  });

  return NextResponse.json({
    ok: true,
    is_custom: true,
    allowed_roles: nextRoles,
  });
}
