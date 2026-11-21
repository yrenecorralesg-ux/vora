import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';
import { getSale } from '@/lib/pos/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string; saleId: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const sale = await getSale(getSupabaseServiceClient(), auth.access.tenantId, params.saleId);
  if (!sale) return NextResponse.json({ ok: false, error: 'Documento o venta no encontrado.' }, { status: 404 });
  return NextResponse.json({
    ok: true,
    document: sale.document,
    sale,
    printable_notice: 'COMPROBANTE INTERNO — NO VÁLIDO COMO FACTURA FISCAL',
  });
}
