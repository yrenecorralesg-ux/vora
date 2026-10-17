import { NextResponse } from 'next/server';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';

/**
 * POST /api/admin/tenants/[id]/membership
 * Creates a tenant membership for the given admin email.
 *
 * Behavior:
 * - Looks up an auth user by email. If found, creates a tenant_memberships
 *   row with status 'active'.
 * - If NOT found, creates a tenant_invitations row with status 'pending'
 *   (the user hasn't been provisioned yet). The wizard shows "pendiente".
 * - Records an audit log in both cases.
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

  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role =
    typeof body?.role === 'string' && body.role.trim()
      ? body.role.trim()
      : 'tenant_admin';

  if (role !== 'tenant_admin')
    return NextResponse.json(
      { error: 'Este flujo asigna únicamente administradores de empresa.' },
      { status: 400 },
    );
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      {
        error: 'Se requiere un email valido para el administrador del tenant.',
      },
      { status: 400 },
    );
  }

  const service = getSupabaseServiceClient();

  /* Verify tenant exists */
  const { data: tenant } = await service
    .from('tenants')
    .select('id, commercial_name')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json(
      { error: 'Empresa no encontrada.' },
      { status: 404 },
    );
  }

  /* Look up the auth user by email via the service client (admin API) */
  let authUser: { id: string; email?: string } | undefined;
  for (let page = 1; ; page++) {
    const { data: users, error } = await service.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error)
      return NextResponse.json(
        { error: 'No se pudo consultar la cuenta del administrador.' },
        { status: 500 },
      );
    authUser = users.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (authUser || users.users.length < 1000) break;
  }

  /* ---------- Case 1: user exists → create membership ---------- */
  if (authUser) {
    /* Check for an existing membership to avoid unique violation */
    const { data: existing } = await service
      .from('tenant_memberships')
      .select('id, status')
      .eq('tenant_id', params.id)
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    let membership;
    if (existing) {
      const { data: updated, error } = await service
        .from('tenant_memberships')
        .update({ role, status: 'active' })
        .eq('id', existing.id)
        .select('id, tenant_id, auth_user_id, role, status')
        .maybeSingle();
      if (error) {
        return NextResponse.json(
          {
            error: 'No se pudo actualizar la membresia.',
            detail: error.message,
          },
          { status: 500 },
        );
      }
      membership = updated;
    } else {
      const { data: created, error } = await service
        .from('tenant_memberships')
        .insert({
          tenant_id: params.id,
          auth_user_id: authUser.id,
          role,
          status: 'active',
        })
        .select('id, tenant_id, auth_user_id, role, status')
        .maybeSingle();
      if (error) {
        console.error('[membership] insert error', error.message);
        return NextResponse.json(
          { error: 'No se pudo crear la membresia.', detail: error.message },
          { status: 500 },
        );
      }
      membership = created;
    }

    await service.from('platform_audit_logs').insert({
      actor_id: user.id,
      tenant_id: params.id,
      action: 'tenant.membership.create',
      resource: 'tenant_memberships',
      resource_id: membership?.id ?? null,
      details: { email, role, status: 'active', auth_user_id: authUser.id },
    });

    return NextResponse.json({
      membership,
      status: 'active',
      pending: false,
      message: 'Membresia creada correctamente. El usuario ya tiene cuenta.',
    });
  }

  /* ---------- Case 2: user does NOT exist → create invitation ---------- */
  /* Simple token: random uuid (opaque). Store a hash. */
  const token = crypto.randomUUID();
  const encoder = new TextEncoder();
  const tokenHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(token),
  );

  const { data: existingInv } = await service
    .from('tenant_invitations')
    .select('id, status')
    .eq('tenant_id', params.id)
    .eq('email', email)
    .maybeSingle();

  let invitation;
  if (existingInv) {
    const { data: updated } = await service
      .from('tenant_invitations')
      .update({
        role,
        status: 'pending',
        token_hash: Array.from(new Uint8Array(tokenHash))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
        invited_by: user.id,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        accepted_at: null,
        accepted_by: null,
      })
      .eq('id', existingInv.id)
      .select('id, tenant_id, email, role, status')
      .maybeSingle();
    invitation = updated;
  } else {
    const { data: created, error: invErr } = await service
      .from('tenant_invitations')
      .insert({
        tenant_id: params.id,
        email,
        role,
        status: 'pending',
        token_hash: Array.from(new Uint8Array(tokenHash))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
        invited_by: user.id,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .select('id, tenant_id, email, role, status')
      .maybeSingle();
    if (invErr) {
      console.error('[membership] invitation insert error', invErr.message);
      return NextResponse.json(
        { error: 'No se pudo crear la invitacion.', detail: invErr.message },
        { status: 500 },
      );
    }
    invitation = created;
  }

  await service.from('platform_audit_logs').insert({
    actor_id: user.id,
    tenant_id: params.id,
    action: 'tenant.invitation.create',
    resource: 'tenant_invitations',
    resource_id: invitation?.id ?? null,
    details: { email, role, status: 'pending' },
  });

  return NextResponse.json({
    invitation,
    status: 'pending',
    pending: true,
    message:
      'Se registró una invitación pendiente. El envío y aceptación por correo aún no están habilitados; puedes asignar el administrador cuando su cuenta exista.',
  });
}
