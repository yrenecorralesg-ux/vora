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

    // 1. Intento híbrido: Ejecutar RPC de PostgreSQL / Supabase si la base de datos está disponible
    try {
      const supabase = getSupabaseServiceClient();
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', params.slug)
        .maybeSingle();

      if (tenant) {
        payload.tenant_id = tenant.id;
        const { data: rpcData, error: rpcError } = await supabase.rpc('vora_pos_confirm_sale', {
          p_payload: payload,
        });

        if (!rpcError && rpcData?.ok) {
          // Sincronizar en memoria para reflejo inmediato en pantalla
          const memRes = posStore.confirmSale({
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

          return NextResponse.json({
            ok: true,
            sale: memRes.sale ?? rpcData,
            source: 'supabase_rpc',
            idempotent_replay: rpcData.idempotent_replay ?? false,
          });
        }
      }
    } catch {
      // Fallback a motor en memoria local
    }

    // 2. Fallback de alta disponibilidad en memoria
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
      source: 'local_in_memory',
      idempotent_replay: result.idempotentReplay ?? false,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

