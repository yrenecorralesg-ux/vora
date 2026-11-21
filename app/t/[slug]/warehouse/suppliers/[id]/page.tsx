import {
  Truck,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Banknote,
  Clock,
  ShoppingBasket,
  FileText,
  Edit2,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default async function SupplierDetailPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  await requireTenantFeature(params.slug, 'warehouse.suppliers');

  const supabase = getSupabaseServerClient();
  const service = getSupabaseServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, commercial_name')
    .eq('slug', params.slug)
    .maybeSingle();

  // El branding se pide junto con los proveedores (misma ronda a Supabase).
  const brandingQuery = supabase
    .from('tenant_branding')
    .select('secondary_color')
    .eq('tenant_id', tenant?.id ?? '')
    .maybeSingle();

  const [{ data: supplier }, { data: branding }] = await Promise.all([
    service
      .from('warehouse_supplier_profiles')
      .select(`
        *,
        terms:warehouse_supplier_terms (*)
      `)
      .eq('tenant_id', tenant?.id ?? '')
      .eq('id', params.id)
      .maybeSingle(),
    brandingQuery,
  ]);

  const secondaryColor = branding?.secondary_color ?? '#285C49';


  if (!supplier) {
    notFound();
  }

  const terms = supplier.terms?.[0] ?? supplier.terms;
  const catInfo = CATEGORY_LABELS[supplier.category] ?? CATEGORY_LABELS.general;
  const statusInfo = STATUS_LABELS[supplier.status] ?? STATUS_LABELS.active;
  const bankDetails = terms?.bank_details ?? {};

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header del Proveedor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white border border-slate-100 p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-700">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{supplier.name}</h1>
              <Badge variant="outline" className={`text-[10px] font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] font-semibold ${catInfo.color}`}>
                {catInfo.label}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {supplier.code ? `Código: ${supplier.code} · ` : ''}
              RIF: {supplier.tax_id || 'No registrado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SupplierDialog
            slug={params.slug}
            secondaryColor={secondaryColor}
            supplierToEdit={supplier}
            triggerButton={
              <Button size="sm" variant="outline" className="text-xs rounded-xl gap-1.5 h-9">
                <Edit2 className="h-3.5 w-3.5" />
                Editar Proveedor
              </Button>
            }
          />
        </div>
      </div>

      {/* Grid de 3 columnas: Datos de contacto, Condiciones comerciales, Datos bancarios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contacto y Dirección */}
        <Card className="rounded-2xl border-slate-100 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <Mail className="h-4 w-4 text-slate-400" />
              Contacto y Ubicación
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Persona de Contacto</span>
              <span className="text-slate-800 font-semibold">{supplier.contact_name || 'No especificada'}</span>
            </div>
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Correo Electrónico</span>
              {supplier.email ? (
                <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                  {supplier.email}
                </a>
              ) : (
                <span className="text-slate-400">Sin correo</span>
              )}
            </div>
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Teléfono</span>
              {supplier.phone ? (
                <a href={`tel:${supplier.phone}`} className="text-slate-800 font-medium">
                  {supplier.phone}
                </a>
              ) : (
                <span className="text-slate-400">Sin teléfono</span>
              )}
            </div>
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Dirección</span>
              <span className="text-slate-700">
                {supplier.address ? `${supplier.address}, ${supplier.city || ''}` : 'Sin dirección'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Condiciones Comerciales */}
        <Card className="rounded-2xl border-slate-100 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <CreditCard className="h-4 w-4 text-slate-400" />
              Condiciones Comerciales
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Plazo de Pago</span>
              <span className="text-slate-800 font-bold text-sm">
                {(terms?.payment_terms_days ?? 0) === 0
                  ? 'Contado inmediato'
                  : `${terms?.payment_terms_days} días de crédito`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Moneda de Facturación</span>
                <span className="text-slate-800 font-semibold">{terms?.currency ?? 'USD'}</span>
              </div>
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Límite de Crédito</span>
                <span className="text-slate-800 font-semibold">
                  {terms?.credit_limit ? `$${Number(terms.credit_limit).toLocaleString()}` : 'Sin límite'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Tiempo de Entrega</span>
                <span className="text-slate-800 font-semibold">
                  {terms?.lead_time_days ? `${terms.lead_time_days} días est.` : 'Inmediato / N/A'}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Descuento Comercial</span>
                <span className="text-slate-800 font-semibold">
                  {terms?.discount_percentage ? `${terms.discount_percentage}%` : '0%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos Bancarios y Pago */}
        <Card className="rounded-2xl border-slate-100 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <Banknote className="h-4 w-4 text-slate-400" />
              Datos de Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Método Preferido</span>
              <span className="text-slate-800 font-semibold capitalize">
                {terms?.preferred_payment_method === 'transfer'
                  ? 'Transferencia bancaria'
                  : terms?.preferred_payment_method === 'pago_movil'
                  ? 'Pago Móvil'
                  : terms?.preferred_payment_method || 'Transferencia'}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Banco</span>
              <span className="text-slate-800 font-medium">
                {bankDetails?.bank_name || 'No especificado'}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Número de Cuenta / Teléfono</span>
              <span className="font-mono text-slate-800 bg-slate-50 px-2 py-1 rounded block mt-0.5">
                {bankDetails?.account_number || 'No especificado'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de Órdenes de Compra (Vinculación a Fase 3) */}
      <Card className="rounded-2xl border-slate-100 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
            <ShoppingBasket className="h-4 w-4 text-slate-400" />
            Órdenes de Compra y Abastecimiento
          </CardTitle>
          <Button asChild variant="outline" size="sm" className="text-xs rounded-xl h-8">
            <Link href={`/t/${params.slug}/warehouse/receipts`}>
              Registrar entrada →
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="py-12 text-center text-xs text-slate-500">
          <ShoppingBasket className="h-10 w-10 text-slate-200 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Sin órdenes de compra registradas con este proveedor</p>
          <p className="text-slate-400 mt-1 max-w-sm mx-auto">
            Las órdenes de compra emitidas y recepcionadas aparecerán en esta sección automáticamente cuando se active la Fase 3 (Compras).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
