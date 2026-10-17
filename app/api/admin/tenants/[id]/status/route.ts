import { NextResponse } from 'next/server';
import {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from '@/lib/supabase-server';
import { isSuperAdmin } from '@/lib/auth';

const ALLOWED_COMMERCIAL = [
  'trial',
  'active',
  'suspended',
  'cancelled',
] as const;
const ALLOWED_TECHNICAL = ['pending_setup', 'ready', 'error'] as const;

type CommercialStatus = (typeof ALLOWED_COMMERCIAL)[number];
type TechnicalStatus = (typeof ALLOWED_TECHNICAL)[number];

/**
 * PATCH /api/admin/tenants/[id]/status
 * Suspend or activate a tenant (and optionally set technical_status).
 */
export async function PATCH(
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

  if (body?.technical_status === 'ready')
    return NextResponse.json(
      {
        error:
          'Valida primero plan, administrador y base de datos desde Configuración progresiva.',
      },
      { status: 409 },
    );
  const patch: Record<string, unknown> = {};
  const actionLabel: string[] = [];

  if (typeof body?.commercial_status === 'string') {
    if (
      !ALLOWED_COMMERCIAL.includes(body.commercial_status as CommercialStatus)
    ) {
      return NextResponse.json(
        {
          error: `commercial_status invalido. Permitidos: ${ALLOWED_COMMERCIAL.join(', ')}.`,
        },
        { status: 400 },
      );
    }
    patch.commercial_status = body.commercial_status;
    actionLabel.push(`commercial_status=${body.commercial_status}`);
  }

  if (typeof body?.technical_status === 'string') {
    if (!ALLOWED_TECHNICAL.includes(body.technical_status as TechnicalStatus)) {
      return NextResponse.json(
        {
          error: `technical_status invalido. Permitidos: ${ALLOWED_TECHNICAL.join(', ')}.`,
        },
        { status: 400 },
      );
    }
    patch.technical_status = body.technical_status;
    actionLabel.push(`technical_status=${body.technical_status}`);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: 'Envia commercial_status o technical_status para actualizar.' },
      { status: 400 },
    );
  }

  const service = getSupabaseServiceClient();
  const { data: updated, error } = await service
    .from('tenants')
    .update(patch)
    .eq('id', params.id)
    .select('id, commercial_name, slug, commercial_status, technical_status')
    .maybeSingle();

  if (error) {
    console.error('[status] update error', error.message);
    return NextResponse.json(
      { error: 'No se pudo actualizar el estado.', detail: error.message },
      { status: 500 },
    );
  }
  if (!updated) {
    return NextResponse.json(
      { error: 'Empresa no encontrada.' },
      { status: 404 },
    );
  }

  await service.from('platform_audit_logs').insert({
    actor_id: user.id,
    tenant_id: params.id,
    action: 'tenant.status.change',
    resource: 'tenants',
    resource_id: params.id,
    details: { ...patch, labels: actionLabel },
  });

  return NextResponse.json({ tenant: updated });
}
