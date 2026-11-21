-- ============================================================
-- VORA Warehouse · Cierre del MVP
--   1. Matriz de permisos por empresa (WH-12) y alcance de almacenes por usuario.
--   2. Transferencias entre almacenes con stock en tránsito (WH-04).
--   3. Evidencias de ajustes en Storage privado (WH-07).
--   4. Reportes programados (WH-11).
-- Aditiva. Las funciones son solo para service_role (las rutas API autorizan antes).
-- ============================================================
BEGIN;

-- 1. Matriz de permisos por empresa ------------------------------------------
-- Si existe una fila (empresa, rol), sus permisos de Warehouse sustituyen a los
-- valores por defecto de role_permissions para esa empresa. Los permisos de
-- otros módulos (POS) no se tocan aquí.
CREATE TABLE IF NOT EXISTS public.tenant_role_matrix (
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key    text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_key)
);

-- Alcance por usuario: si tiene filas, solo opera en esos almacenes.
CREATE TABLE IF NOT EXISTS public.warehouse_user_scopes (
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouse_warehouses(id) ON DELETE CASCADE,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, auth_user_id, warehouse_id)
);

-- Permiso nuevo para transferencias, con valores por defecto.
INSERT INTO public.role_permissions (role_key, permission, scope)
VALUES ('wh_manager', 'stock.transfer', 'tenant'),
       ('wh_supervisor', 'stock.transfer', 'tenant'),
       ('wh_clerk', 'stock.transfer', 'tenant')
ON CONFLICT (role_key, permission) DO NOTHING;

-- 2. Transferencias ------------------------------------------------------------
ALTER TABLE public.warehouse_movements DROP CONSTRAINT IF EXISTS warehouse_movements_movement_type_check;
ALTER TABLE public.warehouse_movements ADD CONSTRAINT warehouse_movements_movement_type_check CHECK (movement_type IN (
  'receipt', 'issue', 'adjustment_in', 'adjustment_out', 'return_sellable', 'return_damaged',
  'pos_sale', 'pos_return', 'import', 'reversal', 'transfer_out', 'transfer_in'));

CREATE TABLE IF NOT EXISTS public.warehouse_transfers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  number            text NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouse_warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id   uuid NOT NULL REFERENCES public.warehouse_warehouses(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'received', 'cancelled')),
  notes             text,
  idempotency_key   text NOT NULL,
  created_by        uuid,
  shipped_at        timestamptz NOT NULL DEFAULT now(),
  closed_by         uuid,
  closed_at         timestamptz,
  CHECK (from_warehouse_id <> to_warehouse_id),
  UNIQUE (tenant_id, number),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS warehouse_transfers_tenant_idx ON public.warehouse_transfers (tenant_id, status, shipped_at DESC);

CREATE TABLE IF NOT EXISTS public.warehouse_transfer_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_id uuid NOT NULL REFERENCES public.warehouse_transfers(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  quantity    numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit_cost   numeric(18,6) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  UNIQUE (transfer_id, item_id)
);

