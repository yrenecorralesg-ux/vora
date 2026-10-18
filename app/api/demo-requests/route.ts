import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { notifyDemoRequest } from '@/lib/demo-request-mail';

export const runtime = 'nodejs';

const demoRequestSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  interest: z.string().trim().max(1200).optional().or(z.literal('')),
  consent: z.literal(true),
  website: z.string().max(0).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 });
  }

  const parsed = demoRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revisa los campos obligatorios y tu consentimiento.' }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const service = getSupabaseServiceClient();
  const { data, error } = await service.from('demo_requests').insert({
    full_name: parsed.data.full_name,
    email: parsed.data.email.toLowerCase(),
    company: parsed.data.company || null,
    phone: parsed.data.phone || null,
    interest: parsed.data.interest || null,
    consent: true,
  }).select('id').single();
  if (error || !data) {
    return NextResponse.json({ error: 'No pudimos registrar la solicitud.' }, { status: 500 });
  }
  const notification = await notifyDemoRequest(parsed.data, data.id);
  if (notification !== 'accepted') {
    console.error('demo_request_notification', { id: data.id, status: notification });
  }
  // Persistence succeeds independently of SMTP. Avoid inviting duplicate submissions.
  return NextResponse.json({ ok: true, notification }, { status: 201 });
}
