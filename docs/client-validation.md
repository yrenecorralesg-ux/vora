# Validación con el Cliente — EKOSCRM

## Visión General

Este documento define el proceso de liberación de módulos para validación con el cliente, la plantilla de feedback y los estados de aceptación que rigen el flujo de cada módulo desde desarrollo hasta aceptación.

---

## Liberación por Módulo

### Filosofía

Cada módulo del CRM se libera de forma **independiente** para validación. El cliente valida módulo por módulo, no toda la plataforma de una vez. Esto permite:

- Iteraciones focalizadas
- Detección temprana de desviaciones
- Aceptación parcial (algunos módulos aceptados mientras otros se ajustan)

### Estado de Liberación (`release_status`)

Cada `tenant_features` tiene un `release_status` que controla dónde está el módulo en el ciclo de validación:

| Estado | Descripción | Acción siguiente |
|--------|-------------|------------------|
| `planned` | Planificado, aún no liberado | Desarrollar |
| `in_development` | En desarrollo activo | Completar desarrollo |
| `released_for_testing` | Liberado al cliente para pruebas | Cliente valida |
| `accepted` | Aceptado por el cliente sin reservas | Cerrado |
| `accepted_with_pending` | Aceptado con pendientes menores | Resolver pendientes |

### Flujo de Liberación

```
planned → in_development → released_for_testing → accepted
                                            └─→ accepted_with_pending → accepted
```

### Proceso por Módulo

1. **Marcar `in_development`** en `tenant_features.release_status` cuando comience el desarrollo del módulo para un tenant específico
2. **Notificar al cliente** que el módulo está listo para pruebas
3. **Marcar `released_for_testing`** cuando el módulo esté disponible en el entorno del tenant
4. **Cliente valida** usando la plantilla de feedback (ver abajo)
5. **Resultado:**
   - Sin objeciones → marcar `accepted`
   - Con ajustes menores → marcar `accepted_with_pending` con lista de pendientes
   - Con objeciones mayores → mantener `released_for_testing`, iterar, re-validar

### Módulos Liberados en Sprint 1

En Sprint 1, todos los features se crean con `release_status: 'planned'`. Los módulos CRM core están construidos visualmente (con datos demo) pero no se han liberado formalmente para validación porque no tienen datos reales.

Los módulos que el cliente puede **validar visualmente** en Sprint 1:

| Módulo | Estado | Nota |
|--------|--------|------|
| Dashboard | Demo visual | Datos estáticos |
| Clientes | Demo visual | Datos estáticos |
| Productos | Demo visual | Datos estáticos |
| Ventas | Demo visual | Datos estáticos |
| Pedidos | Demo visual | Datos estáticos |
| Tareas | Demo visual | Datos estáticos |
| Segmentos | Demo visual | Datos estáticos |
| Campañas | Demo visual | Datos estáticos |
| Captura QR | Demo visual | Datos estáticos |
| Shopify | Placeholder | En hoja de ruta |
| SIIGO | Placeholder | En hoja de ruta |
| Predictivo | Placeholder | En hoja de ruta |

---

## Plantilla de Feedback

### Estructura

Para cada módulo liberado, el cliente completa la siguiente plantilla:

```markdown
## Validación de Módulo: [Nombre del Módulo]

**Tenant:** [Nombre del tenant]
**Fecha:** [Fecha de validación]
**Validador:** [Nombre y rol]
**Versión:** [Versión o sprint]

### 1. Funcionalidad

- [ ] Las funciones principales operan correctamente
- [ ] Los flujos principales funcionan de inicio a fin
- [ ] Los errores se muestran claramente

**Comentarios:**
> [Comentarios específicos sobre funcionalidad]

### 2. Interfaz

- [ ] La interfaz es clara y comprensible
- [ ] Los colores y branding son correctos
- [ ] La navegación es intuitiva

**Comentarios:**
> [Comentarios sobre UI/UX]

### 3. Datos

- [ ] Los datos mostrados son correctos
- [ ] Los formatos (moneda, fecha, etc.) son apropiados
- [ ] Los filtros y búsquedas funcionan

**Comentarios:**
> [Comentarios sobre datos]

### 4. Pendientes

| # | Descripción | Severidad |
|---|-------------|-----------|
| 1 | [Pendiente] | Crítica / Menor |

### 5. Resultado

- [ ] Aceptado
- [ ] Aceptado con pendientes
- [ ] Requiere cambios

**Firma:** [Nombre del validador]
```

