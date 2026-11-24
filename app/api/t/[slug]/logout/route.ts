import { NextResponse, type NextRequest } from 'next/server';
import { clearTenantSessionCookie } from '@/lib/tenant-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const response = NextResponse.json({
    ok: true,
    redirect_url: `/t/${params.slug}/login`,
  });

  clearTenantSessionCookie(response, params.slug);
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const response = NextResponse.redirect(new URL(`/t/${params.slug}/login`, request.url));
  clearTenantSessionCookie(response, params.slug);
  return response;
}
