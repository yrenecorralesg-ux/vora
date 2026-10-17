import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Building2 } from 'lucide-react';

import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { CoreSetupPanel } from '@/components/core-setup-panel';
import { TenantTabs } from '@/components/tenant-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CommercialStatus, TechnicalStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* ------------------------------- badge maps ------------------------------- */

const COMMERCIAL_LABEL: Record<CommercialStatus, string> = {
  trial: 'Prueba',
  active: 'Activo',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
};
const COMMERCIAL_BADGE: Record<CommercialStatus, string> = {
  trial: 'bg-warning text-warning-foreground',
  active: 'bg-success text-success-foreground',
  suspended: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};
const TECHNICAL_LABEL: Record<TechnicalStatus, string> = {
  pending_setup: 'Pendiente',
  ready: 'Listo',
  error: 'Error',
};
const TECHNICAL_BADGE: Record<TechnicalStatus, string> = {
  pending_setup: 'bg-muted text-muted-foreground',
  ready: 'bg-success text-success-foreground',
  error: 'bg-destructive text-destructive-foreground',
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireSuperAdmin();
  if (!user) redirect('/login');

  const supabase = getSupabaseServerClient();
  const tenantId = params.id;

  /* Tenant ----------------------------------------------------------------- */
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select(
      `
        id,
        commercial_name,
        legal_name,
        tax_id,
        slug,
        commercial_status,
        technical_status,
        country,
        currency,
        language,
        timezone,
        business_template_id,
        plan_id,
        wizard_step,
        wizard_completed,
        created_at,
        updated_at,
        business_templates ( name ),
        plans ( name )
      `,
    )
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantErr) {
    console.error('[admin/tenants/[id]] tenant fetch error', tenantErr.message);
  }
  if (!tenant) notFound();

  /* Related data ----------------------------------------------------------- */
  const [
    { data: branding },
    { data: dbRows },
    { data: domains },
    { data: memberships },
    { data: features },
    { data: auditLogs },
  ] = await Promise.all([
    supabase
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('tenant_databases')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('tenant_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false }),
    supabase
      .from('tenant_memberships')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase
      .from('tenant_features')
      .select(
        `
          id,
          tenant_id,
          feature_key,
          enabled,
          config,
          config_state,
          release_status,
          features!inner ( name, category )
        `,
      )
      .eq('tenant_id', tenantId)
      .order('feature_key', { ascending: true }),
    supabase
      .from('platform_audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  /* Reshape memberships to include email from auth users (best-effort) ------ */
  const membershipsWithEmail = (memberships ?? []).map((m: any) => ({
    ...m,
    email: null,
  }));

  /* Reshape features to flatten the joined feature name/category ------------ */
  const featuresFlat = (features ?? []).map((f: any) => ({
    id: f.id,
    tenant_id: f.tenant_id,
    feature_key: f.feature_key,
    enabled: f.enabled,
    config: f.config,
    config_state: f.config_state,
    release_status: f.release_status,
    feature_name: f.features?.name ?? null,
    feature_category: f.features?.category ?? null,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                Panel Super Admin
              </h1>
              <p className="text-xs text-muted-foreground">
                VORA · {user.email}
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="/admin/tenants"
              className="rounded-md bg-muted px-3 py-1.5 font-medium text-foreground"
            >
              Empresas
            </a>
            <a
              href="/admin"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Inicio
            </a>
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb + header */}
        <div className="mb-6 space-y-4">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin/tenants">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a empresas
            </Link>
          </Button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white"
                style={{
                  backgroundColor:
                    branding?.primary_color ?? 'hsl(225 93% 23%)',
                }}
              >
                {tenant.commercial_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {tenant.commercial_name}
                  </h2>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {tenant.slug}
                  </code>
                  <Badge
                    className={cn(
                      'border-transparent',
                      COMMERCIAL_BADGE[
                        tenant.commercial_status as CommercialStatus
                      ],
                    )}
                  >
                    {
                      COMMERCIAL_LABEL[
                        tenant.commercial_status as CommercialStatus
                      ]
                    }
                  </Badge>
                  <Badge
                    className={cn(
                      'border-transparent',
                      TECHNICAL_BADGE[
                        tenant.technical_status as TechnicalStatus
                      ],
                    )}
                  >
                    {
                      TECHNICAL_LABEL[
                        tenant.technical_status as TechnicalStatus
                      ]
                    }
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CoreSetupPanel tenantId={tenant.id} slug={tenant.slug} />
        {/* Tabs */}
        <TenantTabs
          tenant={{
            id: tenant.id,
            commercial_name: tenant.commercial_name,
            legal_name: tenant.legal_name,
            tax_id: tenant.tax_id,
            slug: tenant.slug,
            commercial_status: tenant.commercial_status,
            technical_status: tenant.technical_status,
            country: tenant.country,
            currency: tenant.currency,
            language: tenant.language,
            timezone: tenant.timezone,
            business_template_id: tenant.business_template_id,
            plan_id: tenant.plan_id,
            wizard_step: tenant.wizard_step,
            wizard_completed: tenant.wizard_completed,
            created_at: tenant.created_at,
            updated_at: tenant.updated_at,
          }}
          branding={branding as any}
          features={featuresFlat as any}
          database={dbRows as any}
          domains={(domains ?? []) as any}
          memberships={membershipsWithEmail as any}
          auditLogs={(auditLogs ?? []) as any}
          templateName={(tenant.business_templates as any)?.name ?? null}
          planName={(tenant.plans as any)?.name ?? null}
        />
      </main>
    </div>
  );
}
