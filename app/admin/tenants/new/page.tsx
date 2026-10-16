'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BusinessTemplate, Feature } from '@/lib/types';
import { WizardData, SubmitResults, StepResult, STEPS, ALLOWED_FONTS, slugify } from '@/lib/wizard-types';
import { StepEmpresa, StepTemplate, StepBranding } from '@/components/wizard/wizard-steps-1-3';
import { StepModulos, StepSupabase, StepAdmin, StepResumen } from '@/components/wizard/wizard-steps-4-7';

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
  const [loadingRef, setLoadingRef] = useState(true);
  const [data, setData] = useState<WizardData>({
    commercial_name: '', legal_name: '', slug: '', slugTouched: false,
    country: 'CO', currency: 'COP', language: 'es', timezone: 'America/Bogota',
    business_type: 'retail', business_template_id: '',
    primary_color: '#042071', secondary_color: '#63DCE5', accent_color: '#00AFEF',
    font_family: 'Inter', login_background_color: '#042071', selectedFeatures: {},
    project_ref: '', supabase_url: '', secret_ref: '', admin_email: '',
  });

  useEffect(() => {
    (async () => {
      setLoadingRef(true);
      const [tmplRes, featRes] = await Promise.all([
        supabase.from('business_templates').select('id, key, name, description, suggested_features').order('name'),
        supabase.from('features').select('key, name, description, category, dependencies, implementation_status, sort_order').order('sort_order'),
      ]);
      if (tmplRes.data) setTemplates(tmplRes.data as BusinessTemplate[]);
      if (featRes.data) setFeatures(featRes.data as Feature[]);
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
    switch (step) {
      case 0: return data.commercial_name.trim().length > 0 && data.slug.trim().length > 0 && /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(data.slug) && slugAvailable !== false;
      case 1: return !!data.business_template_id;
      case 2: return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(data.primary_color) && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(data.secondary_color) && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(data.accent_color) && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(data.login_background_color) && ALLOWED_FONTS.includes(data.font_family as (typeof ALLOWED_FONTS)[number]);
      case 3: return selectedFeatureCount > 0;
      case 4: return isValidTenantConnection(data);
      case 5: return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.admin_email);
      default: return true;
    }
  }, [step, data, slugAvailable, selectedFeatureCount]);

  const goNext = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));
  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitResults(null);
    const results: StepResult[] = [];
    try {
      const createRes = await fetch('/api/admin/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commercial_name: data.commercial_name, legal_name: data.legal_name || undefined, slug: data.slug, country: data.country, currency: data.currency, language: data.language, timezone: data.timezone, business_type: data.business_type, business_template_id: data.business_template_id || undefined }) });
      const createJson = await createRes.json();
      if (!createRes.ok) { results.push({ ok: false, label: 'Crear empresa', detail: createJson?.error ?? `Error ${createRes.status}` }); setSubmitResults({ steps: results, finalTechnicalStatus: 'pending_setup' }); return; }
      const tenantId = createJson.tenant.id;
      results.push({ ok: true, label: 'Empresa creada', detail: `ID: ${tenantId}` });
      const brandingRes = await fetch(`/api/admin/tenants/${tenantId}/branding`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ primary_color: data.primary_color, secondary_color: data.secondary_color, accent_color: data.accent_color, font_family: data.font_family, login_background_color: data.login_background_color }) });
      results.push({ ok: brandingRes.ok, label: 'Branding guardado', detail: brandingRes.ok ? `Colores + ${data.font_family}` : `Error ${brandingRes.status}` });
      const featureArr = Object.entries(data.selectedFeatures).filter(([, enabled]) => enabled).map(([feature_key]) => ({ feature_key, enabled: true }));
      const featureRes = await fetch(`/api/admin/tenants/${tenantId}/features`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: featureArr }) });
      results.push({ ok: featureRes.ok, label: 'Modulos guardados', detail: featureRes.ok ? `${featureArr.length} modulos` : `Error ${featureRes.status}` });
      const dbRes = await fetch(`/api/admin/tenants/${tenantId}/database`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_ref: data.project_ref, supabase_url: data.supabase_url, secret_ref: data.secret_ref }) });
      results.push({ ok: dbRes.ok, label: 'Conexion registrada', detail: dbRes.ok ? `project_ref: ${data.project_ref}` : `Error ${dbRes.status}` });
      const membershipRes = await fetch(`/api/admin/tenants/${tenantId}/membership`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.admin_email, role: 'tenant_admin' }) });
      const membershipJson = await membershipRes.json();
      results.push({ ok: membershipRes.ok, label: membershipJson?.pending ? 'Invitacion creada (pendiente)' : 'Administrador asignado', pending: membershipJson?.pending, detail: membershipRes.ok ? (membershipJson?.message ?? data.admin_email) : `Error ${membershipRes.status}` });
      await fetch(`/api/admin/tenants/${tenantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wizard_completed: true, wizard_step: 7 }) });
      setSubmitResults({ tenant: createJson.tenant, steps: results, finalTechnicalStatus: 'pending_setup' });
    } catch (error) {
      results.push({ ok: false, label: 'Error inesperado', detail: error instanceof Error ? error.message : 'Error desconocido' });
      setSubmitResults({ steps: results, finalTechnicalStatus: 'pending_setup' });
    } finally {
      setSubmitting(false);
    }
  };

  const progressValue = ((step + 1) / STEPS.length) * 100;
  return (
    <div className="animate-fade-in-up space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/tenants"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link></Button>
      <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><Building2 className="h-6 w-6 text-accent" />Nueva empresa</h1><p className="mt-1 text-sm text-muted-foreground">Asistente de creacion de tenant — 7 pasos.</p></div>
      <Card><CardContent className="pt-6"><div className="mb-4 flex items-center justify-between text-sm"><span className="font-medium text-foreground">Paso {step + 1} de {STEPS.length}: {STEPS[step].label}</span><span className="text-muted-foreground">{Math.round(progressValue)}%</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressValue}%` }} /></div><div className="mt-4 flex flex-wrap gap-2">{STEPS.map((item, index) => { const current = index === step; const done = index < step; return <button key={item.key} type="button" onClick={() => { if (index <= step) setStep(index); else if (index === step + 1 && canGoNext) setStep(index); }} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors', current && 'border-accent bg-accent/10 text-accent', done && 'border-success/30 bg-success/10 text-success', !current && !done && 'border-border text-muted-foreground')}>{done ? <Check className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}{item.label}<span className="ml-0.5 text-[10px] opacity-60">{index + 1}</span></button>; })}</div></CardContent></Card>
      <Card className="min-h-[420px]">{loadingRef && step <= 1 ? <CardContent className="flex flex-col items-center justify-center gap-3 py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /><p className="text-sm text-muted-foreground">Cargando datos de referencia...</p></CardContent> : <>{step === 0 && <StepEmpresa data={data} update={update} slugAvailable={slugAvailable} checkingSlug={checkingSlug} />}{step === 1 && <StepTemplate templates={templates} selectedId={data.business_template_id} onSelect={(id) => update('business_template_id', id)} />}{step === 2 && <StepBranding data={data} update={update} />}{step === 3 && <StepModulos features={features} featuresByCategory={featuresByCategory} selectedFeatures={data.selectedFeatures} toggleFeature={toggleFeature} selectedTemplate={selectedTemplate} />}{step === 4 && <StepSupabase data={data} update={update} />}{step === 5 && <StepAdmin data={data} update={update} />}{step === 6 && <StepResumen data={data} templates={templates} features={features} selectedTemplate={selectedTemplate} submitting={submitting} submitResults={submitResults} onSubmit={handleSubmit} onVisitTenant={(id) => router.push(`/admin/tenants/${id}`)} />}</>}</Card>
      {!submitResults && <div className="flex items-center justify-between"><Button variant="outline" onClick={goBack} disabled={step === 0 || submitting}><ArrowLeft className="mr-2 h-4 w-4" />Anterior</Button>{step < STEPS.length - 1 ? <Button onClick={goNext} disabled={!canGoNext}>Siguiente <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={handleSubmit} disabled={submitting || !canGoNext}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando empresa...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Crear empresa</>}</Button>}</div>}
    </div>
  );
}
