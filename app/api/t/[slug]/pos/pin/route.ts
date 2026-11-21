import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import { PosError, hashPin, validatePinFormat, verifyPinHash } from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const APPROVER_PERMISSIONS = ['pos.refunds.approve', 'pos.sales.discount.override', 'pos.sales.void'];

async function canApprove(access: Parameters<typeof hasTenantPermission>[0]) {
  for (const p of APPROVER_PERMISSIONS) if (await hasTenantPermission(access, p)) return true;
  return false;
}

/** ¿El usuario de la sesión tiene PIN de supervisor configurado? */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const { data } = await getSupabaseServiceClient()
    .from('pos_staff_pins')
    .select('updated_at, locked_until')
    .eq('tenant_id', auth.access.tenantId)
    .eq('auth_user_id', auth.access.userId)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    has_pin: Boolean(data),
    updated_at: data?.updated_at ?? null,
    locked_until: data?.locked_until ?? null,
    can_approve: await canApprove(auth.access),
  });
}

/**
 * Define o cambia el PIN personal del supervisor de la sesión. Para cambiarlo
 * exige el PIN actual. Se guarda solo el hash (scrypt con sal).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  if (auth.access.role === 'super_admin')
    return permissionDenied('El PIN de supervisor es personal de los usuarios de la empresa.');
  if (!(await canApprove(auth.access)))
    return permissionDenied('Tu rol no autoriza operaciones de supervisor; no necesita PIN.');

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  try {
    const pin = validatePinFormat(body.pin);
    const service = getSupabaseServiceClient();
    const { tenantId, userId } = auth.access;
    const { data: current } = await service
      .from('pos_staff_pins')
      .select('pin_hash')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (current && !verifyPinHash(String(body.current_pin ?? '').trim(), current.pin_hash))
      return NextResponse.json({ ok: false, error: 'El PIN actual no es correcto.' }, { status: 403 });

    const { error } = await service.from('pos_staff_pins').upsert(
      {
        tenant_id: tenantId,
        auth_user_id: userId,
        pin_hash: hashPin(pin),
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,auth_user_id' },
    );
    if (error) return NextResponse.json({ ok: false, error: 'No se pudo guardar el PIN.' }, { status: 500 });
    await service.from('pos_audit_events').insert({
      tenant_id: tenantId,
      actor_id: userId,
      event_type: current ? 'pin_supervisor_cambiado' : 'pin_supervisor_creado',
      entity_type: 'pos_staff_pins',
      entity_id: userId,
      description: current ? 'PIN de supervisor actualizado' : 'PIN de supervisor configurado',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 500 });
  }
}
