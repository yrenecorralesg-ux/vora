import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { authorizeTenantModuleApi, hasTenantPermission, permissionDenied } from '@/lib/tenant-api-auth';
import type { PosBranch } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;

  try {
    const supabase = getSupabaseServiceClient();

    // 1. Obtener tenant por slug
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, commercial_name')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 });
    }

    // 2. Consultar sedes reales
    const { data: rows, error } = await supabase
      .from('tenant_branches')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('is_primary', { ascending: false })
      .order('code', { ascending: true });

    if (error) {
      console.warn('[pos/branches] Error consultando tenant_branches:', error.message);
      return NextResponse.json({ ok: false, error: 'No se pudieron cargar las sedes.' }, { status: 500 });
    }

    // 3. Auto-aprovisionar Sede Principal y Caja 01 si está vacía
    if (!rows || rows.length === 0) {
      const { data: autoBranch, error: createErr } = await supabase
        .from('tenant_branches')
        .insert({
          tenant_id: tenant.id,
          code: 'CCS-01',
          name: 'Sede Principal',
          fiscal_address: null,
          phone: null,
          timezone: 'America/Caracas',
          is_primary: true,
          status: 'active',
        })
        .select('*')
        .single();

      if (!createErr && autoBranch) {
        // Auto-crear Caja 01 para esta sede
        await supabase.from('pos_registers').insert({
          tenant_id: tenant.id,
          branch_id: autoBranch.id,
          code: 'CAJA-01',
          name: 'Caja 01 - Principal',
          status: 'active',
        });

        const branchList: PosBranch[] = [autoBranch as PosBranch];
        return NextResponse.json({ ok: true, branches: branchList, auto_provisioned: true });
      }
    }

    const branchList: PosBranch[] = (rows as PosBranch[]) ?? [];
    return NextResponse.json({ ok: true, branches: branchList });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const auth = await authorizeTenantModuleApi(params.slug, 'pos');
  if (!auth.ok) return auth.response;

  if (!(await hasTenantPermission(auth.access, 'pos.settings.manage')))
    return permissionDenied('Tu rol no permite crear sedes.');

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

    if (!code || !name) {
      return NextResponse.json({ ok: false, error: 'Código y nombre de sede son obligatorios.' }, { status: 400 });
    }

    const { data: created, error } = await supabase
      .from('tenant_branches')
      .insert({
        tenant_id: tenant.id,
        code,
        name,
        fiscal_address: body.fiscal_address?.trim() || null,
        phone: body.phone?.trim() || null,
        timezone: body.timezone || 'America/Caracas',
        is_primary: Boolean(body.is_primary),
        status: 'active',
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, branch: created });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Error en servidor' }, { status: 500 });
  }
}
