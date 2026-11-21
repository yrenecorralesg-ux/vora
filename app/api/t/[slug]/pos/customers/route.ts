import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';
import { mapCustomer } from '@/lib/pos/server';
import type { PosCustomer } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  try {
    const supabase = getSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 });
    }

    let query = supabase
      .from('pos_customers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('customer_tier', { ascending: false })
      .order('total_purchases_count', { ascending: false });

    if (q) {
      // Sin comas, paréntesis ni comodines: no deben alterar el filtro de PostgREST.
      const safeQ = q.replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);
      const cleanQ = safeQ.replace(/[\s\.-]/g, '');
      query = query.or(`legal_name.ilike.%${safeQ}%,document_number.ilike.%${cleanQ}%,phone.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
    }

    const { data: rows, error } = await query.limit(50);

    if (error) {
      console.warn('[pos/customers] Error consultando pos_customers:', error.message);
      return NextResponse.json({ ok: false, error: 'No se pudieron cargar los clientes.' }, { status: 500 });
    }

    // Auto-aprovisionar "Consumidor Final" si no existe ninguno
    if (!rows || rows.length === 0) {
      if (!q) {
        const { data: autoCust, error: autoErr } = await supabase
          .from('pos_customers')
          .insert({
            tenant_id: tenant.id,
            document_type: 'V',
            document_number: '00000000',
            legal_name: 'Consumidor Final',
            fiscal_address: 'Venta en mostrador sin registro fiscal',
            customer_tier: 'consumidor_final',
            total_purchases_count: 0,
            total_purchases_usd: 0,
          })
          .select('*')
          .single();

        if (!autoErr && autoCust) {
          const list: PosCustomer[] = [autoCust as PosCustomer];
          return NextResponse.json({ ok: true, customers: list, auto_provisioned: true });
        }
      }
    }

    const custList: PosCustomer[] = (rows ?? []).map(mapCustomer);
    return NextResponse.json({ ok: true, customers: custList });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const supabase = getSupabaseServiceClient();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });
    }

    const docType = body.document_type || 'V';
    const docNumber = (body.document_number || '').trim().replace(/[\s\.-]/g, '');
    const legalName = (body.legal_name || '').trim();

    if (!docNumber || !legalName) {
      return NextResponse.json({ ok: false, error: 'Cédula/RIF y Razón Social son obligatorios.' }, { status: 400 });
    }

    const { data: created, error } = await supabase
      .from('pos_customers')
      .upsert(
        {
          tenant_id: tenant.id,
          document_type: docType,
          document_number: docNumber,
          legal_name: legalName,
          phone: body.phone?.trim() || null,
          email: body.email?.trim() || null,
          fiscal_address: body.fiscal_address?.trim() || null,
          customer_tier: body.customer_tier || 'nuevo',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,document_type,document_number' },
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, customer: created });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
