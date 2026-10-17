import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import { venezuelaDate } from '@/lib/core-config';
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('rate'),
    ves_per_usd: z.number().finite().positive().max(100000000),
    source: z.string().trim().min(3).max(200),
  }),
  z.object({
    action: z.literal('recipient'),
    bank_code: z.string().regex(/^\d{4}$/),
    phone: z.string().regex(/^04\d{9}$/),
    tax_id: z.string().trim().min(4).max(40),
  }),
  z.object({
    action: z.literal('invoice'),
    tenant_id: z.string().uuid(),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal('review'),
    payment_id: z.string().uuid(),
    approve: z.boolean(),
    note: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal('plan'),
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100),
    monthly_price_usd: z.number().finite().positive().max(1000000),
    infrastructure_mode: z.enum(['shared', 'dedicated']),
    limits: z.record(z.number().int().nonnegative().max(100000000)).default({}),
  }),
]);
export async function GET() {
  if (!(await requireSuperAdmin()))
    return NextResponse.json(
      { error: 'Permisos insuficientes.' },
      { status: 403 },
    );
  const db = getSupabaseServiceClient();
  const results = await Promise.all([
    db
      .from('platform_exchange_rates')
      .select('*')
      .order('effective_date', { ascending: false })
      .limit(30),
    db
      .from('platform_billing_settings')
      .select('bank_code,phone,tax_id')
      .eq('id', true)
      .maybeSingle(),
    db
      .from('platform_invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('platform_payment_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('tenants').select('id,commercial_name').order('commercial_name'),
    db
      .from('plans')
      .select('id,name,monthly_price_usd,infrastructure_mode,limits')
      .eq('is_active', true),
  ]);
  if (results.some((r) => r.error))
    return NextResponse.json(
      {
        error: 'No se pudo cargar facturación. Verifica la migración de Core.',
      },
      { status: 500 },
    );
  return NextResponse.json({
    rates: results[0].data,
    recipient: results[1].data,
    invoices: results[2].data,
    payments: results[3].data,
    tenants: results[4].data,
    plans: results[5].data,
    today: venezuelaDate(),
  });
}
export async function POST(req: Request) {
  const user = await requireSuperAdmin();
  if (!user)
    return NextResponse.json(
      { error: 'Permisos insuficientes.' },
      { status: 403 },
    );
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const d = parsed.data,
    session = getSupabaseServerClient(),
    db = getSupabaseServiceClient();
  let error;
  let result: unknown;
  if (d.action === 'invoice') {
    const r = await session.rpc('vora_issue_invoice', {
      p_tenant: d.tenant_id,
      p_period: d.period_start,
    });
    error = r.error;
    result = r.data;
  } else if (d.action === 'review') {
    const r = await session.rpc('vora_review_payment', {
      p_payment: d.payment_id,
      p_approve: d.approve,
      p_note: d.note,
    });
    error = r.error;
  } else if (d.action === 'rate') {
    const r = await db
      .from('platform_exchange_rates')
      .insert({
        effective_date: venezuelaDate(),
        ves_per_usd: d.ves_per_usd,
        source: d.source,
        created_by: user.id,
      });
    error = r.error;
  } else if (d.action === 'recipient') {
    const r = await db
      .from('platform_billing_settings')
      .upsert({
        id: true,
        bank_code: d.bank_code,
        phone: d.phone,
        tax_id: d.tax_id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
    error = r.error;
  } else {
    if (d.id) {
      const { data: assigned } = await db
        .from('tenant_subscriptions')
        .select('id')
        .eq('plan_id', d.id)
        .limit(1);
      const { data: current } = await db
        .from('plans')
        .select('infrastructure_mode')
        .eq('id', d.id)
        .maybeSingle();
      if (
        assigned?.length &&
        current?.infrastructure_mode !== d.infrastructure_mode
      )
        return NextResponse.json(
          { error: 'No puedes cambiar la modalidad de un plan asignado.' },
          { status: 409 },
        );
    }
    if (d.id && d.limits.max_users !== undefined) {
      const { data: companies } = await db
        .from('tenants')
        .select('id')
        .eq('plan_id', d.id);
      for (const company of companies ?? []) {
        const { count, error: countError } = await db
          .from('tenant_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', company.id)
          .eq('status', 'active');
        if (countError || (count ?? 0) > d.limits.max_users)
          return NextResponse.json(
            {
              error:
                'El límite no admite los usuarios activos de alguna empresa.',
            },
            { status: 409 },
          );
      }
    }
    const row = {
      name: d.name,
      monthly_price_usd: d.monthly_price_usd,
      infrastructure_mode: d.infrastructure_mode,
      limits: d.limits,
    };
    const r = d.id
      ? await db.from('plans').update(row).eq('id', d.id).select('id').single()
      : await db.from('plans').insert(row).select('id').single();
    error = r.error;
    result = r.data;
  }
  if (error)
    return NextResponse.json(
      {
        error:
          d.action === 'invoice'
            ? 'No se pudo emitir: revisa plan con precio, suscripción, datos Pago Móvil, tasa de hoy y que el período no esté cobrado.'
            : d.action === 'rate'
              ? 'La tasa del día ya existe o no se pudo guardar. Las tasas registradas no se sobrescriben.'
              : d.action === 'review'
                ? 'No se pudo revisar. El pago debe estar pendiente y el importe debe coincidir con el cargo.'
                : 'No se pudo guardar.',
      },
      { status: 409 },
    );
  if (!['invoice', 'review'].includes(d.action)) {
    const { error: auditError } = await db
      .from('platform_audit_logs')
      .insert({
        actor_id: user.id,
        action: `billing.${d.action}`,
        resource: 'platform_billing',
        details: d,
      });
    if (auditError)
      return NextResponse.json(
        { error: 'Guardado, pero falló el registro de auditoría.' },
        { status: 500 },
      );
  }
  return NextResponse.json({ ok: true, result });
}
