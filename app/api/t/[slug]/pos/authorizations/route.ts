import { NextResponse, type NextRequest } from 'next/server';
import { MOCK_USERS } from '@/lib/pos-demo-data';
import { posStore } from '@/lib/pos-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { supervisorId, pin, operationType, reason, limitSnapshot, branchId, shiftId, saleId } = await request.json();

    const supervisor = MOCK_USERS.find((u) => u.id === supervisorId);
    if (!supervisor || (supervisor.role !== 'pos_supervisor' && supervisor.role !== 'pos_store_admin')) {
      return NextResponse.json({ ok: false, error: 'Usuario no autorizado como Supervisor' }, { status: 403 });
    }

    if (supervisor.pin !== pin) {
      return NextResponse.json({ ok: false, error: 'Credencial o PIN de supervisor inválido' }, { status: 401 });
    }

    const authId = `auth-${Date.now()}`;
    const authorization = {
      id: authId,
      tenant_id: 't0000000-0000-0000-0000-000000000001',
      branch_id: branchId || 'b0000000-0000-0000-0000-000000000001',
      shift_id: shiftId || null,
      sale_id: saleId || null,
      operation_type: operationType,
      requested_by: supervisorId,
      approved_by: supervisorId,
      approver_name_snapshot: supervisor.name,
      reason,
      limit_snapshot: limitSnapshot || {},
      created_at: new Date().toISOString(),
    };

    posStore.addAudit({
      branch_id: branchId,
      shift_id: shiftId,
      actor_id: supervisorId,
      event_type: 'autorizacion_supervisor',
      entity_type: 'pos_authorizations',
      entity_id: authId,
      description: `Autorización de ${operationType} por ${supervisor.name}: ${reason} [mock]`,
      metadata: { limitSnapshot },
      correlation_id: null,
    });

    return NextResponse.json({ ok: true, authorization });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
