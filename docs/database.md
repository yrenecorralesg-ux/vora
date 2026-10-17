> Documento histórico. Para el flujo y arquitectura vigentes consulta [VORA Core progresivo](./vora-core-progressive.md). Las descripciones de un Supabase obligatorio por empresa y del asistente de siete pasos ya no aplican.

# Base de Datos — VORA

## Visión General

VORA utiliza un modelo de **dos niveles de bases de datos**:

1. **Platform DB** — Un único proyecto Supabase central con 18 tablas que almacenan metadatos de administración, identidad, configuración y provisioning de tenants.
2. **Tenant DB** — Un proyecto Supabase dedicado por cada empresa tenant, para almacenar sus datos comerciales (CRM). En Sprint 1 estas bases de datos no tienen esquema aplicado; el shell del CRM usa datos demo estáticos.

---

## ERD — Platform DB

### Relaciones principales

```
business_templates 1───* tenants (business_template_id FK)
plans 1───* tenants (plan_id FK)
plans 1───* tenant_subscriptions (plan_id FK)

tenants 1───1 tenant_databases (tenant_id UNIQUE)
tenants 1───1 tenant_branding (tenant_id UNIQUE)
tenants 1───1 tenant_subscriptions (tenant_id UNIQUE)
tenants 1───* tenant_features (tenant_id)
tenants 1───* tenant_memberships (tenant_id)
tenants 1───* tenant_domains (tenant_id)
tenants 1───* tenant_invitations (tenant_id)
tenants 1───* platform_audit_logs (tenant_id, ON DELETE SET NULL)
tenants 1───* migration_runs (tenant_id, ON DELETE SET NULL)

features (PK: key) ───* tenant_features (feature_key FK, ON DELETE CASCADE)
platform_roles 1───* platform_user_roles (role_id FK, ON DELETE CASCADE)
```

### Diagrama de entidades

```
┌─────────────────────┐     ┌──────────────────────┐
│ business_templates  │     │       features        │
│─────────────────────│     │──────────────────────│
│ id (PK, uuid)       │     │ key (PK, text)        │
│ key (UNIQUE, text)  │     │ name (text)           │
│ name (text)         │     │ category (text)       │
│ description (text)  │     │ dependencies (text[]) │
│ suggested_features  │     │ implementation_status │
│   (text[])          │     │ sort_order (int)      │
└─────────────────────┘     └──────────────────────┘
          │                           │
          │ business_template_id      │ feature_key
          ▼                           ▼
┌───────────────────────────────────────────────────┐
│                      tenants                       │
│───────────────────────────────────────────────────│
│ id (PK, uuid)                                      │
│ commercial_name (text, NOT NULL)                   │
│ legal_name (text)                                  │
│ slug (UNIQUE, text, NOT NULL)                      │
│ commercial_status (enum)                           │
│ technical_status (enum)                            │
│ country, currency, language, timezone              │
│ business_type (text)                               │
│ business_template_id (FK → business_templates)     │
│ plan_id (FK → plans)                               │
│ wizard_step (int, default 1)                       │
│ wizard_completed (bool, default false)             │
│ created_at, updated_at                             │
└───────────────────────────────────────────────────┘
          │
          ├────── 1:1 ──→ tenant_databases
          ├────── 1:1 ──→ tenant_branding
          ├────── 1:1 ──→ tenant_subscriptions
          ├────── 1:* ──→ tenant_features
          ├────── 1:* ──→ tenant_memberships
          ├────── 1:* ──→ tenant_domains
          ├────── 1:* ──→ tenant_invitations
          └────── 1:* ──→ platform_audit_logs

┌─────────────────────┐     ┌──────────────────────┐
│   platform_roles    │     │       plans           │
│─────────────────────│     │──────────────────────│
│ id (PK, uuid)       │     │ id (PK, uuid)         │
│ key (UNIQUE, text)  │     │ name (text)           │
│ name (text)         │     │ description (text)    │
│ scope (text)        │     │ limits (jsonb)        │
└─────────────────────┘     │ is_active (bool)      │
          │                 └──────────────────────┘
          │ role_id
          ▼
┌─────────────────────┐
│ platform_user_roles │     ┌──────────────────────┐
│─────────────────────│     │  role_permissions    │
│ id (PK, uuid)       │     │──────────────────────│
│ user_id (uuid)      │     │ id (PK, uuid)         │
│ role_id (FK)        │     │ role_key (text)       │
│ assigned_by (uuid)  │     │ permission (text)     │
│ created_at          │     │ scope (text)          │
│ UNIQUE(user_id,     │     │ UNIQUE(role_key,perm) │
│   role_id)          │     └──────────────────────┘
└─────────────────────┘

┌─────────────────────┐     ┌──────────────────────┐
│ tenant_memberships  │     │ tenant_invitations   │
│─────────────────────│     │──────────────────────│
│ id (PK, uuid)       │     │ id (PK, uuid)        │
│ tenant_id (FK)      │     │ tenant_id (FK)       │
│ auth_user_id (uuid) │     │ email (text)         │
│ role (text)         │     │ role (text)          │
│ status (text)       │     │ status (enum)        │
│ created_at          │     │ token_hash (text)    │
│ UNIQUE(tenant_id,   │     │ invited_by (uuid)    │
│   auth_user_id)     │     │ expires_at           │
└─────────────────────┘     └──────────────────────┘
```

