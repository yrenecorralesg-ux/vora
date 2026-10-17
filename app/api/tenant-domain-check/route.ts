import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { VORA_DOMAIN, validTenantSlug } from '@/lib/core-config';
export async function GET(req: Request) {
  const hostname = new URL(req.url).hostname.toLowerCase();
  const suffix = `.${VORA_DOMAIN}`;
  const slug = hostname.endsWith(suffix)
    ? hostname.slice(0, -suffix.length)
    : '';
  if (!validTenantSlug(slug))
    return NextResponse.json(
      { error: 'Dominio desconocido.' },
      { status: 404 },
    );
  const { data } = await getSupabaseServiceClient()
    .from('tenant_domains')
    .select('hostname,verification_token')
    .eq('hostname', hostname)
    .eq('is_primary', true)
    .maybeSingle();
  return data
    ? NextResponse.json(
        { hostname: data.hostname, token: data.verification_token },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    : NextResponse.json({ error: 'Dominio desconocido.' }, { status: 404 });
}
