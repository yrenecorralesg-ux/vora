import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().trim().email('Correo electrónico inválido').max(254),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  role: z.enum([
    'tenant_admin',
    'pos_store_admin',
    'pos_supervisor',
    'pos_cashier',
    'pos_sales_rep',
    'pos_auditor',
    'wh_manager',
    'wh_supervisor',
    'wh_clerk',
    'wh_scanner',
    'wh_auditor',
    'member',
  ]),
});

/** Busca una cuenta de Supabase Auth por correo recorriendo todas las páginas. */
async function findAuthUserByEmail(
  service: ReturnType<typeof getSupabaseServiceClient>,
  emailLower: string,
) {
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`No se pudo consultar usuarios: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === emailLower);
    if (match) return match;
    if (users.length < perPage) return null;
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'Permisos insuficientes. Requiere Super Admin.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Datos de usuario inválidos.';
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const { email, password, name, role } = parsed.data;
  const emailLower = email.toLowerCase();
  const service = getSupabaseServiceClient();

  // 1. Verificar existencia del tenant
  const { data: tenant, error: tenantErr } = await service
    .from('tenants')
    .select('id, commercial_name, slug')
    .eq('id', params.id)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  }

  // 2. Crear o resolver usuario en Supabase Auth
  let authUserId: string;
  let reusedExistingAccount = false;

  let existing: Awaited<ReturnType<typeof findAuthUserByEmail>>;
  try {
    existing = await findAuthUserByEmail(service, emailLower);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  if (existing) {
    // La cuenta ya existe (puede pertenecer a otra empresa o a Venesoft): solo
    // se vincula. Nunca se cambia su contraseña ni sus datos desde aquí.
    authUserId = existing.id;
    reusedExistingAccount = true;
  } else {
    const { data: createdAuth, error: createAuthErr } = await service.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, commercial_name: tenant.commercial_name },
    });

    if (createAuthErr || !createdAuth?.user) {
      return NextResponse.json(
        { error: `Error al crear usuario en autenticación: ${createAuthErr?.message || 'Error desconocido'}` },
        { status: 500 },
      );
    }
    authUserId = createdAuth.user.id;
  }

  // 3. Vincular membresía en tenant_memberships
  const { data: membership, error: memberErr } = await service
    .from('tenant_memberships')
    .upsert(
      {
        tenant_id: tenant.id,
        auth_user_id: authUserId,
        role,
        status: 'active',
      },
      { onConflict: 'tenant_id,auth_user_id' },
    )
    .select('id, tenant_id, auth_user_id, role, status, created_at')
    .single();

  if (memberErr) {
    return NextResponse.json(
      { error: `Error al registrar membresía del usuario: ${memberErr.message}` },
      { status: 500 },
    );
  }

  // 4. Registro de auditoría
  await service.from('platform_audit_logs').insert({
    actor_id: actor.id,
    tenant_id: tenant.id,
    action: 'tenant.user.create',
    resource: 'tenant_memberships',
    resource_id: membership.id,
    details: {
      email: emailLower,
      name,
      role,
      auth_user_id: authUserId,
      tenant_slug: tenant.slug,
      reused_existing_account: reusedExistingAccount,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: membership.id,
      auth_user_id: authUserId,
      email: emailLower,
      name,
      role,
      status: 'active',
      created_at: membership.created_at,
    },
    reused_existing_account: reusedExistingAccount,
    message: reusedExistingAccount
      ? `La cuenta ${emailLower} ya existía: se asignó con rol ${role} y conserva su contraseña actual.`
      : `Usuario ${name} (${emailLower}) asignado con rol ${role} exitosamente.`,
  });
}
