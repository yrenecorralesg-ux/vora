import { NextResponse, type NextRequest } from 'next/server';
import { getTenantSessionFromRequest } from '@/lib/tenant-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const session = getTenantSessionFromRequest(request, params.slug);
  if (!session) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      tenantId: session.tenantId,
      slug: session.slug,
    },
  });
}
