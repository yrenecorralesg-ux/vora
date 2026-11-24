import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Ban, ShieldAlert } from 'lucide-react';

import { requireSession, isSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';
import { getTenantSession } from '@/lib/tenant-session';
import { CrmSidebar } from '@/components/crm-sidebar';
import { ModuleRail } from '@/components/module-rail';
import { TenantFrame } from '@/components/tenant-frame';
import { canPreviewTenant } from '@/lib/tenant-preview';
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
  const currentPath = headers().get('x-vora-path') || '';
  if (currentPath.endsWith('/login') || currentPath.includes('/login?') || currentPath.endsWith('/login/')) {
    return <>{children}</>;
  }

  // 1. Sesión dedicada de empresa mediante cookie vora_session_[slug]
  const tenantSession = await getTenantSession(params.slug);

  const service = getSupabaseServiceClient();

  // 2. Resolver tenant por slug
  const { data: tenant, error: tenantErr } = await service
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

  if (!tenant) {
    return <NoAccessPage />;
  }

  // 3. Aislamiento total: Si no hay sesión de empresa, exigir inicio de sesión en el portal de la empresa
  if (!tenantSession) {
    const supabase = getSupabaseServerClient();
    const user = await requireSession(supabase);
    if (!user) {
      redirect(`/t/${params.slug}/login`);
    }

    const { data: membership } = await service
      .from('tenant_memberships')
      .select('id, role')
      .eq('tenant_id', tenant.id)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      redirect(`/t/${params.slug}/login`);
    }
  }

  /* 4. Branding y Features ------------------------------------------------ */
  const [{ data: branding }, { data: featureRows }] = await Promise.all([
    service
      .from('tenant_branding')
      .select('primary_color, secondary_color, accent_color, logo_url, banner_url, font_family')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    service.from('tenant_features').select('feature_key, enabled').eq('tenant_id', tenant.id),
  ]);

  const isSolee = tenant.slug === 'solee';
  const primaryColor =
    branding?.primary_color ?? (isSolee ? '#1a102f' : '#285C49');
  const secondaryColor =
    branding?.secondary_color ?? (isSolee ? '#7c3aed' : '#A9BEA5');
  const accentColor =
    branding?.accent_color ?? (isSolee ? '#a855f7' : '#C97857');
  const logoUrl = branding?.logo_url ?? null;

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

  /* 5. Tenant suspendido ------------------------------------------------- */
  const isSuspended =
    tenant.commercial_status === 'suspended' ||
    tenant.commercial_status === 'cancelled';
  const isSubscription =
    headers().get('x-vora-path') === `/t/${params.slug}/subscription`;
  if (isSuspended && !isSubscription) {
    return (
      <SuspendedPage
        tenantName={tenant.commercial_name}
        primaryColor={primaryColor}
      />
    );
  }

  /* 6. Features habilitadas ---------------------------------------------- */

  const enabledFeatures = (featureRows ?? [])
    .filter((f: FeatureRow) => f.enabled)
    .map((f: FeatureRow) => f.feature_key);

  // El dashboard siempre debe ser accesible si hay membresia.
  if (!enabledFeatures.includes('crm.dashboard')) {
    enabledFeatures.push('crm.dashboard');
  }

  const userRole = tenantSession?.role ?? 'member';
  const admin = false;
  const isPreview = false;

  // Selector POS ↔ Warehouse, común a todo el portal de la empresa.
  const rail = (
    <ModuleRail slug={tenant.slug} tenantId={tenant.id} enabledFeatures={enabledFeatures} isSuperAdmin={false} />
  );

  /* 7. Render ------------------------------------------------------------- */
  // El menú del CRM se oculta en POS y Warehouse (tienen barra propia). La decisión
  // se toma en el cliente (TenantFrame) porque el layout no se re-renderiza al navegar.
  return (
    <div
      data-tenant-root
      className="min-h-screen"
      style={{
        '--crm-primary': primaryColor,
        '--crm-secondary': secondaryColor,
        '--crm-accent': accentColor,
        fontFamily: getFontFamily(branding?.font_family),
      } as React.CSSProperties}
    >
      <TenantFrame
        slug={tenant.slug}
        rail={rail}
        sidebar={
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
        }
        topLink={
          (admin || ['tenant_admin', 'admin'].includes(userRole)) && (
            <a href={`/t/${tenant.slug}/subscription`} className="mb-4 inline-block text-sm underline">
              Suscripción y Pago Móvil
            </a>
          )
        }
      >
        {children}
      </TenantFrame>
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
