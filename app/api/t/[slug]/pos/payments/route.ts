import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = ['registrado', 'pendiente_verificacion', 'verificado', 'conciliado', 'rechazado', 'revertido'];

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  const saleId = new URL(request.url).searchParams.get('sale_id');
  let q = getSupabaseServiceClient().from('pos_sale_payments').select('*').eq('tenant_id', auth.access.tenantId);
  if (saleId) q = q.eq('sale_id', saleId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ ok: false, error: 'No se pudieron cargar los pagos.' }, { status: 500 });
  return NextResponse.json({ ok: true, payments: data ?? [] });
}

/** Cambia el estado de verificación de un pago (p. ej. Pago Móvil verificado). */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;
  if (!(await hasTenantPermission(auth.access, 'pos.payments.register')))
    return permissionDenied('Tu rol no permite verificar pagos.');

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 });
  }
  const status = String(body.newStatus ?? body.status ?? '');
  if (!STATUSES.includes(status)) return NextResponse.json({ ok: false, error: 'Estado de pago inválido.' }, { status: 400 });
  const verified = status === 'verificado' || status === 'conciliado';
  const { data, error } = await getSupabaseServiceClient()
    .from('pos_sale_payments')
    .update({
      provider_status: status,
      verified_by: verified ? auth.access.userId : null,
      verified_at: verified ? new Date().toISOString() : null,
    })
    .eq('tenant_id', auth.access.tenantId)
    .eq('id', String(body.paymentId ?? body.payment_id ?? ''))
    .select('*')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ ok: false, error: 'Pago no encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, payment: data });
}
