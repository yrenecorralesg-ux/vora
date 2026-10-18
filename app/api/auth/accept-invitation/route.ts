import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 });
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión con el enlace de invitación.' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 }); }
  const parsed = z.object({ invitation: z.string().uuid(), password: z.string().min(12).max(128) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Usa una contraseña de al menos 12 caracteres.' }, { status: 400 });
  // Pending recipients do not have tenant read privileges yet. Authorize by verified
  // Auth identity, never by an email or user id supplied in the request body.
  const { data: invitation } = await getSupabaseServiceClient().from('tenant_invitations').select('id,email,status,expires_at').eq('id', parsed.data.invitation).maybeSingle();
  if (!user.email_confirmed_at || !invitation || invitation.email.toLowerCase() !== user.email?.toLowerCase() || invitation.status !== 'pending' || Date.parse(invitation.expires_at) <= Date.now()) return NextResponse.json({ error: 'Invitación vencida o no pertenece a tu cuenta.' }, { status: 403 });
  const { error: passwordError } = await client.auth.updateUser({ password: parsed.data.password });
  if (passwordError) return NextResponse.json({ error: 'No se pudo guardar la contraseña. Usa otra contraseña segura o solicita un nuevo enlace.' }, { status: 400 });
  const { data: slug, error } = await client.rpc('vora_accept_admin_invitation', { p_invitation: parsed.data.invitation });
  if (error || !slug) return NextResponse.json({ error: 'Contraseña guardada, pero el acceso sigue pendiente. Venesoft debe revisar el cupo de usuarios o la invitación.' }, { status: 409 });
  return NextResponse.json({ destination: `/t/${encodeURIComponent(slug)}` });
}
