-- ============================================================
-- VORA POS · Persistencia en servidor (turnos, ventas, devoluciones)
--
-- Hasta ahora el POS vivía en memoria: el turno se abría en el navegador y las
-- ventas se perdían al reiniciar el servidor, mientras Warehouse sí descontaba
-- stock. Esta migración hace de Supabase la fuente de verdad:
--   · pos_tenant_settings: tasa, límites y correlativos por empresa.
--   · pos_staff_pins: PIN personal de supervisor (hash calculado en el servidor).
--   · Funciones solo para service_role (las rutas API las llaman después de
--     autorizar), con el mismo patrón que Warehouse: p_tenant + p_actor.
--   · Una venta y su salida de stock ocurren en la misma transacción; si falta
--     stock, no queda venta registrada.
--   · El catálogo puede ser warehouse_items o pos_products (configurable por
--     empresa); cada venta guarda de cuál salió.
-- Aditiva: no modifica datos existentes.
-- ============================================================
BEGIN;

-- 1. Configuración y correlativos por empresa --------------------------------
CREATE TABLE IF NOT EXISTS public.pos_tenant_settings (
  tenant_id                    uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_exchange_rate         numeric(18,6) CHECK (active_exchange_rate IS NULL OR active_exchange_rate > 0),
  exchange_rate_source         text,
  exchange_rate_api_url        text,
  auto_fetch_exchange_rate     boolean NOT NULL DEFAULT true,
  exchange_rate_updated_at     timestamptz,
  max_cashier_discount_percent numeric(5,2) NOT NULL DEFAULT 5
                               CHECK (max_cashier_discount_percent BETWEEN 0 AND 100),
  allow_partial_payments       boolean NOT NULL DEFAULT true,
  active_methods               text[] NOT NULL DEFAULT ARRAY['efectivo', 'pago_movil', 'tarjeta', 'cashea'],
  internal_doc_prefix          text NOT NULL DEFAULT 'COMP-INT-',
  require_pin_for_withdrawals  boolean NOT NULL DEFAULT true,
  next_sale_seq                bigint NOT NULL DEFAULT 1 CHECK (next_sale_seq > 0),
  next_doc_seq                 bigint NOT NULL DEFAULT 1 CHECK (next_doc_seq > 0),
  next_return_seq              bigint NOT NULL DEFAULT 1 CHECK (next_return_seq > 0),
  updated_by                   uuid,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

-- 2. PIN personal de supervisor ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_staff_pins (
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id    uuid NOT NULL,
  pin_hash        text NOT NULL CHECK (length(pin_hash) > 20),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, auth_user_id)
);

-- 3. Columnas nuevas ---------------------------------------------------------
ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'pos'
    CHECK (catalog_source IN ('pos', 'warehouse')),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE public.pos_sale_lines
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.warehouse_items(id) ON DELETE RESTRICT;

ALTER TABLE public.pos_return_lines
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'sellable'
    CHECK (condition IN ('sellable', 'damaged'));

