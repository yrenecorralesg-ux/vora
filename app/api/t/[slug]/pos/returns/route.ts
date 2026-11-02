import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  return NextResponse.json({
    ok: true,
    returns: posStore.returns,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const payload = await request.json();

    const result = posStore.processReturn({
      branchId: payload.branch_id,
      shiftId: payload.shift_id,
      originalSaleId: payload.original_sale_id,
      returnType: payload.return_type,
      reason: payload.reason,
      notes: payload.notes,
      refundMethod: payload.refund_method,
      requestedBy: payload.requested_by,
      approvedBy: payload.approved_by,
      lines: payload.lines || [],
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      return_record: result.returnRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

