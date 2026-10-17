# Variables de Entorno — VORA

## Visión General

VORA utiliza variables de entorno para configurar la conexión a la Platform DB de Supabase y las conexiones a las Tenant DBs. Es crítico distinguir entre variables **públicas** (accesibles en el navegador) y **privadas** (solo servidor).

---

## Clasificación

### Públicas (prefix `NEXT_PUBLIC_`)

Estas variables se exponen al navegador y son seguras para compartir (no son secretos):

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la Platform DB de Supabase | `https://kvebyunxezcueshjmdyq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase (sujeta a RLS) | `eyJhbGciOiJIUzI1NiIs...` |

### Privadas (sin prefix, server-only)

Estas variables **nunca** se exponen al navegador. Se usan solo en API routes y server components:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de la Platform DB (bypassa RLS) | `eyJhbGciOiJIUzI1NiIs...` |

### Privadas por Tenant (patrón dinámico)

Cada tenant tiene su propio proyecto Supabase. Las claves se almacenan con un patrón basado en el UUID del tenant:

| Patrón | Descripción |
|--------|-------------|
| `<SECRET_REF>` | Nombre de la variable server-only que contiene la service role key del tenant |
| `TENANT_<UUID>_SUPABASE_SERVER_KEY` | Service role key del proyecto Supabase del tenant |

Donde `<UUID>` es el valor de `tenants.id` (ej. `TENANT_550e8400-e29b-41d4-a716-446655440000_SUPABASE_URL`).

> **Importante:** Estas variables requieren **redeploy** de la aplicación al añadirse o cambiarse. No hay rotación dinámica en Sprint 1.

---

## Archivo `.env.example`

```bash
# ---- Platform Supabase (shared, public) ----
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ---- Platform Supabase (server-only, secret) ----
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ---- Tenant DB connections (server-only, never use NEXT_PUBLIC_ prefix) ----
# TENANT_<UUID>_SUPABASE_URL=https://tenant-project.supabase.co
# TENANT_<UUID>_SUPABASE_SERVER_KEY=tenant-service-role-key
```

---

## Dónde se Usan

### `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

| Archivo | Uso |
|---------|-----|
| `lib/supabase-client.ts` | Cliente del navegador |
| `lib/supabase-server.ts` | Server client (cookie forwarding) |
| `middleware.ts` | Validación de sesión en rutas protegidas |

```typescript
// lib/supabase-client.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
```

### `SUPABASE_SERVICE_ROLE_KEY`

| Archivo | Uso |
|---------|-----|
| `lib/supabase-server.ts` | Service client para operaciones privilegiadas en API routes |

```typescript
// lib/supabase-server.ts
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getSupabaseServiceClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

### `TENANT_<UUID>_SUPABASE_URL` y `TENANT_<UUID>_SUPABASE_SERVER_KEY`

El adaptador server-only actual usa `secret_ref` para recuperar la clave del proyecto asociado durante el health check. En Sprint 1, el shell del CRM sigue usando datos demo estáticos y no consulta datos comerciales de la Tenant DB.

El adaptador server-only actual recupera una variable con nombre validado desde `secret_ref`; la URL no se toma de una variable duplicada y debe coincidir con el `project_ref` guardado. No se envía ninguna clave al navegador.

---

## Configuración por Entorno

### Local (`.env`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Vercel / Netlify

Configurar las mismas variables en el dashboard del proveedor:
- **Vercel:** Settings → Environment Variables
- **Netlify:** Site settings → Environment variables

### Reglas de seguridad

1. **Nunca** uses `NEXT_PUBLIC_` para secretos
2. **Nunca** commits `.env` al repositorio (verificar `.gitignore`)
3. El `SUPABASE_SERVICE_ROLE_KEY` solo se usa en server-side
4. Las `TENANT_*` keys solo se usan en server-side
5. El `.env.example` se commitea como documentación, sin valores reales

---

## Validación

Si las variables públicas faltan, la aplicación fallará al iniciar:

```typescript
// Error explícito por el uso de `!` (non-null assertion)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// → TypeError si no está definida
```

No hay validación graceful en Sprint 1. Se asume que las variables están configuradas correctamente antes del deploy.
