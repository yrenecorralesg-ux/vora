import { headers } from 'next/headers';
import { requireWarehousePage, type WarehouseContext, type WarehouseFunction, type WarehousePermission } from '@/lib/warehouse/access';
import { hasTenantPermission } from '@/lib/tenant-api-auth';
import { isFullCrossModuleRole } from '@/lib/role-modules';
import { WarehouseSidebar } from '@/components/warehouse/wh-sidebar';
import { WhBackBar } from '@/components/warehouse/back-bar';

export const dynamic = 'force-dynamic';

// Requisitos de cada enlace de la barra lateral (las páginas vuelven a validarlos en servidor).
const LINK_RULES: { href: string; permission?: WarehousePermission; fn?: WarehouseFunction }[] = [
  { href: '', fn: 'wh_dashboard' },
  { href: '/catalog', fn: 'wh_catalog' },
  { href: '/stock', fn: 'wh_stock' },
  { href: '/receipts', permission: 'stock.receive', fn: 'wh_receipts' },
  { href: '/issues', permission: 'stock.issue', fn: 'wh_issues' },
  { href: '/adjustments', permission: 'stock.adjust.request', fn: 'wh_adjustments' },
  { href: '/returns', permission: 'stock.return', fn: 'wh_returns' },
  { href: '/transfers', permission: 'stock.transfer', fn: 'wh_transfers' },
  { href: '/kardex', fn: 'wh_kardex' },
  { href: '/scan', permission: 'stock.receive', fn: 'wh_scanner' },
  { href: '/warehouses', fn: 'wh_warehouses' },
  { href: '/imports', permission: 'import.validate', fn: 'wh_imports' },
  { href: '/suppliers', fn: 'wh_suppliers' },
  { href: '/reports', permission: 'report.view', fn: 'wh_reports' },
  { href: '/pos', fn: 'wh_pos_integration' },
  { href: '/settings', permission: 'warehouse.configure', fn: 'wh_settings' },
  { href: '/sector', permission: 'warehouse.configure', fn: 'wh_sector' },
  { href: '/attributes', permission: 'warehouse.configure', fn: 'wh_attributes' },
  { href: '/units', permission: 'warehouse.configure', fn: 'wh_units' },
  { href: '/roles', permission: 'warehouse.configure', fn: 'wh_roles' },
];

async function hiddenLinks(ctx: WarehouseContext): Promise<string[]> {
  const hidden = LINK_RULES.filter((r) => (r.permission && !ctx.can(r.permission)) || (r.fn && !ctx.functions[r.fn])).map((r) => r.href);
  const { data: suppliers } = await ctx.service
    .from('tenant_features')
    .select('enabled, contracted')
    .eq('tenant_id', ctx.tenantId)
    .eq('feature_key', 'warehouse.suppliers')
    .maybeSingle();
  if (suppliers && (!suppliers.enabled || !suppliers.contracted)) {
    if (!hidden.includes('/suppliers')) hidden.push('/suppliers');
  }
  return hidden;
}

/**
 * Estructura de Warehouse, igual que el POS: barra lateral propia + contenido.
 * El layout de la empresa ya validó sesión y membresía y pone el selector de módulos.
 */
export default async function WarehouseLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  if (headers().get('x-vora-path') === `/t/${params.slug}/warehouse/inactive`)
    return <main className="mx-auto max-w-7xl px-4 py-10">{children}</main>;

  // Redirige a /warehouse/inactive con el motivo si el módulo no puede abrirse.
  const ctx = await requireWarehousePage(params.slug);
  const [hidden, { data: branding }, canConfigurePos] = await Promise.all([
    hiddenLinks(ctx),
    ctx.service
      .from('tenant_branding')
      .select('primary_color, secondary_color, accent_color, logo_url, font_family')
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle(),
    hasTenantPermission(ctx, 'pos.settings.manage'),
  ]);

  const primaryColor = branding?.primary_color || '#144D37';
  const secondaryColor = branding?.secondary_color || '#1E6B4E';
  const accentColor = branding?.accent_color || '#A9BEA5';

  return (
    <div
      data-tenant-root
      className="flex min-h-screen flex-col bg-[#F6F5F0] md:flex-row"
      style={{
        '--crm-primary': primaryColor,
        '--crm-secondary': secondaryColor,
        '--crm-accent': accentColor,
        '--crm-ink': `color-mix(in srgb, ${primaryColor} 40%, #111827)`,
        '--crm-heading': `color-mix(in srgb, ${primaryColor} 82%, #111827)`,
      } as React.CSSProperties}
    >
      <WarehouseSidebar
        slug={params.slug}
        tenantName={ctx.tenantName}
        hidden={hidden}
        canConfigurePos={canConfigurePos}
        canAccessPos={isFullCrossModuleRole(ctx.role)}
        branding={{
          primaryColor,
          secondaryColor,
          accentColor,
          logoUrl: branding?.logo_url ?? null,
        }}
      />
      <main className="min-w-0 flex-1 p-4 pb-20 sm:p-5 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <WhBackBar slug={params.slug} />
          {children}
        </div>
      </main>
    </div>
  );
}