ALTER TABLE public.pos_sale_returns
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS pos_sale_returns_idempotency
  ON public.pos_sale_returns (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.pos_customers
  ADD COLUMN IF NOT EXISTS wallet_balance_usd numeric(18,2) NOT NULL DEFAULT 0
    CHECK (wallet_balance_usd >= 0);

ALTER TABLE public.pos_authorizations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

CREATE INDEX IF NOT EXISTS pos_sales_tenant_created_idx ON public.pos_sales (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pos_sales_shift_idx ON public.pos_sales (shift_id);
CREATE INDEX IF NOT EXISTS pos_sale_lines_sale_idx ON public.pos_sale_lines (sale_id);
CREATE INDEX IF NOT EXISTS pos_sale_payments_sale_idx ON public.pos_sale_payments (sale_id);
CREATE INDEX IF NOT EXISTS pos_shifts_tenant_idx ON public.pos_shifts (tenant_id, opened_at DESC);

ALTER TABLE public.pos_tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_staff_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_tenant_settings, public.pos_staff_pins FROM anon, authenticated;

-- 4. Funciones auxiliares ----------------------------------------------------
-- Suma un delta a una cubeta del arqueo esperado del turno.
CREATE OR REPLACE FUNCTION public.pos_bump_expected(p_shift uuid, p_key text, p_delta numeric)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  UPDATE pos_shifts
     SET expected_totals = jsonb_set(
           expected_totals, ARRAY[p_key],
           to_jsonb(round(coalesce((expected_totals->>p_key)::numeric, 0) + p_delta, 2)))
   WHERE id = p_shift;
$$;

CREATE OR REPLACE FUNCTION public.pos_audit(
  p_tenant uuid, p_branch uuid, p_shift uuid, p_actor uuid, p_event text,
  p_entity text, p_entity_id text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  INSERT INTO pos_audit_events (tenant_id, branch_id, shift_id, actor_id, event_type, entity_type,
                                entity_id, description, metadata)
  VALUES (p_tenant, p_branch, p_shift, p_actor, p_event, p_entity, p_entity_id, p_description,
          coalesce(p_metadata, '{}'::jsonb));
$$;

-- 5. Turnos ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_open_shift(
  p_tenant uuid, p_actor uuid, p_branch uuid, p_register uuid, p_cashier_name text,
  p_opening_usd numeric, p_opening_ves numeric, p_notes text
) RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Falta el usuario que abre el turno.'; END IF;
  IF coalesce(p_opening_usd, -1) < 0 OR coalesce(p_opening_ves, -1) < 0 THEN
    RAISE EXCEPTION 'Los montos de fondo inicial deben ser iguales o mayores a 0.';
  END IF;
  PERFORM 1 FROM pos_registers
    WHERE id = p_register AND tenant_id = p_tenant AND branch_id = p_branch AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'La caja no existe, no pertenece a la sede o no está activa.'; END IF;
  PERFORM 1 FROM pos_shifts WHERE tenant_id = p_tenant AND cashier_user_id = p_actor AND status = 'abierto';
  IF FOUND THEN RAISE EXCEPTION 'Ya tienes un turno abierto en otra caja. Ciérralo antes de abrir uno nuevo.'; END IF;

  BEGIN
    INSERT INTO pos_shifts (tenant_id, branch_id, register_id, cashier_user_id, cashier_name_snapshot,
                            opening_amount_usd, opening_amount_ves, opening_notes, expected_totals)
    VALUES (p_tenant, p_branch, p_register, p_actor, nullif(trim(p_cashier_name), ''),
            p_opening_usd, p_opening_ves, nullif(trim(p_notes), ''),
            jsonb_build_object('efectivo_usd', round(p_opening_usd, 2), 'efectivo_ves', round(p_opening_ves, 2),
                               'pago_movil_ves', 0, 'tarjeta_ves', 0, 'cashea_usd', 0))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'La caja seleccionada ya tiene un turno abierto. No se permiten dos turnos simultáneos en la misma caja.';
  END;

  PERFORM pos_audit(p_tenant, p_branch, v_id, p_actor, 'apertura_turno', 'pos_shifts', v_id::text,
    'Apertura de turno para ' || coalesce(nullif(trim(p_cashier_name), ''), 'cajero'),
    jsonb_build_object('opening_usd', p_opening_usd, 'opening_ves', p_opening_ves));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_add_cash_movement(
  p_tenant uuid, p_actor uuid, p_shift uuid, p_type text, p_currency text,
  p_amount numeric, p_reason text, p_authorization uuid
) RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_shift record; v_id uuid; v_key text; v_delta numeric;
BEGIN
  SELECT * INTO v_shift FROM pos_shifts WHERE id = p_shift AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN RAISE EXCEPTION 'El turno no existe o se encuentra cerrado.'; END IF;
  IF p_type NOT IN ('ingreso_efectivo', 'retiro_efectivo', 'ajuste_caja', 'cambio_saldo_inicial') THEN
    RAISE EXCEPTION 'Tipo de movimiento de caja inválido.';
  END IF;
  IF p_currency NOT IN ('USD', 'VES') THEN RAISE EXCEPTION 'Moneda inválida.'; END IF;
  IF coalesce(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a 0.'; END IF;
  IF length(trim(coalesce(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Indica el motivo del movimiento.'; END IF;

  v_key := CASE p_currency WHEN 'USD' THEN 'efectivo_usd' ELSE 'efectivo_ves' END;
  v_delta := CASE p_type WHEN 'retiro_efectivo' THEN -p_amount ELSE p_amount END;
  IF coalesce((v_shift.expected_totals->>v_key)::numeric, 0) + v_delta < 0 THEN
    RAISE EXCEPTION 'El retiro excede el efectivo esperado en caja.';
  END IF;

  INSERT INTO pos_cash_movements (tenant_id, branch_id, shift_id, movement_type, currency, amount,
                                  reason, performed_by, authorization_id)
  VALUES (p_tenant, v_shift.branch_id, p_shift, p_type, p_currency, p_amount, trim(p_reason), p_actor, p_authorization)
  RETURNING id INTO v_id;
  PERFORM pos_bump_expected(p_shift, v_key, v_delta);
  PERFORM pos_audit(p_tenant, v_shift.branch_id, p_shift, p_actor, 'movimiento_caja', 'pos_cash_movements', v_id::text,
    p_type || ' de ' || p_amount || ' ' || p_currency || ': ' || trim(p_reason), '{}'::jsonb);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pos_close_shift(
  p_tenant uuid, p_actor uuid, p_shift uuid, p_declared jsonb, p_justification text
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_shift record; v_key text; v_diff numeric; v_diffs jsonb := '{}'::jsonb; v_has_diff boolean := false;
BEGIN
  SELECT * INTO v_shift FROM pos_shifts WHERE id = p_shift AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El turno de caja especificado no existe.'; END IF;
  IF v_shift.status = 'cerrado' THEN RAISE EXCEPTION 'El turno ya se encuentra cerrado.'; END IF;

  FOREACH v_key IN ARRAY ARRAY['efectivo_usd', 'efectivo_ves', 'pago_movil_ves', 'tarjeta_ves', 'cashea_usd'] LOOP
    v_diff := round(coalesce((p_declared->>v_key)::numeric, 0) - coalesce((v_shift.expected_totals->>v_key)::numeric, 0), 2);
    v_diffs := v_diffs || jsonb_build_object(v_key, v_diff);
    IF v_diff <> 0 THEN v_has_diff := true; END IF;
  END LOOP;
  IF v_has_diff AND length(trim(coalesce(p_justification, ''))) < 5 THEN
    RAISE EXCEPTION 'Diferencia detectada en el arqueo: ingresa una justificación de al menos 5 caracteres.';
  END IF;

  UPDATE pos_shifts
     SET status = 'cerrado', closed_at = now(), closed_by = p_actor,
         declared_totals = coalesce(p_declared, '{}'::jsonb), differences_totals = v_diffs,
         closing_justification = nullif(trim(p_justification), '')
   WHERE id = p_shift;
  PERFORM pos_audit(p_tenant, v_shift.branch_id, p_shift, p_actor, 'cierre_turno', 'pos_shifts', p_shift::text,
    'Cierre de turno con arqueo', jsonb_build_object('expected', v_shift.expected_totals,
      'declared', p_declared, 'differences', v_diffs));
  RETURN v_diffs;
END $$;

-- 6. Ventas ------------------------------------------------------------------
-- p_sale lo arma el servidor (precios del catálogo, descuentos validados):
-- {idempotency_key, correlation_id, shift_id, register_id, customer_id?, catalog_source,
--  track_stock, stock_policy, warehouse_id?, exchange_rate, subtotal_usd, discount_total_usd,
--  tax_total_usd, total_usd, total_ves, paid_total_usd, paid_total_ves, balance_due_usd,
--  balance_due_ves, payment_status, notes?, discount_authorization_id?, wallet_used_usd,
--  wallet_deposited_usd, metadata, lines: [...], payments: [...]}
CREATE OR REPLACE FUNCTION public.pos_record_sale(p_tenant uuid, p_actor uuid, p_sale jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_key text := nullif(trim(p_sale->>'idempotency_key'), '');
  v_source text := coalesce(p_sale->>'catalog_source', 'pos');
  v_existing record; v_shift record; v_cfg record; v_customer uuid; v_auth uuid;
  v_sale_id uuid; v_sale_number text; v_doc_number text; v_rate numeric;
  v_line jsonb; v_pay jsonb; v_prod record; v_stock_lines jsonb := '[]'::jsonb;
  v_amount numeric; v_wallet_used numeric; v_wallet_dep numeric; v_new_stock numeric;
BEGIN
  IF v_key IS NULL THEN RAISE EXCEPTION 'Falta la clave de idempotencia de la venta.'; END IF;
  SELECT id, sale_number, document_number INTO v_existing
    FROM pos_sales WHERE tenant_id = p_tenant AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('sale_id', v_existing.id, 'sale_number', v_existing.sale_number,
                              'document_number', v_existing.document_number, 'replay', true);
  END IF;
  IF v_source NOT IN ('pos', 'warehouse') THEN RAISE EXCEPTION 'Origen de catálogo inválido.'; END IF;
  IF jsonb_array_length(coalesce(p_sale->'lines', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene productos.';
  END IF;
  v_rate := (p_sale->>'exchange_rate')::numeric;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'No hay una tasa de cambio válida configurada.'; END IF;

  SELECT * INTO v_shift FROM pos_shifts
    WHERE id = (p_sale->>'shift_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN
    RAISE EXCEPTION 'El turno de caja especificado no existe o se encuentra cerrado.';
  END IF;
  IF v_shift.cashier_user_id <> p_actor THEN
    RAISE EXCEPTION 'El turno pertenece a otro cajero.';
  END IF;

  IF nullif(p_sale->>'customer_id', '') IS NOT NULL THEN
    SELECT id INTO v_customer FROM pos_customers
      WHERE id = (p_sale->>'customer_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente no encontrado.'; END IF;
  END IF;

  IF nullif(p_sale->>'discount_authorization_id', '') IS NOT NULL THEN
    UPDATE pos_authorizations SET consumed_at = now()
     WHERE id = (p_sale->>'discount_authorization_id')::uuid AND tenant_id = p_tenant
       AND operation_type = 'discount_override' AND consumed_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
    RETURNING id INTO v_auth;
    IF v_auth IS NULL THEN RAISE EXCEPTION 'La autorización de descuento no es válida o ya fue usada.'; END IF;
  END IF;

  -- Correlativos de venta y comprobante (bloqueo de la fila de configuración).
  INSERT INTO pos_tenant_settings (tenant_id) VALUES (p_tenant) ON CONFLICT (tenant_id) DO NOTHING;
  UPDATE pos_tenant_settings
     SET next_sale_seq = next_sale_seq + 1, next_doc_seq = next_doc_seq + 1
   WHERE tenant_id = p_tenant
  RETURNING next_sale_seq - 1 AS sale_seq, next_doc_seq - 1 AS doc_seq, internal_doc_prefix INTO v_cfg;
  v_sale_number := 'VTA-' || lpad(v_cfg.sale_seq::text, 7, '0');
  v_doc_number := v_cfg.internal_doc_prefix || lpad(v_cfg.doc_seq::text, 6, '0');

  INSERT INTO pos_sales (
    tenant_id, branch_id, shift_id, register_id, cashier_user_id, customer_id, sale_number,
    commercial_status, payment_status, currency, exchange_rate_snapshot, subtotal_usd,
    discount_total_usd, tax_total_usd, total_usd, total_ves, paid_total_usd, paid_total_ves,
    balance_due_usd, balance_due_ves, notes, discount_authorization_id, idempotency_key,
    correlation_id, confirmed_at, document_number, catalog_source, metadata)
  VALUES (
    p_tenant, v_shift.branch_id, v_shift.id, v_shift.register_id, p_actor, v_customer, v_sale_number,
    'confirmada', coalesce(p_sale->>'payment_status', 'pagada'), 'USD', v_rate,
    (p_sale->>'subtotal_usd')::numeric, (p_sale->>'discount_total_usd')::numeric,
    (p_sale->>'tax_total_usd')::numeric, (p_sale->>'total_usd')::numeric, (p_sale->>'total_ves')::numeric,
    (p_sale->>'paid_total_usd')::numeric, (p_sale->>'paid_total_ves')::numeric,
    (p_sale->>'balance_due_usd')::numeric, (p_sale->>'balance_due_ves')::numeric,
    nullif(trim(p_sale->>'notes'), ''), v_auth, v_key,
    coalesce(nullif(p_sale->>'correlation_id', ''), gen_random_uuid()::text), now(), v_doc_number,
    v_source, coalesce(p_sale->'metadata', '{}'::jsonb))
  RETURNING id INTO v_sale_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_sale->'lines') LOOP
    IF coalesce((v_line->>'quantity')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Cantidad inválida en la venta.'; END IF;
    IF v_source = 'warehouse' THEN
      PERFORM 1 FROM warehouse_items WHERE id = (v_line->>'item_id')::uuid AND tenant_id = p_tenant;
    ELSE
      PERFORM 1 FROM pos_products WHERE id = (v_line->>'product_id')::uuid AND tenant_id = p_tenant;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto % no encontrado en el catálogo.', v_line->>'sku'; END IF;

    INSERT INTO pos_sale_lines (
      tenant_id, sale_id, product_id, item_id, sku_snapshot, name_snapshot, is_service, quantity,
      unit_price_usd, discount_percent, discount_amount_usd, tax_rate_percent, tax_amount_usd,
      line_subtotal_usd, line_total_usd)
    VALUES (
      p_tenant, v_sale_id,
      CASE WHEN v_source = 'pos' THEN (v_line->>'product_id')::uuid END,
      CASE WHEN v_source = 'warehouse' THEN (v_line->>'item_id')::uuid END,
      v_line->>'sku', v_line->>'name', coalesce((v_line->>'is_service')::boolean, false),
      (v_line->>'quantity')::numeric, (v_line->>'unit_price_usd')::numeric,
      coalesce((v_line->>'discount_percent')::numeric, 0), coalesce((v_line->>'discount_amount_usd')::numeric, 0),
      coalesce((v_line->>'tax_rate_percent')::numeric, 0), coalesce((v_line->>'tax_amount_usd')::numeric, 0),
      (v_line->>'line_subtotal_usd')::numeric, (v_line->>'line_total_usd')::numeric);

    IF NOT coalesce((v_line->>'is_service')::boolean, false) THEN
      IF v_source = 'warehouse' THEN
        v_stock_lines := v_stock_lines || jsonb_build_array(jsonb_build_object(
          'sku', v_line->>'sku', 'quantity', (v_line->>'quantity')::numeric));
      ELSIF coalesce((p_sale->>'track_stock')::boolean, true) THEN
        SELECT * INTO v_prod FROM pos_products WHERE id = (v_line->>'product_id')::uuid FOR UPDATE;
        v_new_stock := v_prod.stock_quantity - (v_line->>'quantity')::numeric;
        IF v_new_stock < 0 AND coalesce(p_sale->>'stock_policy', 'strict_block') = 'strict_block' THEN
          RAISE EXCEPTION 'Stock insuficiente para % (disponible: %).', v_prod.sku, v_prod.stock_quantity;
        END IF;
        UPDATE pos_products
           SET stock_quantity = v_new_stock, updated_at = now(),
               status = CASE WHEN status = 'descontinuado' THEN status
                             WHEN v_new_stock <= 0 THEN 'agotado' ELSE 'disponible' END
         WHERE id = v_prod.id;
        INSERT INTO pos_inventory_kardex (tenant_id, branch_id, product_id, movement_type, reference_id,
                                          quantity_delta, stock_before, stock_after, actor_id)
        VALUES (p_tenant, v_shift.branch_id, v_prod.id, 'venta_pos', v_sale_id,
                -(v_line->>'quantity')::numeric, v_prod.stock_quantity, v_new_stock, p_actor);
      END IF;
    END IF;
  END LOOP;

  FOR v_pay IN SELECT value FROM jsonb_array_elements(coalesce(p_sale->'payments', '[]'::jsonb)) LOOP
    INSERT INTO pos_sale_payments (
      tenant_id, branch_id, sale_id, shift_id, method, currency, amount_received, amount_applied,
      change_amount, change_currency, exchange_rate_snapshot, reference_number, bank_code, bank_name,
      payer_phone, payer_document, terminal_id, card_last4, approval_code, cashea_operation_id,
      cashea_merchant_amount, provider_status, verified_by, verified_at)
    VALUES (
      p_tenant, v_shift.branch_id, v_sale_id, v_shift.id, v_pay->>'method', v_pay->>'currency',
      (v_pay->>'amount_received')::numeric, (v_pay->>'amount_applied')::numeric,
      coalesce((v_pay->>'change_amount')::numeric, 0), nullif(v_pay->>'change_currency', ''), v_rate,
      nullif(v_pay->>'reference_number', ''), nullif(v_pay->>'bank_code', ''), nullif(v_pay->>'bank_name', ''),
      nullif(v_pay->>'payer_phone', ''), nullif(v_pay->>'payer_document', ''), nullif(v_pay->>'terminal_id', ''),
      nullif(v_pay->>'card_last4', ''), nullif(v_pay->>'approval_code', ''),
      nullif(v_pay->>'cashea_operation_id', ''), (v_pay->>'cashea_merchant_amount')::numeric,
      coalesce(v_pay->>'provider_status', 'registrado'),
      CASE WHEN v_pay->>'provider_status' = 'verificado' THEN p_actor END,
      CASE WHEN v_pay->>'provider_status' = 'verificado' THEN now() END);

    v_amount := (v_pay->>'amount_applied')::numeric;
    CASE v_pay->>'method'
      WHEN 'efectivo' THEN
        PERFORM pos_bump_expected(v_shift.id,
          CASE v_pay->>'currency' WHEN 'USD' THEN 'efectivo_usd' ELSE 'efectivo_ves' END,
          v_amount - coalesce((v_pay->>'change_amount')::numeric, 0));
      WHEN 'pago_movil' THEN PERFORM pos_bump_expected(v_shift.id, 'pago_movil_ves', v_amount);
      WHEN 'tarjeta' THEN PERFORM pos_bump_expected(v_shift.id, 'tarjeta_ves', v_amount);
      WHEN 'cashea' THEN
        PERFORM pos_bump_expected(v_shift.id, 'cashea_usd',
          CASE v_pay->>'currency' WHEN 'USD' THEN v_amount ELSE v_amount / v_rate END);
      ELSE RAISE EXCEPTION 'Método de pago inválido.';
    END CASE;
  END LOOP;

  -- Cliente: estadísticas y monedero.
  v_wallet_used := coalesce((p_sale->>'wallet_used_usd')::numeric, 0);
  v_wallet_dep := coalesce((p_sale->>'wallet_deposited_usd')::numeric, 0);
  IF v_customer IS NOT NULL THEN
    UPDATE pos_customers
       SET total_purchases_count = total_purchases_count + 1,
           total_purchases_usd = total_purchases_usd + (p_sale->>'total_usd')::numeric,
           last_purchase_at = now(), updated_at = now(),
           wallet_balance_usd = wallet_balance_usd - v_wallet_used + v_wallet_dep
     WHERE id = v_customer;
  ELSIF v_wallet_used > 0 OR v_wallet_dep > 0 THEN
    RAISE EXCEPTION 'El monedero requiere un cliente identificado.';
  END IF;

  INSERT INTO pos_commercial_documents (tenant_id, sale_id, internal_number)
  VALUES (p_tenant, v_sale_id, v_doc_number);

  -- Salida de Warehouse en la misma transacción: sin stock, no hay venta.
  IF v_source = 'warehouse' AND coalesce((p_sale->>'track_stock')::boolean, false)
     AND jsonb_array_length(v_stock_lines) > 0 THEN
    PERFORM warehouse_register_pos_event(p_tenant, p_actor, jsonb_build_object(
      'kind', 'sale', 'reference', v_sale_number,
      'warehouse_id', nullif(p_sale->>'warehouse_id', ''), 'lines', v_stock_lines));
  END IF;

  PERFORM pos_audit(p_tenant, v_shift.branch_id, v_shift.id, p_actor, 'venta_confirmada', 'pos_sales',
    v_sale_id::text, 'Venta ' || v_sale_number || ' confirmada. Comprobante ' || v_doc_number,
    jsonb_build_object('total_usd', p_sale->'total_usd', 'catalog_source', v_source));
  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number,
                            'document_number', v_doc_number, 'replay', false);
END $$;

-- 7. Devoluciones ------------------------------------------------------------
-- p_return: {idempotency_key, original_sale_id, shift_id, return_type, reason, notes?,
--            refund_method, approved_by, authorization_id?, track_stock, warehouse_id?,
--            lines: [{sale_line_id, quantity, condition}]}
CREATE OR REPLACE FUNCTION public.pos_record_return(p_tenant uuid, p_actor uuid, p_return jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_key text := nullif(trim(p_return->>'idempotency_key'), '');
  v_existing record; v_sale record; v_shift record; v_line jsonb; v_sl record; v_prod record;
  v_ret_id uuid; v_ret_number text; v_seq bigint; v_qty numeric; v_refund numeric; v_total numeric := 0;
  v_total_ves numeric; v_cond text; v_type text := p_return->>'return_type';
  v_method text := p_return->>'refund_method'; v_wh uuid; v_pending boolean; v_track boolean;
  v_restock jsonb := '[]'::jsonb; v_cash_amount numeric; v_cash_available numeric;
BEGIN
  IF v_key IS NOT NULL THEN
    SELECT id, return_number INTO v_existing FROM pos_sale_returns
      WHERE tenant_id = p_tenant AND idempotency_key = v_key;
    IF FOUND THEN
      RETURN jsonb_build_object('return_id', v_existing.id, 'return_number', v_existing.return_number, 'replay', true);
    END IF;
  END IF;
  IF v_type NOT IN ('anulacion_total', 'devolucion_parcial', 'devolucion_total') THEN
    RAISE EXCEPTION 'Tipo de devolución inválido.';
  END IF;
  IF v_method NOT IN ('efectivo_usd', 'efectivo_ves', 'reverso_electronico', 'nota_credito_interna') THEN
    RAISE EXCEPTION 'Método de reembolso inválido.';
  END IF;
  IF length(trim(coalesce(p_return->>'reason', ''))) = 0 THEN RAISE EXCEPTION 'Indica el motivo de la devolución.'; END IF;
  IF nullif(p_return->>'approved_by', '') IS NULL THEN RAISE EXCEPTION 'La devolución requiere un aprobador.'; END IF;

  SELECT * INTO v_sale FROM pos_sales
    WHERE id = (p_return->>'original_sale_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta de referencia no encontrada.'; END IF;
  IF v_sale.commercial_status IN ('anulada', 'devuelta') THEN
    RAISE EXCEPTION 'La venta ya se encuentra completamente anulada o devuelta.';
  END IF;

  SELECT * INTO v_shift FROM pos_shifts
    WHERE id = (p_return->>'shift_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN
    RAISE EXCEPTION 'Las devoluciones se registran en un turno abierto.';
  END IF;
  IF v_shift.cashier_user_id <> p_actor THEN RAISE EXCEPTION 'El turno pertenece a otro cajero.'; END IF;

  INSERT INTO pos_tenant_settings (tenant_id) VALUES (p_tenant) ON CONFLICT (tenant_id) DO NOTHING;
  UPDATE pos_tenant_settings SET next_return_seq = next_return_seq + 1
   WHERE tenant_id = p_tenant RETURNING next_return_seq - 1 INTO v_seq;
  v_ret_number := 'DEV-' || lpad(v_seq::text, 7, '0');

  INSERT INTO pos_sale_returns (
    tenant_id, branch_id, original_sale_id, shift_id, return_number, return_type, reason, notes,
    requested_by, approved_by, authorization_id, refund_method, idempotency_key,
    stock_reversal_reference, financial_reversal_reference)
  VALUES (
    p_tenant, v_shift.branch_id, v_sale.id, v_shift.id, v_ret_number, v_type, trim(p_return->>'reason'),
    nullif(trim(p_return->>'notes'), ''), p_actor, (p_return->>'approved_by')::uuid,
    nullif(p_return->>'authorization_id', '')::uuid, v_method, v_key,
    'KARDEX-REV-' || v_ret_number, 'CAJA-REV-' || v_ret_number)
  RETURNING id INTO v_ret_id;

  v_track := coalesce((p_return->>'track_stock')::boolean, false);
  -- Orden estable para bloquear las líneas.
  FOR v_line IN SELECT value FROM jsonb_array_elements(coalesce(p_return->'lines', '[]'::jsonb))
                ORDER BY value->>'sale_line_id' LOOP
    v_qty := (v_line->>'quantity')::numeric;
    v_cond := coalesce(v_line->>'condition', 'sellable');
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Cantidad a devolver inválida.'; END IF;
    IF v_cond NOT IN ('sellable', 'damaged') THEN RAISE EXCEPTION 'Condición de devolución inválida.'; END IF;
    SELECT * INTO v_sl FROM pos_sale_lines
      WHERE id = (v_line->>'sale_line_id')::uuid AND sale_id = v_sale.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Línea de venta no encontrada.'; END IF;
    IF v_sl.returned_quantity + v_qty > v_sl.quantity THEN
      RAISE EXCEPTION 'La cantidad a devolver de % excede el remanente disponible.', v_sl.sku_snapshot;
    END IF;
    -- Reembolso proporcional a lo cobrado (incluye descuento e impuesto).
    v_refund := round(v_sl.line_total_usd / v_sl.quantity * v_qty, 2);
    v_total := v_total + v_refund;
    UPDATE pos_sale_lines SET returned_quantity = returned_quantity + v_qty WHERE id = v_sl.id;
    INSERT INTO pos_return_lines (tenant_id, return_id, sale_line_id, product_id, item_id, quantity_returned,
                                  refund_amount_usd, refund_amount_ves, condition)
    VALUES (p_tenant, v_ret_id, v_sl.id, v_sl.product_id, v_sl.item_id, v_qty, v_refund,
            round(v_refund * v_sale.exchange_rate_snapshot, 2), v_cond);

    IF NOT v_sl.is_service AND v_track THEN
      IF v_sale.catalog_source = 'warehouse' AND v_sl.item_id IS NOT NULL THEN
        IF v_cond = 'sellable' THEN
          v_restock := v_restock || jsonb_build_array(jsonb_build_object('sku', v_sl.sku_snapshot, 'quantity', v_qty));
        ELSE
          v_wh := coalesce(nullif(p_return->>'warehouse_id', '')::uuid,
                           (SELECT default_warehouse_id FROM warehouse_settings WHERE tenant_id = p_tenant));
          IF v_wh IS NULL THEN RAISE EXCEPTION 'No hay almacén predeterminado para el POS.'; END IF;
          PERFORM 1 FROM warehouse_items WHERE id = v_sl.item_id AND track_stock;
          IF FOUND THEN
            PERFORM warehouse_apply_movement(p_tenant, v_sl.item_id, v_wh, 'return_damaged', v_qty, NULL,
              'damaged', NULL, 'pos', v_ret_number, trim(p_return->>'reason'),
              'pos:return-damaged:' || v_ret_number || ':' || v_sl.id, p_actor);
          END IF;
        END IF;
      ELSIF v_sale.catalog_source = 'pos' AND v_sl.product_id IS NOT NULL AND v_cond = 'sellable' THEN
        SELECT * INTO v_prod FROM pos_products WHERE id = v_sl.product_id FOR UPDATE;
        UPDATE pos_products
           SET stock_quantity = stock_quantity + v_qty, updated_at = now(),
               status = CASE WHEN status = 'descontinuado' THEN status ELSE 'disponible' END
         WHERE id = v_prod.id;
        INSERT INTO pos_inventory_kardex (tenant_id, branch_id, product_id, movement_type, reference_id,
                                          quantity_delta, stock_before, stock_after, actor_id)
        VALUES (p_tenant, v_shift.branch_id, v_prod.id, 'reverso_devolucion', v_ret_id, v_qty,
                v_prod.stock_quantity, v_prod.stock_quantity + v_qty, p_actor);
      END IF;
    END IF;
  END LOOP;
  IF v_total = 0 THEN RAISE EXCEPTION 'Selecciona al menos un producto y cantidad para devolver.'; END IF;

  IF jsonb_array_length(v_restock) > 0 THEN
    PERFORM warehouse_register_pos_event(p_tenant, p_actor, jsonb_build_object(
      'kind', 'return', 'reference', v_ret_number,
      'warehouse_id', nullif(p_return->>'warehouse_id', ''), 'lines', v_restock));
  END IF;

  v_total_ves := round(v_total * v_sale.exchange_rate_snapshot, 2);
  UPDATE pos_sale_returns SET total_refunded_usd = v_total, total_refunded_ves = v_total_ves WHERE id = v_ret_id;

  SELECT bool_or(returned_quantity < quantity) INTO v_pending FROM pos_sale_lines WHERE sale_id = v_sale.id;
  UPDATE pos_sales
     SET commercial_status = CASE WHEN v_type = 'anulacion_total' THEN 'anulada'
                                  WHEN coalesce(v_pending, false) THEN 'parcialmente_devuelta'
                                  ELSE 'devuelta' END,
         payment_status = CASE WHEN v_type = 'anulacion_total' OR NOT coalesce(v_pending, false)
                               THEN 'reversada' ELSE payment_status END
   WHERE id = v_sale.id;

  IF v_method IN ('efectivo_usd', 'efectivo_ves') THEN
    v_cash_amount := CASE WHEN v_method = 'efectivo_usd' THEN v_total ELSE v_total_ves END;
    SELECT coalesce((expected_totals->>v_method)::numeric, 0) INTO v_cash_available
      FROM pos_shifts WHERE id = v_shift.id;
    IF v_cash_available < v_cash_amount THEN
      RAISE EXCEPTION 'No hay efectivo suficiente en caja para el reembolso.';
    END IF;
    PERFORM pos_bump_expected(v_shift.id, v_method, -v_cash_amount);
  END IF;

  PERFORM pos_audit(p_tenant, v_shift.branch_id, v_shift.id, p_actor, 'devolucion_reverso', 'pos_sale_returns',
    v_ret_id::text, 'Devolución ' || v_ret_number || ' de la venta ' || v_sale.sale_number,
    jsonb_build_object('total_usd', v_total, 'method', v_method, 'approved_by', p_return->>'approved_by'));
  RETURN jsonb_build_object('return_id', v_ret_id, 'return_number', v_ret_number, 'replay', false);
END $$;

-- 8. Abono a una venta a crédito (cuentas por cobrar) --------------------------
-- p_payment: {method, currency, amount, reference_number?, idempotency_key}
CREATE OR REPLACE FUNCTION public.pos_record_debt_payment(
  p_tenant uuid, p_actor uuid, p_sale uuid, p_shift uuid, p_payment jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_sale record; v_shift record; v_amount numeric := (p_payment->>'amount')::numeric;
  v_currency text := p_payment->>'currency'; v_method text := p_payment->>'method';
  v_usd numeric; v_applied_usd numeric; v_applied numeric; v_key text := nullif(trim(p_payment->>'idempotency_key'), '');
BEGIN
  IF v_method NOT IN ('efectivo', 'pago_movil', 'tarjeta') THEN RAISE EXCEPTION 'Método de abono inválido.'; END IF;
  IF v_currency NOT IN ('USD', 'VES') THEN RAISE EXCEPTION 'Moneda inválida.'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'El monto del abono debe ser mayor a 0.'; END IF;
  IF v_key IS NOT NULL THEN
    PERFORM 1 FROM pos_audit_events WHERE tenant_id = p_tenant AND correlation_id = 'abono:' || v_key;
    IF FOUND THEN RETURN jsonb_build_object('sale_id', p_sale, 'replay', true); END IF;
  END IF;

  SELECT * INTO v_sale FROM pos_sales WHERE id = p_sale AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada.'; END IF;
  IF v_sale.commercial_status IN ('anulada', 'devuelta') THEN RAISE EXCEPTION 'La venta está anulada o devuelta.'; END IF;
  IF v_sale.balance_due_usd <= 0 THEN RAISE EXCEPTION 'Esta venta ya se encuentra totalmente saldada.'; END IF;
  SELECT * INTO v_shift FROM pos_shifts WHERE id = p_shift AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN RAISE EXCEPTION 'Los abonos se registran en un turno abierto.'; END IF;
  IF v_shift.cashier_user_id <> p_actor THEN RAISE EXCEPTION 'El turno pertenece a otro cajero.'; END IF;

  v_usd := CASE v_currency WHEN 'USD' THEN v_amount ELSE v_amount / v_sale.exchange_rate_snapshot END;
  v_applied_usd := round(least(v_usd, v_sale.balance_due_usd), 2);
  v_applied := CASE v_currency WHEN 'USD' THEN v_applied_usd
                               ELSE round(v_applied_usd * v_sale.exchange_rate_snapshot, 2) END;

  INSERT INTO pos_sale_payments (tenant_id, branch_id, sale_id, shift_id, method, currency, amount_received,
                                 amount_applied, change_amount, exchange_rate_snapshot, reference_number,
                                 provider_status, verified_by, verified_at)
  VALUES (p_tenant, v_shift.branch_id, v_sale.id, v_shift.id, v_method, v_currency, v_amount, v_applied,
          greatest(v_amount - v_applied, 0), v_sale.exchange_rate_snapshot,
          nullif(p_payment->>'reference_number', ''), 'verificado', p_actor, now());

  UPDATE pos_sales
     SET paid_total_usd = paid_total_usd + v_applied_usd,
         paid_total_ves = round(paid_total_ves + v_applied_usd * exchange_rate_snapshot, 2),
         balance_due_usd = greatest(round(balance_due_usd - v_applied_usd, 2), 0),
         balance_due_ves = greatest(round((balance_due_usd - v_applied_usd) * exchange_rate_snapshot, 2), 0),
         payment_status = CASE WHEN balance_due_usd - v_applied_usd <= 0.05 THEN 'pagada' ELSE 'parcial' END
   WHERE id = v_sale.id;

  CASE v_method
    WHEN 'efectivo' THEN
      PERFORM pos_bump_expected(v_shift.id, CASE v_currency WHEN 'USD' THEN 'efectivo_usd' ELSE 'efectivo_ves' END, v_applied);
    WHEN 'pago_movil' THEN PERFORM pos_bump_expected(v_shift.id, 'pago_movil_ves',
      CASE v_currency WHEN 'VES' THEN v_applied ELSE round(v_applied * v_sale.exchange_rate_snapshot, 2) END);
    WHEN 'tarjeta' THEN PERFORM pos_bump_expected(v_shift.id, 'tarjeta_ves',
      CASE v_currency WHEN 'VES' THEN v_applied ELSE round(v_applied * v_sale.exchange_rate_snapshot, 2) END);
  END CASE;

  INSERT INTO pos_audit_events (tenant_id, branch_id, shift_id, actor_id, event_type, entity_type, entity_id,
                                description, metadata, correlation_id)
  VALUES (p_tenant, v_shift.branch_id, v_shift.id, p_actor, 'abono_credito', 'pos_sales', v_sale.id::text,
          'Abono de ' || v_applied_usd || ' USD a la venta ' || v_sale.sale_number,
          jsonb_build_object('method', v_method, 'currency', v_currency, 'amount', v_amount),
          CASE WHEN v_key IS NOT NULL THEN 'abono:' || v_key END);
  RETURN jsonb_build_object('sale_id', v_sale.id, 'applied_usd', v_applied_usd, 'replay', false);
END $$;

-- 9. Permisos: solo el servidor (service_role) ejecuta estas funciones ---------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_bump_expected(uuid,text,numeric)',
    'pos_audit(uuid,uuid,uuid,uuid,text,text,text,text,jsonb)',
    'pos_open_shift(uuid,uuid,uuid,uuid,text,numeric,numeric,text)',
    'pos_add_cash_movement(uuid,uuid,uuid,text,text,numeric,text,uuid)',
    'pos_close_shift(uuid,uuid,uuid,jsonb,text)',
    'pos_record_sale(uuid,uuid,jsonb)',
    'pos_record_return(uuid,uuid,jsonb)',
    'pos_record_debt_payment(uuid,uuid,uuid,uuid,jsonb)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
