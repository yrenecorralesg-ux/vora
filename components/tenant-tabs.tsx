'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Palette,
  CreditCard,
  Boxes,
  Database as DatabaseIcon,
  Users as UsersIcon,
  Globe,
  ScrollText,
  LayoutDashboard,
  Search,
  Plus,
  ExternalLink,
  PlugZap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Play,
  Save,
  ShieldAlert,
  Upload,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CRM_MODULES_CATALOG } from '@/lib/modules-config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type {
  Tenant,
  TenantBranding,
  TenantDatabase,
  TenantDomain,
  TenantFeature,
  TenantMembership,
  AuditLog,
  CommercialStatus,
  TechnicalStatus,
  ConnectionStatus,
  FeatureConfigState,
} from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Badge maps                                                                */
/* -------------------------------------------------------------------------- */

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

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  not_configured: 'No configurada',
  checking: 'Verificando',
  connected: 'Conectada',
  error: 'Error',
};
const CONNECTION_DOT: Record<ConnectionStatus, string> = {
  not_configured: 'bg-muted-foreground',
  checking: 'bg-warning',
  connected: 'bg-success',
  error: 'bg-destructive',
};

const CONFIG_LABEL: Record<FeatureConfigState, string> = {
  enabled: 'Habilitado',
  pending_config: 'Config. pendiente',
  configured: 'Configurado',
  operational: 'Operativo',
};
const CONFIG_BADGE: Record<FeatureConfigState, string> = {
  enabled: 'bg-info text-info-foreground',
  pending_config: 'bg-warning text-warning-foreground',
  configured: 'bg-success text-success-foreground',
  operational: 'bg-success text-success-foreground',
};

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

