# Multi-Tenancy — EKOSCRM

## Modelo de Aislamiento

EKOSCRM utiliza un modelo de **base de datos por tenant** (database-per-tenant). Cada empresa (tenant) recibe su propio proyecto Supabase con su propia base de datos PostgreSQL, completamente aislada de otros tenants y de la Platform DB.

```
┌─────────────────────────────────────────────────┐
│              Platform DB (Supabase)              │
│  tenants, tenant_databases, tenant_branding,     │
│  tenant_features, tenant_memberships, roles,     │
│  features, plans, audit_logs, demo_requests...   │
└──────────────────────┬──────────────────────────┘
                       │ Gestiona metadatos de:
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Tenant A │ │ Tenant B │ │ Tenant C │
   │ Supabase │ │ Supabase │ │ Supabase │
   │ Project  │ │ Project  │ │ Project  │
   │          │ │          │ │          │
   │ clientes │ │ clientes │ │ clientes │
   │ ventas   │ │ ventas   │ │ ventas   │
   │ pedidos  │ │ pedidos  │ │ pedidos  │
   └──────────┘ └──────────┘ └──────────┘
```

**Ventajas:**
- Aislamiento total de datos: no hay riesgo de cross-tenant leaks
- RLS dentro de la Tenant DB no necesita filtrar por `tenant_id`
- Escalado independiente: cada tenant puede estar en un plan de Supabase diferente
- Backup/restore por tenant sin afectar a la plataforma ni a otros tenants

**Desventajas:**
- Más infraestructura que gestionar (un proyecto Supabase por tenant)
- Las migraciones deben aplicarse a toda la flota de tenants
- El provisioning de un nuevo tenant requiere crear un proyecto Supabase manualmente

---

## Hosts y Rutas

### Estructura de URLs

| Ruta | Descripción | Acceso |
|------|-------------|--------|
| `/` | Landing page pública con formulario de demo | Público |
| `/login` | Inicio de sesión | Público (redirige si hay sesión) |
| `/admin` | Dashboard de super admin | Solo `super_admin` |
| `/admin/tenants` | Listado de empresas | Solo `super_admin` |
| `/admin/tenants/new` | Wizard de creación de tenant (7 pasos) | Solo `super_admin` |
| `/admin/tenants/[id]` | Detalle del tenant con tabs | Solo `super_admin` |
| `/admin/modules` | Catálogo de módulos | Solo `super_admin` |
| `/admin/plans` | Planes de suscripción | Solo `super_admin` |
| `/admin/users` | Usuarios de plataforma | Solo `super_admin` |
| `/admin/audit` | Auditoría de plataforma | Solo `super_admin` |
| `/t/[slug]` | Dashboard del CRM del tenant | Autenticado + membresía |
| `/t/[slug]/customers` | Clientes del tenant | Autenticado + membresía |
| `/t/[slug]/products` | Productos del tenant | Autenticado + membresía |
| `/t/[slug]/sales` | Ventas del tenant | Autenticado + membresía |
| `/t/[slug]/orders` | Pedidos del tenant | Autenticado + membresía |
| `/t/[slug]/tasks` | Tareas del tenant | Autenticado + membresía |
| `/t/[slug]/segments` | Segmentos del tenant | Autenticado + membresía |
| `/t/[slug]/campaigns` | Campañas del tenant | Autenticado + membresía |
| `/t/[slug]/capture` | Captura QR | Autenticado + membresía |
| `/t/[slug]/settings` | Configuración del tenant | Autenticado + membresía |
| `/t/[slug]/shopify` | Integración Shopify (placeholder) | Autenticado + membresía |
| `/t/[slug]/siigo` | Integración SIIGO (placeholder) | Autenticado + membresía |
| `/t/[slug]/predictive` | Predictivo de recompra (placeholder) | Autenticado + membresía |

### Resolución de Tenant

El tenant se resuelve por el **slug** en la URL (`/t/[slug]/...`). El layout `app/t/[slug]/layout.tsx`:

1. Verifica la sesión del usuario
2. Busca el tenant en la Platform DB por `slug`
3. Si no existe → muestra página "Sin acceso"
4. Verifica la membresía del usuario en `tenant_memberships` (status = `active`)
5. Si no tiene membresía pero es `super_admin` → entra en **modo vista previa**
6. Si el tenant está `suspended` o `cancelled` y no es vista previa → muestra "Cuenta suspendida"
7. Carga el branding y los features habilitados
8. Inyecta los colores del tenant como CSS custom properties

### Fallback Paths

