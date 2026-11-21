# Progreso — VORA Warehouse, POS y estabilización (17–21 nov 2026)

## Cambios realizados

**Estabilización (commit `190db45`, ya en `main`)**
- Restaurados `components/tenant-tabs.tsx` (JSX corrupto en `82a4eb4`) y `lib/core-config.ts` (había quedado vacío).
- Implementada la ruta pública de branding; eliminada la ruta vacía de dominios.
- Revertido el cambio de dominio hecho dentro de una migración ya publicada.
- Seguridad: quitado el acceso con la cookie `vora_pos_session` (se podía falsificar); todas las APIs del POS exigen sesión y membresía (`lib/tenant-api-auth.ts`); `scripts/run-migration.js` ya no contiene la contraseña.

**VORA Warehouse, MVP del documento de 40 vistas (commit `2be07fb`, ya en `main`)**
- 23 vistas: WH-01 a WH-16, WH-18 a WH-23 y WH-27, en `/t/<slug>/warehouse`.
- Modelo de datos único (`20261117030000_warehouse_core_schema.sql`): catálogo, almacenes, movimientos inmutables, saldos sin stock negativo, costo promedio ponderado, documentos con aprobación de ajustes e importaciones idempotentes.
- Permisos por acción y 5 roles de almacén.
- Barra de módulos POS ↔ Warehouse, barra lateral propia de Warehouse y efectos de carga.
- Nombres en el gestor: "VORA Warehouse · Inventario / Proveedores / …".
- Datos demo del POS sacados de la migración a `supabase/seeds/dev_pos_test1.sql`; una migración elimina la tasa BCV ficticia.
- Pruebas: `scripts/test-warehouse.cjs` (15), `test-core.cjs` (21) y `test-core-routes.cjs`.

**Base de datos de desarrollo (`ilrbrpfyfzqpwdgklgmc`)**
- Aplicadas las migraciones `20261117000000`, `…020000`, `…030000`, `…040000`, `…050000` y `20261121000000` (POS). Recorrido completo del POS probado en Stunt Riders con cuentas de prueba `cajero.prueba@vora.test` y `supervisor.prueba@vora.test`.

**POS con Supabase como fuente de verdad y correcciones de seguridad (21 nov, sin commit)**
- Revisión de `0791e01`–`e088293`: el POS mezclaba datos entre empresas (un solo `posStore` en memoria), las ventas nunca llegaban a Supabase (el turno solo existía en el navegador) y Warehouse descontaba stock por ventas que se perdían al reiniciar.
- Migración `20261121000000_pos_server_persistence.sql`: `pos_tenant_settings` (tasa, límites, correlativos), `pos_staff_pins` y funciones solo para el servidor (`pos_open_shift`, `pos_add_cash_movement`, `pos_close_shift`, `pos_record_sale`, `pos_record_return`, `pos_record_debt_payment`). Venta y salida de stock en una sola transacción, idempotentes.
- `lib/pos/server.ts`: el servidor recalcula precio, impuesto y totales desde el catálogo; aplica el límite de descuento; rechaza si el total cambió desde que se cargó el catálogo.
- Catálogo configurable por empresa en el gestor (`commerce.pos` → `catalog_source`): `warehouse_items` o `pos_products` (con su política de stock).
- PIN personal de supervisor (hash scrypt, bloqueo tras 5 intentos) para descuentos, devoluciones y retiros; cada supervisor lo define en Configuración. Se eliminaron el PIN 9999 y los usuarios ficticios.
- Permisos por acción en todas las rutas del POS (`hasTenantPermission`).
- Todas las vistas leen turno, ventas, devoluciones, configuración y personal del servidor. Sin conexión: comprobante provisional y cola que no reintenta rechazos definitivos.
- Credenciales de The Factory HKA fuera del código: variables de entorno `<REF>_USER` / `<REF>_PASSWORD`; configuración fiscal en `pos_fiscal_integrations`.
- Roles del gestor alineados con los permisos reales (`wh_*`, `pos_auditor`); se quitó `owner`, que no otorgaba nada.
- Login de empresa sin el acceso "demo" ficticio. Inicio de empresa: POS si lo tiene, Warehouse si solo tiene Warehouse, si no el panel.
- Pruebas: `test-pos.cjs` (13, nueva), `test-core-routes.cjs` (82), `test-client-dashboard.cjs` vuelve a pasar; build correcto.

