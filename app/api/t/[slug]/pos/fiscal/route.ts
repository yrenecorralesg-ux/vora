import { NextResponse, type NextRequest } from 'next/server';
import { posStore, hkaProvider } from '@/lib/pos-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  return NextResponse.json({
    ok: true,
    integration: posStore.fiscalIntegration,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'validate') {
      const res = await hkaProvider.validateConfiguration(posStore.fiscalIntegration);
      return NextResponse.json({ ok: res.valid, message: res.message, data: res.data });
    }

    if (action === 'issue') {
      const sale = posStore.sales.find((s) => s.id === body.sale_id);
      if (!sale) {
        return NextResponse.json({ ok: false, error: 'Venta no encontrada' }, { status: 404 });
      }

      const res = await hkaProvider.issueDocument(sale, body.idempotency_key || `idemp-hka-${sale.id}`);

      // Actualizar registro fiscal en la venta
      sale.fiscal_request = {
        id: `fr-${Date.now()}`,
        tenant_id: sale.tenant_id,
        sale_id: sale.id,
        idempotency_key: body.idempotency_key || `idemp-hka-${sale.id}`,
        request_hash: `hash-${Date.now()}`,
        provider_reference: res.providerReference ?? null,
        fiscal_invoice_number: res.fiscalInvoiceNumber ?? null,
        fiscal_control_number: res.fiscalControlNumber ?? null,
        status: res.status,
        error_code: res.errorCode ?? null,
        response_summary: {
          provider: 'The Factory HKA (SENIAT)',
          status: res.status,
          message: res.message,
          rawResponse: res.rawResponse ?? null,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return NextResponse.json({
        ok: res.success,
        result: res,
        fiscal_request: sale.fiscal_request,
      });
    }

    if (action === 'simulate_timeout') {
      const sale = posStore.sales.find((s) => s.id === body.sale_id);
      const res = await hkaProvider.simulateTimeout();

      if (sale) {
        sale.fiscal_request = {
          id: `fr-${Date.now()}`,
          tenant_id: sale.tenant_id,
          sale_id: sale.id,
          idempotency_key: body.idempotency_key || `idemp-hka-${sale.id}`,
          request_hash: `hash-${Date.now()}`,
          provider_reference: null,
          fiscal_invoice_number: null,
          fiscal_control_number: null,
          status: 'por_revisar',
          error_code: res.errorCode,
          response_summary: {
            provider: 'The Factory HKA (SENIAT)',
            status: 'por_revisar',
            message: res.message,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return NextResponse.json({ ok: false, result: res, fiscal_request: sale?.fiscal_request });
    }

    if (action === 'status') {
      const res = await hkaProvider.getDocumentStatus(
        body.sale_id,
        body.idempotency_key,
        body.numero_documento,
      );
      return NextResponse.json({ ok: true, result: res });
    }

    if (action === 'cancel') {
      const res = await hkaProvider.cancelDocument(body.numero_documento, body.motivo);
      return NextResponse.json({ ok: res.success, result: res });
    }

    return NextResponse.json({ ok: false, error: 'Acción fiscal no reconocida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
