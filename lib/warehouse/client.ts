// Llamadas del navegador a /api/t/[slug]/warehouse/*.
export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: string;
  fields?: { field: string; message: string; value?: string }[];
}

export async function whPost<T = Record<string, unknown>>(
  slug: string,
  path: string,
  body: unknown,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/t/${slug}/warehouse/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? 'Error inesperado.', fields: json.fields };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor.' };
  }
}

export async function whGet<T>(slug: string, path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/t/${slug}/warehouse/${path}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? 'Error inesperado.' };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor.' };
  }
}
