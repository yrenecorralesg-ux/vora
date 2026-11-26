import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { VORA_DOMAIN, validTenantSlug } from '@/lib/core-config';
import { getTenantCookieName, verifyTenantSessionTokenEdge } from '@/lib/tenant-session-edge';
export async function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase(),
    suffix = `.${VORA_DOMAIN}`;
  const slug = hostname.endsWith(suffix)
    ? hostname.slice(0, -suffix.length)
    : null;
  let pathname = request.nextUrl.pathname;
  if (slug !== null && !validTenantSlug(slug))
    return new NextResponse('Empresa no encontrada.', { status: 404 });
  if (slug && pathname.startsWith('/admin'))
    return NextResponse.redirect(new URL(pathname, `https://${VORA_DOMAIN}`));
  // Challenge & Service Worker are reachable without tenant rewrite.
  if (pathname === '/api/tenant-domain-check' || pathname === '/sw.js') return NextResponse.next();
  if (
    slug &&
    pathname.startsWith('/api/t/') &&
    !pathname.startsWith(`/api/t/${slug}/`)
  )
    return new NextResponse('Sin acceso.', { status: 403 });
  if (
    slug &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/auth/') &&
    pathname !== '/login' &&
    pathname !== '/access-pending' &&
    pathname !== '/select-tenant'
  ) {
    if (
      pathname.startsWith('/t/') &&
      pathname !== `/t/${slug}` &&
      !pathname.startsWith(`/t/${slug}/`)
    )
      return new NextResponse('Sin acceso.', { status: 403 });
    if (!pathname.startsWith('/t/'))
      pathname = `/t/${slug}${pathname === '/' ? '' : pathname}`;
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-vora-path', pathname);
  requestHeaders.set(
    'x-vora-preview',
    request.nextUrl.searchParams.get('preview') === '1' ? '1' : '0',
  );
  const destination = request.nextUrl.clone();
  destination.pathname = pathname;
  const makeResponse = () =>
    pathname !== request.nextUrl.pathname
      ? NextResponse.rewrite(destination, {
        request: { headers: requestHeaders },
      })
      : NextResponse.next({ request: { headers: requestHeaders } });
  let response = makeResponse();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value });
          const previous = response.cookies.getAll();
          requestHeaders.set('cookie', request.cookies.toString());
          response = makeResponse();
          for (const cookie of previous) response.cookies.set(cookie);
          response.cookies.set({ name, value, ...(options as object) });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: '' });
          const previous = response.cookies.getAll();
          requestHeaders.set('cookie', request.cookies.toString());
          response = makeResponse();
          for (const cookie of previous) response.cookies.set(cookie);
          response.cookies.set({ name, value: '', ...(options as object) });
        },
      },
    },
  );
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/t/') ||
    pathname === '/login'
  ) {
    const tenantMatch = pathname.match(/^\/t\/([^/]+)/);
    const targetSlug = tenantMatch?.[1] ?? slug;

    let hasTenantSession = false;
    if (pathname.startsWith('/t/') && !pathname.endsWith('/login') && targetSlug) {
      const tenantToken = request.cookies.get(getTenantCookieName(targetSlug))?.value;
      if (tenantToken) {
        hasTenantSession = Boolean(await verifyTenantSessionTokenEdge(tenantToken, targetSlug));
      }
    }

    const user = hasTenantSession
      ? null
      : (await supabase.auth.getUser()).data.user;

    if (!user && pathname.startsWith('/admin')) {
      const login = request.nextUrl.clone();
      login.pathname = '/login';
      login.search = '';
      return NextResponse.redirect(login);
    }

    if (!user && !hasTenantSession && pathname.startsWith('/t/') && !pathname.endsWith('/login')) {
      const login = request.nextUrl.clone();
      login.pathname = targetSlug ? `/t/${targetSlug}/login` : '/login';
      login.search = '';
      return NextResponse.redirect(login);
    }

    if (user && pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/select-tenant';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }
  return response;
}
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)',
  ],
};
