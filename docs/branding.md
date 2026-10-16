# Branding — EKOSCRM

## Visión General

EKOSCRM tiene dos capas de identidad visual: la **identidad global de EKOSCRM** (la plataforma) y el **branding por tenant** (cada empresa). Ambas conviven: la plataforma usa su propia marca en el panel de super admin y la landing page, mientras que cada tenant ve su propia marca en su shell del CRM.

---

## Identidad Global de EKOSCRM

### Paleta de colores global

| Color | Hex | Uso |
|-------|-----|-----|
| Primary (azul marino) | `#042071` | Sidebar del admin, headers, botones primarios, fondo del login |
| Accent (turquesa) | `#63DCE5` | Acentos, highlights, indicadores |
| Accent alt (azul claro) | `#00AFEF` | Acentos secundarios, botones de CTA |
| White | `#FFFFFF` | Fondos de tarjetas, texto sobre oscuro |

Estos colores están definidos como CSS variables en `tailwind.config.ts` y `globals.css`:

```css
--primary: 225 93% 23%;      /* #042071 */
--accent: 184 71% 64%;       /* #63DCE5 */
```

### Tipografía global

- **Fuente:** Inter (cargada via `next/font/google`)
- Usada en toda la plataforma: landing, login, panel admin

### Logo EKOSCRM

El componente `EkosLogo` (`components/ekos-logo.tsx`) renderiza el logo de EKOSCRM. Se usa en:
- Header de la landing page
- Página de login
- Sidebar del panel de super admin
- Footer

El logo es siempre el de EKOSCRM, independientemente del contexto. Los tenants no reemplazan el logo de EKOSCRM en el panel admin — solo en su propio shell del CRM.

---

## Branding por Tenant

### Tabla `tenant_branding`

Cada tenant tiene una fila única en `tenant_branding` (relación 1:1 con `tenants`):

| Campo | Default | Descripción |
|-------|---------|-------------|
| `primary_color` | `#042071` | Color primario del tenant |
| `secondary_color` | `#63DCE5` | Color secundario |
| `accent_color` | `#00AFEF` | Color de acento |
| `font_family` | `Inter` | Tipografía (Inter, Poppins, Roboto, Montserrat) |
| `login_background_color` | `#042071` | Color de fondo del login del tenant |
| `logo_url` | null | URL del logo del tenant |
| `favicon_url` | null | URL del favicon |
| `banner_url` | null | URL del banner |

### Validación

El endpoint `POST /api/admin/tenants/[id]/branding` valida:

- **Colores:** Regex hex `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`
- **Fuente:** Allowlist — `Inter`, `Poppins`, `Roboto`, `Montserrat`

```typescript
const ALLOWED_FONTS = ['Inter', 'Poppins', 'Roboto', 'Montserrat'];
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
```

---

## Cómo Funciona el Branding en Runtime

### 1. Resolución

El layout del tenant (`app/t/[slug]/layout.tsx`) carga el branding desde la Platform DB:

```typescript
const { data: branding } = await supabase
  .from('tenant_branding')
  .select('primary_color, secondary_color, accent_color, logo_url')
  .eq('tenant_id', tenant.id)
  .maybeSingle();

const primaryColor = branding?.primary_color ?? '#042071';
const secondaryColor = branding?.secondary_color ?? '#63DCE5';
const accentColor = branding?.accent_color ?? '#63DCE5';
```

Si el tenant no tiene branding configurado, se usan los defaults de EKOSCRM.

### 2. Inyección como CSS Custom Properties

Los colores se inyectan como CSS custom properties en el wrapper del CRM:

```typescript
const wrapperStyle = {
  '--crm-primary': primaryColor,
  '--crm-secondary': secondaryColor,
  '--crm-accent': accentColor,
} as React.CSSProperties;

return (
  <div className="min-h-screen bg-background" style={wrapperStyle}>
    {/* ... */}
  </div>
);
```

### 3. Uso en el Sidebar

El componente `CrmSidebar` recibe los colores como props y los aplica directamente:

```typescript
<CrmSidebar
  tenantId={tenant.id}
  slug={tenant.slug}
  tenantName={tenant.commercial_name}
  logoUrl={logoUrl}
  primaryColor={primaryColor}
  secondaryColor={secondaryColor}
  accentColor={accentColor}
  enabledFeatures={enabledFeatures}
  userRole={userRole}
  isPreview={isPreview}
/>
```

El sidebar usa `primaryColor` como fondo, mostrando el `logoUrl` del tenant si existe, o las iniciales del nombre comercial si no.

### 4. Vista Previa en el Wizard

El paso 3 del wizard (Branding) incluye una vista previa en tiempo real que muestra:

- Header con `login_background_color` y el nombre del tenant
- Botón primario con `primary_color`
- Botón secundario con borde en `secondary_color`
- Botón de acento con `accent_color`
- Mockup de tarjeta con la `font_family` aplicada

---

## Tenants Demo

### SOLEÉ (Retail / Ecommerce)

| Campo | Valor |
|-------|-------|
| `primary_color` | `#4a1d6e` (morado) |
| `secondary_color` | `#63DCE5` (turquesa) |
| Tipo | Retail / Ecommerce |
| Plantilla | `retail_ecommerce` |

La landing page muestra una preview con gradiente morado→azul marino.

### Empresa Demo (Servicios)

| Campo | Valor |
|-------|-------|
| `primary_color` | `#0d7a4e` (verde) |
| `secondary_color` | `#a8e6cf` (verde claro) |
| Tipo | Servicios |
| Plantilla | `services` |

La landing page muestra una preview con gradiente verde→verde oscuro.

> **Nota:** Estas previews en la landing son ilustrativas de la capacidad de branding y no representan clientes reales ni casos de éxito. El texto lo aclara explícitamente: "Previews de configuración. No representan casos de éxito ni clientes reales."

---

## Separación de Capas

```
┌─────────────────────────────────────────────┐
│              Identidad EKOSCRM                │
│  (Landing, Login, Panel Super Admin)         │
│  Colores: #042071, #63DCE5, #00AFEF          │
│  Logo: EkosLogo                              │
│  Fuente: Inter                               │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐     ┌───────────────┐
│   Tenant A    │     │   Tenant B    │
│  (SOLEÉ)      │     │(Empresa Demo) │
│               │     │               │
│ #4a1d6e       │     │ #0d7a4e       │
│ #63DCE5       │     │ #a8e6cf       │
│ Logo: A       │     │ Logo: B       │
│ Font: Inter   │     │ Font: Poppins │
└───────────────┘     └───────────────┘
```

El panel de super admin siempre usa la identidad de EKOSCRM. El CRM del tenant (`/t/[slug]/*`) usa la identidad del tenant. Esto crea una separación visual clara: el operador de EKOSCRM sabe que está en la plataforma, y el cliente del tenant ve su propia marca.
