import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Enlace inválido.' }, { status: 400 }); }
  const parsed = z.object({ token_hash: z.string().min(32).max(256), type: z.enum(['email','invite']), invitation: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enlace inválido.' }, { status: 400 });
  const { data: invitation } = await getSupabaseServiceClient().from('tenant_invitations').select('id,email,token_hash,status,expires_at').eq('id', parsed.data.invitation).maybeSingle();
  if (!invitation || invitation.status !== 'pending' || invitation.token_hash !== parsed.data.token_hash || Date.parse(invitation.expires_at) <= Date.now()) return NextResponse.json({ error: 'Enlace vencido, reemplazado o ya utilizado. Solicita un reenvío a Venesoft.' }, { status: 400 });
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: parsed.data.token_hash, type: parsed.data.type });
  if (error || !data.user || data.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    if (!error && data.user) await supabase.auth.signOut();
    return NextResponse.json({ error: 'No se pudo confirmar el enlace. Solicita un reenvío.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