**Warehouse: rediseño y cierre del MVP (21 nov, sin commit)**
- Rediseño con la estética de los wireframes (barra verde, fondo crema, tarjetas blancas) y acabado SaaS: componentes en `components/warehouse/wh-ui.tsx` (botones, campos, KPI con icono, tablas con hover, estados vacíos, búsqueda), icono por vista y se quitó la franja "Acciones: …". Dashboard con gráfico de entradas/salidas (paleta validada), ranking de valor y accesos rápidos.
- WH-14: pestaña **Conciliación** (`lib/warehouse/reconcile.ts`): ventas/devoluciones del POS frente a movimientos de stock (sin salida, sin venta, cantidad distinta).
- WH-12: **matriz de permisos por empresa** (`tenant_role_matrix`, solo la edita el administrador) y **alcance por almacén** por usuario (`warehouse_user_scopes`), aplicado en documentos, transferencias e importaciones.
- WH-04: **transferencias** entre almacenes con stock en tránsito (permiso `stock.transfer`), vista `/warehouse/transfers`.
- WH-07: **evidencia** de ajustes (foto o PDF ≤ 5 MB, tipo verificado por firma) en Storage privado `warehouse-evidence`, con enlace firmado de 60 s.
- WH-23: **escaneo con cámara** (BarcodeDetector) donde el navegador lo permite.
- WH-11: **reportes programados** por correo (resumen + enlace) con Vercel Cron `/api/cron/warehouse-reports` (`CRON_SECRET`).
- Migración `20261121010000_warehouse_mvp_completion.sql`. Pruebas: `test-warehouse.cjs` (17), `test-core-routes.cjs` (93); build correcto.

## Decisiones
- Warehouse se construye según `Docs Iniciales/Vora Warehouse/VORA_Warehouse_Definicion_Integral_40_Vistas_v2.pdf`.
- Se conserva Proveedores, aunque no está en el documento.
- Valoración de inventario: costo promedio ponderado.
- No hay dominio definido: se prueba con `/t/<slug>` o `<slug>.localhost`.
- Las migraciones no siembran datos ficticios; los datos demo viven en `supabase/seeds/`.
- XLSX: se propone `exceljs` (MIT, permite listas desplegables); instalarla requiere autorización.
- POS: el origen del catálogo se elige por empresa (Warehouse o catálogo propio del POS).
- POS: las autorizaciones de supervisor usan PIN personal validado en el servidor.

## Pendiente
- **Aplicar la migración `20261121010000`** (Warehouse) en desarrollo y probar transferencias, roles, evidencias y reportes programados. Configurar `CRON_SECRET` y `NEXT_PUBLIC_APP_URL` en el despliegue.
- **Cuentas de prueba** en Stunt Riders (`cajero.prueba@vora.test`, `supervisor.prueba@vora.test`): borrarlas cuando no se necesiten.
- **Credenciales HKA:** las que estaban en el código (`lib/pos-hka-provider.ts`) siguen en el historial de git; si eran reales, rotarlas. Configurar `<REF>_USER` / `<REF>_PASSWORD` en el servidor.
- **Contraseña expuesta:** cambiar la contraseña del proyecto Supabase `bpjjuoyizmgyxzubeaag`. Está en el historial público de GitHub desde el commit `34cbd64` (15 oct). Valorar hacer el repositorio privado.
- **Ramas:** borrar en GitHub la rama mal nombrada `origin/feat/vora-warehouse` y renombrar la local del mismo nombre.
- **Documentos:** decidir si `Docs Iniciales/` se sube al repositorio.
- **POS, sin persistir aún:** motor de promociones (los ejemplos eran ficticios; hoy no hay promociones), comisión por asesor (los asesores son usuarios reales con rol `pos_sales_rep`, sin tasa de comisión) y el detalle de cobros Cashea más allá del pago registrado.
- **MVP Warehouse:** XLSX (falta autorizar la dependencia) y reserva de stock antes del cobro (requiere tocar el cobro del POS). Ubicaciones internas (pasillo/estante) quedan para el módulo `warehouse.locations`.
- **Extensión temprana:** WH-17 Variantes, WH-24 Seriales, WH-25 Etiquetas, WH-26 Conteo físico, WH-28 y WH-29 Activos.
- **Vertical petrolera:** WH-30 a WH-40.
- **Decisiones del §13 del documento:** formato de códigos, política de seriales, impresoras y lectores, reglas de aprobación, impuestos.

## Siguiente paso
Aplicar `20261121010000` en desarrollo y probar Warehouse; decidir XLSX y la reserva de stock; luego hacer el commit. Después, extensión temprana empezando por WH-26 Conteo físico.
