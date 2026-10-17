# VORA Core progresivo

## Alcance de esta entrega

Alta mínima con nombre, subdominio, modalidad Shared/Dedicated y datos legales opcionales. La operación PostgreSQL `vora_create_tenant` guarda empresa, dominio reservado, identidad VORA y auditoría en una sola transacción. No depende de correo, DNS, plan ni conexión operativa. Defaults para nuevas empresas: Venezuela, USD y America/Caracas. Los registros existentes conservan sus datos.

El detalle de empresa permite guardar plan, base de datos, administrador y servicios por separado. Branding y perfil reutilizan los formularios existentes. Un error en un apartado no revierte la empresa ni impide configurar los restantes. El subdominio no se cambia mediante el editor de perfil.

## Dominios

Principal: `vora.venesoftca.com`. Empresa: `<slug>.vora.venesoftca.com`. Acceso provisional: `/t/<slug>` con autenticación y membresía. El DNS y el alta del dominio en el hosting son manuales. La verificación solicita HTTPS al hostname reservado y compara el desafío de este despliegue; no sigue redirecciones ni admite destinos personalizados. Un hostname pendiente no se declara activo. El middleware resuelve el subdominio y bloquea rutas de otra empresa. No modifica proveedores DNS ni Vercel.

## Shared / Dedicated

La modalidad se decide al crear y es inmutable en esta entrega; cambiarla requiere un procedimiento de migración de datos. Shared usa `tenant_workspaces`, con `tenant_id`, RLS y membresías. Guardar configura el espacio; verificar comprueba acceso y versión Core. Esto no crea tablas de ventas ni inventarios: cada módulo futuro requerirá su esquema con RLS y pruebas de aislamiento. Dedicated admite configuración parcial y prueba de conexión posterior. Una conexión activa no se sustituye silenciosamente.

`lib/tenant-data.ts` es el punto de resolución servidor para los futuros repositorios de módulos. Shared utiliza la sesión y mantiene RLS. Dedicated obtiene la clave a través de `secret_ref` después de comprobar autorización. Los módulos deben verificar permisos, filtrar `tenant_id` y realizar las operaciones sensibles en transacciones. El contrato externo heredado `ekoscrm_health_check` se conserva por compatibilidad; el mensaje visible utiliza VORA. Su renombrado requiere migración en cada base Dedicated y no se ejecuta aquí.

## Preparación y servicios

“Validar preparación de Core” exige plan, base verificada y administrador activo. DNS mantiene su estado independiente. Los servicios tienen contratación, activación y configuración por función independientes. Las dependencias se validan en servidor; un servicio planificado puede contratarse, pero permanece inactivo. Solo Venesoft modifica la contratación. Los módulos heredados siguen siendo demostraciones y llevan una advertencia visible.

El plan Emprende Shared se crea con US$15/mes y límites iniciales editables. Desde Suscripciones y cobros se crean o editan planes, precios y cuotas. La cuota de usuarios activos se comprueba en PostgreSQL. Las demás cuotas quedan como parámetros para los módulos que las implementen. No hay cobro automático, renovación programada ni suspensión automática por vencimiento.

## Suscripciones y Pago Móvil

Separados de la facturación de los comercios. Venesoft registra los datos receptores y una tasa de hoy en Bs por USD, según fecha de Caracas, con fuente y responsable. El historial no se sobrescribe. La emisión requiere plan con precio, suscripción, receptor válido y tasa de hoy. El cargo guarda precio USD, tasa, importe redondeado Bs y receptor. Los cambios posteriores no alteran ese cargo. Períodos superpuestos se rechazan bajo bloqueo de la suscripción.

El administrador reporta referencia, banco emisor, teléfono, fecha y monto desde `/t/<slug>/subscription`. Solo ve cargos de su empresa. La referencia no confirma el pago: Venesoft registra el resultado de la revisión bancaria y aprueba o rechaza. Aprobar liquida el cargo y actualiza la vigencia de la suscripción en una transacción. No reactiva por sí solo una empresa suspendida por otro motivo. No hay conexión bancaria automática ni archivo adjunto de comprobante en esta entrega. Un cargo de suscripción no se presenta como documento fiscal autorizado.

## Activación del cambio

1. Revisar y aprobar `20261017000000_progressive_vora_core.sql`.
2. Hacer respaldo y aplicar la migración incremental mediante el procedimiento habitual. No ejecutar migraciones históricas de nuevo en producción.
3. Desplegar esta rama junto al esquema actualizado.
4. Configurar receptor Pago Móvil, tasa diaria y precios de planes desde Core.
5. Crear empresa, asignar plan y servicios, preparar Shared o Dedicated, asignar un administrador existente y validar preparación.
6. Configurar dominio manualmente y verificar DNS/HTTPS cuando esté listo.

No se modificaron archivos de variables de entorno, migraciones históricas ni producción. El envío/aceptación de invitaciones por correo continúa pendiente: las invitaciones se registran y se muestran como pendientes, sin afirmar que se entregaron. Para pruebas puede asignarse una cuenta existente desde Core.

## Pruebas reproducibles

TypeScript: `npm run typecheck`. Build: `npm run build`.

PostgreSQL aislado: instalar `@electric-sql/pglite` en un directorio temporal, sin agregarlo a las dependencias productivas. Ejecutar `node scripts/test-core.cjs <ruta-absoluta-al-paquete-pglite>`. Reproduce las migraciones modulares históricas y la nueva; no carga el inicial consolidado duplicado. Comprueba creación atómica, subdominios, permisos, aislamiento RLS, cuotas, preparación, tasas, cargos y revisión manual. No se conecta a Supabase.

Rutas y middleware: `node scripts/test-core-routes.cjs`. Lint: `npm run lint`.

Validación de esta entrega: 14 pruebas PostgreSQL y 15 pruebas de rutas/middleware aprobadas; TypeScript y build aprobados. Lint sin errores, con cuatro advertencias heredadas sobre imágenes. Se comprobó el rechazo HTTP de accesos anónimos en el servidor local. No se validaron DNS reales, SMTP, bases Dedicated externas ni el recorrido con cuentas reales en producción.
