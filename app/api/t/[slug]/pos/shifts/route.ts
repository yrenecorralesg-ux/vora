import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { searchParams } = new URL(request.url);
  const registerId = searchParams.get('register_id');
  const branchId = searchParams.get('branch_id');

  let list = posStore.shifts;
  if (branchId) {
    list = list.filter((s) => s.branch_id === branchId);
  }
  if (registerId) {
    list = list.filter((s) => s.register_id === registerId);
  }

  const activeShift = registerId ? posStore.getOpenShift(registerId) : undefined;

  return NextResponse.json({
    ok: true,
    active_shift: activeShift ?? null,
    shifts: list,
    movements: posStore.cashMovements,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'open') {
      const res = posStore.openShift({
        branchId: body.branch_id,
        registerId: body.register_id,
        cashierUserId: body.cashier_user_id,
        cashierName: body.cashier_name,
        openingUsd: Number(body.opening_usd ?? 0),
        openingVes: Number(body.opening_ves ?? 0),
        notes: body.notes,
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, shift: res.shift });
    }

    if (action === 'movement') {
      const res = posStore.addCashMovement({
        branchId: body.branch_id,
        shiftId: body.shift_id,
        movementType: body.movement_type,
        currency: body.currency,
        amount: Number(body.amount),
        reason: body.reason,
        performedBy: body.performed_by,
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, movement: res.movement });
    }

    if (action === 'close') {
      const res = posStore.closeShift({
        shiftId: body.shift_id,
        declared: body.declared ?? {},
        justification: body.justification,
        closedBy: body.closed_by,
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, shift: res.shift });
    }

    return NextResponse.json({ ok: false, error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