---

## Diccionario de Datos

### `tenants`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Identificador único del tenant |
| `commercial_name` | text | NO | — | Nombre comercial de la empresa |
| `legal_name` | text | SÍ | — | Razón social |
| `slug` | text | NO | — | Identificador URL-único (solo minúsculas, números, guiones) |
| `commercial_status` | `commercial_status` enum | NO | `'trial'` | Estado comercial: trial, active, suspended, cancelled |
| `technical_status` | `technical_status` enum | NO | `'pending_setup'` | Estado técnico: pending_setup, ready, error |
| `country` | text | SÍ | — | País (código: CO, MX, AR, etc.) |
| `currency` | text | NO | `'COP'` | Moneda (COP, MXN, USD, EUR, etc.) |
| `language` | text | NO | `'es'` | Idioma (es, en, pt) |
| `timezone` | text | NO | `'America/Bogota'` | Zona horaria IANA |
| `business_type` | text | SÍ | — | Tipo de negocio (retail, ecommerce, services, etc.) |
| `business_template_id` | uuid FK | SÍ | — | Referencia a `business_templates.id` |
| `plan_id` | uuid FK | SÍ | — | Referencia a `plans.id` |
| `wizard_step` | int | NO | `1` | Paso actual del wizard (1-7) |
| `wizard_completed` | bool | NO | `false` | Si el wizard fue completado |
| `created_at` | timestamptz | NO | `now()` | Fecha de creación |
| `updated_at` | timestamptz | NO | `now()` | Última actualización (auto-trigger) |

### `tenant_databases`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `tenant_id` | uuid FK UNIQUE | NO | — | Referencia única a `tenants.id` |
| `provider` | text | NO | `'supabase'` | Proveedor de DB (siempre supabase) |
| `project_ref` | text | SÍ | — | Project Reference ID de Supabase |
| `supabase_url` | text | SÍ | — | URL base del proyecto (`https://xyz.supabase.co`) |
| `secret_ref` | text | SÍ | — | Identificador opaco del secreto (NO la clave real) |
| `connection_status` | `connection_status` enum | NO | `'not_configured'` | not_configured, checking, connected, error |
| `schema_version` | text | SÍ | — | Versión del esquema aplicado en la Tenant DB |
| `expected_tenant_id` | uuid | SÍ | — | UUID esperado del tenant en su propia DB (validación) |
| `last_checked_at` | timestamptz | SÍ | — | Última verificación de conexión |
| `error_message` | text | SÍ | — | Mensaje de error si la conexión falló |

### `tenant_branding`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `tenant_id` | uuid FK UNIQUE | NO | — | Referencia única a `tenants.id` |
| `logo_url` | text | SÍ | — | URL del logo del tenant |
| `favicon_url` | text | SÍ | — | URL del favicon |
| `primary_color` | text | NO | `'#042071'` | Color primario (hex) |
| `secondary_color` | text | NO | `'#63DCE5'` | Color secundario (hex) |
| `accent_color` | text | NO | `'#00AFEF'` | Color de acento (hex) |
| `font_family` | text | NO | `'Inter'` | Tipografía (Inter, Poppins, Roboto, Montserrat) |
| `login_background_color` | text | NO | `'#042071'` | Color de fondo del login (hex) |
| `banner_url` | text | SÍ | — | URL del banner |

