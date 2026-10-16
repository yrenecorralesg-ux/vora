import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { auditTenantAction, invalidTenantIdResponse, requireSuperAdminApi } from '@/lib/admin-guard';
import {
  ADMIN_STATUS_LABEL,
  STATUS_ACTIONS,
  statusChangeSchema,
  subscriptionStatusFor,
  zodFieldErrors,
  type TenantStatusAction,
} from '@/lib/tenant-management';
import type { CommercialStatus } from '@/lib/types';

/**
 * POST|PATCH /api/admin/tenants/[id]/status
 * Changes the administrative status of a company (super_admin only):
 *   activate (pending → active), suspend (pending/active → suspended), reactivate (suspended → active).
 * The technical/provisioning status is not changed here: it only becomes 'ready' when the
 * infrastructure is verified (see /test-connection), so activating never makes a company operational by itself.
 * Body: { action: 'activate' | 'suspend' | 'reactivate', reason? } (legacy: { commercial_status: 'active' | 'suspended' }).
 */
async function changeStatus(req: Request, { params }: { params: { id: string } }) {
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
  const parsed = statusChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Acción de estado inválida.', fields: zodFieldErrors(parsed.error) }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id, commercial_status, technical_status')
    .eq('id', params.id)
    .maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });

  const from = tenant.commercial_status as CommercialStatus;
  let action: TenantStatusAction | undefined = parsed.data.action;
  if (!action) action = parsed.data.commercial_status === 'suspended' ? 'suspend' : from === 'suspended' ? 'reactivate' : 'activate';

  const rule = STATUS_ACTIONS[action];
  if (!rule.from.includes(from)) {
    return NextResponse.json(
      { error: `No se puede ${rule.label.toLowerCase()} una empresa en estado ${ADMIN_STATUS_LABEL[from] ?? from}.` },
      { status: 409 },
    );
  }

  const { data: updated, error } = await service
    .from('tenants')
    .update({ commercial_status: rule.to })
    .eq('id', params.id)
    .eq('commercial_status', from)
    .select('id, commercial_name, slug, commercial_status, technical_status')
    .maybeSingle();

  if (error) {
    console.error('[status] update error', error.message);
    return NextResponse.json({ error: 'No se pudo actualizar el estado.' }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'El estado de la empresa cambió mientras tanto. Recarga e inténtalo de nuevo.' }, { status: 409 });
  }

  const { error: subError } = await service
    .from('tenant_subscriptions')
    .update({ status: subscriptionStatusFor(rule.to) })
    .eq('tenant_id', params.id);
  if (subError) console.error('[status] subscription sync error', subError.message);

  await auditTenantAction({
    actorId: user.id,
    tenantId: params.id,
    action: `tenant.status.${action}`,
    details: { from, to: rule.to, reason: parsed.data.reason ?? null, technical_status: tenant.technical_status },
  });

  return NextResponse.json({ tenant: updated });
}

export const POST = changeStatus;
export const PATCH = changeStatus;
