import { Settings, Palette, Layers, CreditCard, Building2 } from 'lucide-react';

import { requireSession, isSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DemoBanner, DemoBadge } from '@/components/demo-banner';
import { TenantModulesConfig } from '@/components/tenant-modules-config';

export const dynamic = 'force-dynamic';

interface BrandingRow {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  font_family: string;
}

interface TenantRow {
  id: string;
  commercial_name: string;
  legal_name: string | null;
  slug: string;
  commercial_status: string;
  currency: string;
  language: string;
  timezone: string;
  plan_id: string | null;
}

interface FeatureRow {
  feature_key: string;
  enabled: boolean;
  features?: { name: string; category: string } | null;
}

interface PlanRow {
  name: string;
}

export default async function SettingsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireSession();
  if (!user) return null;

  const supabase = getSupabaseServerClient();

  // Datos reales del tenant para la pagina de ajustes.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, commercial_name, legal_name, slug, commercial_status, currency, language, timezone, plan_id')
    .eq('slug', params.slug)
    .maybeSingle();

  const { data: branding } = await supabase
    .from('tenant_branding')
    .select('primary_color, secondary_color, accent_color, logo_url, favicon_url, font_family')
    .eq('tenant_id', tenant?.id ?? '')
    .maybeSingle();

  const { data: featureRows } = await supabase
    .from('tenant_features')
    .select('feature_key, enabled, features ( name, category )')
    .eq('tenant_id', tenant?.id ?? '');

  const { data: plan } = await supabase
    .from('plans')
    .select('name')
    .eq('id', tenant?.plan_id ?? '')
    .maybeSingle();

  const features = ((featureRows ?? []) as unknown as FeatureRow[]).map((f) => ({
    ...f,
    features: Array.isArray(f.features) ? f.features[0] : f.features,
  }));
  const enabledCount = features.filter((f) => f.enabled).length;

  const primaryColor = (branding as BrandingRow | null)?.primary_color ?? '#042071';
  const secondaryColor = (branding as BrandingRow | null)?.secondary_color ?? '#63DCE5';
  const accentColor = (branding as BrandingRow | null)?.accent_color ?? '#63DCE5';

  return (
    <div className="space-y-6">
      <DemoBanner message="Demo — La edicion no esta disponible. Se muestran los datos reales de configuracion del tenant." />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Configuracion de la cuenta <DemoBadge />
        </p>
      </div>

      {/* Informacion general */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Informacion general</CardTitle>
              <CardDescription>Datos de la empresa</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoItem label="Nombre comercial" value={tenant?.commercial_name ?? '—'} />
            <InfoItem label="Razon social" value={tenant?.legal_name ?? '—'} />
            <InfoItem label="Slug" value={tenant?.slug ?? params.slug} />
            <InfoItem label="Estado" value={tenant?.commercial_status ?? '—'} />
            <InfoItem label="Moneda" value={tenant?.currency ?? '—'} />
            <InfoItem label="Idioma" value={tenant?.language ?? '—'} />
            <InfoItem label="Zona horaria" value={tenant?.timezone ?? '—'} />
            <InfoItem label="Plan" value={(plan as PlanRow | null)?.name ?? 'Sin plan'} />
          </dl>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Palette className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Branding</CardTitle>
              <CardDescription>Colores y identidad visual</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorSwatch label="Color primario" color={primaryColor} />
            <ColorSwatch label="Color secundario" color={secondaryColor} />
            <ColorSwatch label="Color de acento" color={accentColor} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md text-white" style={{ backgroundColor: primaryColor }}>
              <span className="text-sm font-bold">
                {(tenant?.commercial_name ?? 'E').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-medium">Logo</p>
              <p className="text-muted-foreground">
                {(branding as BrandingRow | null)?.logo_url ? 'Logo personalizado configurado' : 'Sin logo (usa iniciales)'}
              </p>
            </div>
          </div>
          <Button variant="outline" disabled>
            Editar branding
          </Button>
        </CardContent>
      </Card>

      {/* Modulos y Funciones Configurables */}
      <TenantModulesConfig
        slug={params.slug}
        initialFeatures={(featureRows ?? []) as any}
      />

      {/* Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Plan y facturacion</CardTitle>
              <CardDescription>Subscription actual</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Plan actual:{' '}
            <span className="font-semibold">
              {(plan as PlanRow | null)?.name ?? 'Sin plan asignado'}
            </span>
          </p>
          <Button variant="outline" disabled className="mt-4">
            <Settings className="mr-2 h-4 w-4" />
            Gestionar plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div
        className="h-10 w-10 shrink-0 rounded-md border"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-mono text-foreground">{color}</p>
      </div>
    </div>
  );
}
