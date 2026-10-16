import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';
import { ALLOWED_FONTS } from '@/lib/fonts';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * POST /api/admin/tenants/[id]/branding
 * Upserts the tenant's branding row (one-to-one).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const admin = await isSuperAdmin(user.id);
  if (!admin) {
    return NextResponse.json(
      { error: 'Permisos insuficientes. Se requiere rol super_admin.' },
      { status: 403 },
    );
  }

  const row: Record<string, unknown> = { tenant_id: params.id };

  const colorFields = [
    'primary_color',
    'secondary_color',
    'accent_color',
    'login_background_color',
  ];
  for (const f of colorFields) {
    if (typeof body?.[f] === 'string') {
      if (!HEX_RE.test(body[f].trim())) {
        return NextResponse.json(
          { error: `El color ${f} debe ser un hex valido (ej. #042071).` },
          { status: 400 },
        );
      }
      row[f] = body[f].trim();
    }
  }

  if (typeof body?.font_family === 'string') {
    if (!ALLOWED_FONTS.includes(body.font_family)) {
      return NextResponse.json(
        { error: `Fuente no permitida. Valores validos: ${ALLOWED_FONTS.join(', ')}.` },
        { status: 400 },
      );
    }
    row.font_family = body.font_family;
  }

  if (typeof body?.logo_url === 'string') row.logo_url = body.logo_url || null;
  if (typeof body?.favicon_url === 'string') row.favicon_url = body.favicon_url || null;
  if (typeof body?.banner_url === 'string') row.banner_url = body.banner_url || null;

  const service = getSupabaseServiceClient();

  /* Verify tenant exists */
  const { data: tenant } = await service
    .from('tenants')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  }

  /* Upsert — tenant_id is unique */
  const { data: branding, error } = await service
    .from('tenant_branding')
    .upsert(row, { onConflict: 'tenant_id' })
    .select('id, tenant_id, primary_color, secondary_color, accent_color, font_family, login_background_color, logo_url, favicon_url, banner_url')
    .maybeSingle();

  if (error) {
    console.error('[branding] upsert error', error.message);
    return NextResponse.json(
      { error: 'No se pudo guardar el branding.', detail: error.message },
      { status: 500 },
    );
  }

  await service.from('platform_audit_logs').insert({
    actor_id: user.id,
    tenant_id: params.id,
    action: 'tenant.branding.save',
    resource: 'tenant_branding',
    resource_id: params.id,
    details: row,
  });

  return NextResponse.json({ branding });
}
