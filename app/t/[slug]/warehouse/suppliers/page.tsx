import {
  Truck,
  Building2,
  Calendar,
  CreditCard,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
} from 'lucide-react';
import Link from 'next/link';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { CrmHeader } from '@/components/crm-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SupplierDialog } from '@/components/warehouse/supplier-dialog';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  materia_prima: { label: 'Materia Prima', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  empaque:       { label: 'Empaque',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  insumo:        { label: 'Insumos',       color: 'bg-amber-50 text-amber-700 border-amber-200' },
  servicios:     { label: 'Servicios',     color: 'bg-purple-50 text-purple-700 border-purple-200' },
  general:       { label: 'General',       color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: 'Activo',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Inactivo',  color: 'bg-slate-50 text-slate-500 border-slate-200' },
  blocked:  { label: 'Bloqueado', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default async function SuppliersPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'warehouse.suppliers');

  const supabase = getSupabaseServerClient();
  const service = getSupabaseServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, commercial_name')
    .eq('slug', params.slug)
    .maybeSingle();

  const { data: branding } = await supabase
    .from('tenant_branding')
    .select('secondary_color, banner_url')
    .eq('tenant_id', tenant?.id ?? '')
    .maybeSingle();

  let headerBannerUrl: string | null = null;
  if (branding?.banner_url) {
    try {
      headerBannerUrl = JSON.parse(branding.banner_url).header ?? null;
    } catch {
      headerBannerUrl = branding.banner_url;
    }
  }

  const secondaryColor = branding?.secondary_color ?? '#285C49';
  const tenantName = tenant?.commercial_name ?? params.slug;

  // Consultar proveedores con sus términos comerciales
  const { data: suppliers } = await service
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
      category,
      status,
      notes,
      created_at,
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
    .eq('tenant_id', tenant?.id ?? '')
    .order('name', { ascending: true });

  const totalCount = suppliers?.length ?? 0;
  const activeCount = suppliers?.filter((s) => s.status === 'active').length ?? 0;
  const creditSuppliers = suppliers?.filter(
    (s) => (s.terms?.[0]?.payment_terms_days ?? 0) > 0,
  ).length ?? 0;

  const totalDays = suppliers?.reduce((sum, s) => sum + (s.terms?.[0]?.payment_terms_days ?? 0), 0) ?? 0;
  const avgDays = totalCount > 0 ? Math.round(totalDays / totalCount) : 0;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <CrmHeader
        tenantName={tenantName}
        title="Directorio de Proveedores"
        subtitle="Gestión de contactos comerciales, plazos de pago y condiciones de abastecimiento."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
        roleBadgeText="Warehouse"
        action={
          <SupplierDialog
            slug={params.slug}
            secondaryColor={secondaryColor}
          />
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total Proveedores"
          value={totalCount}
          icon={<Building2 className="h-5 w-5 text-slate-700" />}
          color="slate"
        />
        <KpiCard
          label="Proveedores Activos"
          value={activeCount}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          color="emerald"
        />
        <KpiCard
          label="Línea de Crédito"
          value={creditSuppliers}
          subtext="Con plazo diferido"
          icon={<CreditCard className="h-5 w-5 text-blue-600" />}
          color="blue"
        />
        <KpiCard
          label="Plazo Promedio"
          value={`${avgDays} días`}
          icon={<Calendar className="h-5 w-5 text-purple-600" />}
          color="purple"
        />
      </div>

      {/* Tabla de Proveedores */}
      <Card className="rounded-2xl border-slate-100 shadow-xs">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Truck className="h-4.5 w-4.5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-800">
                Proveedores Registrados ({totalCount})
              </span>
            </div>
            <SupplierDialog
              slug={params.slug}
              secondaryColor={secondaryColor}
              triggerButton={
                <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-800 h-8">
                  + Registrar proveedor
                </Button>
              }
            />
          </div>

          {!suppliers || suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Truck className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Sin proveedores registrados</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm">
                Registra a tus proveedores para gestionar órdenes de compra, recepciones y plazos de pago.
              </p>
              <div className="mt-5">
                <SupplierDialog slug={params.slug} secondaryColor={secondaryColor} />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-slate-400">
                    <th className="px-5 py-3 text-left font-semibold">Proveedor</th>
                    <th className="px-5 py-3 text-left font-semibold">Categoría</th>
                    <th className="px-5 py-3 text-left font-semibold">Contacto</th>
                    <th className="px-5 py-3 text-left font-semibold">Condición de Pago</th>
                    <th className="px-5 py-3 text-left font-semibold">Estado</th>
                    <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => {
                    const terms = s.terms?.[0];
                    const catInfo = CATEGORY_LABELS[s.category] ?? CATEGORY_LABELS.general;
                    const statusInfo = STATUS_LABELS[s.status] ?? STATUS_LABELS.active;
                    const paymentDays = terms?.payment_terms_days ?? 0;

                    return (
                      <tr
                        key={s.id}
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Proveedor y RIF */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <Link
                                href={`/t/${params.slug}/warehouse/suppliers/${s.id}`}
                                className="font-bold text-slate-900 hover:underline block text-sm"
                              >
                                {s.name}
                              </Link>
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                                {s.code && <span className="font-mono">{s.code} · </span>}
                                <span>{s.tax_id || 'Sin RIF'}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={`text-[10px] font-semibold ${catInfo.color}`}>
                            {catInfo.label}
                          </Badge>
                        </td>

                        {/* Contacto */}
                        <td className="px-5 py-3">
                          {s.contact_name ? (
                            <span className="text-xs font-medium text-slate-800 block">
                              {s.contact_name}
                            </span>
                          ) : null}
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                            {s.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {s.phone}
                              </span>
                            )}
                            {s.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {s.email}
                              </span>
                            )}
                            {!s.phone && !s.email && <span>—</span>}
                          </div>
                        </td>

                        {/* Condición de Pago */}
                        <td className="px-5 py-3">
                          <div className="text-xs font-semibold text-slate-700">
                            {paymentDays === 0 ? 'Contado' : `Crédito ${paymentDays} días`}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Moneda: {terms?.currency ?? 'USD'}
                            {terms?.credit_limit ? ` · Límite: $${terms.credit_limit}` : ''}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={`text-[10px] font-semibold ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </td>

                        {/* Acciones */}
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <SupplierDialog
                              slug={params.slug}
                              secondaryColor={secondaryColor}
                              supplierToEdit={s}
                              triggerButton={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700"
                                  title="Editar"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700"
                              title="Ver ficha completa"
                            >
                              <Link href={`/t/${params.slug}/warehouse/suppliers/${s.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  color: 'slate' | 'emerald' | 'blue' | 'purple';
}) {
  const bgMap = {
    slate:   'bg-slate-50',
    emerald: 'bg-emerald-50',
    blue:    'bg-blue-50',
    purple:  'bg-purple-50',
  };
  return (
    <Card className={`rounded-2xl border-0 shadow-xs ${bgMap[color]}`}>
      <CardContent className="p-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900">{value}</p>
          {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
        </div>
        <div className="mt-0.5">{icon}</div>
      </CardContent>
    </Card>
  );
}