| Condición | Resultado |
|-----------|-----------|
| No autenticado en `/t/*` | Redirect a `/login` (con `?redirect=/t/[slug]`) |
| Autenticado sin membresía ni super_admin | Página "Sin acceso" |
| Autenticado sin membresía pero con super_admin | Vista previa con banner "Vista previa Super Admin" |
| Tenant no existe (slug inválido) | Página "Sin acceso" |
| Tenant suspendido/cancelado (sin vista previa) | Página "Cuenta suspendida" |
| No autenticado en `/admin/*` | Redirect a `/login?redirect=/admin` |
| Autenticado sin super_admin en `/admin/*` | Redirect a `/login` (vía `requireSuperAdmin`) |
| Autenticado en `/login` | Redirect a `/admin` |

---

## Membresías

### `tenant_memberships`

La membresía vincula un usuario de Supabase Auth (`auth.users.id`) con un tenant y un rol:

```typescript
{
  tenant_id: uuid,       // FK → tenants.id
  auth_user_id: uuid,    // ID en auth.users
  role: string,          // 'tenant_admin' | 'comercial' | 'atencion'
  status: string,        // 'active' | 'inactive'
}
```

**Constraint:** `UNIQUE(tenant_id, auth_user_id)` — un usuario solo puede tener un rol por tenant.

### Asignación de membresía

El endpoint `POST /api/admin/tenants/[id]/membership` maneja dos casos:

1. **El usuario ya existe en auth.users** → crea o actualiza la membresía con `status: 'active'`
2. **El usuario no existe** → crea una invitación en `tenant_invitations` con `status: 'pending'` y expiración de 7 días. Cuando el usuario se registre, la membresía se activará.

> **Nota Sprint 1:** No se envían emails de invitación. El flujo de aceptación de invitaciones estará en un sprint posterior.

### Resolución de membresía en el layout

```typescript
// app/t/[slug]/layout.tsx (simplificado)
const hasMembership = !!membership;
const isPreview = admin && !hasMembership;

if (!hasMembership && !admin) {
  return <NoAccessPage />;
}
```

---

## Cache

### Sprint 1 — Sin cache

En Sprint 1 no hay capa de cache. Cada request a `/t/[slug]/*` ejecuta queries directamente contra la Platform DB para resolver:

1. El tenant por slug
2. La membresía del usuario
3. El branding del tenant
4. Los features habilitados

### Futuro

Se planea implementar cache a nivel de:
- **Branding por tenant** — raramente cambia, ideal para cache en edge
- **Features habilitados por tenant** — cambia solo desde el panel admin
- **Resolución de slug → tenant_id** — inmutable una vez creado

---

## Cookies

### Cookie de sesión

Supabase Auth gestiona la sesión mediante la cookie `sb-access-token` (JWT). El middleware de Next.js la lee en cada request a rutas protegidas.

**Flujo:**

1. **Cliente:** `supabase.auth.signInWithPassword()` → Supabase setea `sb-access-token` como cookie httpOnly
2. **Middleware:** Lee `sb-access-token`, valida con `supabase.auth.getUser()`
3. **Server components:** `getSupabaseServerClient()` reenvía todas las cookies vía `next/headers` para preservar la sesión en SSR

**Características:**
- La cookie es gestionada por `@supabase/supabase-js` automáticamente
- `persistSession: true` en el cliente, `persistSession: false` en el server
- El middleware usa `autoRefreshToken: false` y `detectSessionInUrl: false` para validación stateless

### Configuración por cliente

| Cliente | persistSession | autoRefreshToken | detectSessionInUrl |
|---------|---------------|-----------------|-------------------|
| Client (`supabase-client.ts`) | true | true | true |
| Server (`supabase-server.ts`) | false | false | false |
| Middleware (`middleware.ts`) | false | false | false |

---

## Dominios Personalizados

### Sprint 1 — Preparado pero no operativo

La tabla `tenant_domains` existe y soporta:

- `domain_type`: `subdomain` (ej. `cliente.ekoscrm.app`) o `custom` (ej. `crm.cliente.com`)
- `verification_status`: `pending`, `verified`, `failed`
- `is_primary`: marca el dominio principal

Sin embargo, **no hay resolución DNS activa ni middleware de dominios personalizados** en Sprint 1. Todos los tenants se acceden via `/t/[slug]/*`.

### Futuro

Se planea un middleware que:
1. Detecte el host de la request
2. Si el host coincide con un `hostname` en `tenant_domains`, resuelva el tenant
3. Sirva el CRM del tenant en el dominio personalizado
4. Si no coincide, sirva la landing page de EKOSCRM
