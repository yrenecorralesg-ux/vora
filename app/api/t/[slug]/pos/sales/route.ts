import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branch_id');
  const shiftId = searchParams.get('shift_id');
  const cashierId = searchParams.get('cashier_id');
  const commercialStatus = searchParams.get('commercial_status');
  const paymentStatus = searchParams.get('payment_status');
  const query = searchParams.get('query')?.toLowerCase();

  let list = posStore.sales;

  if (branchId) {
    list = list.filter((s) => s.branch_id === branchId);
  }
  if (shiftId) {
    list = list.filter((s) => s.shift_id === shiftId);
  }
  if (cashierId) {
    list = list.filter((s) => s.cashier_user_id === cashierId);
  }
  if (commercialStatus) {
    list = list.filter((s) => s.commercial_status === commercialStatus);
  }
  if (paymentStatus) {
    list = list.filter((s) => s.payment_status === paymentStatus);
  }
  if (query) {
    list = list.filter(
      (s) =>
        s.sale_number.toLowerCase().includes(query) ||
        s.customer?.legal_name.toLowerCase().includes(query) ||
        s.customer?.document_number.toLowerCase().includes(query),
    );
  }

  return NextResponse.json({
    ok: true,
    sales: list,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const payload = await request.json();

    const result = posStore.confirmSale({
      branchId: payload.branch_id,
      shiftId: payload.shift_id,
      registerId: payload.register_id,
      cashierUserId: payload.cashier_user_id,
      customerId: payload.customer_id,
      idempotencyKey: payload.idempotency_key,
      correlationId: payload.correlation_id || `corr-${Date.now()}`,
      lines: payload.lines || [],
      payments: payload.payments || [],
      notes: payload.notes,
      discountAuthorizationId: payload.discount_authorization_id,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      sale: result.sale,
      idempotent_replay: result.idempotentReplay ?? false,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

