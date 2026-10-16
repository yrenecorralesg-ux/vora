# EKOSCRM

Plataforma CRM modular multi-tenant de EKOS Solutions. Cada empresa opera con su propia marca, módulos y base de datos dedicada.

> **Sprint 1 — Starter funcional:** Landing, autenticación, panel de super admin, wizard de creación de tenants, shell del CRM con datos demo, feature flags y branding.

---

## Stack

- **Next.js 13.5** (App Router, TypeScript)
- **Supabase** (PostgreSQL, Auth, RLS)
- **Tailwind CSS 3.3** + **shadcn/ui** (Radix UI)
- **lucide-react** (iconos)
- **recharts** (gráficos)

---

## Estructura del Proyecto

```
.
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Inicio de sesión
│   ├── layout.tsx                  # Root layout (AuthProvider)
│   ├── admin/                      # Panel de super admin
│   │   ├── page.tsx                # Dashboard
│   │   ├── layout.tsx              # Layout con sidebar
│   │   ├── tenants/                # Listado, wizard, detalle
│   │   ├── modules/                # Catálogo de módulos
│   │   ├── plans/                  # Planes
│   │   ├── users/                  # Usuarios
│   │   └── audit/                  # Auditoría
│   ├── api/admin/tenants/          # API routes CRUD
│   │   ├── route.ts                # POST/GET tenants
│   │   └── [id]/                   # GET/PATCH + sub-rutas
│   │       ├── branding/
│   │       ├── database/
│   │       ├── features/
│   │       ├── membership/
│   │       ├── status/
│   │       └── test-connection/
│   └── t/[slug]/                   # Shell del CRM por tenant
│       ├── layout.tsx              # Resolución de tenant + branding
│       ├── page.tsx                # Dashboard
│       ├── customers/
│       ├── products/
│       ├── sales/
│       ├── orders/
│       ├── tasks/
│       ├── segments/
│       ├── campaigns/
│       ├── capture/
│       ├── settings/
│       ├── shopify/                # Placeholder
│       ├── siigo/                  # Placeholder
│       └── predictive/             # Placeholder
├── components/
│   ├── auth-provider.tsx           # Contexto de auth (client)
│   ├── ekos-logo.tsx               # Logo EKOSCRM
│   ├── crm-sidebar.tsx             # Sidebar del CRM con branding
│   ├── tenant-tabs.tsx             # Tabs del detalle de tenant
│   ├── tenants-table.tsx           # Tabla de listado de tenants
│   ├── demo-banner.tsx             # Banner "Datos demo"
│   ├── admin-logout.tsx            # Botón de logout
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── auth.ts                     # requireSession, isSuperAdmin, memberships
│   ├── supabase-client.ts          # Cliente navegador (anon key)
│   ├── supabase-server.ts          # Server client + service client
│   ├── types.ts                    # Tipos TypeScript
│   ├── demo-data.ts                # Fixtures de datos demo
│   └── utils.ts                    # cn() helper
├── middleware.ts                   # Protección de rutas /admin, /t, /login
├── supabase/migrations/            # Migraciones SQL de Platform DB
├── docs/                           # Documentación del proyecto
└── .env.example                    # Template de variables de entorno
```

---

## Setup

### 1. Clonar e instalar

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Aplicar migraciones a Supabase

Las migraciones se encuentran en `supabase/migrations/`:

- **Esquema consolidado (recomendado para proyectos nuevos):**
  - `20261006000000_initial_schema.sql` — Esquema inicial completo (18 tablas, RLS, triggers, seeds, demo tenants y bootstrap super admin)

- **Historial incremental:**
  1. `001_platform_core_schema.sql`
  2. `002_seed_reference_data.sql`
  3. `003_add_business_type_to_tenants.sql.sql`
  4. `004_seed_demo_tenants.sql`
  5. `005_lockdown_platform_grants.sql`
  6. `006_demo_requests_through_server.sql`
  7. `007_bootstrap_super_admin.sql`
  8. `fix_super_admin_role_lookup.sql`

### 4. Configurar Supabase Auth

En Supabase Dashboard → Authentication → Settings:
- **Confirm email:** OFF
- **Enable email provider:** ON

### 5. Crear el primer super admin

1. En Supabase Dashboard → Authentication → Users → "Add user"
2. Crear usuario con email y contraseña
3. Obtener el UUID del usuario
4. Ejecutar en SQL Editor:

