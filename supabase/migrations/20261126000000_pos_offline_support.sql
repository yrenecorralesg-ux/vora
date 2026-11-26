-- ============================================================
-- VORA POS · Soporte offline completo (PIN offline y auditoría)
--   · pos_staff_pins.offline_bundle: paquete cifrado con PBKDF2 + AES-GCM
--     para validar PINes sin conexión y firmar operaciones diferidas sin
--     almacenar jamás el PIN en texto plano en el navegador.
--   · pos_authorizations.offline_authorized_at: marca autorizaciones
--     emitidas en mostrador sin conexión y sincronizadas luego.
-- ============================================================
BEGIN;

ALTER TABLE public.pos_staff_pins
  ADD COLUMN IF NOT EXISTS offline_bundle jsonb;

ALTER TABLE public.pos_authorizations
  ADD COLUMN IF NOT EXISTS offline_authorized_at timestamptz;

COMMIT;
