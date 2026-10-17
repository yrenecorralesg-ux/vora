import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession, isSuperAdmin } from '@/lib/auth';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import { venezuelaDate } from '@/lib/core-config';
async function context(slug: string) {
  const session = getSupabaseServerClient(),
    user = await requireSession(session);
  if (!user) return null;
  const { data: tenant } = await session
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) return null;
  if (!(await isSuperAdmin(user.id, session))) {
    const { data: member } = await session
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!member || !['tenant_admin', 'admin'].includes(member.role))
      return null;
  }
  return { tenant, user, session };
}
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const ctx = await context(params.slug);
  if (!ctx)
    return NextResponse.json(
      { error: 'Permisos insuficientes.' },
      { status: 403 },
    );
  const [invoices, payments] = await Promise.all([
    ctx.session
      .from('platform_invoices')
      .select('*')
      .eq('tenant_id', ctx.tenant.id)
      .order('created_at', { ascending: false })
      .limit(100),
    ctx.session
      .from('platform_payment_reports')
      .select('*')
      .eq('tenant_id', ctx.tenant.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (invoices.error || payments.error)
    return NextResponse.json(
      { error: 'No se pudo cargar la suscripción.' },
      { status: 500 },
    );
  return NextResponse.json({
    invoices: invoices.data,
    payments: payments.data,
    today: venezuelaDate(),
  });
}
const schema = z.object({
  invoice_id: z.string().uuid(),
  reference: z.string().trim().min(4).max(100),
  bank_code: z.string().regex(/^\d{4}$/),
  phone: z.string().regex(/^04\d{9}$/),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_ves: z.number().finite().positive().max(1000000000000),
});
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const ctx = await context(params.slug);
  if (!ctx)
    return NextResponse.json(
      { error: 'Permisos insuficientes.' },
      { status: 403 },
    );
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          'Referencia, banco, teléfono, fecha y monto válidos son obligatorios.',
      },
      { status: 400 },
    );
  const d = parsed.data;
  if (d.paid_on > venezuelaDate() || Number.isNaN(Date.parse(d.paid_on)))
    return NextResponse.json(
      { error: 'Fecha de pago inválida.' },
      { status: 400 },
    );
  const { data: invoice } = await ctx.session
    .from('platform_invoices')
    .select('id,amount_ves,status,period_start')
    .eq('id', d.invoice_id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle();
  if (!invoice || invoice.status !== 'pending')
    return NextResponse.json(
      { error: 'No hay un cargo pendiente autorizado.' },
      { status: 409 },
    );
  if (
    Math.round(d.amount_ves * 100) !==
    Math.round(Number(invoice.amount_ves) * 100)
  )
    return NextResponse.json(
      { error: 'El monto debe coincidir con el cargo en bolívares.' },
      { status: 400 },
    );
  const db = getSupabaseServiceClient();
  const { error } = await db
    .from('platform_payment_reports')
    .insert({ ...d, tenant_id: ctx.tenant.id, reported_by: ctx.user.id });
  if (error)
    return NextResponse.json(
      {
        error:
          'No se pudo reportar: puede existir una referencia o un reporte pendiente para este cargo.',
      },
      { status: 409 },
    );
  await db
    .from('platform_audit_logs')
    .insert({
      actor_id: ctx.user.id,
      tenant_id: ctx.tenant.id,
      action: 'billing.payment.report',
      resource: 'platform_invoices',
      resource_id: invoice.id,
      details: { reference: d.reference },
    });
  return NextResponse.json({
    ok: true,
    message: 'Pago reportado, pendiente de validación por Venesoft.',
  });
}
