'use client';

import React from 'react';
import { Building2, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WizardData, COUNTRIES, CURRENCIES, LANGUAGES, TIMEZONES, BUSINESS_TYPES } from '@/lib/wizard-types';
import { getFontFamily, ALLOWED_FONTS } from '@/lib/fonts';

export function StepEmpresa({
  data,
  update,
  slugAvailable,
  checkingSlug,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  slugAvailable: null | boolean;
  checkingSlug: boolean;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className="h-5 w-5 text-accent" />
          Datos de la empresa
        </CardTitle>
        <CardDescription>
          Informacion comercial basica del nuevo tenant. El slug se genera automaticamente pero puedes editarlo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="commercial_name">Nombre comercial <span className="text-destructive">*</span></Label>
          <Input id="commercial_name" value={data.commercial_name} onChange={(e) => update('commercial_name', e.target.value)} placeholder="Ej. Mi Empresa SAS" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="legal_name">Razon social (opcional)</Label>
          <Input id="legal_name" value={data.legal_name} onChange={(e) => update('legal_name', e.target.value)} placeholder="Ej. Mi Empresa S.A.S. NIT 900.123.456-7" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (identificador unico) <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">vora.venesoftca.com/</div>
            <Input id="slug" value={data.slug} onChange={(e) => { update('slug', e.target.value.toLowerCase()); update('slugTouched', true); }} placeholder="mi-empresa" className="flex-1" />
            {checkingSlug && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!checkingSlug && slugAvailable === true && data.slug && <CheckCircle2 className="h-4 w-4 text-success" />}
            {!checkingSlug && slugAvailable === false && data.slug && <XCircle className="h-4 w-4 text-destructive" />}
          </div>
          {slugAvailable === false && data.slug && <p className="text-xs text-destructive">Este slug ya esta en uso. Elige otro.</p>}
          {slugAvailable === true && data.slug && <p className="text-xs text-success">Slug disponible.</p>}
          <p className="text-xs text-muted-foreground">Solo minusculas, numeros y guiones. Se usara en URLs y como identificador unico del tenant.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Pais</Label>
            <Select value={data.country} onValueChange={(v) => update('country', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={data.currency} onValueChange={(v) => update('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Select value={data.language} onValueChange={(v) => update('language', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Zona horaria</Label>
            <Select value={data.timezone} onValueChange={(v) => update('timezone', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tipo de negocio</Label>
          <Select value={data.business_type} onValueChange={(v) => update('business_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BUSINESS_TYPES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardContent>
    </>
  );
}

export function StepTemplate({
  templates,
  selectedId,
  onSelect,
}: {
  templates: { id: string; key: string; name: string; description: string; suggested_features: string[] }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className="h-5 w-5 text-accent" />
          Plantilla de negocio
        </CardTitle>
        <CardDescription>
          Elige una plantilla preconfigurada. Cada plantilla sugiere un conjunto de modulos que se preseleccionaran en el paso 4.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Info className="h-5 w-5" />
            No hay plantillas disponibles.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {templates.map((t) => {
              const selected = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className={`flex flex-col items-start gap-3 rounded-lg border-2 p-5 text-left transition-all ${selected ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border hover:border-accent/50 hover:bg-muted/30'}`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${selected ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{t.name}</span>
                      {selected && <CheckCircle2 className="h-4 w-4 text-accent" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <div className="mt-1 w-full">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Modulos sugeridos:</p>
                    <div className="flex flex-wrap gap-1">
                      {(t.suggested_features ?? []).map((f) => (
                        <Badge key={f} variant="outline" className="border-accent/30 bg-accent/5 text-xs">{f}</Badge>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </>
  );
}

export function StepBranding({
  data,
  update,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
}) {
  const colorFields: { key: keyof WizardData; label: string }[] = [
    { key: 'primary_color', label: 'Color primario' },
    { key: 'secondary_color', label: 'Color secundario' },
    { key: 'accent_color', label: 'Color de acento' },
    { key: 'login_background_color', label: 'Color de fondo (login)' },
  ];

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className="h-5 w-5 text-accent" />
          Identidad visual
        </CardTitle>
        <CardDescription>
          Configura los colores y la tipografia del tenant. La vista previa se actualiza en tiempo real.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={data[key] as string} onChange={(e) => update(key, e.target.value as WizardData[typeof key])} className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1" />
                <Input value={data[key] as string} onChange={(e) => update(key, e.target.value as WizardData[typeof key])} className="flex-1 font-mono" placeholder="#042071" />
              </div>
            </div>
          ))}
          <div className="space-y-2">
            <Label>Fuente tipografica</Label>
            <Select value={data.font_family} onValueChange={(v) => update('font_family', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALLOWED_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Solo se permiten: {ALLOWED_FONTS.join(', ')}.</p>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-sm font-medium">Vista previa</Label>
          <div className="overflow-hidden rounded-lg border" style={{ fontFamily: getFontFamily(data.font_family) }}>
            <div className="flex items-center justify-between px-5 py-4 text-white" style={{ backgroundColor: data.login_background_color }}>
              <span className="text-lg font-bold">VORA</span>
              <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: data.accent_color, color: '#fff' }}>{data.commercial_name || 'Mi Empresa'}</span>
            </div>
            <div className="space-y-3 bg-card p-5">
              <div className="rounded-md px-4 py-3 text-sm font-medium text-white" style={{ backgroundColor: data.primary_color }}>Boton primario</div>
              <div className="flex gap-2">
                <div className="flex-1 rounded-md border-2 px-4 py-2 text-center text-sm font-medium" style={{ borderColor: data.secondary_color, color: data.secondary_color }}>Boton secundario</div>
                <div className="flex-1 rounded-md px-4 py-2 text-center text-sm font-medium text-white" style={{ backgroundColor: data.accent_color }}>Acento</div>
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="mb-2 h-2 w-1/3 rounded bg-muted" />
                <div className="mb-1.5 h-2 w-full rounded bg-muted/70" />
                <div className="mb-1.5 h-2 w-5/6 rounded bg-muted/70" />
                <div className="h-2 w-2/3 rounded bg-muted/50" />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Asi se veran los colores del tenant en la interfaz de VORA.</p>
        </div>
      </CardContent>
    </>
  );
}
