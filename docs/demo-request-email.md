# Notificaciones de solicitudes de demo

El formulario persiste primero la solicitud en `demo_requests`. Después envía un aviso exclusivamente a `info@venesoftca.com` mediante Gmail SMTP con TLS. La dirección autenticada es el remitente y el correo del solicitante se usa en Reply-To. No se envían respuestas automáticas al visitante.

Configurar en Vercel → vora → Settings → Environment Variables → Production:

- `GMAIL_SMTP_USER`: dirección completa de la cuenta Gmail o Google Workspace que envía.
- `GMAIL_SMTP_APP_PASSWORD`: contraseña de aplicación de esa cuenta, nunca su contraseña normal. Ingresarla directamente en Vercel como secreta.

Google exige verificación en dos pasos para las contraseñas de aplicación y algunas políticas de Workspace pueden impedir su uso. Documentación oficial: https://support.google.com/accounts/answer/185833

Después de configurar, redesplegar. La aceptación SMTP no garantiza recepción en bandeja de entrada: revisar también spam. Probar con una solicitud identificada como prueba y verificar su recepción en el buzón destinatario.

Si falla Gmail o falta configuración, la API devuelve 201 porque la solicitud ya existe, con `notification: failed` o `not_configured`; el formulario indica que el aviso no pudo enviarse y evita pedir una segunda solicitud. Los logs solo contienen referencia y estado, nunca credenciales ni datos del visitante. Las solicitudes previas permanecen en Supabase; no se reenvían automáticamente. Esta integración no incluye una cola de reintentos.

Verificación local: `node scripts/test-demo-mail.cjs` y `npm run typecheck`.
