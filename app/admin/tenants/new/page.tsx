'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BusinessTemplate, Feature, Plan } from '@/lib/types';
import { WizardData, SubmitResults, StepResult, STEPS, ALLOWED_FONTS, slugify } from '@/lib/wizard-types';
import { normalizeTaxId, SLUG_RE } from '@/lib/tenant-management';
import { StepEmpresa, StepTemplate, StepBranding } from '@/components/wizard/wizard-steps-1-3';
import { StepPlan } from '@/components/wizard/wizard-step-plan';
import { StepModulos, StepInfraestructura, StepAdmin, StepResumen } from '@/components/wizard/wizard-steps-4-7';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function hasDedicatedConnection(data: WizardData) {
  return !!(data.project_ref.trim() || data.supabase_url.trim() || data.secret_ref.trim());
}

function isValidTenantConnection(data: WizardData): boolean {
  if (!/^[a-z0-9-]{6,80}$/i.test(data.project_ref)) return false;
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(data.secret_ref)) return false;
  try {
    const url = new URL(data.supabase_url);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === `${data.project_ref.toLowerCase()}.supabase.co` && url.pathname === '/';
  } catch {
    return false;
  }
}

export default function NewTenantWizardPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitResults, setSubmitResults] = useState<SubmitResults | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<null | boolean>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [templates, setTemplates] = useState<BusinessTemplate[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);
  const [data, setData] = useState<WizardData>({
    commercial_name: '', legal_name: '', tax_id: '', contact_email: '', contact_phone: '',
    infrastructure_mode: 'shared', plan_id: '',
    slug: '', slugTouched: false,
    country: 'VE', currency: 'VES', language: 'es', timezone: 'America/Caracas',
    business_type: 'commerce', business_template_id: '',
    primary_color: '#285C49', secondary_color: '#A9BEA5', accent_color: '#C97857',
    font_family: 'Inter', login_background_color: '#285C49', selectedFeatures: {},
    project_ref: '', supabase_url: '', secret_ref: '', admin_email: '',
  });

  useEffect(() => {
    (async () => {
      setLoadingRef(true);
      const [tmplRes, featRes, planRes] = await Promise.all([
        supabase.from('business_templates').select('id, key, name, description, suggested_features').order('name'),
        supabase.from('features').select('key, name, description, category, dependencies, implementation_status, sort_order').order('sort_order'),
        supabase.from('plans').select('id, name, description, limits, is_active').eq('is_active', true).order('name'),
      ]);
      if (tmplRes.data) setTemplates(tmplRes.data as BusinessTemplate[]);
      if (featRes.data) setFeatures(featRes.data as Feature[]);
      if (planRes.data) setPlans(planRes.data as Plan[]);
      setLoadingRef(false);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!data.slugTouched && data.commercial_name) setData((current) => ({ ...current, slug: slugify(current.commercial_name) }));
  }, [data.commercial_name, data.slugTouched]);

  useEffect(() => {
    if (!data.slug) { setSlugAvailable(null); return; }
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    slugCheckTimer.current = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const { count } = await supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('slug', data.slug);
        setSlugAvailable((count ?? 0) === 0);
      } catch { setSlugAvailable(null); }
      setCheckingSlug(false);
    }, 500);
    return () => { if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current); };
  }, [data.slug, supabase]);

  useEffect(() => {
    if (!data.business_template_id || features.length === 0) return;
    const template = templates.find((item) => item.id === data.business_template_id);
    if (!template) return;
    setData((current) => {
      const next = { ...current.selectedFeatures };
      for (const key of template.suggested_features ?? []) if (features.some((feature) => feature.key === key)) next[key] = true;
      return { ...current, selectedFeatures: next };
    });
  }, [data.business_template_id, templates, features]);

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === data.business_template_id) ?? null, [templates, data.business_template_id]);
  const selectedFeatureCount = useMemo(() => Object.values(data.selectedFeatures).filter(Boolean).length, [data.selectedFeatures]);
  const featuresByCategory = useMemo(() => {
    const grouped: Record<string, Feature[]> = {};
    for (const feature of features) { if (!grouped[feature.category]) grouped[feature.category] = []; grouped[feature.category].push(feature); }
    return grouped;
  }, [features]);

  const update = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => setData((current) => ({ ...current, [key]: value })), []);
  const toggleFeature = useCallback((key: string) => setData((current) => ({ ...current, selectedFeatures: { ...current.selectedFeatures, [key]: !current.selectedFeatures[key] } })), []);

  const canGoNext = useMemo(() => {
    switch (STEPS[step].key) {
      case 'empresa':
        return data.commercial_name.trim().length >= 2
          && data.legal_name.trim().length >= 2
          && normalizeTaxId(data.tax_id, data.country) !== null
          && EMAIL_RE.test(data.contact_email.trim())
          && (data.contact_phone.trim() === '' || PHONE_RE.test(data.contact_phone.trim()))
          && SLUG_RE.test(data.slug)
          && slugAvailable !== false;
      case 'plan':
        return !!data.plan_id && (data.infrastructure_mode === 'shared' || data.infrastructure_mode === 'dedicated');
      case 'template':
        return !!data.business_template_id;
      case 'branding':
        return HEX_RE.test(data.primary_color) && HEX_RE.test(data.secondary_color) && HEX_RE.test(data.accent_color) && HEX_RE.test(data.login_background_color) && ALLOWED_FONTS.includes(data.font_family as (typeof ALLOWED_FONTS)[number]);
      case 'modulos':
        return selectedFeatureCount > 0;
      case 'infraestructura':
        return data.infrastructure_mode === 'shared' || !hasDedicatedConnection(data) || isValidTenantConnection(data);
      case 'admin':
        return data.admin_email.trim() === '' || EMAIL_RE.test(data.admin_email.trim());
      default:
        return true;
    }
  }, [step, data, slugAvailable, selectedFeatureCount]);

  const goNext = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));
  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitResults(null);
    const results: StepResult[] = [];
    try {
      const createRes = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commercial_name: data.commercial_name,
          legal_name: data.legal_name,
          tax_id: data.tax_id,
          contact_email: data.contact_email,
          contact_phone: data.contact_phone,
          slug: data.slug,
          country: data.country,
          currency: data.currency,
          language: data.language,
          timezone: data.timezone,
          business_type: data.business_type,
          business_template_id: data.business_template_id || undefined,
          infrastructure_mode: data.infrastructure_mode,
          plan_id: data.plan_id,
        }),
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        const fieldDetail = createJson?.fields ? Object.values(createJson.fields as Record<string, string>).join(' ') : '';
        results.push({ ok: false, label: 'Registrar empresa', detail: [createJson?.error ?? `Error ${createRes.status}`, fieldDetail].filter(Boolean).join(' ') });
        setSubmitResults({ steps: results, finalTechnicalStatus: 'pending_setup' });
        return;
      }
      const tenantId = createJson.tenant.id;
      results.push({ ok: true, label: 'Empresa registrada', detail: 'Estado: pendiente · aprovisionamiento pendiente' });
      if (!createJson.subscription_created) results.push({ ok: false, label: 'Suscripción inicial', detail: 'No se pudo crear; asigna el plan desde el detalle.' });

      const brandingRes = await fetch(`/api/admin/tenants/${tenantId}/branding`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ primary_color: data.primary_color, secondary_color: data.secondary_color, accent_color: data.accent_color, font_family: data.font_family, login_background_color: data.login_background_color }) });
      results.push({ ok: brandingRes.ok, label: 'Branding guardado', detail: brandingRes.ok ? `Colores + ${data.font_family}` : `Error ${brandingRes.status}` });

      const featureArr = Object.entries(data.selectedFeatures).filter(([, enabled]) => enabled).map(([feature_key]) => ({ feature_key, enabled: true }));
      const featureRes = await fetch(`/api/admin/tenants/${tenantId}/features`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: featureArr }) });
      results.push({ ok: featureRes.ok, label: 'Módulos guardados', detail: featureRes.ok ? `${featureArr.length} módulos` : `Error ${featureRes.status}` });

      if (data.infrastructure_mode === 'dedicated' && hasDedicatedConnection(data)) {
        const dbRes = await fetch(`/api/admin/tenants/${tenantId}/database`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_ref: data.project_ref, supabase_url: data.supabase_url, secret_ref: data.secret_ref }) });
        results.push({ ok: dbRes.ok, label: 'Conexión dedicada registrada', pending: dbRes.ok, detail: dbRes.ok ? 'Pendiente de verificar con «Probar conexión».' : `Error ${dbRes.status}` });
      } else {
        results.push({ ok: true, pending: true, label: 'Infraestructura', detail: data.infrastructure_mode === 'shared' ? 'Shared: aprovisionamiento pendiente.' : 'Dedicated: conexión pendiente de registrar.' });
      }

      if (data.admin_email.trim()) {
        const membershipRes = await fetch(`/api/admin/tenants/${tenantId}/membership`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.admin_email.trim(), role: 'tenant_admin' }) });
        const membershipJson = await membershipRes.json().catch(() => ({}));
        results.push({ ok: membershipRes.ok, label: membershipJson?.pending ? 'Invitación creada (pendiente)' : 'Administrador asignado', pending: membershipJson?.pending, detail: membershipRes.ok ? (membershipJson?.message ?? data.admin_email) : `Error ${membershipRes.status}` });
      }

      await fetch(`/api/admin/tenants/${tenantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wizard_completed: true, wizard_step: STEPS.length }) });
      setSubmitResults({ tenant: createJson.tenant, steps: results, finalTechnicalStatus: 'pending_setup' });
    } catch (error) {
      results.push({ ok: false, label: 'Error inesperado', detail: error instanceof Error ? error.message : 'Error desconocido' });
      setSubmitResults({ steps: results, finalTechnicalStatus: 'pending_setup' });
    } finally {
      setSubmitting(false);
    }
  };

  const progressValue = ((step + 1) / STEPS.length) * 100;
  const stepKey = STEPS[step].key;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/tenants"><ArrowLeft className="mr-2 h-4 w-4" />Volver a empresas</Link></Button>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A4573A]">VORA Core</p>
        <h1 className="mt-2 flex items-center gap-2 font-jakarta text-3xl font-extrabold tracking-[-0.02em] text-[#285C49]"><Building2 className="h-7 w-7" />Registrar empresa</h1>
        <p className="mt-1 text-sm text-[#52675A]">Asistente de registro en {STEPS.length} pasos. La empresa queda pendiente hasta que la actives.</p>
      </div>
      <Card className="rounded-2xl border-[#E2DACB]">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between text-sm"><span className="font-medium text-foreground">Paso {step + 1} de {STEPS.length}: {STEPS[step].label}</span><span className="text-muted-foreground">{Math.round(progressValue)}%</span></div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E6EBDF]"><div className="h-full rounded-full bg-[#285C49] transition-all" style={{ width: `${progressValue}%` }} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {STEPS.map((item, index) => {
              const current = index === step;
              const done = index < step;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  onClick={() => { if (index <= step) setStep(index); else if (index === step + 1 && canGoNext) setStep(index); }}
                  className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors', current && 'border-[#285C49] bg-[#EFF4EC] text-[#285C49]', done && 'border-[#A9BEA5] bg-[#E6EBDF] text-[#1F4A3A]', !current && !done && 'border-border text-muted-foreground')}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] opacity-70">{index + 1}</span>}
                  {item.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="min-h-[420px] rounded-2xl border-[#E2DACB]">
        {loadingRef && (stepKey === 'plan' || stepKey === 'template') ? (
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20"><Loader2 className="h-8 w-8 animate-spin text-[#285C49]" /><p className="text-sm text-muted-foreground">Cargando datos de referencia...</p></CardContent>
        ) : (
          <>
            {stepKey === 'empresa' && <StepEmpresa data={data} update={update} slugAvailable={slugAvailable} checkingSlug={checkingSlug} />}
            {stepKey === 'plan' && <StepPlan data={data} update={update} plans={plans} />}
            {stepKey === 'template' && <StepTemplate templates={templates} selectedId={data.business_template_id} onSelect={(id) => update('business_template_id', id)} />}
            {stepKey === 'branding' && <StepBranding data={data} update={update} />}
            {stepKey === 'modulos' && <StepModulos features={features} featuresByCategory={featuresByCategory} selectedFeatures={data.selectedFeatures} toggleFeature={toggleFeature} selectedTemplate={selectedTemplate} />}
            {stepKey === 'infraestructura' && <StepInfraestructura data={data} update={update} />}
            {stepKey === 'admin' && <StepAdmin data={data} update={update} />}
            {stepKey === 'resumen' && <StepResumen data={data} templates={templates} features={features} plans={plans} selectedTemplate={selectedTemplate} submitting={submitting} submitResults={submitResults} onSubmit={handleSubmit} onVisitTenant={(id) => router.push(`/admin/tenants/${id}`)} />}
          </>
        )}
      </Card>
      {!submitResults && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goBack} disabled={step === 0 || submitting}><ArrowLeft className="mr-2 h-4 w-4" />Anterior</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext} disabled={!canGoNext} className="bg-[#285C49] hover:bg-[#1F4A3A]">Siguiente <ArrowRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !canGoNext} className="bg-[#285C49] hover:bg-[#1F4A3A]">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando empresa...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Registrar empresa</>}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
