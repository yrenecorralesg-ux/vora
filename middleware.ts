import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
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
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...(options as object) });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: '' });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: '', ...(options as object) });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = !!user;
  const isLoginPage = pathname === '/login';
  const isAdminRoute = pathname.startsWith('/admin');
  const isTenantRoute = pathname.startsWith('/t/');

  if (isAdminRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url));
  }
  if (isTenantRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url));
  }
  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = { matcher: ['/admin/:path*', '/login', '/t/:path*'] };
