import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  getTenantCookieName,
  getTenantSessionSecret,
  type TenantSessionPayload,
} from './tenant-session-edge';

export { getTenantCookieName, type TenantSessionPayload };

export function createTenantSessionToken(payload: Omit<TenantSessionPayload, 'exp'>, maxAgeSeconds = 7 * 24 * 60 * 60): string {
  const fullPayload: TenantSessionPayload = {
    ...payload,
    exp: Date.now() + maxAgeSeconds * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = createHmac('sha256', getTenantSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyTenantSessionToken(token: string, expectedSlug?: string): TenantSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expectedSig = createHmac('sha256', getTenantSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  try {
    const isSigValid = timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSig, 'utf8'),
    );
    if (!isSigValid) return null;

    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as TenantSessionPayload;

    if (!payload.userId || !payload.tenantId || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    if (expectedSlug && payload.slug.toLowerCase() !== expectedSlug.toLowerCase()) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function getTenantSession(slug: string): Promise<TenantSessionPayload | null> {
  const cookieStore = cookies();
  const cookieName = getTenantCookieName(slug);
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;
  return verifyTenantSessionToken(token, slug);
}

export function getTenantSessionFromRequest(request: NextRequest, slug: string): TenantSessionPayload | null {
  const cookieName = getTenantCookieName(slug);
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;
  return verifyTenantSessionToken(token, slug);
}

export function setTenantSessionCookie(
  response: NextResponse,
  slug: string,
  payload: Omit<TenantSessionPayload, 'exp'>,
  maxAgeSeconds = 7 * 24 * 60 * 60,
): void {
  const token = createTenantSessionToken(payload, maxAgeSeconds);
  const cookieName = getTenantCookieName(slug);
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function clearTenantSessionCookie(response: NextResponse, slug: string): void {
  const cookieName = getTenantCookieName(slug);
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