### Registro de Feedback

El feedback se registra en `platform_audit_logs` con:

```json
{
  "action": "module.validation.feedback",
  "resource": "tenant_features",
  "resource_id": "<tenant_feature_id>",
  "details": {
    "module": "crm.customers",
    "result": "accepted_with_pending",
    "pendings": 2,
    "validator": "cliente@empresa.com"
  }
}
```

---

## Estados de Aceptación

### `accepted`

El módulo cumple con todos los requisitos y el cliente lo acepta sin reservas.

**Acciones:**
- Actualizar `tenant_features.release_status = 'accepted'`
- Registrar en auditoría
- No se requieren más iteraciones

### `accepted_with_pending`

El módulo es funcional pero tiene pendientes menores que no bloquean su uso.

**Acciones:**
- Actualizar `tenant_features.release_status = 'accepted_with_pending'`
- Registrar los pendientes en `tenant_features.config` (jsonb) como lista
- Planificar resolución de pendientes en el siguiente sprint
- Una vez resueltos, actualizar a `accepted`

### No Aceptado (iterar)

El módulo tiene objeciones mayores que requieren cambios sustanciales.

**Acciones:**
- Mantener `tenant_features.release_status = 'released_for_testing'`
- Documentar las objeciones
- Desarrollar los cambios necesarios
- Re-liberar para validación

---

## Criterios de Aceptación por Categoría

### Módulos CRM Core (Dashboard, Clientes, Productos, Ventas, Pedidos, Tareas)

| Criterio | Descripción |
|----------|-------------|
| CRUD | Crear, leer, actualizar, eliminar funciona |
| Búsqueda | Filtros y búsqueda operan correctamente |
| Paginación | La paginación funciona con volúmenes reales |
| Formatos | Moneda, fechas y números se muestran en el locale del tenant |
| Validación | Los formularios validan campos obligatorios y formatos |
| Permisos | El rol del usuario restringe acciones apropiadamente |

### Integraciones (Shopify, SIIGO)

| Criterio | Descripción |
|----------|-------------|
| Conexión | La conexión con el servicio externo se establece |
| Sincronización | Los datos se sincronizan en ambas direcciones (si aplica) |
| Errores | Los errores de conexión se muestran y permiten reintentar |
| Webhooks | Los webhooks se validan correctamente |

### Analítica (Predictivo)

| Criterio | Descripción |
|----------|-------------|
| Datos | Requiere volumen suficiente de datos para validar |
| Precisión | El modelo produce resultados razonables |
| Reglas base | Si no hay datos suficientes, las reglas base funcionan |
| Plan de mejora | Se documenta cómo mejorar la precisión con más datos |

---

## Entorno de Validación

### Staging

- URL: `staging.ekoscrm.app` o `<branch>.vercel.app`
- Supabase de staging (separado de producción)
- Datos seed + datos de prueba
- El cliente accede con sus credenciales

### Tenant de Prueba

Se recomienda crear un tenant de prueba con:
- Branding real del cliente
- Features que se están validando activados
- Datos demo hasta que el esquema del tenant esté listo
- Membresía del cliente configurada

### Acceso del Cliente

El cliente accede via `/t/[slug]` con sus credenciales. Solo ve los módulos habilitados en su `tenant_features`. El `DemoBanner` indica que los datos son demo hasta que se conecten datos reales.
