export interface TenantSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  slug: string;
  exp: number;
}

const DEFAULT_SECRET = 'vora-tenant-session-secret-salt-2026';

export function getTenantSessionSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CRON_SECRET ||
    DEFAULT_SECRET
  );
}

export function getTenantCookieName(slug: string): string {
  const safeSlug = (slug || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `vora_session_${safeSlug}`;
}

function decodeBase64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verificación compatible con Edge Runtime y Node usando Web Crypto API
 * para validar la cookie aislada `vora_session_<slug>` en el middleware.
 */
export async function verifyTenantSessionTokenEdge(
  token: string,
  expectedSlug?: string,
): Promise<TenantSessionPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;

  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;

    const encoder = new TextEncoder();
    const key = await subtle.importKey(
      'raw',
      encoder.encode(getTenantSessionSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = decodeBase64UrlToBytes(signature);
    const sigBuffer = sigBytes.buffer.slice(
      sigBytes.byteOffset,
      sigBytes.byteOffset + sigBytes.byteLength,
    ) as ArrayBuffer;
    const msgBytes = encoder.encode(payloadB64);
    const msgBuffer = msgBytes.buffer.slice(
      msgBytes.byteOffset,
      msgBytes.byteOffset + msgBytes.byteLength,
    ) as ArrayBuffer;
    const isValid = await subtle.verify('HMAC', key, sigBuffer, msgBuffer);
    if (!isValid) return null;

    const jsonStr = new TextDecoder().decode(decodeBase64UrlToBytes(payloadB64));
    const payload = JSON.parse(jsonStr) as TenantSessionPayload;

    if (!payload.userId || !payload.tenantId || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    if (expectedSlug && String(payload.slug || '').toLowerCase() !== expectedSlug.toLowerCase()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
