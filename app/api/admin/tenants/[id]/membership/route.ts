import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendVoraMail } from '@/lib/resend-mail';
import { VORA_DOMAIN } from '@/lib/core-config';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 }); }
  const parsed = z.object({ email: z.string().trim().email().max(254), role: z.literal('tenant_admin').optional() }).safeParse(body);
  if (!parsed.success || !z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: 'Correo o empresa inválidos.' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const service = getSupabaseServiceClient();
  const { data: tenant } = await service.from('tenants').select('id,commercial_name').eq('id', params.id).maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  const { data: previous } = await service.from('tenant_invitations').select('email_sent_at').eq('tenant_id', params.id).eq('email', email).maybeSingle();
  if (previous?.email_sent_at && Date.parse(previous.email_sent_at) > Date.now()-60000) return NextResponse.json({ error: 'Espera un minuto para reenviar.' }, { status: 429 });
  let exists = false;
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return NextResponse.json({ error: 'No se pudo consultar la cuenta.' }, { status: 502 });
    exists = data.users.some(u => u.email?.toLowerCase() === email);
    if (exists || data.users.length < 1000) break;
  }
  const type = exists ? 'magiclink' : 'invite';
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type, email });
  const hash = link?.properties?.hashed_token;
  if (linkError || !hash) return NextResponse.json({ error: 'No se pudo generar el acceso. Inténtalo nuevamente.' }, { status: 502 });
  const { data: invitation, error } = await getSupabaseServerClient().rpc('vora_prepare_admin_invitation', { p_tenant: params.id, p_email: email, p_hash: hash });
  if (error || !invitation) return NextResponse.json({ error: 'No se pudo preparar la invitación. Revisa el límite de usuarios del plan o espera un minuto para reenviar.' }, { status: 409 });
  // Fragment keeps the secret out of navigation requests and referrers.
  // verifyOtp runs only after the recipient presses Continue, avoiding mail scanners.
  const fragment = new URLSearchParams({ token_hash: hash, type: type === 'magiclink' ? 'email' : 'invite', invitation: invitation.id });
  const url = `https://${VORA_DOMAIN}/auth/activate#${fragment}`;
  const notification = await sendVoraMail(email, 'VORA · Acceso como administrador de empresa', [
    `Te invitaron a administrar ${tenant.commercial_name} en VORA.`,
    'Abre este enlace, confirma tu acceso y establece tu contraseña:', url,
    'El enlace es de un solo uso y tiene una vigencia máxima de una hora. Un reenvío reemplaza el enlace anterior.',
    'Si ya tienes contraseña en VORA, establecer otra la cambia para tu misma cuenta en todas tus empresas.',
    'Este acceso corresponde a la empresa indicada; no otorga permisos de Super Admin.',
    'Si no esperabas esta invitación, puedes ignorarla.',
  ].join('\n\n'), `tenant-invite/${invitation.id}/${hash.slice(0,16)}`);
  await service.from('tenant_invitations').update({ email_status: notification, email_sent_at: notification === 'accepted' ? new Date().toISOString() : null }).eq('id', invitation.id).eq('token_hash', hash);
  await service.from('platform_audit_logs').insert({ actor_id: actor.id, tenant_id: params.id, action: 'tenant.invitation.email', resource: 'tenant_invitations', resource_id: invitation.id, details: { notification } });
  return NextResponse.json({ pending: true, invitation, notification, message: notification === 'accepted' ? 'Invitación enviada. El cliente debe confirmar su acceso y establecer contraseña.' : 'Invitación guardada, pero no se pudo enviar el correo. Puedes reenviarla desde este mismo formulario.' });
}
