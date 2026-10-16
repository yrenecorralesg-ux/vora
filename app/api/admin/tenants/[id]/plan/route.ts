import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { auditTenantAction, invalidTenantIdResponse, requireSuperAdminApi } from '@/lib/admin-guard';
import { planChangeSchema, subscriptionStatusFor, zodFieldErrors } from '@/lib/tenant-management';
import type { CommercialStatus } from '@/lib/types';

/**
 * PUT|POST /api/admin/tenants/[id]/plan
 * Assigns or changes the plan of a company (super_admin only).
 * - The plan must exist and be active.
 * - Updates tenants.plan_id and the company's subscription (created if missing).
 * - Does not charge, bill or activate anything automatically.
 */
async function changePlan(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireSuperAdminApi();
  if (guard.response) return guard.response;
  const { user } = guard;
  const invalid = invalidTenantIdResponse(params.id);
  if (invalid) return invalid;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }
  const parsed = planChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Selecciona un plan válido.', fields: zodFieldErrors(parsed.error) }, { status: 400 });
  }
  const { plan_id } = parsed.data;

  const service = getSupabaseServiceClient();
  const [{ data: tenant }, { data: plan }] = await Promise.all([
    service.from('tenants').select('id, plan_id, commercial_status, plans ( name )').eq('id', params.id).maybeSingle(),
    service.from('plans').select('id, name, is_active').eq('id', plan_id).maybeSingle(),
  ]);
  if (!tenant) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
  if (!plan || plan.is_active === false) {
    return NextResponse.json({ error: 'El plan seleccionado no existe o no está activo.', fields: { plan_id: 'Plan no disponible.' } }, { status: 400 });
  }
  if (tenant.plan_id === plan_id) {
    return NextResponse.json({ error: `La empresa ya tiene el plan ${plan.name}.` }, { status: 409 });
  }

  const { error: tenantError } = await service.from('tenants').update({ plan_id }).eq('id', params.id);
  if (tenantError) {
    console.error('[plan] tenant update error', tenantError.message);
    return NextResponse.json({ error: 'No se pudo asignar el plan.' }, { status: 500 });
  }

  const subscriptionStatus = subscriptionStatusFor(tenant.commercial_status as CommercialStatus);
  const { data: subscription, error: subError } = await service
    .from('tenant_subscriptions')
    .upsert(
      { tenant_id: params.id, plan_id, status: subscriptionStatus, started_at: new Date().toISOString(), ended_at: null },
      { onConflict: 'tenant_id' },
    )
    .select('id, plan_id, status, started_at')
    .maybeSingle();
  if (subError) console.error('[plan] subscription upsert error', subError.message);

  const previousPlan = (tenant.plans as { name?: string } | null)?.name ?? null;
  await auditTenantAction({
    actorId: user.id,
    tenantId: params.id,
    action: 'tenant.plan.change',
    resource: 'tenant_subscriptions',
    details: { from_plan_id: tenant.plan_id, from_plan: previousPlan, to_plan_id: plan_id, to_plan: plan.name },
  });

  return NextResponse.json({ plan: { id: plan.id, name: plan.name }, subscription });
}

export const PUT = changePlan;
export const POST = changePlan;