export interface TenantTabsProps {
  tenant: Tenant;
  branding: TenantBranding | null;
  features: (TenantFeature & { feature_name?: string; feature_category?: string })[];
  database: TenantDatabase | null;
  domains: TenantDomain[];
  memberships: (TenantMembership & { email?: string | null })[];
  auditLogs: AuditLog[];
  templateName: string | null;
  planName?: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Root component                                                            */
/* -------------------------------------------------------------------------- */

export function TenantTabs(props: TenantTabsProps) {
  const { tenant, branding, features, database, domains, memberships, auditLogs } =
    props;

  return (
    <Tabs defaultValue="resumen" className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg bg-muted p-1">
        <TabsTrigger value="resumen" className="gap-1.5">
          <LayoutDashboard className="h-4 w-4" /> Resumen
        </TabsTrigger>
        <TabsTrigger value="empresa" className="gap-1.5">
          <Building2 className="h-4 w-4" /> Empresa
        </TabsTrigger>
        <TabsTrigger value="branding" className="gap-1.5">
          <Palette className="h-4 w-4" /> Branding
        </TabsTrigger>
        <TabsTrigger value="modulos" className="gap-1.5">
          <Boxes className="h-4 w-4" /> Módulos
        </TabsTrigger>
        <TabsTrigger value="basededatos" className="gap-1.5">
          <DatabaseIcon className="h-4 w-4" /> Base de datos
        </TabsTrigger>
        <TabsTrigger value="usuarios" className="gap-1.5">
          <UsersIcon className="h-4 w-4" /> Usuarios
        </TabsTrigger>
        <TabsTrigger value="dominios" className="gap-1.5">
          <Globe className="h-4 w-4" /> Dominios
        </TabsTrigger>
        <TabsTrigger value="auditoria" className="gap-1.5">
          <ScrollText className="h-4 w-4" /> Auditoría
        </TabsTrigger>
      </TabsList>

      <TabsContent value="resumen" className="mt-6">
        <ResumenTab {...props} />
      </TabsContent>
      <TabsContent value="empresa" className="mt-6">
        <EmpresaTab tenant={tenant} />
      </TabsContent>
      <TabsContent value="branding" className="mt-6">
        <BrandingTab branding={branding} tenant={tenant} />
      </TabsContent>
      <TabsContent value="modulos" className="mt-6">
        <ModulosTab features={features} tenantId={tenant.id} />
      </TabsContent>
      <TabsContent value="basededatos" className="mt-6">
        <BaseDeDatosTab database={database} tenantId={tenant.id} />
      </TabsContent>
      <TabsContent value="usuarios" className="mt-6">
        <UsuariosTab memberships={memberships} />
      </TabsContent>
      <TabsContent value="dominios" className="mt-6">
        <DominiosTab domains={domains} />
      </TabsContent>
      <TabsContent value="auditoria" className="mt-6">
        <AuditoriaTab auditLogs={auditLogs} />
      </TabsContent>
    </Tabs>
  );
}

/* -------------------------------------------------------------------------- */
/*  Resumen                                                                   */
/* -------------------------------------------------------------------------- */

function ResumenTab(props: TenantTabsProps) {
  const { tenant, branding, database, domains, memberships, features, templateName, planName } =
    props;

  const enabledFeatures = features.filter((f) => f.enabled).length;
  const activeMembers = memberships.filter((m) => m.status === 'active').length;
  const primaryDomain = domains.find((d) => d.is_primary);
  const isSolee = tenant.slug === 'solee';

  let headerBannerUrl = '';
  let sidebarBannerUrl = '';
  if (branding?.banner_url) {
    try {
      const p = JSON.parse(branding.banner_url);
      if (p.header) headerBannerUrl = p.header;
      if (p.sidebar) sidebarBannerUrl = p.sidebar;
    } catch {
      headerBannerUrl = branding.banner_url;
    }
  }

  const cards: {
    label: string;
    value: React.ReactNode;
    icon: React.ElementType;
  }[] = [
    {
      label: 'Estado comercial',
      value: (
        <Badge className={cn('border-transparent', COMMERCIAL_BADGE[tenant.commercial_status])}>
          {COMMERCIAL_LABEL[tenant.commercial_status]}
        </Badge>
      ),
      icon: ShieldAlert,
    },
    {
      label: 'Estado técnico',
      value: (
        <Badge className={cn('border-transparent', TECHNICAL_BADGE[tenant.technical_status])}>
          {TECHNICAL_LABEL[tenant.technical_status]}
        </Badge>
      ),
      icon: Building2,
    },
    {
      label: 'Conexión BD',
      value: <ConnectionInline status={database?.connection_status ?? 'not_configured'} />,
      icon: DatabaseIcon,
    },
    {
      label: 'Módulos activos',
      value: (
        <span className="text-2xl font-bold">
          {enabledFeatures}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            / {features.length}
          </span>
        </span>
      ),
      icon: Boxes,
    },
    {
      label: 'Usuarios',
      value: (
        <span className="text-2xl font-bold">
          {activeMembers}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            activos
          </span>
        </span>
      ),
      icon: UsersIcon,
    },
    {
      label: 'Dominio principal',
      value: (
        <span className="text-sm font-medium">
          {primaryDomain ? primaryDomain.hostname : '—'}
        </span>
      ),
      icon: Globe,
    },
    {
      label: 'Plan',
      value: (
        <span className="text-sm font-semibold text-primary">
          {planName ?? 'Starter'}
        </span>
      ),
      icon: CreditCard,
    },
    {
      label: 'Template',
      value: (
        <span className="text-sm font-medium">
          {templateName ?? '—'}
        </span>
      ),
      icon: LayoutDashboard,
    },
    {
      label: 'País / Moneda',
      value: (
        <span className="text-sm font-medium">
          {tenant.country ? `${tenant.country} (${tenant.currency ?? 'COP'})` : (tenant.currency ?? '—')}
        </span>
      ),
      icon: Globe,
    },
    {
      label: 'Creado',
      value: (
        <span className="text-sm font-medium">
          {formatDate(tenant.created_at)}
        </span>
      ),
      icon: ScrollText,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{tenant.commercial_name}</h3>
          <p className="text-sm text-muted-foreground">
            {tenant.legal_name ?? tenant.commercial_name} ·{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tenant.slug}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TenantStatusActions tenant={tenant} />
          <Button asChild variant="outline">
            <Link href={`/t/${tenant.slug}?preview=1`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Vista previa
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </CardTitle>
              <c.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>{c.value}</CardContent>
          </Card>
        ))}
      </div>

      {branding && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-primary" /> Identidad visual
            </CardTitle>
            <CardDescription>
              Configuración de marca, colores y recursos gráficos guardados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Logotipo & Favicon */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Logotipo & Favicon
                </p>
                <div className="flex items-center gap-3">
                  {branding.logo_url && !branding.logo_url.includes('logo.webp') ? (
                    <div
                      className="flex h-12 min-w-[120px] max-w-[160px] items-center justify-center rounded-lg border p-2 shadow-xs"
                      style={{ backgroundColor: branding.primary_color || '#1a1b37' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={branding.logo_url}
                        alt="Logo"
                        className="max-h-8 max-w-full object-contain"
                      />
                    </div>
                  ) : isSolee ? (
                    <div
                      className="flex h-12 min-w-[140px] items-center justify-center rounded-lg border px-3 py-1 shadow-xs"
                      style={{ backgroundColor: branding.primary_color || '#1a1b37' }}
                    >
                      <div className="flex flex-col items-center justify-center leading-none">
                        <span className="font-serif text-[13px] font-normal tracking-[0.25em] text-white uppercase">
                          SOLEÉ
                        </span>
                        <span className="text-[5.5px] font-medium tracking-[0.35em] text-white/60 uppercase mt-0.5">
                          AROMAS & RELACIONES
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold text-white shadow-xs"
                      style={{ backgroundColor: branding.primary_color }}
                    >
                      {tenant.commercial_name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {branding.favicon_url && (
                    <div className="flex flex-col items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={branding.favicon_url}
                        alt="Favicon"
                        className="h-7 w-7 rounded border object-contain p-0.5"
                      />
                      <span className="text-[10px] text-muted-foreground">Favicon</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipografía */}
              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tipografía
                </p>
                <p className="text-lg font-bold text-foreground">
                  {branding.font_family || 'Inter'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fuente principal del CRM
                </p>
              </div>

              {/* Paleta de Colores */}
              <div className="rounded-xl border p-4 space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Paleta de Colores
                </p>
                <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border shadow-xs"
                      style={{ backgroundColor: branding.primary_color }}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-none truncate">Primario</p>
                      <code className="text-[10px] text-muted-foreground font-mono">{branding.primary_color}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border shadow-xs"
                      style={{ backgroundColor: branding.secondary_color }}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-none truncate">Secundario</p>
                      <code className="text-[10px] text-muted-foreground font-mono">{branding.secondary_color}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border shadow-xs"
                      style={{ backgroundColor: branding.accent_color ?? '#a855f7' }}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-none truncate">Acento</p>
                      <code className="text-[10px] text-muted-foreground font-mono">{branding.accent_color ?? '#a855f7'}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border shadow-xs"
                      style={{ backgroundColor: branding.login_background_color ?? '#1a0a2e' }}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-none truncate">Login</p>
                      <code className="text-[10px] text-muted-foreground font-mono">{branding.login_background_color ?? '#1a0a2e'}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Banners guardados */}
            {(headerBannerUrl || sidebarBannerUrl) && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recursos Gráficos y Banners Guardados
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {headerBannerUrl && (
                    <div className="overflow-hidden rounded-xl border bg-muted/20">
                      <div className="p-2.5 border-b bg-card flex items-center justify-between">
                        <span className="text-xs font-medium">Banner Ambient (Cabecera)</span>
                        <Badge variant="secondary" className="text-[10px]">Activo</Badge>
                      </div>
                      <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={headerBannerUrl}
                          alt="Banner cabecera"
                          className="h-full w-full object-cover object-right"
                        />
                      </div>
                    </div>
                  )}

                  {sidebarBannerUrl && (
                    <div className="overflow-hidden rounded-xl border bg-muted/20">
                      <div className="p-2.5 border-b bg-card flex items-center justify-between">
                        <span className="text-xs font-medium">Banner Lateral (Sidebar)</span>
                        <Badge variant="secondary" className="text-[10px]">Activo</Badge>
                      </div>
                      <div className="relative h-28 w-full bg-slate-900 overflow-hidden flex items-center justify-center p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sidebarBannerUrl}
                          alt="Banner sidebar"
                          className="max-h-full max-w-full rounded object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empresa (editable form)                                                   */
/* -------------------------------------------------------------------------- */

function EmpresaTab({ tenant }: { tenant: Tenant }) {
  const [form, setForm] = React.useState({
    commercial_name: tenant.commercial_name,
    legal_name: tenant.legal_name ?? '',
    slug: tenant.slug,
    country: tenant.country ?? '',
    currency: tenant.currency,
    language: tenant.language,
    timezone: tenant.timezone,
  });
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<
    { ok: boolean; message: string } | null
  >(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Error al guardar');
      }
      setResult({ ok: true, message: 'Empresa actualizada correctamente.' });
      router.refresh();
    } catch (err: any) {
      setResult({ ok: false, message: err.message ?? 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos de la empresa</CardTitle>
        <CardDescription>
          Edita la información comercial y de configuración regional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre comercial" required>
            <Input
              required
              value={form.commercial_name}
              onChange={(e) =>
                setForm((s) => ({ ...s, commercial_name: e.target.value }))
              }
            />
          </Field>
          <Field label="Razón social">
            <Input
              value={form.legal_name}
              onChange={(e) =>
                setForm((s) => ({ ...s, legal_name: e.target.value }))
              }
            />
          </Field>
          <Field label="Slug" required>
            <Input
              required
              value={form.slug}
              onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
            />
          </Field>
          <Field label="País">
            <Input
              value={form.country}
              onChange={(e) =>
                setForm((s) => ({ ...s, country: e.target.value }))
              }
            />
          </Field>
          <Field label="Moneda">
            <Input
              value={form.currency}
              onChange={(e) =>
                setForm((s) => ({ ...s, currency: e.target.value }))
              }
            />
          </Field>
          <Field label="Idioma">
            <Input
              value={form.language}
              onChange={(e) =>
                setForm((s) => ({ ...s, language: e.target.value }))
              }
            />
          </Field>
          <Field label="Zona horaria">
            <Input
              value={form.timezone}
              onChange={(e) =>
                setForm((s) => ({ ...s, timezone: e.target.value }))
              }
            />
          </Field>

          <div className="col-span-full flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
            {result && (
              <span
                className={cn(
                  'flex items-center gap-1.5 text-sm',
                  result.ok ? 'text-success' : 'text-destructive',
                )}
              >
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {result.message}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Branding                                                                  */
/* -------------------------------------------------------------------------- */

function BrandingTab({
  branding,
  tenant,
}: {
  branding: TenantBranding | null;
  tenant: Tenant;
}) {
  const router = useRouter();
  let initialHeaderBanner = '';
  let initialSidebarBanner = '';
  if (branding?.banner_url) {
    try {
      const p = JSON.parse(branding.banner_url);
      if (p.header) initialHeaderBanner = p.header;
      if (p.sidebar) initialSidebarBanner = p.sidebar;
    } catch {
      initialHeaderBanner = branding.banner_url;
    }
  }

  const [primaryColor, setPrimaryColor] = React.useState(branding?.primary_color ?? '#1a102f');
  const [secondaryColor, setSecondaryColor] = React.useState(branding?.secondary_color ?? '#7c3aed');
  const [accentColor, setAccentColor] = React.useState(branding?.accent_color ?? '#a855f7');
  const [loginBgColor, setLoginBgColor] = React.useState(branding?.login_background_color ?? '#1a0a2e');
  const [fontFamily, setFontFamily] = React.useState(branding?.font_family ?? 'Inter');

  const isSolee = tenant.slug === 'solee';
  const initialLogo = branding?.logo_url && !branding.logo_url.includes('logo.webp') ? branding.logo_url : '';
  const [logoUrl, setLogoUrl] = React.useState(initialLogo);
  const [faviconUrl, setFaviconUrl] = React.useState(branding?.favicon_url ?? '');
  const [headerBannerUrl, setHeaderBannerUrl] = React.useState(initialHeaderBanner);
  const [sidebarBannerUrl, setSidebarBannerUrl] = React.useState(initialSidebarBanner);

  const [uploading, setUploading] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  async function handleFileUpload(type: 'logo' | 'favicon' | 'header_banner' | 'sidebar_banner', file: File) {
    setUploading(type);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch(`/api/admin/tenants/${tenant.id}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al subir imagen');
      }

      const data = await res.json();
      if (type === 'logo') setLogoUrl(data.url);
      if (type === 'favicon') setFaviconUrl(data.url);
      if (type === 'header_banner') setHeaderBannerUrl(data.url);
      if (type === 'sidebar_banner') setSidebarBannerUrl(data.url);

      setResult({ ok: true, message: `Imagen (${type}) subida con éxito. Haz clic en "Guardar identidad visual" para aplicar.` });
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Error en la subida' });
    } finally {
      setUploading(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const bannerPayload = JSON.stringify({
        header: headerBannerUrl || null,
        sidebar: sidebarBannerUrl || null,
      });

      const res = await fetch(`/api/admin/tenants/${tenant.id}/branding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          login_background_color: loginBgColor,
          font_family: fontFamily,
          logo_url: logoUrl || null,
          favicon_url: faviconUrl || null,
          banner_url: bannerPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar branding');
      }

      setResult({ ok: true, message: 'Identidad visual guardada exitosamente.' });
      router.refresh();
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {/* Colores */}
      <Card>
            <CardHeader>
              <CardTitle className="text-base">Paleta de Colores</CardTitle>
              <CardDescription>
                Define los tonos corporativos aplicados en el CRM del tenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Color primario (Sidebar / Fondos oscuros)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color secundario (Botones / Píldoras activas)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border p-1"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color de acento</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border p-1"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Fondo pantalla de login</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={loginBgColor}
                    onChange={(e) => setLoginBgColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border p-1"
                  />
                  <Input
                    value={loginBgColor}
                    onChange={(e) => setLoginBgColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Tipografía</Label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="Inter">Inter (Sans-serif moderna)</option>
                  <option value="Poppins">Poppins (Geométrica amigable)</option>
                  <option value="Roboto">Roboto (Limpia estándar)</option>
                  <option value="Montserrat">Montserrat (Display elegante)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Moderna limpia)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Subida de Imágenes y Recursos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imágenes y Recursos de Marca</CardTitle>
              <CardDescription>
                Sube archivos directamente a almacenamiento en la nube para logos y banners.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Logotipo de la empresa</p>
                    <p className="text-xs text-muted-foreground">PNG, WEBP o SVG transparente</p>
                  </div>
                  {logoUrl && !logoUrl.includes('logo.webp') ? (
                    <div className="flex items-center gap-2">
                      <img src={logoUrl} alt="Logo" className="h-8 max-w-[100px] object-contain rounded" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogoUrl('')}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Quitar
                      </Button>
                    </div>
                  ) : isSolee ? (
                    <div className="rounded-lg bg-[#131126] px-3 py-1.5 text-center">
                      <span className="font-serif text-[11px] tracking-[0.22em] text-white uppercase block leading-none">SOLEÉ</span>
                      <span className="text-[5px] tracking-[0.3em] text-white/50 uppercase block mt-0.5">AROMAS & RELACIONES</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading === 'logo'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('logo', file);
                    }}
                    className="text-xs"
                  />
                  {uploading === 'logo' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>

              {/* Banner superior Ambient */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Banner Superior Ambient (Cabecera CRM)</p>
                    <p className="text-xs text-muted-foreground">Fotografía ambiental o de producto</p>
                  </div>
                  {headerBannerUrl && (
                    <div className="flex items-center gap-2">
                      <img src={headerBannerUrl} alt="Header" className="h-10 w-16 object-cover rounded" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setHeaderBannerUrl('')}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Quitar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading === 'header_banner'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('header_banner', file);
                    }}
                    className="text-xs"
                  />
                  {uploading === 'header_banner' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>

              {/* Banner lateral Sidebar */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Banner Pie de Sidebar</p>
                    <p className="text-xs text-muted-foreground">Imagen vertical o 4:3 para el menú lateral</p>
                  </div>
                  {sidebarBannerUrl && (
                    <div className="flex items-center gap-2">
                      <img src={sidebarBannerUrl} alt="Sidebar" className="h-10 w-14 object-cover rounded" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarBannerUrl('')}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      >
                        Quitar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading === 'sidebar_banner'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('sidebar_banner', file);
                    }}
                    className="text-xs"
                  />
                  {uploading === 'sidebar_banner' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>

              {/* Favicon */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Favicon (Pestaña del navegador)</p>
                    <p className="text-xs text-muted-foreground">Ícono cuadrado 32x32 o 64x64</p>
                  </div>
                  {faviconUrl && (
                    <img src={faviconUrl} alt="Favicon" className="h-6 w-6 object-contain rounded" />
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading === 'favicon'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('favicon', file);
                    }}
                    className="text-xs"
                  />
                  {uploading === 'favicon' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>
            </CardContent>
          </Card>

      {/* Barra de Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar identidad visual
          </Button>

          {result && (
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm',
                result.ok ? 'text-success' : 'text-destructive',
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {result.message}
            </span>
          )}
        </div>

        <Button asChild variant="outline">
          <Link href={`/t/${tenant.slug}?preview=1`} target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir CRM real en nueva pestaña
          </Link>
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Módulos                                                                   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Módulos                                                                   */
/* -------------------------------------------------------------------------- */

function ModulosTab({
  features: initialFeatures,
  tenantId,
}: {
  features: TenantTabsProps['features'];
  tenantId: string;
}) {
  const router = useRouter();
  const [featuresList, setFeaturesList] = React.useState(() => {
    // Merge catalog with initialFeatures
    const catalogKeys = Object.keys(CRM_MODULES_CATALOG);
    const existingMap = new Map(initialFeatures.map((f) => [f.feature_key, f]));

    return catalogKeys.map((key) => {
      const existing = existingMap.get(key);
      const catalogItem = CRM_MODULES_CATALOG[key];
      const cfg = (existing as any)?.config ?? { functions: {} };

      return {
        feature_key: key,
        feature_name: catalogItem?.name ?? existing?.feature_name ?? key,
        feature_category: catalogItem?.category ?? existing?.feature_category ?? 'crm',
        description: catalogItem?.description ?? '',
        enabled: existing?.enabled ?? false,
        config: cfg,
        available_functions: catalogItem?.functions ?? [],
      };
    });
  });

  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  function toggleModule(key: string, enabled: boolean) {
    setFeaturesList((prev) =>
      prev.map((f) => (f.feature_key === key ? { ...f, enabled } : f)),
    );
  }

  function toggleFunction(moduleKey: string, funcKey: string, enabled: boolean) {
    setFeaturesList((prev) =>
      prev.map((f) => {
        if (f.feature_key !== moduleKey) return f;
        const currentFuncs = f.config?.functions ?? {};
        return {
          ...f,
          config: {
            ...f.config,
            functions: {
              ...currentFuncs,
              [funcKey]: enabled,
            },
          },
        };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    setResult(null);
    try {
      const payload = {
        features: featuresList.map((f) => ({
          feature_key: f.feature_key,
          enabled: f.enabled,
          config: f.config,
        })),
      };

      const res = await fetch(`/api/admin/tenants/${tenantId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al guardar módulos');
      }

      setResult({ ok: true, message: 'Módulos y funciones actualizados correctamente.' });
      router.refresh();
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Error al guardar módulos' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div>
          <CardTitle className="text-base">Módulos y Funcionalidades del CRM</CardTitle>
          <CardDescription>
            Habilita o deshabilita módulos y personaliza las funciones activas para este CRM.
          </CardDescription>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cambios
        </Button>
      </CardHeader>

      {result && (
        <div
          className={cn(
            'mx-6 mt-4 flex items-center gap-2 rounded-lg p-3 text-sm',
            result.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
          )}
        >
          {result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {result.message}
        </div>
      )}

      <CardContent className="p-0 divide-y divide-slate-100">
        {featuresList.map((f) => {
          const isExpanded = expandedKey === f.feature_key;
          const funcs = f.available_functions;
          const enabledFuncsCount = funcs.filter(
            (fn) => f.config?.functions?.[fn.key] ?? fn.defaultEnabled,
          ).length;

          return (
            <div key={f.feature_key} className="p-4 transition-colors hover:bg-slate-50/50">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-slate-900 text-sm">
                      {f.feature_name}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {f.feature_category}
                    </Badge>
                    {f.enabled ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/60 text-[10px]">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] text-slate-500">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {f.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {funcs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : f.feature_key)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-purple-600"
                    >
                      <span>{enabledFuncsCount}/{funcs.length} funciones</span>
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={(checked) => toggleModule(f.feature_key, checked)}
                  />
                </div>
              </div>

              {/* Sub-functions accordion */}
              {isExpanded && funcs.length > 0 && (
                <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Funciones disponibles en {f.feature_name}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {funcs.map((fn) => {
                      const isFuncActive = f.config?.functions?.[fn.key] ?? fn.defaultEnabled;
                      return (
                        <div
                          key={fn.key}
                          className="flex items-start justify-between gap-2 rounded-lg bg-white p-2.5 border border-slate-100 shadow-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-slate-800">{fn.name}</p>
                            <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">{fn.description}</p>
                          </div>
                          <Switch
                            disabled={!f.enabled}
                            checked={f.enabled && isFuncActive}
                            onCheckedChange={(checked) => toggleFunction(f.feature_key, fn.key, checked)}
                            className="scale-90 shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Base de datos                                                             */
/* -------------------------------------------------------------------------- */

function BaseDeDatosTab({
  database,
  tenantId,
}: {
  database: TenantDatabase | null;
  tenantId: string;
}) {
  if (!database) {
    return (
      <EmptyCard
        icon={DatabaseIcon}
        title="Sin base de datos configurada"
        description="Esta empresa aún no tiene un proyecto Supabase asociado."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Conexión de base de datos</CardTitle>
            <CardDescription>
              Proyecto Supabase dedicado para los datos de esta empresa.
            </CardDescription>
          </div>
          <ConnectionInline status={database.connection_status} large />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailRow label="Proveedor" value={database.provider} />
            <DetailRow
              label="Project ref"
              value={database.project_ref ?? '—'}
              mono
            />
            <DetailRow
              label="Supabase URL"
              value={database.supabase_url ?? '—'}
              mono
            />
            <DetailRow
              label="Secret ref"
              value={database.secret_ref ?? '—'}
              mono
            />
            <DetailRow
              label="Versión de esquema"
              value={database.schema_version ?? '—'}
            />
            <DetailRow
              label="Última verificación"
              value={
                database.last_checked_at
                  ? formatDateTime(database.last_checked_at)
                  : 'Nunca'
              }
            />
          </dl>

          {database.error_message && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Mensaje de error</p>
                <p className="text-destructive/80">{database.error_message}</p>
              </div>
            </div>
          )}

          <div className="mt-5">
            <TestConnectionButton tenantId={tenantId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TestConnectionButton({ tenantId }: { tenantId: string }) {
  const [state, setState] = React.useState<
    'idle' | 'loading' | 'ok' | 'error'
  >('idle');
  const [message, setMessage] = React.useState('');

  async function runTest() {
    setState('loading');
    setMessage('');
    try {
      const res = await fetch(
        `/api/admin/tenants/${tenantId}/test-connection`,
        { method: 'POST' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? 'Error al probar la conexión');
      }
      setState('ok');
      setMessage(body.message ?? 'Conexión exitosa.');
    } catch (err: any) {
      setState('error');
      setMessage(err.message ?? 'Error al probar la conexión');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={runTest} variant="outline" disabled={state === 'loading'}>
        {state === 'loading' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PlugZap className="mr-2 h-4 w-4" />
        )}
        Probar conexión
      </Button>
      {state === 'ok' && (
        <span className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </span>
      )}
      {state === 'error' && (
        <span className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {message}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Usuarios                                                                  */
/* -------------------------------------------------------------------------- */

function UsuariosTab({
  memberships,
}: {
  memberships: TenantTabsProps['memberships'];
}) {
  if (memberships.length === 0) {
    return (
      <EmptyCard
        icon={UsersIcon}
        title="Sin usuarios asignados"
        description="Esta empresa no tiene miembros todavía."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Miembros de la empresa</CardTitle>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Invitar usuario
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Desde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      {(m.email ?? m.auth_user_id).slice(0, 2)}
                    </span>
                    <div>
                      <p className="font-medium">
                        {m.email ?? 'Sin email'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.auth_user_id.slice(0, 8)}…
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {m.role.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      'border-transparent',
                      m.status === 'active'
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {m.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(m.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dominios                                                                  */
/* -------------------------------------------------------------------------- */

function DominiosTab({ domains }: { domains: TenantDomain[] }) {
  if (domains.length === 0) {
    return (
      <EmptyCard
        icon={Globe}
        title="Sin dominios configurados"
        description="Esta empresa no tiene dominios o subdominios registrados."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Dominios</CardTitle>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Añadir dominio
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Hostname</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Verificación</TableHead>
              <TableHead>Principal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    {d.hostname}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {d.domain_type === 'subdomain' ? 'Subdominio' : 'Personalizado'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      'border-transparent capitalize',
                      d.verification_status === 'verified'
                        ? 'bg-success text-success-foreground'
                        : d.verification_status === 'failed'
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-warning text-warning-foreground',
                    )}
                  >
                    {d.verification_status === 'verified'
                      ? 'Verificado'
                      : d.verification_status === 'failed'
                        ? 'Fallido'
                        : 'Pendiente'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {d.is_primary ? (
                    <Badge className="border-transparent bg-primary text-primary-foreground">
                      Principal
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Auditoría                                                                 */
/* -------------------------------------------------------------------------- */

function AuditoriaTab({ auditLogs }: { auditLogs: AuditLog[] }) {
  if (auditLogs.length === 0) {
    return (
      <EmptyCard
        icon={ScrollText}
        title="Sin registros de auditoría"
        description="No hay eventos registrados para esta empresa todavía."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Eventos recientes</CardTitle>
        <CardDescription>
          Últimas acciones registradas para esta empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fecha</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Recurso</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(log.created_at)}
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {log.action}
                  </code>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.resource ?? '—'}
                  {log.resource_id && (
                    <span className="ml-1 text-xs text-muted-foreground/70">
                      ({log.resource_id.slice(0, 8)}…)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.actor_id ? log.actor_id.slice(0, 8) + '…' : 'Sistema'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared interactive: status actions                                        */
/* -------------------------------------------------------------------------- */

function TenantStatusActions({ tenant }: { tenant: Tenant }) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'ok' | 'error'>(
    'idle',
  );
  const [current, setCurrent] = React.useState(tenant.commercial_status);
  const [message, setMessage] = React.useState('');

  async function updateStatus(next: CommercialStatus) {
    setState('loading');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commercial_status: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? 'Error al actualizar estado');
      }
      setCurrent(next);
      setState('ok');
      setMessage(
        next === 'suspended'
          ? 'Empresa suspendida.'
          : 'Empresa activada.',
      );
    } catch (err: any) {
      setState('error');
      setMessage(err.message ?? 'Error al actualizar estado');
    }
  }

  return (
    <div className="flex items-center gap-2">
      {current === 'suspended' ? (
        <Button
          variant="default"
          size="sm"
          disabled={state === 'loading'}
          onClick={() => updateStatus('active')}
        >
          {state === 'loading' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Activar
        </Button>
      ) : (
        <Button
          variant="destructive"
          size="sm"
          disabled={state === 'loading' || current === 'cancelled'}
          onClick={() => updateStatus('suspended')}
        >
          {state === 'loading' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Ban className="mr-2 h-4 w-4" />
          )}
          Suspender
        </Button>
      )}
      {state === 'ok' && (
        <span className="flex items-center gap-1 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </span>
      )}
      {state === 'error' && (
        <span className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {message}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small shared helpers                                                      */
/* -------------------------------------------------------------------------- */

function ConnectionInline({
  status,
  large,
}: {
  status: ConnectionStatus;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        large ? 'text-base font-medium' : 'text-sm',
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full',
          large ? 'h-3 w-3' : 'h-2.5 w-2.5',
          CONNECTION_DOT[status],
        )}
      />
      {CONNECTION_LABEL[status]}
    </span>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 text-sm',
          mono && 'font-mono text-xs',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- date utils ------------------------------- */

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
