'use client';

import React from 'react';
import { Boxes, CreditCard, Database, UserPlus, Info, AlertCircle, CheckCircle2, XCircle, ClipboardCheck, Sparkles, Building2, Palette, LayoutTemplate, Share2 } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WizardData, SubmitResults, IMPL_STATUS_LABELS, IMPL_STATUS_BADGE } from '@/lib/wizard-types';
import { TENANT_CURRENCIES, businessTypeLabel, countryLabel, infrastructureLabel } from '@/lib/tenant-management';
import type { BusinessTemplate, Feature, Plan } from '@/lib/types';

export function StepModulos({
  features,
  featuresByCategory,
  selectedFeatures,
  toggleFeature,
  selectedTemplate,
}: {
  features: Feature[];
  featuresByCategory: Record<string, Feature[]>;
  selectedFeatures: Record<string, boolean>;
  toggleFeature: (key: string) => void;
  selectedTemplate: BusinessTemplate | null;
}) {
  const categoryLabels: Record<string, string> = {
    crm: 'CRM', integration: 'Integraciones', channel: 'Canales', automation: 'Automatizacion', analytics: 'Analitica',
  };
  const suggestedSet = new Set(selectedTemplate?.suggested_features ?? []);
  const totalSelected = Object.values(selectedFeatures).filter(Boolean).length;

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><Boxes className="h-5 w-5 text-accent" />Modulos y funcionalidades</CardTitle>
        <CardDescription>
          Selecciona los modulos que estaran disponibles para el tenant. Los modulos sugeridos por la plantilla ya estan preseleccionados{selectedTemplate && <> ({selectedTemplate.name})</>}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-md bg-accent/10 px-4 py-2 text-sm">
          <span className="font-medium text-foreground"><Sparkles className="mr-1.5 inline h-4 w-4 text-accent" />{totalSelected} modulo{totalSelected !== 1 ? 's' : ''} seleccionado{totalSelected !== 1 ? 's' : ''}</span>
          {selectedTemplate && <span className="text-xs text-muted-foreground">Plantilla: {selectedTemplate.name}</span>}
        </div>
        {features.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground"><Info className="h-5 w-5" />No hay modulos disponibles.</div>
        ) : (
          Object.entries(featuresByCategory).map(([category, feats]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{categoryLabels[category] ?? category}</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {feats.map((f) => {
                  const checked = !!selectedFeatures[f.key];
                  const isSuggested = suggestedSet.has(f.key);
                  const depsMissing = f.dependencies.filter((d) => !selectedFeatures[d]);
                  return (
                    <div key={f.key} className={cn('flex gap-3 rounded-lg border p-4 transition-colors', checked ? 'border-accent/40 bg-accent/5' : 'border-border')}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleFeature(f.key)} className="mt-0.5" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{f.name}</span>
                          {isSuggested && <Badge className="border-transparent bg-accent/15 text-xs text-accent">Sugerido</Badge>}
                          <Badge className={cn('text-xs', IMPL_STATUS_BADGE[f.implementation_status])}>{IMPL_STATUS_LABELS[f.implementation_status]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                        {f.dependencies.length > 0 && (
                          <p className={cn('text-xs', depsMissing.length > 0 && checked ? 'text-warning' : 'text-muted-foreground')}>
                            Depende de: <code className="rounded bg-muted px-1 py-0.5">{f.dependencies.join(', ')}</code>
                            {depsMissing.length > 0 && checked && <span className="ml-1 text-warning">(faltan: {depsMissing.join(', ')})</span>}
                          </p>
                        )}
                        <code className="text-[10px] text-muted-foreground">{f.key}</code>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </>
  );
}

export function StepInfraestructura({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
}) {
  if (data.infrastructure_mode === 'shared') {
    return (
      <>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><Share2 className="h-5 w-5 text-accent" />Infraestructura Shared</CardTitle>
          <CardDescription>La empresa compartirá infraestructura con otras empresas, aislada por tenant_id y políticas RLS.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">Aprovisionamiento pendiente</p>
              <p>No hace falta registrar una base de datos. Las tablas comerciales y el aislamiento de la modalidad Shared todavía están en preparación, así que la empresa quedará con aprovisionamiento pendiente y no se marcará como operativa.</p>
            </div>
          </div>
        </CardContent>
      </>
    );
  }
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><Database className="h-5 w-5 text-accent" />Infraestructura Dedicated</CardTitle>
        <CardDescription>Si el proyecto Supabase de la empresa ya existe, registra su conexión. Si todavía no existe, deja los campos vacíos: el aprovisionamiento quedará pendiente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border border-info/30 bg-info/5 p-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-info" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">VORA no crea proyectos Supabase automáticamente.</p>
              <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                <li>Crea el proyecto dedicado en supabase.com.</li>
                <li>Anota el <strong>Project Reference ID</strong> y la <strong>URL del proyecto</strong>.</li>
                <li>Guarda la service role key como variable segura del servidor y registra aquí solo su <strong>nombre</strong> (secret_ref), nunca la clave.</li>
                <li>Después usa «Probar conexión» en el detalle de la empresa: solo así pasa a infraestructura lista.</li>
              </ol>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project_ref">Project Reference ID</Label>
          <Input id="project_ref" value={data.project_ref} onChange={(e) => update('project_ref', e.target.value)} placeholder="ej. abcdwxyzqprsmainxxxx" className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supabase_url">URL del proyecto</Label>
          <Input id="supabase_url" value={data.supabase_url} onChange={(e) => update('supabase_url', e.target.value)} placeholder="https://xyz.supabase.co" className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret_ref">Secret Reference (nombre de la variable)</Label>
          <Input id="secret_ref" value={data.secret_ref} onChange={(e) => update('secret_ref', e.target.value)} placeholder="TENANT_EMPRESA_SERVICE_KEY" className="font-mono" />
          <p className="text-xs text-muted-foreground"><strong className="text-warning">No es la clave secreta.</strong> Mayúsculas, números y guiones bajos.</p>
        </div>
      </CardContent>
    </>
  );
}

export function StepAdmin({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><UserPlus className="h-5 w-5 text-accent" />Administrador del tenant</CardTitle>
        <CardDescription>Opcional. Si el usuario ya tiene cuenta, se le asigna la membresía; si no, se crea una invitación pendiente. También puedes hacerlo después desde el detalle de la empresa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="admin_email">Email del administrador (opcional)</Label>
          <Input id="admin_email" type="email" value={data.admin_email} onChange={(e) => update('admin_email', e.target.value)} placeholder="admin@miempresa.com" />
        </div>
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">Estado pendiente</p>
              <p className="text-muted-foreground">Si el email no tiene una cuenta en VORA, se creará una invitación con estado <Badge className="border-transparent bg-warning/15 text-warning">pendiente</Badge>.</p>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-info/30 bg-info/5 p-4 text-sm">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-info" />
            <div className="space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">Que pasara al confirmar:</p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>Se busca el usuario por email en auth.users.</li>
                <li>Si existe -&gt; membresia <strong>activa</strong> con rol tenant_admin.</li>
                <li>Si no existe -&gt; invitacion <strong>pendiente</strong> (7 dias de validez).</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  );
}

export function StepResumen({
  data,
  templates,
  features,
  plans,
  selectedTemplate,
  submitting,
  submitResults,
  onSubmit,
  onVisitTenant,
}: {
  data: WizardData;
  templates: BusinessTemplate[];
  features: Feature[];
  plans: Plan[];
  selectedTemplate: BusinessTemplate | null;
  submitting: boolean;
  submitResults: SubmitResults | null;
  onSubmit: () => void;
  onVisitTenant: (id: string) => void;
}) {
  const selectedFeatureKeys = Object.entries(data.selectedFeatures).filter(([, enabled]) => enabled).map(([key]) => key);
  const selectedFeatureNames = selectedFeatureKeys.map((k) => features.find((f) => f.key === k)?.name ?? k).sort();
  const currencyName = TENANT_CURRENCIES.find((c) => c.value === data.currency)?.label ?? data.currency;
  const planName = plans.find((p) => p.id === data.plan_id)?.name ?? '—';
  const hasDedicatedConnection = data.infrastructure_mode === 'dedicated' && !!(data.project_ref || data.supabase_url || data.secret_ref);

  if (submitResults) {
    const allOk = submitResults.steps.every((s) => s.ok);
    const hasPending = submitResults.steps.some((s) => s.pending);
    return (
      <>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            {allOk ? <CheckCircle2 className="h-6 w-6 text-success" /> : <AlertCircle className="h-6 w-6 text-destructive" />}
            {allOk ? 'Empresa creada' : 'Creacion con errores'}
          </CardTitle>
          <CardDescription>
            {allOk ? (hasPending ? 'La empresa se creo correctamente, pero algunos pasos quedaron pendientes.' : 'La empresa se creo correctamente. Todos los pasos se completaron.') : 'Algunos pasos fallaron durante la creacion. Revisa los detalles a continuacion.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            {submitResults.steps.map((s, i) => (
              <div key={i} className={cn('flex items-start gap-3 rounded-md border p-3', s.ok ? (s.pending ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5') : 'border-destructive/30 bg-destructive/5')}>
                {s.ok ? (s.pending ? <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />) : <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{s.label}</div>
                  {s.detail && <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>}
                </div>
                {s.pending && <Badge className="border-transparent bg-warning/15 text-warning">Pendiente</Badge>}
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Estado inicial:</span>
              <Badge className="border-transparent bg-warning/15 text-warning">Pendiente · aprovisionamiento pendiente</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {submitResults.tenant && <Button onClick={() => onVisitTenant(submitResults.tenant!.id)}><Building2 className="mr-2 h-4 w-4" />Ver empresa</Button>}
            <Button variant="outline" asChild><Link href="/admin/tenants">Volver al listado</Link></Button>
          </div>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><ClipboardCheck className="h-5 w-5 text-accent" />Resumen y confirmacion</CardTitle>
        <CardDescription>Revisa todos los datos antes de crear el tenant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SummarySection title="Empresa" icon={Building2}>
          <SummaryRow label="Nombre comercial" value={data.commercial_name} />
          <SummaryRow label="Razón social" value={data.legal_name} />
          <SummaryRow label={data.country === 'VE' ? 'RIF' : 'Identificación fiscal'} value={<code className="rounded bg-muted px-1.5 py-0.5">{data.tax_id}</code>} />
          <SummaryRow label="Correo" value={data.contact_email} />
          <SummaryRow label="Teléfono" value={data.contact_phone || '—'} />
          <SummaryRow label="País" value={countryLabel(data.country)} />
          <SummaryRow label="Moneda" value={currencyName} />
          <SummaryRow label="Tipo de negocio" value={businessTypeLabel(data.business_type)} />
          <SummaryRow label="Slug" value={<code className="rounded bg-muted px-1.5 py-0.5">{data.slug}</code>} />
        </SummarySection>
        <SummarySection title="Plan y modalidad" icon={CreditCard}>
          <SummaryRow label="Plan inicial" value={planName} />
          <SummaryRow label="Modalidad" value={infrastructureLabel(data.infrastructure_mode)} />
          <SummaryRow label="Estado inicial" value="Pendiente · aprovisionamiento pendiente" />
        </SummarySection>
        <SummarySection title="Plantilla" icon={LayoutTemplate}>
          <SummaryRow label="Plantilla" value={selectedTemplate?.name ?? '—'} />
          <div className="flex flex-wrap gap-1">{(selectedTemplate?.suggested_features ?? []).map((f) => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}</div>
        </SummarySection>
        <SummarySection title="Branding" icon={Palette}>
          <div className="flex flex-wrap gap-3">
            <ColorChip label="Primario" color={data.primary_color} />
            <ColorChip label="Secundario" color={data.secondary_color} />
            <ColorChip label="Acento" color={data.accent_color} />
            <ColorChip label="Login" color={data.login_background_color} />
          </div>
          <SummaryRow label="Fuente" value={data.font_family} />
        </SummarySection>
        <SummarySection title="Modulos" icon={Boxes}>
          <SummaryRow label="Modulos seleccionados" value={`${selectedFeatureKeys.length} modulo(s)`} />
          <div className="flex flex-wrap gap-1">{selectedFeatureNames.map((n) => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}</div>
        </SummarySection>
        {data.infrastructure_mode === 'dedicated' && (
          <SummarySection title="Infraestructura dedicada" icon={Database}>
            {hasDedicatedConnection ? (
              <>
                <SummaryRow label="Project Ref" value={<code className="text-xs">{data.project_ref || '—'}</code>} />
                <SummaryRow label="URL" value={<code className="text-xs">{data.supabase_url || '—'}</code>} />
                <SummaryRow label="Secret Ref" value={<code className="text-xs">{data.secret_ref || '—'}</code>} />
              </>
            ) : (
              <SummaryRow label="Conexión" value="Pendiente de registrar" />
            )}
          </SummarySection>
        )}
        <SummarySection title="Administrador" icon={UserPlus}>
          <SummaryRow label="Email" value={data.admin_email || '—'} />
        </SummarySection>
        <div className="rounded-md border border-info/30 bg-info/5 p-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-info" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">Al confirmar se registrará la empresa con su plan, branding, módulos y, si los indicaste, la conexión dedicada y el administrador.</p>
              <p className="text-muted-foreground">La empresa quedará <strong>pendiente</strong> hasta que la actives, y con aprovisionamiento pendiente hasta verificar su infraestructura.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  );
}

function SummarySection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-accent" />{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function ColorChip({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5">
      <div className="h-5 w-5 rounded border" style={{ backgroundColor: color }} />
      <div className="text-xs"><div className="font-medium text-foreground">{label}</div><div className="font-mono text-muted-foreground">{color}</div></div>
    </div>
  );
}
