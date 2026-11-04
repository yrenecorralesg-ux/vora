import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { CRM_MODULES_CATALOG } from '@/lib/modules-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Resolver tenant por slug
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, commercial_name, slug')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      // Fallback demo/mock si no existe tenant en BD
      return NextResponse.json({
        ok: true,
        tenant_id: null,
        is_module_enabled: true,
        functions: {
          pos_sales: true,
          pos_shifts: true,
          pos_payments: true,
          pos_cashea: true,
          pos_fiscal: true,
          pos_fiscal_reports: true,
          pos_c2p_debit: true,
          pos_multiticket: true,
          pos_scanner: true,
          pos_thermal_print: true,
          pos_blind_reconciliation: true,
          pos_exchange_rate_api: true,
          pos_returns: true,
          pos_authorizations: true,
          pos_documents: true,
          pos_kardex: true,
          pos_settings: true,
          pos_reports: true,
        },
      });
    }

    // 2. Consultar tenant_features
    const { data: tfRows } = await supabase
      .from('tenant_features')
      .select('feature_key, enabled, config')
      .eq('tenant_id', tenant.id);

    const posFeature = (tfRows || []).find((f) => f.feature_key === 'commerce.pos');
    const isModuleEnabled = posFeature ? Boolean(posFeature.enabled) : true;

    // Catálogo base de funciones POS
    const catalogPos = CRM_MODULES_CATALOG['commerce.pos'];
    const defaultFuncs: Record<string, boolean> = {};
    for (const fn of catalogPos?.functions || []) {
      defaultFuncs[fn.key] = fn.defaultEnabled;
    }

    const tenantFuncs = posFeature?.config?.functions || {};
    const finalFunctions = { ...defaultFuncs, ...tenantFuncs };

    return NextResponse.json({
      ok: true,
      tenant_id: tenant.id,
      tenant_name: tenant.commercial_name,
      is_module_enabled: isModuleEnabled,
      functions: finalFunctions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Error al resolver módulos POS' },
      { status: 500 },
    );
  }
}
