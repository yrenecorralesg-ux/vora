import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      // 1. Intento híbrido RPC
      try {
        const supabase = getSupabaseServiceClient();
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', params.slug)
          .maybeSingle();

        if (tenant) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('vora_pos_open_shift', {
            p_payload: {
              tenant_id: tenant.id,
              branch_id: body.branch_id,
              register_id: body.register_id,
              cashier_user_id: body.cashier_user_id,
              cashier_name: body.cashier_name,
              opening_usd: Number(body.opening_usd ?? 0),
              opening_ves: Number(body.opening_ves ?? 0),
              notes: body.notes,
            },
          });
          if (!rpcError && rpcData?.ok) {
            const memRes = posStore.openShift({
              branchId: body.branch_id,
              registerId: body.register_id,
              cashierUserId: body.cashier_user_id,
              cashierName: body.cashier_name,
              openingUsd: Number(body.opening_usd ?? 0),
              openingVes: Number(body.opening_ves ?? 0),
              notes: body.notes,
            });
            return NextResponse.json({ ok: true, shift: memRes.shift ?? rpcData, source: 'supabase_rpc' });
          }
        }
      } catch {
        // Fallback local
      }

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

      return NextResponse.json({ ok: true, shift: res.shift, source: 'local_in_memory' });
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
      // 1. Intento híbrido RPC
      try {
        const supabase = getSupabaseServiceClient();
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', params.slug)
          .maybeSingle();

        if (tenant) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('vora_pos_close_shift', {
            p_payload: {
              tenant_id: tenant.id,
              shift_id: body.shift_id,
              declared_totals: body.declared ?? {},
              closing_justification: body.justification,
              closed_by: body.closed_by,
            },
          });
          if (!rpcError && rpcData?.ok) {
            const memRes = posStore.closeShift({
              shiftId: body.shift_id,
              declared: body.declared ?? {},
              justification: body.justification,
              closedBy: body.closed_by,
            });
            return NextResponse.json({ ok: true, shift: memRes.shift ?? rpcData, source: 'supabase_rpc' });
          }
        }
      } catch {
        // Fallback local
      }

      const res = posStore.closeShift({
        shiftId: body.shift_id,
        declared: body.declared ?? {},
        justification: body.justification,
        closedBy: body.closed_by,
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, shift: res.shift, source: 'local_in_memory' });
    }

    return NextResponse.json({ ok: false, error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

