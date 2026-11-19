import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { CRM_MODULES_CATALOG } from '@/lib/modules-config';
import { authorizeTenantApi } from '@/lib/tenant-api-auth';

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

    // 1. Resolver tenant por slug con su branding
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, commercial_name, slug, country, currency, tenant_branding(*)')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!tenant) {
      // Fallback demo/mock si no existe tenant en BD
      return NextResponse.json({
        ok: true,
        tenant_id: null,
        tenant_name: 'VORA POS',
        country: 'VE',
        currency: 'USD',
        branding: null,
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

    // Warehouse activo: el menú "Inventario" del POS abre el módulo en lugar de la vista demo.
    const whFeature = (tfRows || []).find((f) => f.feature_key === 'warehouse.inventory');
    const isWarehouseEnabled = Boolean(whFeature?.enabled);
    const whConfig = (whFeature?.config as Record<string, any>) || {};
    const stockPolicy = whConfig.pos_stock_policy || 'warn_and_allow';

    const tenantFuncs = posFeature?.config?.functions || {};
    const finalFunctions = { ...defaultFuncs, ...tenantFuncs };

    const rawBranding = Array.isArray(tenant.tenant_branding)
      ? tenant.tenant_branding[0]
      : tenant.tenant_branding;

    return NextResponse.json({
      ok: true,
      tenant_id: tenant.id,
      tenant_name: tenant.commercial_name,
      country: tenant.country || 'VE',
      currency: tenant.currency || 'USD',
      branding: rawBranding || null,
      is_module_enabled: isModuleEnabled,
      is_warehouse_enabled: isWarehouseEnabled,
      stock_policy: stockPolicy,
      functions: finalFunctions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Error al resolver módulos POS' },
      { status: 500 },
    );
  }
}
