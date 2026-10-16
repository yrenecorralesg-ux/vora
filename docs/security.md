# Seguridad — EKOSCRM

## Visión General

EKOSCRM implementa seguridad en múltiples capas: RLS a nivel de base de datos, validación de roles en API routes, middleware de Next.js para protección de rutas, y separación estricta entre claves públicas y privilegiadas.

---

## Permisos y Roles

### Roles de Plataforma (`platform_roles`)

| Rol | Key | Scope | Descripción |
|-----|-----|-------|-------------|
| Super Admin EKOSCRM | `super_admin` | platform | Acceso total al panel de super admin. Crea tenants, asigna branding, gestiona módulos y bases de datos. |
| Administrador de Tenant | `tenant_admin` | tenant | Admin de una empresa específica. Acceso a su shell CRM y configuración. |
| Comercial | `comercial` | tenant | Acceso a clientes, ventas y seguimiento. |
| Atención | `atencion` | tenant | Acceso a clientes y seguimiento. |

### Matriz de Permisos (`role_permissions`)

#### super_admin (scope: platform)

| Permiso | Descripción |
|---------|-------------|
| `tenant.create` | Crear nuevos tenants |
| `tenant.update` | Actualizar datos del tenant |
| `tenant.suspend` | Suspender/activar tenants |
| `branding.manage` | Gestionar branding de tenants |
| `modules.manage` | Activar/desactivar módulos |
| `database.register` | Registrar conexión de Tenant DB |
| `database.check` | Probar conexión de Tenant DB |
| `admin.invite` | Invitar usuarios a tenants |
| `preview.access` | Vista previa de cualquier tenant |

#### tenant_admin (scope: tenant)

| Permiso | Descripción |
|---------|-------------|
| `crm.customers` | Gestión de clientes |
| `crm.products` | Gestión de productos |
| `crm.sales` | Gestión de ventas |
| `crm.orders` | Gestión de pedidos |
| `crm.tasks` | Gestión de tareas |
| `crm.segments` | Gestión de segmentos |
| `crm.campaigns` | Gestión de campañas |
| `capture.fairs` | Captura QR |
| `branding.manage` | Gestionar branding del propio tenant |

#### comercial (scope: tenant)

| Permiso | Descripción |
|---------|-------------|
| `crm.customers` | Clientes |
| `crm.sales` | Ventas |
| `crm.tasks` | Tareas |

#### atencion (scope: tenant)

| Permiso | Descripción |
|---------|-------------|
| `crm.customers` | Clientes |
| `crm.tasks` | Tareas |

### Verificación en código

```typescript
// lib/auth.ts

// Verifica si un usuario tiene rol super_admin
async function isSuperAdmin(userId: string): Promise<boolean>

// Requiere sesión + super_admin, devuelve el usuario o null
async function requireSuperAdmin(): Promise<SessionUser | null>

// Obtiene las membresías activas de un usuario
async function getUserMemberships(userId: string)
```

Cada API route valida la sesión y el rol antes de ejecutar cualquier operación:

```typescript
// Patrón usado en todas las API routes
const supabase = getSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401;

const admin = await isSuperAdmin(user.id);
if (!admin) return 403;
```

---

## Row Level Security (RLS)

### Configuración general

RLS está **habilitado en todas las 18 tablas** de la Platform DB. No hay tabla sin RLS.

### Patrón de policies

#### Tablas públicas (read)

| Tabla | Política |
|-------|---------|
| `business_templates` | `SELECT` para `anon` y `authenticated` — `USING (true)` |
| `features` | `SELECT` para `anon` y `authenticated` — `USING (true)` |
| `plans` | `SELECT` para `anon` y `authenticated` — `USING (true)` |

> Estas tablas son legibles sin autenticación porque el wizard y la landing necesitan el catálogo de plantillas, features y planes.

#### Tablas autenticadas (read)

| Tabla | Política |
|-------|---------|
| `platform_roles` | `SELECT` para `authenticated` — `USING (true)` |
| `role_permissions` | `SELECT` para `authenticated` — `USING (true)` |
| `schema_versions` | `SELECT` para `authenticated` — `USING (true)` |

