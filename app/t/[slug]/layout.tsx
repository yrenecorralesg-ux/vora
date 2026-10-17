import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Ban, ShieldAlert } from 'lucide-react';

import { requireSession, isSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { CrmSidebar } from '@/components/crm-sidebar';
import { getFontFamily } from '@/lib/fonts';

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Tipos minimos para las filas de DB                                        */
/* -------------------------------------------------------------------------- */

interface TenantRow {
  id: string;
  commercial_name: string;
  slug: string;
  commercial_status: string;
}

interface BrandingRow {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
}

interface FeatureRow {
  feature_key: string;
  enabled: boolean;
}

interface MembershipRow {
  id: string;
  role: string;
}

/* -------------------------------------------------------------------------- */
/*  Layout del CRM del tenant                                                 */
/* -------------------------------------------------------------------------- */

export default async function TenantCrmLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const supabase = getSupabaseServerClient();

  /* 1. Sesion ------------------------------------------------------------- */
  const user = await requireSession(supabase);
  if (!user) {
    redirect(`/login?redirect=/t/${params.slug}`);
  }

  /* 2. Resolver tenant por slug ------------------------------------------- */
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, commercial_name, slug, commercial_status')
    .eq('slug', params.slug)
    .maybeSingle();

  if (tenantErr) {
    console.error(
      '[t/[slug]/layout] error al resolver tenant',
      tenantErr.message,
    );
  }

  // Tenant inexistente -> lo tratamos como sin acceso.
  if (!tenant) {
    return <NoAccessPage />;
  }

  /* 3. Membresia del usuario + rol super admin ---------------------------- */
  const [{ data: membership }, admin] = await Promise.all([
    supabase
      .from('tenant_memberships')
      .select('id, role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    isSuperAdmin(user.id, supabase),
  ]);

  const hasMembership = !!membership;
  const isPreview = admin && !hasMembership;

  // Sin membresia ni super admin en vista previa -> sin acceso.
  if (!hasMembership && !admin) {
    return <NoAccessPage />;
  }

  /* 4. Branding ----------------------------------------------------------- */
  const { data: branding } = await supabase
    .from('tenant_branding')
    .select(
      'primary_color, secondary_color, accent_color, logo_url, banner_url, font_family',
    )
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  const isSolee = tenant.slug === 'solee';
  const primaryColor =
    branding?.primary_color ?? (isSolee ? '#1a102f' : '#285C49');
  const secondaryColor =
    branding?.secondary_color ?? (isSolee ? '#7c3aed' : '#A9BEA5');
  const accentColor =
    branding?.accent_color ?? (isSolee ? '#a855f7' : '#C97857');
  const logoUrl =
    branding?.logo_url && !branding.logo_url.includes('logo.webp')
      ? branding.logo_url
      : null;

  let headerBannerUrl: string | null = null;
  let sidebarBannerUrl: string | null = null;
  if (branding?.banner_url) {
    try {
      const parsed = JSON.parse(branding.banner_url);
      headerBannerUrl = parsed.header || null;
      sidebarBannerUrl = parsed.sidebar || null;
    } catch {
      headerBannerUrl = branding.banner_url;
    }
  }

  /* 5. Tenant suspendido (no super admin en preview) ---------------------- */
  const isSuspended =
    tenant.commercial_status === 'suspended' ||
    tenant.commercial_status === 'cancelled';
  const isSubscription =
    headers().get('x-vora-path') === `/t/${params.slug}/subscription`;
  if (isSuspended && !isPreview && !isSubscription) {
    return (
      <SuspendedPage
        tenantName={tenant.commercial_name}
        primaryColor={primaryColor}
      />
    );
  }

  /* 6. Features habilitadas ---------------------------------------------- */
  const { data: featureRows } = await supabase
    .from('tenant_features')
    .select('feature_key, enabled')
    .eq('tenant_id', tenant.id);

  const enabledFeatures = (featureRows ?? [])
    .filter((f: FeatureRow) => f.enabled)
    .map((f: FeatureRow) => f.feature_key);

  // El dashboard siempre debe ser accesible si hay membresia.
  if (!enabledFeatures.includes('crm.dashboard')) {
    enabledFeatures.push('crm.dashboard');
  }

  const userRole = membership?.role ?? (admin ? 'super_admin' : 'member');

  /* 7. Render ------------------------------------------------------------- */
  const wrapperStyle = {
    '--crm-primary': primaryColor,
    '--crm-secondary': secondaryColor,
    '--crm-accent': accentColor,
    fontFamily: getFontFamily(branding?.font_family),
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-[#f1f3f9]" style={wrapperStyle}>
      <div className="flex min-h-screen">
        <CrmSidebar
          tenantId={tenant.id}
          slug={tenant.slug}
          tenantName={tenant.commercial_name}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
          sidebarBannerUrl={sidebarBannerUrl}
          enabledFeatures={enabledFeatures}
          userRole={userRole}
          isPreview={isPreview}
        />

        <div className="flex min-h-screen flex-1 flex-col overflow-y-auto">
          <main className="flex-1 p-4 sm:p-5 lg:p-6">
            {(admin || ['tenant_admin', 'admin'].includes(userRole)) && (
              <a
                href={`/t/${tenant.slug}/subscription`}
                className="mb-4 inline-block text-sm underline"
              >
                Suscripción y Pago Móvil
              </a>
            )}
            {!isSubscription && (
              <p className="mb-4 rounded-lg border bg-[#F6F2E9] p-3 text-sm">
                Las vistas comerciales heredadas contienen datos de
                demostración. La configuración y los cobros de Core utilizan los
                datos guardados de la empresa.
              </p>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Paginas de estado (sin acceso / suspendido)                               */
/* -------------------------------------------------------------------------- */

function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No tienes membresia activa en esta empresa. Si crees que es un error,
          contacta al administrador de la organizacion.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}

function SuspendedPage({
  tenantName,
  primaryColor,
}: {
  tenantName: string;
  primaryColor: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <Ban className="h-7 w-7" style={{ color: primaryColor }} />
        </div>
        <h1 className="text-xl font-bold">Cuenta suspendida</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La cuenta de <strong>{tenantName}</strong> se encuentra suspendida.
          Para reactivarla, contacta al equipo de soporte de VORA.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md border px-6 text-sm font-medium"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
