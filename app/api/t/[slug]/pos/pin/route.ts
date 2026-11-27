import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantModuleApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import {
  PosError,
  createOfflinePinBundle,
  hashPin,
  saveOfflinePinBundle,
  validatePinFormat,
  verifyPinHash,
} from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const APPROVER_PERMISSIONS = ['pos.refunds.approve', 'pos.sales.discount.override', 'pos.sales.void'];

async function canApprove(access: Parameters<typeof hasTenantPermission>[0]) {
  for (const p of APPROVER_PERMISSIONS) if (await hasTenantPermission(access, p)) return true;
  return false;
}

/** ¿El usuario de la sesión tiene PIN configurado (y listo para modo offline)? */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  let row: { updated_at?: string; locked_until?: string | null; offline_bundle?: unknown } | null = null;
  const primary = await service
    .from('pos_staff_pins')
    .select('updated_at, locked_until, offline_bundle')
    .eq('tenant_id', auth.access.tenantId)
    .eq('auth_user_id', auth.access.userId)
    .maybeSingle();
  if (primary.error) {
    const fallback = await service
      .from('pos_staff_pins')
      .select('updated_at, locked_until')
      .eq('tenant_id', auth.access.tenantId)
      .eq('auth_user_id', auth.access.userId)
      .maybeSingle();
    row = fallback.data;
  } else {
    row = primary.data;
  }
  return NextResponse.json({
    ok: true,
    has_pin: Boolean(row),
    offline_pin_ready: Boolean(row?.offline_bundle),
    updated_at: row?.updated_at ?? null,
    locked_until: row?.locked_until ?? null,
    can_approve: await canApprove(auth.access),
  });
}

/**
 * Define o cambia el PIN personal del operador/supervisor de la sesión.
 * Permite también activar la verificación offline del PIN actual sin cambiarlo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;
  if (auth.access.role === 'super_admin')
    return permissionDenied('El PIN del POS es personal de los usuarios de la empresa.');

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }

  try {
    const service = getSupabaseServiceClient();
    const { tenantId, userId } = auth.access;
    const { data: current } = await service
      .from('pos_staff_pins')
      .select('pin_hash')
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (body.action === 'activate_offline') {
      if (!current) {
        return NextResponse.json({ ok: false, error: 'Primero configura tu PIN del POS.' }, { status: 400 });
      }
      const currentPin = String(body.current_pin ?? '').trim();
      if (!verifyPinHash(currentPin, current.pin_hash)) {
        return NextResponse.json({ ok: false, error: 'El PIN actual no es correcto.' }, { status: 403 });
      }
      const bundle = createOfflinePinBundle({
        pin: currentPin,
        tenantId,
        userId,
        pinHash: current.pin_hash,
      });
      const saved = await saveOfflinePinBundle(service, tenantId, userId, bundle);
      return NextResponse.json({ ok: true, offline_pin_ready: saved });
    }

    const pin = validatePinFormat(body.pin);
    if (current && !verifyPinHash(String(body.current_pin ?? '').trim(), current.pin_hash))
      return NextResponse.json({ ok: false, error: 'El PIN actual no es correcto.' }, { status: 403 });

    const pinHash = hashPin(pin);
    const offlineBundle = createOfflinePinBundle({ pin, tenantId, userId, pinHash });
    const baseRow = {
      tenant_id: tenantId,
      auth_user_id: userId,
      pin_hash: pinHash,
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    };

    let offlineSaved = true;
    const first = await service
      .from('pos_staff_pins')
      .upsert({ ...baseRow, offline_bundle: offlineBundle }, { onConflict: 'tenant_id,auth_user_id' });
    if (first.error) {
      offlineSaved = false;
      const fallback = await service.from('pos_staff_pins').upsert(baseRow, { onConflict: 'tenant_id,auth_user_id' });
      if (fallback.error) return NextResponse.json({ ok: false, error: 'No se pudo guardar el PIN.' }, { status: 500 });
    }

    await service.from('pos_audit_events').insert({
      tenant_id: tenantId,
      actor_id: userId,
      event_type: current ? 'pin_supervisor_cambiado' : 'pin_supervisor_creado',
      entity_type: 'pos_staff_pins',
      entity_id: userId,
      description: current ? 'PIN personal del POS actualizado' : 'PIN personal del POS configurado',
    });
    return NextResponse.json({ ok: true, offline_pin_ready: offlineSaved });
  } catch (err) {
    const e = err as PosError;
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 500 });
  }
}
