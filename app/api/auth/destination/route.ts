import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { isSuperAdmin, getUserMemberships } from '@/lib/auth';

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  if (await isSuperAdmin(user.id, supabase)) return NextResponse.json({ destination: '/admin' });
  const memberships = await getUserMemberships(user.id, supabase);
  if (memberships.length === 1) {
    const tenant = Array.isArray(memberships[0].tenants) ? memberships[0].tenants[0] : memberships[0].tenants;
    return NextResponse.json({ destination: tenant?.slug ? `/t/${tenant.slug}` : '/access-pending' });
  }
  if (memberships.length > 1) return NextResponse.json({ destination: '/select-tenant' });
  return NextResponse.json({ destination: '/access-pending' });
}
