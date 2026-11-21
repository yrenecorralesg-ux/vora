import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import { getTenantSettings, toClientSettings } from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_RATE_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

/** Solo https hacia un host público (evita que el servidor consulte la red interna). */
function safeRateUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^[0-9.]+$/.test(host) ||
      host.includes(':')
    )
      return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Extrae la tasa de las respuestas habituales (DolarApi, BCV y APIs REST simples). */
function extractRate(data: any): { rate: number | null; source: string } {
  if (typeof data === 'number') return { rate: data, source: 'API Externa' };
  if (!data || typeof data !== 'object') return { rate: null, source: 'API Externa' };
  if (typeof data.promedio === 'number') return { rate: data.promedio, source: data.fuente ? `BCV (${data.fuente})` : 'DolarApi Oficial' };
  if (typeof data.price === 'number') return { rate: data.price, source: data.name || data.source || 'API Tasa' };
  if (typeof data.rate === 'number') return { rate: data.rate, source: data.source || 'API Tasa' };
  if (typeof data.tasa === 'number') return { rate: data.tasa, source: 'API Tasa' };
  if (typeof data.oficial === 'number') return { rate: data.oficial, source: 'BCV Oficial' };
  if (typeof data.valor === 'number') return { rate: data.valor, source: 'API Tasa' };
  if (data.bcv && typeof data.bcv.promedio === 'number') return { rate: data.bcv.promedio, source: 'BCV Oficial' };
  return { rate: null, source: 'API Externa' };
}

/** Tasa vigente guardada para la empresa. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const settings = await getTenantSettings(getSupabaseServiceClient(), auth.access.tenantId);
  return NextResponse.json({
    ok: true,
    rate: settings.active_exchange_rate,
    source: settings.exchange_rate_source,
    url: settings.exchange_rate_api_url ?? DEFAULT_RATE_URL,
    timestamp: settings.exchange_rate_updated_at,
    settings: toClientSettings(settings),
  });
}

/**
 * action 'refresh': el servidor consulta la API configurada y guarda la tasa
 *   (cualquier usuario del POS puede pedirlo: el valor viene de la API).
 * action 'set': tasa manual o cambio de URL / auto-sincronización
 *   (requiere pos.settings.manage).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const service = getSupabaseServiceClient();
  const { tenantId, userId } = auth.access;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }
  const settings = await getTenantSettings(service, tenantId);
  const canManage = await hasTenantPermission(auth.access, 'pos.settings.manage');
  const patch: Record<string, unknown> = { updated_by: userId, updated_at: new Date().toISOString() };

  if (body.url !== undefined && body.url !== null && body.url !== '') {
    if (!canManage) return permissionDenied('Solo un administrador del POS puede cambiar la API de tasa.');
    const safe = safeRateUrl(String(body.url).trim());
    if (!safe) return NextResponse.json({ ok: false, error: 'La URL de la API debe ser https y pública.' }, { status: 400 });
    patch.exchange_rate_api_url = safe;
  }
  if (body.auto_fetch !== undefined) {
    if (!canManage) return permissionDenied('Solo un administrador del POS puede cambiar la sincronización.');
    patch.auto_fetch_exchange_rate = Boolean(body.auto_fetch);
  }

  if (body.action === 'set') {
    if (!canManage) return permissionDenied('Solo un administrador del POS puede fijar la tasa manualmente.');
    if (body.rate !== undefined) {
      const rate = Number(body.rate);
      if (!Number.isFinite(rate) || rate <= 0)
        return NextResponse.json({ ok: false, error: 'Tasa numérica inválida.' }, { status: 400 });
      patch.active_exchange_rate = rate;
      patch.exchange_rate_source = 'Manual';
      patch.exchange_rate_updated_at = new Date().toISOString();
    }
  } else {
    const url = (patch.exchange_rate_api_url as string) ?? settings.exchange_rate_api_url ?? DEFAULT_RATE_URL;
    let data: unknown;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'VoraPOS/1.0' }, cache: 'no-store' });
      if (!res.ok)
        return NextResponse.json({ ok: false, error: `La API de tasa respondió HTTP ${res.status}.` }, { status: 502 });
      data = await res.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'No se pudo conectar con la API de tasa.' }, { status: 502 });
    }
    const { rate, source } = extractRate(data);
    if (rate === null || !Number.isFinite(rate) || rate <= 0)
      return NextResponse.json({ ok: false, error: 'La API no devolvió una tasa válida.' }, { status: 422 });
    patch.active_exchange_rate = Number(rate.toFixed(4));
    patch.exchange_rate_source = source;
    patch.exchange_rate_updated_at = new Date().toISOString();
  }

  const { error } = await service.from('pos_tenant_settings').update(patch).eq('tenant_id', tenantId);
  if (error) return NextResponse.json({ ok: false, error: 'No se pudo guardar la tasa.' }, { status: 500 });
  // Solo se audita cuando la tasa realmente cambia (el POS la refresca al abrirse).
  if (patch.active_exchange_rate !== undefined && Number(patch.active_exchange_rate) !== settings.active_exchange_rate)
    await service.from('pos_audit_events').insert({
      tenant_id: tenantId,
      actor_id: userId,
      event_type: 'actualizacion_tasa',
      entity_type: 'pos_tenant_settings',
      entity_id: tenantId,
      description: `Tasa actualizada a ${patch.active_exchange_rate} VES/USD (${patch.exchange_rate_source})`,
    });
  const updated = await getTenantSettings(service, tenantId);
  return NextResponse.json({
    ok: true,
    rate: updated.active_exchange_rate,
    source: updated.exchange_rate_source,
    timestamp: updated.exchange_rate_updated_at,
    settings: toClientSettings(updated),
  });
}
