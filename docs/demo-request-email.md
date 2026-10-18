# Notificaciones de solicitudes de demo

El formulario persiste primero la solicitud en `demo_requests`. Después envía un aviso exclusivamente a `info@venesoftca.com` mediante la API HTTPS de Resend. El remitente pertenece al dominio verificado en Resend y el correo del solicitante se usa en Reply-To. No se envían respuestas automáticas al visitante.

Configurar en Vercel → vora → Settings → Environment Variables → Production:

- `DEMO_REQUEST_FROM`: `VORA <avisos@notificaciones.venesoftca.com>` después de verificar ese subdominio.
- `RESEND_API_KEY`: clave con permiso de envío para el dominio. Ingresarla directamente en Vercel como secreta.

Crear cuenta en https://resend.com/signup y verificar notificaciones.venesoftca.com con los registros que indique Resend. Configurar solo envío; conservar los MX de Google Workspace del dominio raíz. No habilitar recepción en Resend. Documentación: https://resend.com/docs/dashboard/domains/introduction

Después de configurar, redesplegar. La aceptación del proveedor no garantiza recepción en bandeja de entrada: revisar también spam. Probar con una solicitud identificada como prueba y verificar su recepción en el buzón destinatario.

Si falla Resend o falta configuración, la API devuelve 201 porque la solicitud ya existe, con `notification: failed` o `not_configured`; el formulario indica que el aviso no pudo enviarse y evita pedir una segunda solicitud. Los logs solo contienen referencia y estado, nunca credenciales ni datos del visitante. Las solicitudes previas permanecen en Supabase; no se reenvían automáticamente. Esta integración no incluye una cola de reintentos.

Verificación local: `node scripts/test-demo-mail.cjs` y `npm run typecheck`.
