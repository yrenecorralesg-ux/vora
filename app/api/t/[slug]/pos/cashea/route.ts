import { NextResponse, type NextRequest } from 'next/server';
import { casheaProvider } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const status = await casheaProvider.validateConnection();
    return NextResponse.json({
      ok: status.connected,
      ...status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err.message || 'Error al validar terminal Cashea' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    const action = body.action || 'create_intent';

    if (action === 'validate') {
      const status = await casheaProvider.validateConnection();
      return NextResponse.json({ ok: status.connected, ...status });
    }

    if (action === 'create_intent') {
      const { amountUsd, customerDocument, saleId } = body;
      const res = await casheaProvider.createPaymentIntent({
        amountUsd: Number(amountUsd),
        customerDocument: String(customerDocument || ''),
        saleId: String(saleId || ''),
      });

      return NextResponse.json({
        ok: res.success,
        intent: res.intent,
        message: res.message,
      });
    }

    return NextResponse.json({ ok: false, error: 'Acción Cashea no reconocida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

