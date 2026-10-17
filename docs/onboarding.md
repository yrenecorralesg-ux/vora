> Documento histórico. Para el flujo y arquitectura vigentes consulta [VORA Core progresivo](./vora-core-progressive.md). Las descripciones de un Supabase obligatorio por empresa y del asistente de siete pasos ya no aplican.

# Onboarding — VORA

## Visión General

El onboarding de un nuevo tenant en VORA tiene dos fases: el **wizard guiado** (registrar la empresa y asociar un proyecto Supabase existente) y el **bootstrap externo** del proyecto tenant (secreto server-only y función health check). El wizard no crea proyectos Supabase automáticamente.

---

## Preparación Manual (Pre-Wizard)

Antes de ejecutar el wizard, el super admin debe preparar la infraestructura del tenant:

### Paso 1: Crear el proyecto Supabase del tenant

1. Preparar o seleccionar un proyecto Supabase existente para la empresa
2. Anotar:
   - **Project Reference ID** (en Project Settings → API)
   - **URL del proyecto** (`https://<project_ref>.supabase.co`)
   - **Service role key**, que debe quedar en un secreto server-only

### Paso 2: Guardar la service role key como variable de entorno

La clave se referencia mediante `secret_ref`, que debe ser el nombre de una variable server-only válida. El flujo real es:

1. **Ejecutar el wizard** y crear el tenant (esto genera el UUID)
2. **Añadir las variables de entorno** con el UUID generado:
   ```
   TENANT_<SECRET_REF>=<service-role-key>
   ```
3. **Redeploy** de la aplicación para que las variables estén disponibles

> **Nota:** En Sprint 1, el `secret_ref` registrado en el wizard es un identificador opaco (no la clave). La clave real se añade después via variables de entorno. Esto requiere redeploy.

### Paso 3: Crear el usuario administrador del tenant

Opción A — El admin del tenant se registra primero en `/login` (no hay signup público, pero Supabase Dashboard puede crear usuarios):

1. En Supabase Dashboard → Authentication → Users → "Add user"
2. Crear el usuario con email y contraseña
3. Usar este email en el paso 6 del wizard

Opción B — El admin del tenant aún no tiene cuenta:
1. Usar el email en el paso 6 del wizard
2. Se creará una invitación `pending` en `tenant_invitations`
3. Cuando el usuario se registre, la membresía se activará

---

## Wizard de Creación (7 Pasos)

El wizard vive en `/admin/tenants/new` y es un componente client-side (`app/admin/tenants/new/page.tsx`). Solo accesible para `super_admin`.

### Estructura

```
Paso 1: Empresa     → Datos comerciales básicos
Paso 2: Plantilla   → Selección de plantilla de negocio
Paso 3: Branding    → Colores y tipografía con vista previa
Paso 4: Módulos     → Selección de features con dependencias
Paso 5: Supabase    → Datos de conexión del proyecto Supabase
Paso 6: Administrador → Email del admin del tenant
Paso 7: Resumen     → Revisión y confirmación
```

### Paso 1: Empresa

**Campos:**
- Nombre comercial (obligatorio)
- Razón social (opcional)
- Slug (obligatorio, auto-generado, editable, validación de unicidad en tiempo real)
- País (select: CO, MX, AR, PE, CL, EC, UY, ES, US, OTHER)
- Moneda (select: COP, MXN, ARS, PEN, CLP, USD, EUR)
- Idioma (select: es, en, pt)
- Zona horaria (select: lista IANA)
- Tipo de negocio (select: retail, ecommerce, services, manufacturing, technology, consulting, other)

**Validaciones:**
- Slug: regex `^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$`
- Slug único: consulta `tenants` con `count` y debounce de 500ms
- El slug se auto-genera desde el nombre comercial (slugify con normalización NFD)

**API:** `POST /api/admin/tenants`

### Paso 2: Plantilla

**Opciones:**
- Retail / Ecommerce (`retail_ecommerce`) — sugiere: dashboard, customers, products, sales, orders, tasks, integration.shopify
- Servicios (`services`) — sugiere: dashboard, customers, sales, tasks, segments
- CRM General (`general_crm`) — sugiere: dashboard, customers, sales, tasks

Al seleccionar una plantilla, se preseleccionan los módulos sugeridos en el paso 4.

