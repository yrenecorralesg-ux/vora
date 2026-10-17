# Feature Flags — VORA

## Visión General

VORA utiliza un sistema de feature flags por tenant que controla qué módulos están disponibles para cada empresa. El sistema distingue entre el **estado de implementación** del módulo (¿está construido?) y el **estado de configuración** del flag (¿está activado y configurado para este tenant?).

---

## Catálogo de Features (15 módulos)

### CRM Core (implementados)

| Key | Nombre | Categoría | Deps | Impl. Status | Sort |
|-----|--------|-----------|------|--------------|------|
| `crm.dashboard` | Resumen y Reportes | crm | — | implemented | 1 |
| `crm.customers` | Clientes | crm | — | implemented | 2 |
| `crm.products` | Productos y Catálogos | crm | — | implemented | 3 |
| `crm.sales` | Ventas y Oportunidades | crm | — | implemented | 4 |
| `crm.orders` | Pedidos | crm | — | implemented | 5 |
| `crm.tasks` | Seguimiento | crm | — | implemented | 6 |
| `crm.segments` | Segmentación | crm | — | implemented | 7 |
| `crm.campaigns` | Campañas | crm | `crm.segments` | implemented | 8 |
| `capture.fairs` | Captura QR / Ferias | crm | `crm.customers` | implemented | 9 |

### Integraciones (planificadas)

| Key | Nombre | Categoría | Deps | Impl. Status | Sort |
|-----|--------|-----------|------|--------------|------|
| `integration.shopify` | Shopify | integration | — | **planned** | 10 |
| `integration.siigo` | Facturación SIIGO | integration | `crm.sales` | **planned** | 14 |

### Canales (planificados)

| Key | Nombre | Categoría | Deps | Impl. Status | Sort |
|-----|--------|-----------|------|--------------|------|
| `channel.email` | Correo | channel | — | **planned** | 11 |
| `chatbot.guided_web` | Chatbot Web Guiado | channel | `crm.customers`, `crm.tasks` | **planned** | 12 |

### Automatización (planificada)

| Key | Nombre | Categoría | Deps | Impl. Status | Sort |
|-----|--------|-----------|------|--------------|------|
| `automation.followups` | Reglas de Seguimiento | automation | `crm.tasks` | **planned** | 13 |

### Analítica (planificada)

| Key | Nombre | Categoría | Deps | Impl. Status | Sort |
|-----|--------|-----------|------|--------------|------|
| `analytics.repurchase_pilot` | Predictivo de Recompra | analytics | `crm.orders`, `automation.followups` | **planned** | 15 |

---

## Dependencias

Algunos módulos dependen de otros. Si un módulo dependiente está activado pero su dependencia no, el wizard muestra una advertencia visual:

```
crm.campaigns → depende de: crm.segments
chatbot.guided_web → depende de: crm.customers, crm.tasks
integration.siigo → depende de: crm.sales
automation.followups → depende de: crm.tasks
analytics.repurchase_pilot → depende de: crm.orders, automation.followups
```

El wizard **no bloquea** la activación de un módulo con dependencias faltantes, pero muestra un mensaje de advertencia en color ámbar: `"faltan: crm.segments"`.

---

## Estados

### `implementation_status` (catálogo global)

Este campo vive en la tabla `features` y describe el estado de **construcción** del módulo a nivel de plataforma:

| Estado | Descripción | Color en UI |
|--------|-------------|-------------|
| `implemented` | El módulo está construido y operativo | Verde (success) |
| `planned` | El módulo está planificado pero no construido | Ámbar (warning) |
| `unavailable` | El módulo no está disponible | Gris (muted) |

**Importante:** `implemented` no significa que el módulo tenga datos reales. En Sprint 1, los 9 módulos CRM marcados como `implemented` muestran **datos demo estáticos** desde `lib/demo-data.ts`. La marca `implemented` indica que la UI y el shell del módulo están construidos.

### `config_state` (por tenant)

Este campo vive en `tenant_features` y describe el estado de **configuración** del flag para un tenant específico:

| Estado | Descripción |
|--------|-------------|
| `enabled` | El flag está activado (estado inicial por defecto) |
| `pending_config` | Activado pero requiere configuración adicional |
| `configured` | La configuración requerida fue completada |
| `operational` | El módulo está operativo y verificado |

En Sprint 1, todos los features se crean con `config_state: 'enabled'` y `release_status: 'planned'` desde el wizard.

### `release_status` (por tenant)

Controla el estado de liberación del módulo para un tenant, alineado con el flujo de validación con el cliente:

| Estado | Descripción |
|--------|-------------|
| `planned` | Planificado, aún no liberado |
| `in_development` | En desarrollo activo |
| `released_for_testing` | Liberado para pruebas del cliente |
| `accepted` | Aceptado por el cliente |
| `accepted_with_pending` | Aceptado con pendientes menores |

### `enabled` (booleano por tenant)

El campo `tenant_features.enabled` es el interruptor binario que controla si el módulo aparece en el sidebar del CRM del tenant.

---

## Comportamiento ON vs OFF

### Cuando un feature está `enabled = true`

- El módulo aparece en el sidebar del CRM (`CrmSidebar` filtra por `enabledFeatures`)
- La ruta `/t/[slug]/<module>` es accesible
- El contenido del módulo se renderiza (con datos demo en Sprint 1)

### Cuando un feature está `enabled = false`

- El módulo **no aparece** en el sidebar del CRM
- La ruta existe pero el contenido del módulo no se muestra en la navegación
- No hay bloqueo activo a nivel de ruta en Sprint 1 (la validación de acceso por feature se implementará en un sprint posterior)

### Caso especial: `crm.dashboard`

El dashboard (`/t/[slug]`) **siempre es accesible** si el usuario tiene membresía, independientemente de si está en la lista de features habilitados:

```typescript
// app/t/[slug]/layout.tsx
if (!enabledFeatures.includes('dashboard')) {
  enabledFeatures.push('dashboard');
}
```

Esto garantiza que el tenant siempre tenga una página de inicio al ingresar al CRM.

---

## `implementation_status` vs `config_state`

Estos dos campos son independientes y responden a preguntas distintas:

| Pregunta | Campo | Tabla | Respuesta |
|----------|-------|-------|-----------|
| ¿El módulo está construido a nivel de plataforma? | `implementation_status` | `features` | implemented / planned / unavailable |
| ¿Está activado y configurado para este tenant? | `config_state` | `tenant_features` | enabled / pending_config / configured / operational |

### Escenarios

| Escenario | impl_status | config_state | Comportamiento |
|-----------|-------------|--------------|----------------|
| Módulo CRM construido, activado para tenant | `implemented` | `enabled` | Aparece en sidebar, muestra datos demo |
| Módulo CRM construido, no activado | `implemented` | (no hay row) | No aparece en sidebar |
| Shopify planificado, casilla activada | `planned` | `enabled` | Aparece en sidebar como placeholder |
| Shopify planificado, no activado | `planned` | (no hay row) | No aparece |
| SIIGO planificado, activado sin configurar | `planned` | `pending_config` | Aparece con indicador de configuración pendiente |

### UI en el Wizard

El wizard de creación de tenants muestra el `implementation_status` como un badge junto a cada módulo:

- **Implementado** → badge verde
- **Planificado** → badge ámbar
- **No disponible** → badge gris

Esto permite al super admin saber qué módulos están realmente construidos antes de activarlos para un tenant.

### UI en el Detalle del Tenant

La pestaña de módulos en el detalle del tenant (`/admin/tenants/[id]`) muestra:

- `feature_key` y nombre
- `enabled` (toggle visual)
- `config_state` (badge)
- `release_status` (badge)
- Categoría del feature

---

## Guardado de Features

El endpoint `POST /api/admin/tenants/[id]/features` utiliza una estrategia de **delete + insert** (replace):

1. Elimina todas las filas existentes en `tenant_features` para el tenant
2. Inserta las nuevas filas con los flags seleccionados

```typescript
// API route — simplificado
await service.from('tenant_features').delete().eq('tenant_id', params.id);

const rows = features.map(f => ({
  tenant_id: params.id,
  feature_key: f.feature_key,
  enabled: f.enabled,
  config: {},
  config_state: 'enabled',
  release_status: 'planned',
}));

await service.from('tenant_features').insert(rows);
```

**Validaciones:**
- Cada `feature_key` debe existir en la tabla `features`
- No se permiten duplicados (`UNIQUE(tenant_id, feature_key)`)
- El campo `enabled` debe ser booleano

---

## Features Reservadas (No Incluidas en Sprint 1)

Las siguientes features están reservadas para el futuro pero **no se incluyen en el seed** del catálogo:

- `whatsapp` — Canal de WhatsApp
- `conversations` — Conversaciones unificadas
- `generative_chatbot` — Chatbot generativo con IA
- `visual_builder` — Constructor visual de flujos

Estas features se añadirán al catálogo `features` cuando comience su desarrollo.