#### Tablas de plataforma (read = platform admin OR tenant member)

Las siguientes tablas permiten `SELECT` si el usuario tiene un rol en `platform_user_roles` **O** tiene una membresía activa en el tenant:

- `tenants`
- `tenant_databases`
- `tenant_domains`
- `tenant_branding`
- `tenant_features`
- `tenant_subscriptions`

Ejemplo (tenants):
```sql
CREATE POLICY "tenants_select_platform_or_member" ON tenants
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE tenant_id = tenants.id
    AND auth_user_id = auth.uid()
    AND status = 'active'
  )
);
```

#### Tablas de plataforma (write = platform admin only)

Para `INSERT`, `UPDATE`, `DELETE` en las tablas de tenant, se requiere `platform_user_roles`:

```sql
CREATE POLICY "tenants_insert_platform" ON tenants
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
```

#### `platform_user_roles`

- `SELECT`: propio usuario (`user_id = auth.uid()`) o `super_admin`
- `INSERT`: solo `super_admin`
- `DELETE`: solo `super_admin`

#### `tenant_memberships`

- `SELECT`: propio usuario (`auth_user_id = auth.uid()`) o platform admin
- `INSERT`: solo platform admin
- `UPDATE`: platform admin o propio usuario (con `WITH CHECK` que requiere platform admin)
- `DELETE`: solo platform admin

#### `tenant_invitations`

- `SELECT`: platform admin o miembro del tenant
- `INSERT`/`UPDATE`/`DELETE`: solo platform admin

#### `platform_audit_logs`

- `SELECT`: solo platform admin
- `INSERT`: solo platform admin

#### `migration_runs`

- `SELECT`: solo platform admin

#### `demo_requests`

- `INSERT`: `anon` y `authenticated` — `WITH CHECK (true)` (formulario público)
- `SELECT`: solo platform admin

> Esta es la única tabla que permite escritura anónima, necesaria para el formulario de solicitud de demo en la landing page.

---

## Claves Privilegiadas

### Separación de claves

| Clave | Prefijo | Uso | RLS |
|-------|---------|-----|-----|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_` | Cliente (navegador) y server components | Sujeta a RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | (sin prefijo) | API routes para operaciones privilegiadas | **Bypassa RLS** |

### Clientes Supabase

```typescript
// lib/supabase-client.ts — Navegador
getSupabaseClient()  // Usa anon key, persiste sesión

// lib/supabase-server.ts — Server
getSupabaseServerClient()   // Usa anon key + cookie forwarding, respeta RLS
getSupabaseServiceClient()  // Usa service role key, BYPASSA RLS
```

### Uso seguro del service client

El `getSupabaseServiceClient()` se usa **exclusivamente** en API routes, y siempre después de validar:

1. Que el usuario está autenticado (`supabase.auth.getUser()`)
2. Que el usuario tiene `super_admin` (`isSuperAdmin(user.id)`)

Nunca se usa en client components ni en server components que rendericen contenido público.

---

## Secret Management — Tenant DBs

### Patrón `secret_ref`

La tabla `tenant_databases` almacena un `secret_ref` — un identificador opaco (no la clave real). El nombre sugiere cómo recuperar la clave:

```
tenant_databases.secret_ref = "tenant-abc-service-key"
```

### Env-var adapter

Las claves reales se almacenan como variables de entorno siguiendo el patrón:

```
TENANT_<UUID>_SUPABASE_URL=https://tenant-project.supabase.co
TENANT_<UUID>_SUPABASE_SERVER_KEY=tenant-service-role-key
```

Donde `<UUID>` es el `tenants.id`.

**Limitación documentada:** Añadir o cambiar una clave de tenant requiere redeploy de la aplicación porque las variables de entorno se leen al iniciar el proceso. No hay rotación dinámica de secretos en Sprint 1.

### Lo que NUNCA se almacena en la DB

- Service role keys de tenants
- Contraseñas
- Tokens de API de terceros (Shopify, SIIGO, etc.)

---

## Endpoints Protegidos

### API Routes —todas requieren super_admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/admin/tenants` | Crear tenant |
| `GET` | `/api/admin/tenants` | Listar tenants |
| `GET` | `/api/admin/tenants/[id]` | Obtener detalle del tenant |
| `PATCH` | `/api/admin/tenants/[id]` | Actualizar campos del tenant |
| `POST` | `/api/admin/tenants/[id]/branding` | Guardar branding |
| `POST` | `/api/admin/tenants/[id]/features` | Guardar feature flags |
| `POST` | `/api/admin/tenants/[id]/database` | Registrar conexión DB |
| `POST` | `/api/admin/tenants/[id]/membership` | Asignar administrador |
| `PATCH` | `/api/admin/tenants/[id]/status` | Cambiar estado comercial/técnico |
| `POST` | `/api/admin/tenants/[id]/test-connection` | Probar conexión a Tenant DB |