-- Envía mercancía: sale del origen (costo promedio del origen) y queda en
-- tránsito en el destino hasta que se reciba.
-- p_transfer: {idempotency_key, from_warehouse_id, to_warehouse_id, notes?, lines: [{item_id, quantity}]}
CREATE OR REPLACE FUNCTION public.warehouse_ship_transfer(p_tenant uuid, p_actor uuid, p_transfer jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_key text := nullif(trim(p_transfer->>'idempotency_key'), '');
  v_from uuid := (p_transfer->>'from_warehouse_id')::uuid;
  v_to uuid := (p_transfer->>'to_warehouse_id')::uuid;
  v_id uuid; v_number integer; v_line record; v_mov uuid; v_cost numeric;
BEGIN
  IF v_key IS NULL THEN RAISE EXCEPTION 'Falta la clave de idempotencia.'; END IF;
  SELECT id INTO v_id FROM warehouse_transfers WHERE tenant_id = p_tenant AND idempotency_key = v_key;
  IF FOUND THEN RETURN v_id; END IF;
  IF v_from IS NULL OR v_to IS NULL OR v_from = v_to THEN RAISE EXCEPTION 'Elige almacenes de origen y destino distintos.'; END IF;
  PERFORM 1 FROM warehouse_warehouses WHERE id IN (v_from, v_to) AND tenant_id = p_tenant AND status = 'active'
    HAVING count(*) = 2;
  IF NOT FOUND THEN RAISE EXCEPTION 'Los almacenes deben existir y estar activos.'; END IF;
  IF jsonb_array_length(coalesce(p_transfer->'lines', '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'La transferencia no tiene artículos.'; END IF;

  INSERT INTO warehouse_doc_counters (tenant_id, doc_type, last_number) VALUES (p_tenant, 'transfer', 1)
  ON CONFLICT (tenant_id, doc_type) DO UPDATE SET last_number = warehouse_doc_counters.last_number + 1
  RETURNING last_number INTO v_number;
  INSERT INTO warehouse_transfers (tenant_id, number, from_warehouse_id, to_warehouse_id, notes, idempotency_key, created_by)
  VALUES (p_tenant, 'TRF-' || lpad(v_number::text, 6, '0'), v_from, v_to, nullif(trim(p_transfer->>'notes'), ''), v_key, p_actor)
  RETURNING id INTO v_id;

  -- Orden estable por artículo para evitar interbloqueos.
  FOR v_line IN
      SELECT (value->>'item_id')::uuid AS item_id, sum((value->>'quantity')::numeric) AS qty
      FROM jsonb_array_elements(p_transfer->'lines') GROUP BY 1 ORDER BY 1 LOOP
    IF v_line.qty IS NULL OR v_line.qty <= 0 THEN RAISE EXCEPTION 'Cantidad inválida en la transferencia.'; END IF;
    v_mov := warehouse_apply_movement(p_tenant, v_line.item_id, v_from, 'transfer_out', -v_line.qty, NULL, 'on_hand',
      NULL, 'transfer', 'TRF-' || lpad(v_number::text, 6, '0'), 'Transferencia enviada',
      'trf-out:' || v_id || ':' || v_line.item_id, p_actor);
    SELECT unit_cost INTO v_cost FROM warehouse_movements WHERE id = v_mov;
    INSERT INTO warehouse_transfer_lines (tenant_id, transfer_id, item_id, quantity, unit_cost)
    VALUES (p_tenant, v_id, v_line.item_id, v_line.qty, coalesce(v_cost, 0));
    INSERT INTO warehouse_balances (tenant_id, item_id, warehouse_id) VALUES (p_tenant, v_line.item_id, v_to)
      ON CONFLICT DO NOTHING;
    UPDATE warehouse_balances SET in_transit = in_transit + v_line.qty, updated_at = now()
     WHERE item_id = v_line.item_id AND warehouse_id = v_to;
  END LOOP;
  RETURN v_id;
END $$;

-- Recibe (en el destino) o cancela (vuelve al origen) una transferencia en tránsito.
CREATE OR REPLACE FUNCTION public.warehouse_close_transfer(p_tenant uuid, p_actor uuid, p_transfer uuid, p_action text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_t record; v_line record; v_target uuid; v_type text;
BEGIN
  IF p_action NOT IN ('receive', 'cancel') THEN RAISE EXCEPTION 'Acción inválida.'; END IF;
  SELECT * INTO v_t FROM warehouse_transfers WHERE id = p_transfer AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada.'; END IF;
  IF v_t.status <> 'in_transit' THEN RAISE EXCEPTION 'La transferencia ya fue cerrada.'; END IF;
  v_target := CASE p_action WHEN 'receive' THEN v_t.to_warehouse_id ELSE v_t.from_warehouse_id END;

  FOR v_line IN SELECT * FROM warehouse_transfer_lines WHERE transfer_id = p_transfer ORDER BY item_id LOOP
    UPDATE warehouse_balances SET in_transit = in_transit - v_line.quantity, updated_at = now()
     WHERE item_id = v_line.item_id AND warehouse_id = v_t.to_warehouse_id;
    PERFORM warehouse_apply_movement(p_tenant, v_line.item_id, v_target, 'transfer_in', v_line.quantity, v_line.unit_cost,
      'on_hand', NULL, 'transfer', v_t.number,
      CASE p_action WHEN 'receive' THEN 'Transferencia recibida' ELSE 'Transferencia cancelada: regreso al origen' END,
      'trf-' || p_action || ':' || p_transfer || ':' || v_line.item_id, p_actor);
  END LOOP;

  UPDATE warehouse_transfers
     SET status = CASE p_action WHEN 'receive' THEN 'received' ELSE 'cancelled' END,
         closed_by = p_actor, closed_at = now()
   WHERE id = p_transfer;
END $$;

-- 3. Evidencias de ajustes ------------------------------------------------------
ALTER TABLE public.warehouse_documents
  ADD COLUMN IF NOT EXISTS evidence_path text
    CHECK (evidence_path IS NULL OR evidence_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]{1,200}$');

-- Bucket privado (solo existe en Supabase; en pruebas locales sin Storage se omite).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('warehouse-evidence', 'warehouse-evidence', false, 5242880,
            ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 4. Reportes programados -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouse_report_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report       text NOT NULL CHECK (report IN ('stock', 'valuation', 'rotation', 'kardex')),
  frequency    text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  weekday      smallint CHECK (weekday BETWEEN 1 AND 7),
  month_day    smallint CHECK (month_day BETWEEN 1 AND 28),
  recipients   uuid[] NOT NULL CHECK (cardinality(recipients) BETWEEN 1 AND 20),
  warehouse_id uuid REFERENCES public.warehouse_warehouses(id) ON DELETE CASCADE,
  active       boolean NOT NULL DEFAULT true,
  last_run_at  timestamptz,
  last_status  text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (frequency <> 'weekly' OR weekday IS NOT NULL),
  CHECK (frequency <> 'monthly' OR month_day IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS warehouse_report_schedules_tenant_idx ON public.warehouse_report_schedules (tenant_id, active);

-- RLS: lectura para miembros; escritura solo por el servidor.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_role_matrix', 'warehouse_user_scopes', 'warehouse_transfers',
                           'warehouse_transfer_lines', 'warehouse_report_schedules']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_member_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.warehouse_is_member(tenant_id))', t || '_member_read', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['warehouse_ship_transfer(uuid,uuid,jsonb)', 'warehouse_close_transfer(uuid,uuid,uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
