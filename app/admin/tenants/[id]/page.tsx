import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireSuperAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { TenantTabs } from '@/components/tenant-tabs';
import { AdminStatusBadge, InfrastructureBadge, OperationalIndicator, TechnicalStatusBadge } from '@/components/admin/tenant-badges';
import { UUID_RE } from '@/lib/tenant-management';
import type { Plan, TenantSubscription } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const user = await requireSuperAdmin();
  if (!user) redirect(`/login?redirect=/admin/tenants/${encodeURIComponent(params.id)}`);
  if (!UUID_RE.test(params.id)) notFound();

  const supabase = getSupabaseServerClient();
  const tenantId = params.id;

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select(
      `
        id, commercial_name, legal_name, tax_id, contact_email, contact_phone, slug,
        commercial_status, technical_status, infrastructure_mode,
        country, currency, language, timezone, business_type, business_template_id, plan_id,
        wizard_step, wizard_completed, created_at, updated_at,
        business_templates ( name ),
        plans ( name )
      `,
    )
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantErr) console.error('[admin/tenants/[id]] tenant fetch error', tenantErr.message);
  if (!tenant) notFound();

  const [
    { data: branding },
    { data: dbRow },
    { data: domains },
    { data: memberships },
    { data: features },
    { data: auditLogs },
    { data: subscription },
    { data: plans },
  ] = await Promise.all([
    supabase.from('tenant_branding').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenant_databases').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenant_domains').select('*').eq('tenant_id', tenantId).order('is_primary', { ascending: false }),
    supabase.from('tenant_memberships').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase
      .from('tenant_features')
      .select('id, tenant_id, feature_key, enabled, config, config_state, release_status, features!inner ( name, category )')
      .eq('tenant_id', tenantId)
      .order('feature_key', { ascending: true }),
    supabase.from('platform_audit_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    supabase.from('tenant_subscriptions').select('id, tenant_id, plan_id, status, started_at, ended_at, updated_at').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('plans').select('id, name, description, limits, is_active').order('name'),
  ]);

  const membershipsWithEmail = (memberships ?? []).map((m: any) => ({ ...m, email: null }));
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

  const t = tenant as any;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/admin/tenants" className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-[#285C49] hover:bg-[#E6EBDF]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a empresas
      </Link>

      <header className="flex flex-col gap-4 rounded-[1.5rem] border border-[#E2DACB] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-jakarta text-lg font-extrabold text-white"
            style={{ backgroundColor: (branding as any)?.primary_color ?? '#285C49' }}
            aria-hidden="true"
          >
            {t.commercial_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="font-jakarta text-2xl font-extrabold tracking-[-0.02em] text-[#285C49] sm:text-3xl">{t.commercial_name}</h1>
            <p className="mt-1 text-sm text-[#52675A]">
              {t.legal_name ?? '—'}
              {t.tax_id && <> · <span className="font-mono">{t.tax_id}</span></>} · <code className="rounded bg-[#F6F2E9] px-1.5 py-0.5 text-xs">/{t.slug}</code>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AdminStatusBadge status={t.commercial_status} />
              <TechnicalStatusBadge status={t.technical_status} />
              <InfrastructureBadge mode={t.infrastructure_mode} />
              <OperationalIndicator status={t.commercial_status} technical={t.technical_status} />
            </div>
          </div>
        </div>
        <div className="text-sm text-[#52675A] sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider">Plan</p>
          <p className="font-jakarta text-lg font-bold text-[#285C49]">{t.plans?.name ?? 'Sin plan'}</p>
        </div>
      </header>

      <TenantTabs
        tenant={{
          id: t.id,
          commercial_name: t.commercial_name,
          legal_name: t.legal_name,
          tax_id: t.tax_id ?? null,
          contact_email: t.contact_email ?? null,
          contact_phone: t.contact_phone ?? null,
          infrastructure_mode: t.infrastructure_mode ?? 'shared',
          business_type: t.business_type ?? null,
          slug: t.slug,
          commercial_status: t.commercial_status,
          technical_status: t.technical_status,
          country: t.country,
          currency: t.currency,
          language: t.language,
          timezone: t.timezone,
          business_template_id: t.business_template_id,
          plan_id: t.plan_id,
          wizard_step: t.wizard_step,
          wizard_completed: t.wizard_completed,
          created_at: t.created_at,
          updated_at: t.updated_at,
        }}
        branding={branding as any}
        features={featuresFlat as any}
        database={dbRow as any}
        domains={(domains ?? []) as any}
        memberships={membershipsWithEmail as any}
        auditLogs={(auditLogs ?? []) as any}
        templateName={t.business_templates?.name ?? null}
        planName={t.plans?.name ?? null}
        subscription={(subscription ?? null) as TenantSubscription | null}
        plans={(plans ?? []) as Plan[]}
      />
    </div>
  );
}