Todas las API routes siguen el mismo patrón de validación:

1. `getSupabaseServerClient().auth.getUser()` → verificar sesión
2. `isSuperAdmin(user.id)` → verificar rol
3. Validación de input (tipos, regex, rangos)
4. Ejecución con `getSupabaseServiceClient()` (bypassa RLS)
5. Registro en `platform_audit_logs`

### Validación de input

| Campo | Validación |
|-------|------------|
| `slug` | Regex `^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$` + unicidad |
| `email` | Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `supabase_url` | Debe ser `https://<project_ref>.supabase.co` y coincidir con `project_ref` |
| `colors` | Regex hex `^#([0-9a-fA-F]{3}\|[0-9a-fA-F]{6})$` |
| `font_family` | Allowlist: Inter, Poppins, Roboto, Montserrat |
| `commercial_status` | Enum: trial, active, suspended, cancelled |
| `technical_status` | Enum: pending_setup, ready, error |

---

## Middleware de Next.js

```typescript
// middleware.ts — matcher
export const config = {
  matcher: ['/admin/:path*', '/login', '/t/:path*'],
};
```

El middleware usa `@supabase/ssr` para leer y refrescar cookies de sesión y valida con `supabase.auth.getUser()`.

1. Si `/admin/*` no tiene sesión → redirect a `/login`
2. Si `/t/*` no tiene sesión → redirect a `/login`
3. Si `/login` ya tiene sesión → redirect a `/admin`
4. El destino posterior se resuelve en server-side según rol y membresías

> El middleware valida autenticación pero no valida roles. La validación de `super_admin` se hace en server components y API routes mediante `requireSuperAdmin()`.

---

## Auditoría

Todas las acciones privilegiadas se registran en `platform_audit_logs`:

| Acción | Trigger |
|--------|---------|
| `tenant.create` | POST /api/admin/tenants |
| `tenant.update` | PATCH /api/admin/tenants/[id] |
| `tenant.status.change` | PATCH /api/admin/tenants/[id]/status |
| `tenant.branding.save` | POST /api/admin/tenants/[id]/branding |
| `tenant.features.save` | POST /api/admin/tenants/[id]/features |
| `tenant.database.register` | POST /api/admin/tenants/[id]/database |
| `tenant.database.test_connection` | POST /api/admin/tenants/[id]/test-connection |
| `tenant.membership.create` | POST /api/admin/tenants/[id]/membership (usuario existe) |
| `tenant.invitation.create` | POST /api/admin/tenants/[id]/membership (usuario no existe) |

Cada entrada incluye: `actor_id`, `tenant_id`, `action`, `resource`, `resource_id`, `details` (jsonb).

---

## Consideraciones de Seguridad para Sprints Posteriores

1. **Invitaciones por email:** Implementar envío real de emails con tokens de un solo uso
2. **Rotación de secretos:** Migrar de env vars a un gestor de secretos (Vault, AWS Secrets Manager)
3. **MFA:** Multi-factor authentication para super admins
4. **Rate limiting persistente:** Pendiente para endpoints de API y formulario de demo; actualmente se aplican validación, honeypot y límites de longitud
5. **CORS:** Configuración estricta en Supabase para dominios autorizados
6. **Tenant DB RLS:** Las Tenant DBs necesitarán sus propias policies basadas en membresías
7. **Validación de webhook signatures:** Para integraciones con Shopify/SIIGO
