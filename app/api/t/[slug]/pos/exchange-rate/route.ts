import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl =
      searchParams.get('url') ||
      posStore.settings.exchange_rate_api_url ||
      'https://ve.dolarapi.com/v1/dolares/oficial';

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VoraPOS/1.0',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Error al consultar API de tasa: HTTP ${res.status} ${res.statusText}`,
          url: targetUrl,
        },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Normalizador de respuestas de APIs cambiarias (DolarApi, BCV, endpoints REST estándar)
    let rate: number | null = null;
    let source = 'API Externa';

    if (typeof data === 'number') {
      rate = data;
    } else if (data && typeof data === 'object') {
      if (typeof data.promedio === 'number') {
        rate = data.promedio;
        source = data.fuente ? `BCV (${data.fuente})` : 'DolarApi Oficial';
      } else if (typeof data.price === 'number') {
        rate = data.price;
        source = data.name || data.source || 'API Tasa';
      } else if (typeof data.rate === 'number') {
        rate = data.rate;
        source = data.source || 'API Tasa';
      } else if (typeof data.tasa === 'number') {
        rate = data.tasa;
        source = 'API Tasa';
      } else if (typeof data.oficial === 'number') {
        rate = data.oficial;
        source = 'BCV Oficial';
      } else if (typeof data.valor === 'number') {
        rate = data.valor;
        source = 'API Tasa';
      } else if (data.bcv && typeof data.bcv.promedio === 'number') {
        rate = data.bcv.promedio;
        source = 'BCV Oficial';
      }
    }

    if (rate === null || isNaN(rate) || rate <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No se pudo extraer una tasa válida (número positivo) del JSON devuelto por la API.',
          url: targetUrl,
          raw: data,
        },
        { status: 422 },
      );
    }

    const roundedRate = Number(rate.toFixed(4));

    return NextResponse.json({
      ok: true,
      rate: roundedRate,
      source,
      url: targetUrl,
      timestamp: data.fechaActualizacion || new Date().toISOString(),
      raw: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Error de conexión con la API de tasa',
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    const { rate, source, url, auto_fetch } = body;

    if (rate !== undefined) {
      const numRate = Number(rate);
      if (isNaN(numRate) || numRate <= 0) {
        return NextResponse.json({ ok: false, error: 'Tasa numérica inválida' }, { status: 400 });
      }
      posStore.settings.active_exchange_rate = numRate;
    }

    if (url !== undefined) {
      posStore.settings.exchange_rate_api_url = String(url).trim();
    }

    if (auto_fetch !== undefined) {
      posStore.settings.auto_fetch_exchange_rate = Boolean(auto_fetch);
    }

    if (source !== undefined) {
      posStore.settings.exchange_rate_source = String(source);
    }

    posStore.settings.last_exchange_rate_fetch = new Date().toISOString();
    posStore.settings.updated_at = new Date().toISOString();

    posStore.addAudit({
      branch_id: posStore.settings.branch_id,
      shift_id: null,
      actor_id: body.actor_id || null,
      event_type: 'actualizacion_tasa_bcv_api',
      entity_type: 'pos_settings',
      entity_id: posStore.settings.id,
      description: `Tasa cambiaria oficial actualizada a ${posStore.settings.active_exchange_rate} VES/USD mediante API (${posStore.settings.exchange_rate_source || 'dolarapi'}) [live]`,
      metadata: {
        rate: posStore.settings.active_exchange_rate,
        url: posStore.settings.exchange_rate_api_url,
        source: posStore.settings.exchange_rate_source,
      },
    });

    return NextResponse.json({
      ok: true,
      rate: posStore.settings.active_exchange_rate,
      settings: posStore.settings,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
