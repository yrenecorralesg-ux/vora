# Acceso del administrador de empresa

Desde Configuración progresiva, Super Admin ingresa un correo y pulsa Invitar o reenviar acceso. Se prepara una invitación por empresa y correo. Supabase genera un enlace de invitación (cuenta nueva) o email OTP (cuenta existente); Resend entrega el aviso con el remitente de servidor existente. Nunca se devuelve el enlace en la respuesta administrativa ni se registra en auditoría.

El cliente abre /auth/activate. El token viaja en el fragmento de URL, se retira del historial y solo se verifica tras pulsar Continuar. El GET no consume el token, para evitar que los escáneres de correo gasten los enlaces. Tras verificarlo se establece una sesión de esa cuenta; el cliente introduce su contraseña de al menos 12 caracteres y confirma. Cambiarla afecta a la misma identidad Auth en todas sus empresas. Las cuentas ya vinculadas conservan su acceso durante un reenvío.

La aceptación usa una función PostgreSQL transaccional: comprueba auth.uid(), correo confirmado coincidente, estado, expiración y rol fijo tenant_admin. Bloquea la empresa antes de activar membresía y conserva las cuotas del plan. Marca la invitación aceptada y audita sin secretos. No escribe en platform_user_roles. No activa DNS, base de datos ni módulos pendientes.

La vigencia máxima es una hora; Supabase puede limitarla más con su configuración Email OTP Expiration. El reenvío reemplaza el hash anterior y tiene un intervalo mínimo de 60 segundos después de un envío aceptado por Resend. No existe reintento automático de correo. El estado accepted de email_status significa aceptación del proveedor, no prueba de entrega en la bandeja. El panel muestra los fallos para reenviar.

La tabla tenant_invitations queda visible solo al Super Admin por RLS, porque el token_hash de Supabase permite verificar una sesión. Las rutas de aceptación consultan la invitación en servidor y comprueban identidad y correo; no confían en tenant_id o role del navegador. Las rutas POST de activación exigen mismo origen. El portal conserva sus comprobaciones independientes de membresía, estado técnico/comercial y servicio contratado/habilitado.

Despliegue: aplicar 20261018000000_tenant_admin_invitation_access.sql, registrar la migración y desplegar main. Utiliza RESEND_API_KEY y DEMO_REQUEST_FROM ya configuradas. No necesita modificar plantillas SMTP ni Site URL de Supabase porque la aplicación verifica el TokenHash directamente.

Validación: scripts/test-core.cjs (PostgreSQL/RLS/cuotas), scripts/test-invitation-routes.cjs (rutas y autorización), scripts/test-core-routes.cjs, scripts/test-demo-mail.cjs y TypeScript/lint. La aceptación humana y entrada de una contraseña real debe hacerla el usuario destinatario.
