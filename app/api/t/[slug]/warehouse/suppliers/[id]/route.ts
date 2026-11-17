import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';

/**
 * GET /api/t/[slug]/warehouse/suppliers/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string; id: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from('warehouse_supplier_profiles')
    .select(`
      *,
      terms:warehouse_supplier_terms (*)
    `)
    .eq('tenant_id', auth.access.tenantId)
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Proveedor no encontrado.' }, { status: 404 });

  return NextResponse.json({ supplier: data });
}

/**
 * PATCH /api/t/[slug]/warehouse/suppliers/[id]
 */
export async function PATCH(
  req: Request,
  { params }: { params: { slug: string; id: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const service = getSupabaseServiceClient();

  const profileUpdates: Record<string, any> = {};
  if (body.name !== undefined) profileUpdates.name = body.name.trim();
  if (body.code !== undefined) profileUpdates.code = body.code ? body.code.trim() : null;
  if (body.tax_id !== undefined) profileUpdates.tax_id = body.tax_id ? body.tax_id.trim() : null;
  if (body.contact_name !== undefined) profileUpdates.contact_name = body.contact_name ? body.contact_name.trim() : null;
  if (body.email !== undefined) profileUpdates.email = body.email ? body.email.trim() : null;
  if (body.phone !== undefined) profileUpdates.phone = body.phone ? body.phone.trim() : null;
  if (body.address !== undefined) profileUpdates.address = body.address ? body.address.trim() : null;
  if (body.city !== undefined) profileUpdates.city = body.city ? body.city.trim() : null;
  if (body.category !== undefined) profileUpdates.category = body.category;
  if (body.status !== undefined) profileUpdates.status = body.status;
  if (body.notes !== undefined) profileUpdates.notes = body.notes ? body.notes.trim() : null;
  profileUpdates.updated_at = new Date().toISOString();

  let updatedProfile = null;
  if (Object.keys(profileUpdates).length > 1) {
    const { data, error } = await service
      .from('warehouse_supplier_profiles')
      .update(profileUpdates)
      .eq('tenant_id', auth.access.tenantId)
      .eq('id', params.id)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updatedProfile = data;
  }

  // Actualizar términos comerciales si se proporcionaron
  const termUpdates: Record<string, any> = {};
  if (body.payment_terms_days !== undefined) termUpdates.payment_terms_days = parseInt(body.payment_terms_days, 10);
  if (body.currency !== undefined) termUpdates.currency = body.currency;
  if (body.credit_limit !== undefined) termUpdates.credit_limit = parseFloat(body.credit_limit);
  if (body.discount_percentage !== undefined) termUpdates.discount_percentage = parseFloat(body.discount_percentage);
  if (body.lead_time_days !== undefined) termUpdates.lead_time_days = parseInt(body.lead_time_days, 10);
  if (body.preferred_payment_method !== undefined) termUpdates.preferred_payment_method = body.preferred_payment_method;
  if (body.bank_details !== undefined) termUpdates.bank_details = body.bank_details;

  if (Object.keys(termUpdates).length > 0) {
    termUpdates.updated_at = new Date().toISOString();
    await service
      .from('warehouse_supplier_terms')
      .upsert({
        tenant_id: auth.access.tenantId,
        supplier_id: params.id,
        ...termUpdates,
      }, { onConflict: 'tenant_id,supplier_id' });
  }

  return NextResponse.json({ ok: true, supplier: updatedProfile });
}

/**
 * DELETE /api/t/[slug]/warehouse/suppliers/[id]
 * Desactiva el proveedor (soft delete)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string; id: string } },
) {
  const auth = await authorizeTenantApi(params.slug);
  if (!auth.ok) return auth.response;

  const service = getSupabaseServiceClient();
  const { error } = await service
    .from('warehouse_supplier_profiles')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('tenant_id', auth.access.tenantId)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
