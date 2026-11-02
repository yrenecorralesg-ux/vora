import { NextResponse, type NextRequest } from 'next/server';
import { posStore } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; saleId: string } },
) {
  const sale = posStore.sales.find((s) => s.id === params.saleId || s.sale_number === params.saleId);

  if (!sale) {
    return NextResponse.json({ ok: false, error: 'Documento o venta no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    document: sale.document,
    sale,
    printable_notice: 'COMPROBANTE INTERNO — NO VÁLIDO COMO FACTURA FISCAL',
  });
}

