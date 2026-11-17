-- ============================================================
-- Limpieza: la migración del POS (20261019000000, sección 10) insertaba una
-- tasa BCV ficticia en platform_exchange_rates, la tabla real de los cobros
-- de suscripción. Esa siembra se movió a supabase/seeds/dev_pos_test1.sql.
--
-- Elimina la tasa ficticia solo si ningún cobro la usa. Si algún cobro ya la
-- usó, no la toca (el cobro conserva su tasa) y lo informa para revisión.
-- Idempotente: si no existe, no hace nada.
-- ============================================================
DO $$
DECLARE
  v_mock constant text := 'Tasa BCV Oficial 36,500000 VES/USD [mock]';
  v_used integer;
  v_deleted integer;
BEGIN
  SELECT count(*) INTO v_used
  FROM public.platform_invoices i
  JOIN public.platform_exchange_rates r ON r.id = i.exchange_rate_id
  WHERE r.source = v_mock;

  DELETE FROM public.platform_exchange_rates r
  WHERE r.source = v_mock
    AND NOT EXISTS (SELECT 1 FROM public.platform_invoices i WHERE i.exchange_rate_id = r.id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'Tasas ficticias eliminadas: %', v_deleted;
  IF v_used > 0 THEN
    RAISE WARNING 'Hay % cobro(s) emitidos con la tasa ficticia [mock]; revísalos manualmente.', v_used;
  END IF;
END $$;