### `tenant_features`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `tenant_id` | uuid FK | NO | — | Referencia a `tenants.id` |
| `feature_key` | text FK | NO | — | Referencia a `features.key` |
| `enabled` | bool | NO | `false` | Si el módulo está activado |
| `config` | jsonb | NO | `'{}'` | Configuración específica del módulo |
| `config_state` | `feature_config_state` enum | NO | `'enabled'` | enabled, pending_config, configured, operational |
| `release_status` | `release_status` enum | NO | `'planned'` | planned, in_development, released_for_testing, accepted, accepted_with_pending |
| `created_at` | timestamptz | NO | `now()` | — |
| `updated_at` | timestamptz | NO | `now()` | Auto-trigger |

**Constraint:** `UNIQUE(tenant_id, feature_key)` — un tenant no puede tener duplicados del mismo feature.

### `tenant_memberships`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `tenant_id` | uuid FK | NO | — | Referencia a `tenants.id` |
| `auth_user_id` | uuid | NO | — | UUID del usuario en `auth.users` |
| `role` | text | NO | `'tenant_admin'` | Rol dentro del tenant (tenant_admin, comercial, atencion) |
| `status` | text | NO | `'active'` | active, inactive |
| `created_at` | timestamptz | NO | `now()` | — |

**Constraint:** `UNIQUE(tenant_id, auth_user_id)` — un usuario no puede tener dos membresías al mismo tenant.

### `platform_user_roles`

| Columna | Tipo | Nullable | Default | Descripción |
|---------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | UUID del usuario en `auth.users` |
| `role_id` | uuid FK | NO | — | Referencia a `platform_roles.id` |
| `assigned_by` | uuid | SÍ | — | UUID del admin que asignó el rol |
| `created_at` | timestamptz | NO | `now()` | — |

**Constraint:** `UNIQUE(user_id, role_id)`.

### `platform_roles`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `key` | text UNIQUE | NO | Clave del rol (super_admin, tenant_admin, comercial, atencion) |
| `name` | text | NO | Nombre legible |
| `description` | text | SÍ | Descripción |
| `scope` | text | NO | Ámbito (platform, tenant) |

### `role_permissions`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `role_key` | text | NO | Clave del rol |
| `permission` | text | NO | Permiso (ej. `tenant.create`, `crm.customers`) |
| `scope` | text | NO | platform o tenant |

**Constraint:** `UNIQUE(role_key, permission)`.

### `features` (Catálogo de módulos)

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `key` | text | NO | PK (ej. `crm.dashboard`, `integration.siigo`) |
| `name` | text | NO | Nombre legible |
| `description` | text | NO | Descripción del módulo |
| `category` | text | NO | Categoría: crm, integration, channel, automation, analytics |
| `dependencies` | text[] | NO | Features que deben estar activadas primero |
| `implementation_status` | enum | NO | implemented, planned, unavailable |
| `sort_order` | int | NO | Orden de visualización |

### `business_templates`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `key` | text UNIQUE | NO | retail_ecommerce, services, general_crm |
| `name` | text | NO | Nombre legible |
| `description` | text | NO | Descripción |
| `suggested_features` | text[] | NO | Features sugeridas al seleccionar esta plantilla |

### `plans`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `name` | text | NO | Nombre del plan (Starter, Growth) |
| `description` | text | SÍ | — |
| `limits` | jsonb | NO | Límites del plan (max_users, max_customers, etc.) |
| `is_active` | bool | NO | Si el plan está disponible |

### `tenant_domains`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `tenant_id` | uuid FK | NO | Referencia a `tenants.id` |
| `hostname` | text UNIQUE | NO | Nombre de host del dominio |
| `domain_type` | enum | NO | subdomain, custom |
| `verification_status` | enum | NO | pending, verified, failed |
| `is_primary` | bool | NO | Si es el dominio principal |

### `tenant_invitations`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `tenant_id` | uuid FK | NO | Referencia a `tenants.id` |
| `email` | text | NO | Email del invitado |
| `role` | text | NO | Rol asignado (default: tenant_admin) |
| `status` | `invitation_status` enum | NO | pending, accepted, expired, revoked |
| `token_hash` | text | NO | Hash SHA-256 del token de invitación |
| `invited_by` | uuid | SÍ | UUID del admin que invitó |
| `expires_at` | timestamptz | NO | Fecha de expiración (7 días) |
| `accepted_at` | timestamptz | SÍ | Fecha de aceptación |
| `accepted_by` | uuid | SÍ | UUID del usuario que aceptó |

**Constraint:** `UNIQUE(tenant_id, email)`.

