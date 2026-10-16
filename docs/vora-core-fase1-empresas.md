# VORA Core — Fase 1: gestión de empresas (tenants)

Rama: `feature/vora-tenant-management` · Migración: `supabase/migrations/20261017000000_vora_tenant_management.sql`

> **No aplicar la migración en producción sin aprobación.** Probar primero en un proyecto Supabase de pruebas.

## 1. Auditoría (estado antes de esta fase)

| Área | Estado encontrado |
|---|---|
| Tablas | Ya existían `tenants`, `plans`, `tenant_subscriptions`, `tenant_memberships`, `tenant_databases`, `platform_audit_logs`, `platform_roles`, `platform_user_roles`. No se duplicó ninguna. |
| Faltaba en `tenants` | RIF, correo, teléfono, modalidad Shared/Dedicated y el estado administrativo «pendiente». |
| Rol `super_admin` | Se asigna con una fila en `platform_user_roles` (rol `super_admin` de `platform_roles`). El bootstrap automático está deshabilitado; la asignación es manual en la base. |
| Autorización en servidor | Las API de `/api/admin/tenants/*` ya validaban sesión + `super_admin` (401/403). Se centralizó en `lib/admin-guard.ts`. |
| RLS | Las políticas de plataforma aceptaban **cualquier** fila de `platform_user_roles`, no solo `super_admin`. Se reforzó para `tenants`, `tenant_subscriptions` y `platform_audit_logs`. |
| Funcionaba | Alta (asistente), listado, detalle, edición básica, branding, módulos, registro de BD dedicada, prueba de conexión, membresías, auditoría. |
| No funcionaba / solo interfaz | Los botones **Suspender/Activar** enviaban `POST` a `/status`, que solo aceptaba `PATCH` (respondía 405). No había forma de **asignar o cambiar plan**. Los botones «Invitar usuario» y «Añadir dominio» del detalle no tienen acción (siguen pendientes). |
| Aprovisionamiento | La API de estado permitía marcar `technical_status = ready` a mano; ahora solo lo hace la prueba de conexión de una empresa Dedicated. |

## 2. Qué se implementó

- **Listado** (`/admin/tenants`): nombre comercial y razón social, RIF, slug, estado, plan, modalidad + aprovisionamiento, fecha; búsqueda (nombre, razón social, RIF, slug) y filtros (estado, plan, modalidad); vista de tarjetas en móvil.
- **Registro** (`/admin/tenants/new`, 8 pasos): datos fiscales y de contacto, plan inicial y modalidad, plantilla, branding, módulos, infraestructura (Dedicated opcional), administrador opcional y resumen.
  - Validación en cliente y en servidor (zod): obligatorios, RIF venezolano (`J-12345678-9`), correo, teléfono, slug, plan activo.
  - Unicidad de slug y RIF (409) + índice único en base de datos.
  - La empresa nace **Pendiente** y con **aprovisionamiento pendiente**; se crea su suscripción en estado pendiente.
- **Detalle** (`/admin/tenants/[id]`): encabezado con estado administrativo, aprovisionamiento, modalidad y «Operativa»; pestañas Resumen, Empresa (edición), Plan y suscripción, Branding, Módulos, Infraestructura, Usuarios, Dominios, Auditoría.
- **Acciones**: crear, editar, activar, suspender (con confirmación), reactivar, asignar/cambiar plan, cambiar modalidad (solo mientras la infraestructura no esté verificada), registrar conexión dedicada. **No hay eliminación física.**
- **Auditoría**: `tenant.create`, `tenant.update`, `tenant.status.activate|suspend|reactivate`, `tenant.plan.change` (con plan anterior y nuevo), registro y prueba de BD.

### Shared y Dedicated

- **Estado administrativo** (`commercial_status`): pendiente, activa, suspendida (prueba y cancelada se conservan para datos existentes).
- **Aprovisionamiento** (`technical_status`): pendiente, lista, error. Solo pasa a «lista» cuando `Probar conexión` verifica una empresa **Dedicated**.
- **Operativa** = activa **y** infraestructura lista. Activar una empresa no la vuelve operativa por sí solo.
- **Shared**: solo se registra la modalidad; las tablas comerciales y el aislamiento por `tenant_id` todavía no existen, por eso queda con aprovisionamiento pendiente.
- **Dedicated**: VORA no crea proyectos Supabase; se registra la conexión (project_ref, URL y el **nombre** del secreto) cuando el proyecto exista.

