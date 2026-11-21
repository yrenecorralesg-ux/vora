import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import type { PosRegister } from '@/lib/types';

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
    const branchId = searchParams.get('branch_id');

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 });
    }

    let query = supabase
      .from('pos_registers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('code', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.warn('[pos/registers] Error consultando pos_registers:', error.message);
      return NextResponse.json({ ok: false, error: 'No se pudieron cargar las cajas.' }, { status: 500 });
    }

    const regList: PosRegister[] = (rows as PosRegister[]) ?? [];
    return NextResponse.json({ ok: true, registers: regList });
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

  if (!(await hasTenantPermission(auth.access, 'pos.settings.manage')))
    return permissionDenied('Tu rol no permite crear cajas.');

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

    const code = (body.code || '').trim().toUpperCase();
    const name = (body.name || '').trim();
    const branchId = body.branch_id;

    if (!code || !name || !branchId) {
      return NextResponse.json({ ok: false, error: 'Código, nombre y sede asignada son obligatorios.' }, { status: 400 });
    }

    const { data: branch } = await supabase
      .from('tenant_branches')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', branchId)
      .maybeSingle();
    if (!branch) {
      return NextResponse.json({ ok: false, error: 'La sede no pertenece a la empresa.' }, { status: 400 });
    }

    const { data: created, error } = await supabase
      .from('pos_registers')
      .insert({
        tenant_id: tenant.id,
        branch_id: branchId,
        code,
        name,
        status: body.status || 'active',
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, register: created });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
