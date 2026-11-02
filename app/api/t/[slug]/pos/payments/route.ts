import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { searchParams } = new URL(request.url);
  const saleId = searchParams.get('sale_id');

  const allPayments = posStore.sales.flatMap((s) => s.payments ?? []);
  const filtered = saleId ? allPayments.filter((p) => p.sale_id === saleId) : allPayments;

  return NextResponse.json({
    ok: true,
    payments: filtered,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    const { paymentId, newStatus, verifiedBy } = body;

    let targetPayment = null;
    for (const sale of posStore.sales) {
      const p = sale.payments?.find((item) => item.id === paymentId);
      if (p) {
        p.provider_status = newStatus;
        if (newStatus === 'verificado') {
          p.verified_by = verifiedBy;
          p.verified_at = new Date().toISOString();
        }
        targetPayment = p;
        break;
      }
    }

    if (!targetPayment) {
      return NextResponse.json({ ok: false, error: 'Pago no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, payment: targetPayment });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