### `schema_versions`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `scope` | `db_scope` enum | NO | platform, tenant |
| `version` | text | NO | Número de versión (ej. `001`) |
| `name` | text | NO | Nombre descriptivo |
| `description` | text | SÍ | — |
| `applied_at` | timestamptz | NO | Fecha de aplicación |

**Constraint:** `UNIQUE(scope, version)`.

### `migration_runs`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `scope` | `db_scope` enum | NO | platform, tenant |
| `tenant_id` | uuid FK | SÍ | Tenant afectado (NULL si es platform) |
| `version` | text | NO | Versión de la migración |
| `status` | `migration_status` enum | NO | pending, running, completed, failed, rolled_back |
| `started_at` | timestamptz | SÍ | — |
| `completed_at` | timestamptz | SÍ | — |
| `error_message` | text | SÍ | — |

### `platform_audit_logs`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `actor_id` | uuid | SÍ | UUID del usuario que ejecutó la acción |
| `tenant_id` | uuid FK | SÍ | Tenant afectado (ON DELETE SET NULL) |
| `action` | text | NO | Tipo de acción (ej. `tenant.create`, `tenant.status.change`) |
| `resource` | text | SÍ | Tabla/recurso afectado |
| `resource_id` | text | SÍ | ID del recurso |
| `details` | jsonb | NO | Detalles adicionales de la acción |
| `correlation_id` | text | SÍ | ID de correlación para trazabilidad |
| `created_at` | timestamptz | NO | Fecha del evento |

### `demo_requests`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid | NO | PK |
| `full_name` | text | NO | Nombre completo |
| `email` | text | NO | Email |
| `company` | text | SÍ | Empresa |
| `phone` | text | SÍ | Teléfono |
| `interest` | text | SÍ | Mensaje de interés |
| `consent` | bool | NO | Consentimiento de tratamiento de datos |
| `status` | text | NO | Estado (default: `new`) |
| `created_at` | timestamptz | NO | Fecha de solicitud |

---

## Enums

| Enum | Valores |
|------|---------|
| `commercial_status` | trial, active, suspended, cancelled |
| `technical_status` | pending_setup, ready, error |
| `connection_status` | not_configured, checking, connected, error |
| `implementation_status` | implemented, planned, unavailable |
| `feature_config_state` | enabled, pending_config, configured, operational |
| `domain_type` | subdomain, custom |
| `domain_verification` | pending, verified, failed |
| `invitation_status` | pending, accepted, expired, revoked |
| `migration_status` | pending, running, completed, failed, rolled_back |
| `db_scope` | platform, tenant |
| `release_status` | planned, in_development, released_for_testing, accepted, accepted_with_pending |

---

## Índices

```sql
idx_tenants_slug                ON tenants(slug)
idx_tenants_status              ON tenants(commercial_status)
idx_tenants_template            ON tenants(business_template_id)
idx_tenant_features_tenant      ON tenant_features(tenant_id)
idx_tenant_features_key         ON tenant_features(feature_key)
idx_tenant_memberships_user     ON tenant_memberships(auth_user_id)
idx_tenant_memberships_tenant   ON tenant_memberships(tenant_id)
idx_platform_user_roles_user    ON platform_user_roles(user_id)
idx_audit_logs_tenant           ON platform_audit_logs(tenant_id)
idx_audit_logs_created          ON platform_audit_logs(created_at DESC)
```

---

## Triggers

Existe un trigger `update_updated_at()` que actualiza automáticamente la columna `updated_at` en un `BEFORE UPDATE` para las siguientes tablas:

- `tenants`, `tenant_databases`, `tenant_domains`, `tenant_branding`, `tenant_features`, `tenant_subscriptions`, `tenant_memberships`, `features`, `plans`, `business_templates`

---

## Tenant DB — Esquema (Pendiente)

En Sprint 1, las Tenant DBs no tienen tablas. El esquema del tenant se aplicará en un sprint posterior mediante migraciones registradas en `schema_versions` y `migration_runs`. Las tablas esperadas incluyen:

- `customers` — Fichas de clientes
- `products` — Productos y catálogos
- `sales` — Oportunidades y ventas
- `orders` — Pedidos con eventos de seguimiento
- `tasks` — Tareas de seguimiento comercial
- `segments` — Segmentos de clientes
- `campaigns` — Campañas comerciales

Cada Tenant DB validará su identidad mediante una tabla o configuración que contenga el `tenant_id` esperado, contrastado con `tenant_databases.expected_tenant_id` en la Platform DB.
