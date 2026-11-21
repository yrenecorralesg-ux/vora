import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const supabaseSession = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseSession.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Sesión no iniciada.' }, { status: 401 });
    }

    const service = getSupabaseServiceClient();

    // 1. Obtener ID del tenant por slug
    const { data: tenant, error: tenantErr } = await service
      .from('tenants')
      .select('id, commercial_name, slug')
      .eq('slug', params.slug)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 });
    }

    // 2. Verificar rol Super Admin de Venesoft
    const isPlatformAdmin = await isSuperAdmin(user.id, supabaseSession);
    if (isPlatformAdmin) {
      return NextResponse.json({
        ok: true,
        role: 'super_admin',
        tenant_name: tenant.commercial_name,
        redirect_url: `/t/${params.slug}`,
      });
    }

    // 3. Verificar membresía activa en la empresa
    const { data: membership, error: memErr } = await service
      .from('tenant_memberships')
      .select('id, role, status')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (memErr || !membership) {
      return NextResponse.json(
        {
          ok: false,
          error: `Acceso restringido: Esta cuenta no está asignada como colaboradora de ${tenant.commercial_name}.`,
        },
        { status: 403 },
      );
    }

    if (membership.status !== 'active') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Su membresía en esta empresa se encuentra inactiva o suspendida.',
        },
        { status: 403 },
      );
    }

    // 4. Redirección inteligente según el rol
    const role = membership.role;
    let redirectUrl = `/t/${params.slug}`;

    if (
      role === 'pos_cashier' ||
      role === 'pos_supervisor' ||
      role === 'pos_sales_rep' ||
      role === 'pos_store_admin'
    ) {
      redirectUrl = `/t/${params.slug}/pos`;
    } else if (role.startsWith('wh_')) {
      redirectUrl = `/t/${params.slug}/warehouse`;
    } else {
      redirectUrl = `/t/${params.slug}`;
    }

    return NextResponse.json({
      ok: true,
      role,
      tenant_name: tenant.commercial_name,
      redirect_url: redirectUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Error al verificar acceso de usuario.' },
      { status: 500 },
    );
  }
}