### API

| Método | Ruta | Uso |
|---|---|---|
| GET / POST | `/api/admin/tenants` | Listar / registrar empresa |
| GET / PATCH | `/api/admin/tenants/[id]` | Detalle / editar datos (no plan ni estado) |
| POST / PATCH | `/api/admin/tenants/[id]/status` | `{ "action": "activate" \| "suspend" \| "reactivate" }` |
| PUT / POST | `/api/admin/tenants/[id]/plan` | `{ "plan_id": "<uuid de un plan activo>" }` |

Todas responden **401** sin sesión y **403** si el usuario no es `super_admin`.

## 3. Aplicar la migración (proyecto de PRUEBAS)

1. En el proyecto Supabase de pruebas, aplica en orden todas las migraciones de `supabase/migrations/` (incluida `20261017000000_vora_tenant_management.sql`), por SQL Editor o con la CLI enlazada a ese proyecto.
2. Asegúrate de tener al menos un plan activo en `plans` (las migraciones existentes crean `Starter` y `Growth`).
3. Tu usuario de prueba debe tener el rol `super_admin` en `platform_user_roles`.
4. Configura `.env.local` (o las variables del entorno de pruebas) con la URL, la anon key y la **service role key real** de ese proyecto.

## 4. Guion de pruebas

Usa solo empresas de prueba (por ejemplo, nombres que empiecen con «PRUEBA»).

| # | Prueba | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Crear empresa | Empresas → Registrar empresa. Completa: PRUEBA Uno, PRUEBA Uno C.A., Venezuela, RIF `J-12345678-9`, correo, moneda VES, Comercio, plan, Shared. Sigue hasta Registrar. | Resumen sin errores; la empresa queda **Pendiente**, **Aprovisionamiento pendiente**, «No operativa». |
| 2 | Slug duplicado | Registra otra con el mismo nombre/slug. | En el paso 1 el slug sale «en uso»; si se fuerza por API: **409**. |
| 3 | RIF duplicado | Otra empresa con el mismo RIF. | **409** «Ya existe una empresa con el RIF…». |
| 4 | Obligatorios y formato | Deja vacío el RIF o escribe `X-123`; correo `abc`. | «Siguiente» deshabilitado y mensaje de formato; por API: **400** con `fields`. |
| 5 | Listado | Vuelve a Empresas; busca por RIF; filtra por estado Pendiente, por plan y por Shared. | La empresa aparece con todas las columnas; los filtros la muestran u ocultan. |
| 6 | Editar | Detalle → Empresa: cambia teléfono y tipo de negocio → Guardar. | «Empresa actualizada»; cambios visibles tras recargar; evento `tenant.update` en Auditoría. |
| 7 | Activar | Detalle → Activar. | Estado **Activa**, sigue **No operativa** (infraestructura pendiente); suscripción «Activa». |
| 8 | Suspender y reactivar | Suspender → confirmar; luego Reactivar. | Pasa a **Suspendida** y vuelve a **Activa**; eventos en Auditoría. |
| 9 | Plan | Detalle → Plan y suscripción → elige otro plan → Cambiar plan. | Plan actualizado en encabezado y listado; evento `tenant.plan.change` con plan anterior y nuevo. |
| 10 | 403 | Con un usuario **sin** rol super_admin, abre `/api/admin/tenants` en el navegador. | **403** «Permisos insuficientes». `/admin` redirige al login. |
| 11 | Claves | En el navegador (F12 → Network/Sources) busca el valor de la service role key. | No aparece en ningún archivo del cliente. |
| 12 | Regresión | Landing, `/login`, módulos y branding de una empresa existente. | Siguen funcionando. |

## 5. Pendiente para fases siguientes

- Tablas comerciales y aislamiento por `tenant_id` + RLS de la modalidad Shared.
- Reforzar con `is_platform_super_admin()` el resto de políticas de plataforma (branding, features, dominios, membresías, invitaciones, BD).
- Botones «Invitar usuario» y «Añadir dominio» del detalle.
- Decidir si una empresa **pendiente** puede entrar a su CRM (`/t/[slug]`): hoy solo se bloquean suspendidas y canceladas.
- Planes de VORA (Emprende, Negocio, Profesional, Enterprise) en la tabla `plans`.
