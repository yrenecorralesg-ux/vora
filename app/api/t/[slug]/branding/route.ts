import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { validTenantSlug } from '@/lib/core-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/t/[slug]/branding
 * Público (la pantalla de login lo usa antes de autenticar): solo expone
 * nombre comercial e identidad visual. Nunca datos legales ni de estado.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  if (!validTenantSlug(params.slug))
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });

  const service = getSupabaseServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id, commercial_name')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!tenant)
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });

  const { data: branding } = await service
    .from('tenant_branding')
    .select(
      'logo_url, primary_color, secondary_color, accent_color, font_family, login_background_color',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  return NextResponse.json({
    branding: { commercial_name: tenant.commercial_name, ...(branding ?? {}) },
  });
}