```sql
INSERT INTO platform_user_roles (user_id, role_id)
SELECT
  '<UUID-DEL-USUARIO>'::uuid,
  id FROM platform_roles WHERE key = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

### 6. Iniciar

```bash
npm run dev
```

Ir a `http://localhost:3000`, iniciar sesión en `/login`.

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check (tsc --noEmit) |

---

## Variables de Entorno

### Públicas (navegador)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la Platform DB |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (sujeta a RLS) |

### Privadas (server-only)

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypassa RLS) |

### Por Tenant (server-only, requiere redeploy)

| Patrón | Descripción |
|--------|-------------|
| `TENANT_<UUID>_SUPABASE_URL` | URL del proyecto Supabase del tenant |
| `TENANT_<UUID>_SUPABASE_SERVER_KEY` | Service role key del tenant |

Ver `docs/environment.md` para detalles.

---

## Bootstrap del Primer Admin

1. Crear usuario en Supabase Dashboard → Authentication → Users
2. Asignar rol `super_admin` via SQL (ver arriba)
3. Iniciar sesión en `/login`
4. Acceder a `/admin`

> No hay signup público. Todos los usuarios son creados por el super admin o vía Supabase Dashboard.

---

## Seeds

Los datos de referencia se insertan en la migración `002_seed_reference_data.sql`:

- **3 plantillas:** retail_ecommerce, services, general_crm
- **15 features:** 9 implementadas (CRM core + captura QR), 6 planificadas (Shopify, SIIGO, email, chatbot, automatización, predictivo)
- **4 roles:** super_admin, tenant_admin, comercial, atencion
- **24 permisos:** Matriz role × permission
- **2 planes:** Starter, Growth

El seed es idempotente (`ON CONFLICT DO UPDATE/NOTHING`) y puede re-ejecutarse.

---

## Despliegue

### Vercel (recomendado)

1. Conectar repositorio a Vercel
2. Configurar variables de entorno en Settings → Environment Variables
3. Deploy automático en push a `main`

### Netlify (alternativo)

El proyecto incluye `netlify.toml` y `@netlify/plugin-nextjs`.

Ver `docs/deployment.md` para detalles completos.

---

## Modelo Multi-Tenant

- **Platform DB:** Un único proyecto Supabase con 18 tablas de metadatos
- **Tenant DB:** Un proyecto Supabase dedicado por empresa (datos CRM)
- **Aislamiento:** Cada tenant tiene su propia base de datos, completamente separada
- **Rutas:** `/t/[slug]/*` para el CRM del tenant
- **Branding:** Cada tenant tiene sus propios colores, fuente y logo

Ver `docs/multitenancy.md` y `docs/architecture.md` para detalles.

---

## Limitaciones de Sprint 1

- **Datos del CRM son demo:** Todos los datos en `/t/[slug]/*` provienen de fixtures estáticos (`lib/demo-data.ts`), no de Tenant DBs reales
- **Sin integraciones reales:** Shopify, SIIGO y Predictivo son placeholders
- **Sin WhatsApp ni chatbot:** No implementados
- **Sin invitaciones por email:** Las invitaciones se guardan pero no se envían
- **Secret management via env vars:** Añadir/cambiar claves de tenant requiere redeploy
- **Sin dominios personalizados:** La tabla existe pero no hay resolución DNS
- **Sin CRUD comercial real:** Las Tenant DBs no tienen esquema aplicado

Ver `docs/handoff.md` para el estado completo y próximos sprints.

---

## Documentación

| Archivo | Descripción |
|---------|-------------|
| `docs/architecture.md` | Arquitectura Platform vs Tenant, auth, límites |
| `docs/database.md` | ERD, diccionario de datos, enums |
| `docs/multitenancy.md` | Hosts, rutas, membresías, cookies, dominios |
| `docs/security.md` | Permisos, RLS, claves, endpoints, auditoría |
| `docs/feature-flags.md` | Catálogo, dependencias, estados |
| `docs/branding.md` | Identidad global vs tenant, cómo funciona |
| `docs/onboarding.md` | Setup manual + wizard de 7 pasos |
| `docs/migrations.md` | Versionamiento y estrategia de flota |
| `docs/environment.md` | Variables de entorno públicas y privadas |
| `docs/deployment.md` | Vercel, Supabase, staging, DNS, rollback |
| `docs/handoff.md` | Estado del proyecto, pendientes, próximos sprints |
| `docs/client-validation.md` | Liberación por módulo, feedback, aceptación |
