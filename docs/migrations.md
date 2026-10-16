# Migraciones — EKOSCRM

## Visión General

EKOSCRM gestiona dos niveles de esquema: el de la **Platform DB** (central, gestionada por Supabase MCP / CLI) y el de las **Tenant DBs** (una por empresa, con su propio ciclo de versiones). El versionamiento se registra en las tablas `schema_versions` y `migration_runs`.

---

## Migraciones de la Platform DB

### Archivos de migración

Las migraciones viven en `supabase/migrations/` con el formato `<timestamp>_<name>.sql`:

```
supabase/migrations/
├── 20261006000000_initial_schema.sql — Esquema inicial completo consolidado
├── 20261006162917_001_platform_core_schema.sql — Esquema base inicial
├── 20261006162954_002_seed_reference_data.sql — Seed reference data
├── 20261006164551_003_add_business_type_to_tenants.sql.sql — Columna business_type
├── 20261006172244_004_seed_demo_tenants.sql — Seed demo tenants
├── 20261006175258_20261006190000_005_lockdown_platform_grants.sql.sql — Lockdown grants Data API
├── 20261006175919_20261006191000_006_demo_requests_through_server.sql.sql — Demo requests vía server
├── 20261006182318_20261006180000_007_bootstrap_super_admin.sql.sql — Super admin bootstrap
└── 20261008190324_20261008120000_fix_super_admin_role_lookup.sql — Fix super admin lookup RLS
```

### Migración 001: Platform Core Schema

**Contenido:**
- 11 enums (`commercial_status`, `technical_status`, `connection_status`, etc.)
- 18 tablas con sus PKs, FKs y constraints
- Índices en columnas de búsqueda frecuente
- Trigger `update_updated_at()` para auto-actualizar `updated_at`
- RLS habilitado en todas las tablas
- Policies completas (SELECT, INSERT, UPDATE, DELETE) por tabla

**Orden de creación:**
1. Enums (con `DO $$ ... EXCEPTION WHEN duplicate_object`)
2. Tablas (todas creadas antes de aplicar policies)
3. Índices
4. Triggers
5. RLS habilitado
6. Policies aplicadas

**Notas:**
- Usa `CREATE TABLE IF NOT EXISTS` para idempotencia
- Las policies usan `DROP POLICY IF EXISTS` antes de `CREATE` para idempotencia
- Los triggers usan `DO $$ ... EXCEPTION WHEN duplicate_object` para idempotencia

### Migración 002: Seed Reference Data

**Contenido:**
- 3 business_templates (retail_ecommerce, services, general_crm)
- 15 features (catálogo de módulos)
- 4 platform_roles (super_admin, tenant_admin, comercial, atencion)
- 24 role_permissions (matriz de permisos)
- 2 plans (Starter, Growth)
- 1 schema_version record (platform, 001)

**Idempotencia:**
- `INSERT ... ON CONFLICT DO UPDATE` para templates, features, roles, permissions
- `INSERT ... ON CONFLICT DO NOTHING` para plans y schema_versions

### Migración 003: Add business_type

- Añade columna `business_type text` (nullable) a `tenants`
- Usa `DO $$ ... IF NOT EXISTS` para idempotencia
- Sin cambios en policies (el RLS existente cubre todas las columnas)

---

## Tablas de Versionamiento

### `schema_versions`

Registra qué versión de esquema está aplicada en cada scope:

```sql
CREATE TABLE schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope db_scope NOT NULL,          -- 'platform' | 'tenant'
  version text NOT NULL,             -- ej. '001', '002'
  name text NOT NULL,
  description text,
  applied_at timestamptz DEFAULT now(),
  UNIQUE(scope, version)
);
```

### `migration_runs`

Registra cada ejecución de migración, incluyendo su estado:

```sql
CREATE TABLE migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope db_scope NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  version text NOT NULL,
  status migration_status NOT NULL DEFAULT 'pending',
  -- pending | running | completed | failed | rolled_back
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

---

## Estrategia de Migración de Flota (Tenant DBs)

### El Problema

Cuando se actualiza el esquema del CRM (ej. añadir una columna a `customers`), la migración debe aplicarse a **todos los proyectos Supabase de todos los tenants**. En Sprint 1 no hay automatización para esto.

### Estrategia Planificada

```
┌──────────────────────────────────────────────────────────┐
│                    Platform DB                            │
│  schema_versions (scope='tenant', version='001_crm')     │
│  migration_runs (scope='tenant', status='completed')     │
└──────────────────────────┬───────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │ Tenant A │    │ Tenant B │    │ Tenant C │
     │ DB       │    │ DB       │    │ DB       │
     │ v001_crm │    │ v001_crm │    │ v001_crm │
     └──────────┘    └──────────┘    └──────────┘
```

1. **Definir la migración** en un archivo SQL versionado
2. **Registrar** en `schema_versions` con `scope='tenant'` y la nueva versión
3. **Iterar** sobre cada tenant en `tenant_databases` con `connection_status='connected'`
4. **Conectar** al Tenant DB usando las env vars (`TENANT_<UUID>_SUPABASE_URL`, `TENANT_<UUID>_SUPABASE_SERVER_KEY`)
5. **Validar** que `expected_tenant_id` coincide con el tenant correcto
6. **Ejecutar** la migración en la Tenant DB
7. **Registrar** el resultado en `migration_runs` (completed/failed)
8. **Actualizar** `tenant_databases.schema_version` al nueva versión

### Sprint 1: Sin migraciones de tenant

En Sprint 1, las Tenant DBs no tienen esquema. No hay migraciones de tenant que ejecutar. La infraestructura de versionamiento (`schema_versions`, `migration_runs`) está lista para cuando se necesite.

---

## Comandos

### Aplicar migraciones de plataforma

Las migraciones de la Platform DB se aplican mediante Supabase MCP o Supabase CLI:

```bash
# Via Supabase CLI (si está configurado)
supabase db push

# Via Supabase MCP (desde Bolt)
# Se usa la herramienta apply_migration para DDL
```

### Verificar estado de migraciones

```sql
-- Versiones aplicadas en platform
SELECT * FROM schema_versions WHERE scope = 'platform' ORDER BY version;

-- Migraciones de tenant ejecutadas
SELECT * FROM migration_runs ORDER BY created_at DESC;

-- Estado de conexiones de tenants
SELECT t.commercial_name, t.slug, td.connection_status, td.schema_version
FROM tenants t
LEFT JOIN tenant_databases td ON td.tenant_id = t.id
ORDER BY t.created_at;
```

---

## Reglas para Nuevas Migraciones

1. **Idempotencia:** Toda migración debe poder ejecutarse múltiples veces sin error (usar `IF NOT EXISTS`, `ON CONFLICT`, `DO $$ ... EXCEPTION`)
2. **Orden:** Crear tablas antes de aplicar RLS y policies
3. **Seed separado:** Los datos de referencia van en migraciones separadas del esquema
4. **Versionado:** Cada migración incrementa el número de versión y se registra en `schema_versions`
5. **Rollback:** Preparar un script de rollback para cada migración (el campo `migration_runs.status` soporta `rolled_back`)
6. **Additivo:** Preferir `ADD COLUMN` sobre `ALTER COLUMN` cuando sea posible para no romper compatibilidad
