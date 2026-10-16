# Handoff — EKOSCRM Sprint 1

## Resumen

Este documento describe el estado del proyecto EKOSCRM al cierre del Sprint 1: qué está implementado, qué pendiente, qué es mock/demo, y qué viene en los siguientes sprints.

---

## Lo Que Está Hecho (Sprint 1)

### Landing Page (`/`)

- Hero con CTA "Solicitar demo"
- Sección de beneficios (6 tarjetas)
- Sección de módulos (6 tarjetas + integraciones en hoja de ruta)
- Sección "Cómo funciona" (5 pasos)
- Sección "Identidad por empresa" con previews de SOLEÉ y Empresa Demo
- Sección FAQ (5 preguntas)
- Formulario de solicitud de demo → `demo_requests` (anon insert)
- Header con navegación y menú móvil
- Footer con contacto y legal (borrador)

### Autenticación (`/login`)

- Login email/password con Supabase Auth
- Email confirmation OFF
- `AuthProvider` con `onAuthStateChange`
- Destino según autorización: Super Admin → `/admin`, una membresía → `/t/[slug]`, varias → `/select-tenant`, ninguna → `/access-pending`
- UI con fondo navy-gradient y logo EKOSCRM

### Panel de Super Admin (`/admin/*`)

- **Dashboard** (`/admin`): Stats de tenants, estado comercial/técnico, empresas recientes, auditoría reciente
- **Empresas** (`/admin/tenants`): Listado de tenants
- **Nueva empresa** (`/admin/tenants/new`): Wizard de 7 pasos
- **Detalle de empresa** (`/admin/tenants/[id]`): Tabs con info, branding, módulos, DB, dominios, membresías, auditoría
- **Módulos** (`/admin/modules`): Catálogo de features
- **Planes** (`/admin/plans`): Planes de suscripción
- **Usuarios** (`/admin/users`): Usuarios de plataforma
- **Auditoría** (`/admin/audit`): Log de auditoría
- Sidebar con navegación, logo, email del admin, logout
- Protegido por `requireSuperAdmin()` en layout

### Wizard de Creación de Tenants (7 pasos)

1. **Empresa:** nombre, razón social, slug (auto-gen + unique check), país, moneda, idioma, timezone, tipo de negocio
2. **Plantilla:** retail_ecommerce, services, general_crm (preselecciona módulos)
3. **Branding:** 4 colores + fuente con vista previa en tiempo real
4. **Módulos:** 15 features agrupados por categoría con badges de implementación y dependencias
5. **Supabase:** project_ref, supabase_url, secret_ref
6. **Administrador:** email (crea membresía o invitación)
7. **Resumen:** revisión + ejecución secuencial con resultados en tiempo real

### API Routes

- `POST /api/admin/tenants` — Crear tenant
- `GET /api/admin/tenants` — Listar tenants
- `GET /api/admin/tenants/[id]` — Detalle con joins
- `PATCH /api/admin/tenants/[id]` — Actualizar campos
- `POST /api/admin/tenants/[id]/branding` — Upsert branding
- `POST /api/admin/tenants/[id]/features` — Replace features
- `POST /api/admin/tenants/[id]/database` — Upsert conexión
- `POST /api/admin/tenants/[id]/membership` — Membresía o invitación
- `PATCH /api/admin/tenants/[id]/status` — Cambiar estado
- `POST /api/admin/tenants/[id]/test-connection` — Verificar health check del proyecto asociado

Todas validan sesión + super_admin + registran auditoría. El formulario público usa `POST /api/demo-requests`, valida con Zod y solo confirma después de persistir.

### Shell del CRM por Tenant (`/t/[slug]/*`)

- Layout con resolución de tenant por slug
- Verificación de membresía o vista previa (super_admin)
- Branding dinámico (CSS custom properties)
- Sidebar con features habilitados
- Páginas para cada módulo:
  - Dashboard, Clientes, Productos, Ventas, Pedidos, Tareas, Segmentos, Campañas, Captura QR, Settings
  - Placeholders: Shopify, SIIGO, Predictivo
- Páginas de estado: "Sin acceso", "Cuenta suspendida"
- DemoBanner y DemoBadge indicando que los datos son demo

### Feature Flags

