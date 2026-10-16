# Arquitectura de EKOSCRM

## Visión General

EKOSCRM es una plataforma SaaS CRM modular multi-tenant construida sobre Next.js 13.5 (App Router) y Supabase. La arquitectura se basa en un modelo **Platform vs Tenant** donde la plataforma administra la identidad, configuración y provisioning de empresas, y cada tenant opera su propia base de datos Supabase dedicada para sus datos comerciales.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 13.5 (App Router) |
| Lenguaje | TypeScript 5.2 |
| Estilos | Tailwind CSS 3.3 + tailwindcss-animate |
| UI Components | shadcn/ui (Radix UI primitives) |
| Iconos | lucide-react |
| Backend/Auth/DB | Supabase (PostgreSQL + GoTrue + REST) |
| Formularios | react-hook-form + zod |
| Gráficos | recharts |
| Despliegue | Vercel (recomendado) / Netlify |
| Runtime | Node.js 18+ |

---

## Modelo Platform vs Tenant

### Platform DB (Base de datos central)

Existe **un único** proyecto Supabase que actúa como la base de datos de la plataforma. Contiene exclusivamente metadatos de administración e identidad — nunca datos comerciales de los tenants.

**Tablas de la Platform DB (18 total):**

1. `tenants` — Registros de empresas con estado comercial y técnico
2. `tenant_databases` — Conexión al proyecto Supabase dedicado del tenant
3. `tenant_branding` — Identidad visual del tenant (colores, logo, tipografía)
4. `tenant_features` — Feature flags asignados por tenant
5. `tenant_memberships` — Asignación de usuarios a tenants con rol
6. `platform_user_roles` — Roles globales de plataforma (super_admin, etc.)
7. `platform_roles` — Catálogo de roles de plataforma
8. `role_permissions` — Matriz de permisos por rol
9. `tenant_invitations` — Invitaciones pendientes a unirse a un tenant
10. `business_templates` — Plantillas de negocio preconfiguradas
11. `features` — Catálogo de módulos e integraciones disponibles
12. `plans` — Planes de suscripción con límites
13. `tenant_subscriptions` — Asignación de plan por tenant
14. `schema_versions` — Versiones de esquema aplicadas
15. `migration_runs` — Log de ejecución de migraciones
16. `platform_audit_logs` — Auditoría de acciones de plataforma
17. `demo_requests` — Solicitudes de demo del formulario público
18. `tenant_domains` — Dominios/subdominios por tenant

### Tenant DB (Una por empresa)

Cada tenant recibe su **propio proyecto Supabase** — no comparte base de datos con otros tenants ni con la plataforma. Esta base de datos contendrá las tablas de CRM (clientes, productos, ventas, pedidos, tareas, segmentos, campañas, etc.) en sprints posteriores.

**Por qué proyectos separados:**
- Aislamiento total de datos entre tenants
- RLS no necesita filtrar por `tenant_id` dentro de la Tenant DB
- Cada tenant puede escalar su base de datos independientemente
- Backup, restore y pausa por tenant sin afectar a otros
- El `tenant_id` se valida en runtime: la Platform DB guarda `expected_tenant_id` en `tenant_databases` para verificar que la conexión apunta al proyecto correcto

> **Nota de Sprint 1:** Las Tenant DBs aún no tienen su esquema de CRM. El shell del CRM (`/t/[slug]/*`) muestra datos demo desde fixtures estáticos (`lib/demo-data.ts`). El registro de la conexión existe pero el esquema del tenant se aplica en un sprint posterior.

---

## Modelo de Autenticación

### Proveedor

- **Supabase Auth (GoTrue)** sobre la Platform DB
- Email + contraseña
- **Confirmación de email desactivada** (`email_confirmations = OFF` en Supabase Dashboard)
- No hay signup público: los usuarios son creados por el super admin o vía invitación

### Flujo de sesión

1. El usuario ingresa email/contraseña en `/login`
2. `auth-provider.tsx` (client) llama `supabase.auth.signInWithPassword()`
3. Supabase SSR mantiene la sesión en cookies gestionadas por `@supabase/ssr`
4. `onAuthStateChange` actualiza el contexto de React y limpia la suscripción al desmontar
5. El middleware y los server components validan la sesión con `supabase.auth.getUser()`

### Clientes Supabase

| Cliente | Uso | Clave |
|---------|-----|-------|
| `getSupabaseClient()` | Client-side (navegador) | Anon key (`NEXT_PUBLIC_`) |
| `getSupabaseServerClient()` | Server components / API routes | Anon key + cookie forwarding |
| `getSupabaseServiceClient()` | Operaciones privilegiadas (service role) | `SUPABASE_SERVICE_ROLE_KEY` |

El server client reenvía cookies mediante `next/headers` para que la sesión del usuario se preserve en SSR. El service client bypassa RLS y se usa exclusivamente en API routes validadas con `isSuperAdmin()`.

### Primer super admin

No hay signup público ni interfaz para auto-asignar `super_admin`. El primer usuario debe ser promovido mediante SQL ejecutado directamente en la Platform DB:

```sql
-- 1. Crear el usuario en auth.users (vía Supabase Dashboard o API admin)
-- 2. Obtener su UUID:
SELECT id, email FROM auth.users WHERE email = 'admin@ekossolutions.com';

-- 3. Asignar el rol super_admin:
INSERT INTO platform_user_roles (user_id, role_id)
SELECT
  '<UUID-DEL-USUARIO>'::uuid,
  id FROM platform_roles WHERE key = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

> **Importante:** Esta operación requiere acceso al SQL Editor de Supabase o a la service role key. Nunca debe exponerse como endpoint público.

---

## Límites y Alcance de Sprint 1

### Lo que está implementado

- Landing page pública con formulario de solicitud de demo
- Autenticación email/password
- Panel de super admin (dashboard, listado y detalle de tenants)
- Wizard de creación de tenants (7 pasos)
- Shell del CRM por tenant con sidebar, branding dinámico y datos demo
- Feature flags por tenant con catálogo de 15 módulos
- Branding por tenant (colores, tipografía, logo)
- Auditoría de acciones de plataforma
- RLS en todas las tablas

### Lo que NO está implementado (pendiente para sprints posteriores)

- **Integración real con Shopify** — la casilla existe pero no sincroniza datos
- **Integración con SIIGO** — facturación planificada, no operativa
- **Predictivo de recompra** — piloto planificado, no implementado
- **CRUD comercial real** — clientes, productos, ventas, pedidos se muestran con datos demo estáticos; las Tenant DBs no tienen esquema aún
- **WhatsApp** — no implementado
- **Chatbot generativo** — no implementado
- **Reglas de automatización** — planificadas, no operativas
- **Dominios personalizados** — la tabla existe pero no hay resolución DNS activa

### Límites conocidos

- **Secret management basado en env vars:** `secret_ref` es el nombre de una variable server-only; añadir o cambiar una clave requiere redeploy de la aplicación.
- **Test de conexión condicionado:** El endpoint solo acepta `https://<project_ref>.supabase.co`, recupera el secreto server-only y llama al contrato `ekoscrm_health_check` del proyecto tenant. Sin secreto o sin bootstrap, conserva un estado de error/pending; no marca conectado por reachability.
- **Sin invitación por email:** Las invitaciones se guardan en `tenant_invitations` con estado `pending`, pero no se envía un email real. La membresía se activa cuando el usuario se registra.
- **Sin multi-factor auth:** Solo email/password.
- **Sin realtime:** No se usan suscripciones de Supabase Realtime en Sprint 1.
