import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';

/**
 * GET /api/t/[slug]/warehouse/suppliers
 * Lista proveedores del tenant con sus términos comerciales.
 * Filtros opcionales: ?search=...&category=...&status=...
 */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const category = searchParams.get('category');
  const status = searchParams.get('status');

  const service = getSupabaseServiceClient();
  let query = service
    .from('warehouse_supplier_profiles')
    .select(`
      id,
      code,
      name,
      tax_id,
      contact_name,
      email,
      phone,
      address,
      city,
      country,
      category,
      status,
      notes,
      created_at,
      updated_at,
      terms:warehouse_supplier_terms (
        payment_terms_days,
        currency,
        credit_limit,
        discount_percentage,
        lead_time_days,
        preferred_payment_method,
        bank_details
      )
    `)
    .eq('tenant_id', auth.access.tenantId)
    .order('name', { ascending: true });

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (search) {
    query = query.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%,contact_name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ suppliers: data ?? [] });
}

/**
 * POST /api/t/[slug]/warehouse/suppliers
 * Crea un nuevo proveedor y sus condiciones comerciales.
 * Body: {
 *   name, code?, tax_id?, contact_name?, email?, phone?, address?, city?, category?, notes?,
 *   payment_terms_days?, currency?, credit_limit?, discount_percentage?, lead_time_days?,
 *   preferred_payment_method?, bank_details?
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const {
    name,
    code,
    tax_id,
    contact_name,
    email,
    phone,
    address,
    city,
    category,
    notes,
    payment_terms_days = 0,
    currency = 'USD',
    credit_limit = 0,
    discount_percentage = 0,
    lead_time_days = 0,
    preferred_payment_method = 'transfer',
    bank_details = {},
  } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'El nombre o razón social es obligatorio.' }, { status: 400 });
  }

  const service = getSupabaseServiceClient();

  // 1. Insertar perfil
  const { data: profile, error: profileErr } = await service
    .from('warehouse_supplier_profiles')
    .insert({
      tenant_id: auth.access.tenantId,
      name: name.trim(),
      code: code ? code.trim() : null,
      tax_id: tax_id ? tax_id.trim() : null,
      contact_name: contact_name ? contact_name.trim() : null,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      category: category ?? 'general',
      notes: notes ? notes.trim() : null,
      status: 'active',
    })
    .select()
    .single();

  if (profileErr) {
    if (profileErr.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un proveedor con este nombre o código.' }, { status: 409 });
    }
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // 2. Insertar condiciones comerciales
  const { data: terms, error: termsErr } = await service
    .from('warehouse_supplier_terms')
    .insert({
      tenant_id: auth.access.tenantId,
      supplier_id: profile.id,
      payment_terms_days: Math.max(0, parseInt(String(payment_terms_days), 10) || 0),
      currency: currency || 'USD',
      credit_limit: Math.max(0, parseFloat(String(credit_limit)) || 0),
      discount_percentage: Math.min(100, Math.max(0, parseFloat(String(discount_percentage)) || 0)),
      lead_time_days: Math.max(0, parseInt(String(lead_time_days), 10) || 0),
      preferred_payment_method: preferred_payment_method || 'transfer',
      bank_details: bank_details || {},
    })
    .select()
    .single();

  if (termsErr) {
    return NextResponse.json({
      ok: true,
      supplier: { ...profile, terms: null },
      warning: 'Perfil creado pero hubo un error con los términos comerciales: ' + termsErr.message,
    }, { status: 201 });
  }

  return NextResponse.json({ ok: true, supplier: { ...profile, terms } }, { status: 201 });
}