- Catálogo de 15 features en `features` table
- 9 implementadas (CRM core + captura QR)
- 6 planificadas (Shopify, SIIGO, email, chatbot, automatización, predictivo)
- `tenant_features` con `enabled`, `config_state`, `release_status`
- Dependencias entre features documentadas y mostradas en UI

### Branding

- `tenant_branding` con 4 colores, fuente, logo, favicon, banner
- Inyección como CSS custom properties
- Vista previa en wizard
- Identidad EKOSCRM vs identidad del tenant separadas

### Base de Datos

- 18 tablas en Platform DB
- RLS en todas las tablas con policies completas
- 6 migraciones aplicadas, incluidas las de grants y solicitudes demo
- Seed data (templates, features, roles, planes, permisos)
- Auditoría automática en todas las acciones privilegiadas

### Middleware

- Protege `/admin/*`, `/t/*`, `/login`
- Valida cookies SSR gestionadas por `@supabase/ssr`
- Redirects inteligentes

---

## Lo Que Es Mock / Demo

### Datos del CRM

**Todos los datos del CRM son fixtures estáticos** en `lib/demo-data.ts`:

- `demoCustomers` — 6 clientes ficticios
- `demoSales` — 5 oportunidades ficticias
- `demoOrders` — 6 pedidos ficticios
- `demoTasks` — 5 tareas ficticias
- `demoProducts` — 5 productos ficticios
- `demoSegments` — 4 segmentos ficticios
- `demoCampaigns` — 3 campañas ficticias
- `demoActivityFeed` — 5 eventos ficticios

Estos datos **no provienen de ninguna base de datos**. Se muestran con `DemoBanner` y `DemoBadge` para indicar claramente que son demo.

### Integraciones

- **Shopify:** La página existe pero muestra un placeholder. No hay sincronización real.
- **SIIGO:** La página existe pero muestra un placeholder. No hay facturación real.
- **Predictivo:** La página existe pero muestra un placeholder. No hay modelo predictivo.

### Test de conexión

El `test-connection` no simula éxito. Rechaza destinos que no coinciden con `project_ref`, requiere un secreto server-only y espera el contrato `ekoscrm_health_check` que confirme `expected_tenant_id`. Sin bootstrap externo, el estado permanece pendiente/error.

### Invitaciones por email

Las invitaciones se guardan en `tenant_invitations` pero **no se envía ningún email**. El estado queda `pending` hasta que el usuario se registre.

---

## Lo Que Está Pendiente

### Sprint 2 — Esquema de Tenant DB + CRUD Comercial

- Definir y aplicar el esquema CRM en las Tenant DBs (customers, products, sales, orders, tasks, segments, campaigns)
- Conectar el shell del CRM a la Tenant DB real (adapter `TENANT_<UUID>_SUPABASE_*`)
- CRUD completo de clientes, productos, ventas, pedidos, tareas
- Validar `expected_tenant_id` al conectar
- Migraciones de flota automatizadas

### Sprint 3 — Integraciones

- Integración real con Shopify (sincronización de productos y pedidos)
- Integración con SIIGO (facturación de ventas directas)
- Webhook handlers con validación de firma
- Configuración de API keys por tenant

### Sprint 4 — Canales y Automatización

- Canal de correo (notificaciones comerciales)
- Chatbot web guiado (captación por web, QR, Shopify)
- Reglas de seguimiento automatizado
- WhatsApp (canal)

### Sprint 5 — Analítica

- Piloto predictivo de recompra
- Diagnóstico, reglas base, modelo validado
- Dashboard de analítica avanzada

### Sprint 6+ — Plataforma

- Invitaciones por email reales
- Dominios personalizados con resolución DNS
- Cache de branding y features
- MFA para super admins
- Rate limiting
- Chatbot generativo con IA
- Constructor visual de flujos

---

## Estado Técnico Final del Tenant Después del Wizard

Al completar el wizard, el tenant queda:

| Campo | Valor | Razón |
|-------|-------|-------|
| `commercial_status` | `trial` | Default al crear |
| `technical_status` | `pending_setup` | Requiere verificación de conexión |
| `wizard_completed` | `true` | Marcado al final del wizard |
| `wizard_step` | `7` | Paso final |
| `connection_status` | `not_configured` | Pendiente de health check real con secreto server-only |

Para que el tenant pase a `ready`, el super admin debe ejecutar `test-connection` desde el detalle del tenant y obtener `connected`.
