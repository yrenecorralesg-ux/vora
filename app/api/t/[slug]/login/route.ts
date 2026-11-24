import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { setTenantSessionCookie } from '@/lib/tenant-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Correo electrónico y contraseña requeridos.' },
        { status: 400 },
      );
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

    // 2. Autenticar credenciales usando Supabase Auth en cliente temporal (sin modificar cookies globales)
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr || !authData.user) {
      return NextResponse.json(
        {
          ok: false,
          error:
            authErr?.message === 'Invalid login credentials'
              ? 'Correo o contraseña incorrectos. Verifique sus credenciales.'
              : authErr?.message || 'Error al iniciar sesión.',
        },
        { status: 401 },
      );
    }

    const authUser = authData.user;

    // 3. Verificar membresía activa exclusiva de esta empresa (los tokens de superadmin no tienen validez aquí)
    const { data: membership, error: memErr } = await service
      .from('tenant_memberships')
      .select('id, role, status')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (memErr || !membership) {
      return NextResponse.json(
        {
          ok: false,
          error: `Acceso restringido: Esta cuenta no está asignada a ${tenant.commercial_name}.`,
        },
        { status: 403 },
      );
    }

    if (membership.status !== 'active') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Su cuenta en esta empresa se encuentra inactiva o suspendida.',
        },
        { status: 403 },
      );
    }

    // 4. Determinar destino según el rol
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

    const userName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'Operador';

    const response = NextResponse.json({
      ok: true,
      user: {
        id: authUser.id,
        email: authUser.email,
        name: userName,
        role,
      },
      tenant_name: tenant.commercial_name,
      redirect_url: redirectUrl,
    });

    // 5. Guardar sesión aislada exclusiva de esta empresa (sin afectar la sesión del Gestor)
    setTenantSessionCookie(response, params.slug, {
      userId: authUser.id,
      email: authUser.email || email,
      name: userName,
      role,
      tenantId: tenant.id,
      slug: params.slug,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Error al procesar el inicio de sesión.' },
      { status: 500 },
    );
  }
}