### Paso 3: Branding

**Campos:**
- Color primario (color picker + input hex)
- Color secundario (color picker + input hex)
- Color de acento (color picker + input hex)
- Color de fondo login (color picker + input hex)
- Fuente tipográfica (select: Inter, Poppins, Roboto, Montserrat)

**Vista previa en tiempo real:** Muestra un mockup con los colores y fuente aplicados.

**API:** `POST /api/admin/tenants/[id]/branding`

### Paso 4: Módulos

Muestra los 15 features del catálogo agrupados por categoría:
- CRM
- Integraciones
- Canales
- Automatización
- Analítica

Cada feature muestra:
- Checkbox para activar/desactivar
- Nombre y descripción
- Badge de `implementation_status` (Implementado / Planificado)
- Badge "Sugerido" si viene de la plantilla
- Dependencias (con advertencia si faltan)

**API:** `POST /api/admin/tenants/[id]/features` (delete + insert)

### Paso 5: Supabase

**Campos:**
- Project Reference ID (obligatorio)
- URL del proyecto (obligatorio, debe empezar con `https://`)
- Secret Reference (obligatorio, identificador opaco — NO la clave)

**Guía incluida en el UI:** Explica los 4 pasos para preparar el proyecto Supabase.

**API:** `POST /api/admin/tenants/[id]/database`

### Paso 6: Administrador

**Campos:**
- Email del administrador (obligatorio, validación de email)

**Comportamiento:**
- Si el usuario existe en `auth.users` → crea membresía `active` con rol `tenant_admin`
- Si no existe → crea invitación `pending` con expiración de 7 días

**API:** `POST /api/admin/tenants/[id]/membership`

### Paso 7: Resumen

Muestra un resumen de todos los datos antes de confirmar. Al confirmar, ejecuta secuencialmente:

1. `POST /api/admin/tenants` — Crear empresa
2. `POST /api/admin/tenants/[id]/branding` — Guardar branding
3. `POST /api/admin/tenants/[id]/features` — Guardar módulos
4. `POST /api/admin/tenants/[id]/database` — Registrar conexión
5. `POST /api/admin/tenants/[id]/membership` — Asignar admin
6. `PATCH /api/admin/tenants/[id]` — Marcar `wizard_completed: true, wizard_step: 7`

Cada paso muestra su resultado (✓ ok, ⚠ pendiente, ✗ error) en tiempo real.

**Estado técnico final:** El tenant queda en `pending_setup` hasta que se verifique la conexión de base de datos desde el detalle del tenant.

---

## Post-Wizard

### Verificar conexión

Desde el detalle del tenant (`/admin/tenants/[id]`), el super admin puede:

1. Probar la conexión (`POST /api/admin/tenants/[id]/test-connection`)
2. Valida que la URL sea `https://<project_ref>.supabase.co` y coincida con `project_ref`.
3. Recupera el secreto server-only usando `secret_ref`.
4. Llama a `POST /rest/v1/rpc/ekoscrm_health_check` enviando el UUID esperado.
5. Solo una respuesta válida con `ok: true` y el mismo tenant UUID marca `connected` y permite pasar a `ready`.

### Configurar variables de entorno

Después de crear el tenant:

1. Obtener el UUID del tenant desde el detalle
2. Añadir a `.env` (o Vercel env vars):
   ```
   TENANT_<SECRET_REF>=<service-role-key>
   ```
3. Redeploy de la aplicación

### Acceder al CRM del tenant

- Via `/t/[slug]` (ej. `/t/solee`)
- El super admin puede acceder en modo "vista previa" incluso sin membresía
- El admin del tenant necesita membresía activa

---

## Bootstrap del Primer Super Admin

Antes de poder usar el wizard, debe existir al menos un usuario con rol `super_admin`:

1. Crear un usuario en Supabase Dashboard → Authentication → Users → "Add user"
2. Obtener el UUID del usuario
3. Ejecutar en Supabase SQL Editor:

```sql
INSERT INTO platform_user_roles (user_id, role_id)
SELECT
  '<UUID-DEL-USUARIO>'::uuid,
  id FROM platform_roles WHERE key = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

4. Iniciar sesión en `/login` con ese usuario
5. Será redirigido a `/admin`
