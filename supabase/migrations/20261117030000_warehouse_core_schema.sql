-- ============================================================
-- VORA Warehouse – Núcleo de inventario (MVP WH-01..WH-23, WH-27)
-- Especificación: warehousedocs/VORA_Warehouse_Definicion_Integral_40_Vistas_v2.pdf
--
-- Principios aplicados (secciones 3, 9 y 11 del documento):
--   · Una sola fuente de verdad: warehouse_movements (registro inmutable) y
--     warehouse_balances (saldo por artículo y almacén) actualizados en la misma
--     transacción por warehouse_apply_movement().
--   · El stock nunca queda negativo: la fila de saldo se bloquea (FOR UPDATE)
--     antes de descontar, así dos ventas simultáneas no toman la última unidad.
--   · Idempotencia: idempotency_key único por tenant en movimientos, documentos
--     e importaciones aplicadas.
--   · Costo promedio ponderado por artículo y almacén.
--   · Servicios y activos alquilables no manejan existencias (track_stock).
--   · Devolución dañada va al saldo "damaged", nunca al vendible.
--   · Las escrituras se hacen solo desde el servidor (service_role) tras
--     autorizar sesión, membresía, módulo contratado y permiso.
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 0. Pertenencia (lectura vía RLS para clientes autenticados)
-- ------------------------------------------------------------
CREATE FUNCTION public.warehouse_is_member(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.vora_is_super_admin() OR EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = p_tenant AND m.auth_user_id = auth.uid() AND m.status = 'active');
$$;
REVOKE ALL ON FUNCTION public.warehouse_is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.warehouse_is_member(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 1. Configuración (WH-13) y perfil sectorial (WH-15)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_settings (
  tenant_id                   uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  require_adjustment_approval boolean NOT NULL DEFAULT true,
  low_stock_alerts            boolean NOT NULL DEFAULT true,
  costing_method              text    NOT NULL DEFAULT 'weighted_average' CHECK (costing_method = 'weighted_average'),
  default_warehouse_id        uuid,
  import_max_rows             integer NOT NULL DEFAULT 2000 CHECK (import_max_rows BETWEEN 1 AND 10000),
  unknown_code_action         text    NOT NULL DEFAULT 'offer_create' CHECK (unknown_code_action IN ('offer_create', 'block')),
  updated_by                  uuid,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.warehouse_business_profiles (
  tenant_id        uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  sector           text NOT NULL,
  specialty        text,
  template_key     text NOT NULL,
  template_version integer NOT NULL DEFAULT 1,
  applied_by       uuid,
  applied_at       timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. Unidades y conversiones (WH-18)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_units (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code         text NOT NULL,
  name         text NOT NULL,
  symbol       text NOT NULL,
  base_unit_id uuid REFERENCES public.warehouse_units(id) ON DELETE RESTRICT,
  factor       numeric(18,6) NOT NULL DEFAULT 1 CHECK (factor > 0),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  CHECK (base_unit_id IS NOT NULL OR factor = 1),
  CHECK (base_unit_id IS DISTINCT FROM id)
);

-- ------------------------------------------------------------
-- 3. Categorías y atributos dinámicos (WH-16)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE public.warehouse_attribute_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label       text NOT NULL,
  data_type   text NOT NULL CHECK (data_type IN ('text', 'number', 'date', 'boolean', 'select')),
  options     text[] NOT NULL DEFAULT '{}',
  required    boolean NOT NULL DEFAULT false,
  category_id uuid REFERENCES public.warehouse_categories(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  source      text NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'template')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key),
  CHECK (data_type <> 'select' OR cardinality(options) > 0)
);

-- ------------------------------------------------------------
-- 4. Catálogo unificado (WH-02, WH-03) y códigos de barras
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku         text NOT NULL CHECK (length(trim(sku)) BETWEEN 1 AND 64),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  description text,
  item_type   text NOT NULL CHECK (item_type IN (
                'physical', 'weighted', 'lot', 'serialized', 'variant', 'kit', 'manufactured',
                'service', 'service_consumables', 'service_work_order',
                'reservable_resource', 'rental_asset')),
  -- Servicios y activos alquilables no consumen stock por sí mismos (sección 3).
  track_stock boolean GENERATED ALWAYS AS (item_type NOT IN (
                'service', 'service_consumables', 'service_work_order',
                'reservable_resource', 'rental_asset')) STORED,
  category_id uuid REFERENCES public.warehouse_categories(id) ON DELETE SET NULL,
  unit_id     uuid NOT NULL REFERENCES public.warehouse_units(id) ON DELETE RESTRICT,
  price_usd   numeric(18,4) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  tax_rate    numeric(5,2)  NOT NULL DEFAULT 16 CHECK (tax_rate BETWEEN 0 AND 100),
  min_stock   numeric(18,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  attributes  jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
CREATE INDEX warehouse_items_tenant_name_idx ON public.warehouse_items (tenant_id, lower(name));

CREATE TABLE public.warehouse_item_barcodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  code       text NOT NULL CHECK (code ~ '^[A-Za-z0-9\-\.\_/]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Un SKU admite varios códigos, pero un código identifica un solo artículo.
  UNIQUE (tenant_id, code)
);
CREATE INDEX warehouse_item_barcodes_item_idx ON public.warehouse_item_barcodes (item_id);

-- ------------------------------------------------------------
-- 5. Almacenes por sede (WH-04)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_warehouses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id  uuid REFERENCES public.tenant_branches(id) ON DELETE SET NULL,
  code       text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9\-_]{0,23}$'),
  name       text NOT NULL,
  address    text,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
ALTER TABLE public.warehouse_settings
  ADD CONSTRAINT warehouse_settings_default_wh_fk
  FOREIGN KEY (default_warehouse_id) REFERENCES public.warehouse_warehouses(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 6. Saldos (WH-09)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_balances (
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouse_warehouses(id) ON DELETE CASCADE,
  on_hand      numeric(18,3) NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved     numeric(18,3) NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  damaged      numeric(18,3) NOT NULL DEFAULT 0 CHECK (damaged >= 0),
  in_transit   numeric(18,3) NOT NULL DEFAULT 0 CHECK (in_transit >= 0),
  avg_cost     numeric(18,6) NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, warehouse_id),
  CHECK (reserved <= on_hand)
);
CREATE INDEX warehouse_balances_tenant_idx ON public.warehouse_balances (tenant_id, warehouse_id);

-- ------------------------------------------------------------
-- 7. Documentos: entrada, salida, ajuste, devolución (WH-05/06/07/10)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type        text NOT NULL CHECK (doc_type IN ('receipt', 'issue', 'adjustment', 'return')),
  number          text NOT NULL,
  status          text NOT NULL CHECK (status IN ('pending_approval', 'posted', 'rejected', 'reversed')),
  warehouse_id    uuid NOT NULL REFERENCES public.warehouse_warehouses(id) ON DELETE RESTRICT,
  supplier_id     uuid REFERENCES public.warehouse_supplier_profiles(id) ON DELETE SET NULL,
  reason          text,
  reference       text,
  notes           text,
  evidence_url    text CHECK (evidence_url IS NULL OR evidence_url ~ '^https://'),
  idempotency_key text NOT NULL,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text,
  posted_at       timestamptz,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, number)
);
CREATE INDEX warehouse_documents_tenant_idx ON public.warehouse_documents (tenant_id, doc_type, status, created_at DESC);

CREATE TABLE public.warehouse_document_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES public.warehouse_documents(id) ON DELETE CASCADE,
  line_no      integer NOT NULL,
  item_id      uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  -- Cantidad en la unidad del artículo; con signo solo en ajustes (diferencia).
  quantity     numeric(18,3) NOT NULL CHECK (quantity <> 0),
  entered_qty  numeric(18,3) NOT NULL,
  entered_unit_id uuid REFERENCES public.warehouse_units(id) ON DELETE SET NULL,
  unit_cost    numeric(18,6) CHECK (unit_cost >= 0),
  system_qty   numeric(18,3),
  counted_qty  numeric(18,3) CHECK (counted_qty >= 0),
  condition    text CHECK (condition IN ('sellable', 'damaged')),
  reason       text,
  UNIQUE (document_id, line_no)
);

CREATE TABLE public.warehouse_doc_counters (
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type    text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, doc_type)
);

-- ------------------------------------------------------------
-- 8. Registro inmutable de movimientos / kardex (WH-08)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  warehouse_id    uuid NOT NULL REFERENCES public.warehouse_warehouses(id) ON DELETE CASCADE,
  movement_type   text NOT NULL CHECK (movement_type IN (
                    'receipt', 'issue', 'adjustment_in', 'adjustment_out',
                    'return_sellable', 'return_damaged', 'pos_sale', 'pos_return',
                    'import', 'reversal')),
  bucket          text NOT NULL DEFAULT 'on_hand' CHECK (bucket IN ('on_hand', 'damaged')),
  quantity        numeric(18,3) NOT NULL CHECK (quantity <> 0),
  unit_cost       numeric(18,6) NOT NULL DEFAULT 0,
  on_hand_after   numeric(18,3) NOT NULL,
  damaged_after   numeric(18,3) NOT NULL,
  avg_cost_after  numeric(18,6) NOT NULL,
  document_id     uuid REFERENCES public.warehouse_documents(id) ON DELETE SET NULL,
  reference_type  text,
  reference_id    text,
  reason          text,
  reversal_of     uuid REFERENCES public.warehouse_movements(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  actor_id        uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX warehouse_movements_item_idx ON public.warehouse_movements (tenant_id, item_id, created_at DESC);
CREATE INDEX warehouse_movements_date_idx ON public.warehouse_movements (tenant_id, created_at DESC);
CREATE INDEX warehouse_movements_type_idx ON public.warehouse_movements (tenant_id, movement_type, created_at DESC);
CREATE UNIQUE INDEX warehouse_movements_single_reversal ON public.warehouse_movements (reversal_of) WHERE reversal_of IS NOT NULL;

CREATE FUNCTION public.warehouse_movements_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Permite solo el borrado en cascada (p. ej. al eliminar la empresa).
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Los movimientos de inventario son inmutables; registra un reverso.';
END $$;
CREATE TRIGGER warehouse_movements_no_update
  BEFORE UPDATE OR DELETE ON public.warehouse_movements
  FOR EACH ROW EXECUTE FUNCTION public.warehouse_movements_immutable();

-- ------------------------------------------------------------
-- 9. Importaciones (WH-19..WH-22, WH-27)
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_import_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation    text NOT NULL CHECK (operation IN ('items', 'initial_stock', 'prices')),
  file_name    text NOT NULL,
  file_sha256  text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  status       text NOT NULL CHECK (status IN ('validated', 'invalid', 'applied', 'cancelled')),
  apply_mode   text CHECK (apply_mode IN ('all_or_nothing', 'partial')),
  total_rows   integer NOT NULL DEFAULT 0,
  valid_rows   integer NOT NULL DEFAULT 0,
  error_rows   integer NOT NULL DEFAULT 0,
  summary      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  applied_by   uuid,
  applied_at   timestamptz
);
CREATE INDEX warehouse_import_jobs_tenant_idx ON public.warehouse_import_jobs (tenant_id, created_at DESC);
-- Reimportar un archivo ya confirmado no duplica movimientos (sección 11).
CREATE UNIQUE INDEX warehouse_import_jobs_applied_once
  ON public.warehouse_import_jobs (tenant_id, operation, file_sha256) WHERE status = 'applied';

CREATE TABLE public.warehouse_import_rows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_id     uuid NOT NULL REFERENCES public.warehouse_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  action     text NOT NULL CHECK (action IN ('create', 'update', 'movement', 'skip')),
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw        jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors     jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (job_id, row_number)
);

-- ------------------------------------------------------------
-- 10. Auditoría de configuración y catálogo
-- ------------------------------------------------------------
CREATE TABLE public.warehouse_audit_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id   uuid,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  details    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warehouse_audit_events_tenant_idx ON public.warehouse_audit_events (tenant_id, created_at DESC);

-- ------------------------------------------------------------
-- 11. RLS: lectura para miembros activos; escritura solo vía servidor
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouse_settings', 'warehouse_business_profiles', 'warehouse_units', 'warehouse_categories',
    'warehouse_attribute_definitions', 'warehouse_items', 'warehouse_item_barcodes',
    'warehouse_warehouses', 'warehouse_balances', 'warehouse_documents', 'warehouse_document_lines',
    'warehouse_doc_counters', 'warehouse_movements', 'warehouse_import_jobs', 'warehouse_import_rows',
    'warehouse_audit_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.warehouse_is_member(tenant_id))', t || '_member_read', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 12. Funciones transaccionales (solo service_role)
-- ------------------------------------------------------------

-- Configuración inicial idempotente: ajustes, unidades base y almacén principal.
CREATE FUNCTION public.warehouse_bootstrap(p_tenant uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_kg uuid; v_l uuid; v_wh uuid; v_branch uuid;
BEGIN
  PERFORM 1 FROM tenants WHERE id = p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa no encontrada'; END IF;
  INSERT INTO warehouse_settings (tenant_id) VALUES (p_tenant) ON CONFLICT DO NOTHING;

  INSERT INTO warehouse_units (tenant_id, code, name, symbol) VALUES
    (p_tenant, 'UND', 'Unidad', 'und'),
    (p_tenant, 'KG', 'Kilogramo', 'kg'),
    (p_tenant, 'L', 'Litro', 'l')
  ON CONFLICT (tenant_id, code) DO NOTHING;
  SELECT id INTO v_kg FROM warehouse_units WHERE tenant_id = p_tenant AND code = 'KG';
  SELECT id INTO v_l FROM warehouse_units WHERE tenant_id = p_tenant AND code = 'L';
  INSERT INTO warehouse_units (tenant_id, code, name, symbol, base_unit_id, factor) VALUES
    (p_tenant, 'G', 'Gramo', 'g', v_kg, 0.001),
    (p_tenant, 'ML', 'Mililitro', 'ml', v_l, 0.001)
  ON CONFLICT (tenant_id, code) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM warehouse_warehouses WHERE tenant_id = p_tenant) THEN
    SELECT id INTO v_branch FROM tenant_branches
      WHERE tenant_id = p_tenant AND status = 'active' ORDER BY is_primary DESC, created_at LIMIT 1;
    INSERT INTO warehouse_warehouses (tenant_id, branch_id, code, name)
      VALUES (p_tenant, v_branch, 'PRINCIPAL', 'Almacén principal') RETURNING id INTO v_wh;
    UPDATE warehouse_settings SET default_warehouse_id = v_wh
      WHERE tenant_id = p_tenant AND default_warehouse_id IS NULL;
  END IF;
END $$;

-- Núcleo: aplica un movimiento bloqueando el saldo. Única vía para cambiar existencias.
CREATE FUNCTION public.warehouse_apply_movement(
  p_tenant uuid, p_item uuid, p_warehouse uuid, p_type text, p_qty numeric,
  p_unit_cost numeric, p_bucket text, p_document uuid, p_ref_type text, p_ref_id text,
  p_reason text, p_key text, p_actor uuid, p_reversal_of uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid; v_item record; v_bal record;
  v_on numeric; v_dmg numeric; v_avg numeric; v_cost numeric;
BEGIN
  SELECT id INTO v_id FROM warehouse_movements WHERE tenant_id = p_tenant AND idempotency_key = p_key;
  IF FOUND THEN RETURN v_id; END IF;
  IF p_qty IS NULL OR p_qty = 0 THEN RAISE EXCEPTION 'Cantidad inválida.'; END IF;
  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN RAISE EXCEPTION 'El costo no puede ser negativo.'; END IF;

  SELECT id, sku, track_stock INTO v_item FROM warehouse_items WHERE id = p_item AND tenant_id = p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Artículo no encontrado.'; END IF;
  IF NOT v_item.track_stock THEN RAISE EXCEPTION 'El artículo % no maneja existencias.', v_item.sku; END IF;
  PERFORM 1 FROM warehouse_warehouses WHERE id = p_warehouse AND tenant_id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Almacén no disponible.'; END IF;

  INSERT INTO warehouse_balances (tenant_id, item_id, warehouse_id)
    VALUES (p_tenant, p_item, p_warehouse) ON CONFLICT DO NOTHING;
  SELECT * INTO v_bal FROM warehouse_balances
    WHERE item_id = p_item AND warehouse_id = p_warehouse FOR UPDATE;
  v_on := v_bal.on_hand; v_dmg := v_bal.damaged; v_avg := v_bal.avg_cost;

  IF p_bucket = 'damaged' THEN
    v_cost := coalesce(p_unit_cost, v_avg);
    v_dmg := v_dmg + p_qty;
    IF v_dmg < 0 THEN RAISE EXCEPTION 'Stock dañado insuficiente para %.', v_item.sku; END IF;
  ELSIF p_bucket = 'on_hand' THEN
    IF p_qty > 0 THEN
      v_cost := coalesce(p_unit_cost, v_avg);
      v_avg := round((v_on * v_avg + p_qty * v_cost) / (v_on + p_qty), 6);
    ELSE
      v_cost := v_avg;
    END IF;
    v_on := v_on + p_qty;
    IF v_on < v_bal.reserved THEN
      RAISE EXCEPTION 'Stock insuficiente para % (disponible: %).', v_item.sku, v_bal.on_hand - v_bal.reserved;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de saldo inválido.';
  END IF;

  UPDATE warehouse_balances SET on_hand = v_on, damaged = v_dmg, avg_cost = v_avg, updated_at = now()
    WHERE item_id = p_item AND warehouse_id = p_warehouse;
  INSERT INTO warehouse_movements (
    tenant_id, item_id, warehouse_id, movement_type, bucket, quantity, unit_cost,
    on_hand_after, damaged_after, avg_cost_after, document_id, reference_type, reference_id,
    reason, reversal_of, idempotency_key, actor_id)
  VALUES (
    p_tenant, p_item, p_warehouse, p_type, p_bucket, p_qty, v_cost,
    v_on, v_dmg, v_avg, p_document, p_ref_type, p_ref_id,
    p_reason, p_reversal_of, p_key, p_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Contabiliza un documento: todas sus líneas o ninguna.
CREATE FUNCTION public.warehouse_post_document(p_tenant uuid, p_document uuid, p_actor uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_doc record; v_line record; v_type text; v_bucket text;
BEGIN
  SELECT * INTO v_doc FROM warehouse_documents WHERE id = p_document AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento no encontrado.'; END IF;
  IF v_doc.status <> 'pending_approval' THEN RAISE EXCEPTION 'El documento ya fue procesado.'; END IF;

  -- Orden estable de bloqueo para evitar interbloqueos entre documentos concurrentes.
  FOR v_line IN SELECT * FROM warehouse_document_lines WHERE document_id = p_document ORDER BY item_id, line_no LOOP
    v_bucket := 'on_hand';
    v_type := CASE v_doc.doc_type
      WHEN 'receipt' THEN 'receipt'
      WHEN 'issue' THEN 'issue'
      WHEN 'adjustment' THEN CASE WHEN v_line.quantity > 0 THEN 'adjustment_in' ELSE 'adjustment_out' END
      WHEN 'return' THEN CASE WHEN v_line.condition = 'damaged' THEN 'return_damaged' ELSE 'return_sellable' END
    END;
    IF v_type = 'return_damaged' THEN v_bucket := 'damaged'; END IF;
    PERFORM warehouse_apply_movement(
      p_tenant, v_line.item_id, v_doc.warehouse_id, v_type,
      CASE WHEN v_doc.doc_type = 'issue' THEN -v_line.quantity ELSE v_line.quantity END,
      v_line.unit_cost, v_bucket, p_document, 'document', v_doc.number,
      coalesce(v_line.reason, v_doc.reason), 'doc:' || v_line.id, p_actor);
  END LOOP;

  -- En ajustes queda registrado quién los autorizó (sección 11: cambios auditables).
  UPDATE warehouse_documents SET status = 'posted', posted_at = now(),
    decided_by = CASE WHEN doc_type = 'adjustment' THEN p_actor END,
    decided_at = CASE WHEN doc_type = 'adjustment' THEN now() END
  WHERE id = p_document;
END $$;

-- Crea un documento (y lo contabiliza si p_post). Idempotente por idempotency_key.
-- p_doc: {doc_type, warehouse_id, supplier_id?, reason?, reference?, notes?, evidence_url?,
--         idempotency_key, lines: [{item_id, quantity?, counted_qty?, unit_id?, unit_cost?, condition?, reason?}]}
CREATE FUNCTION public.warehouse_create_document(p_tenant uuid, p_actor uuid, p_doc jsonb, p_post boolean)
RETURNS uuid
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid; v_type text := p_doc->>'doc_type'; v_wh uuid := (p_doc->>'warehouse_id')::uuid;
  v_key text := p_doc->>'idempotency_key'; v_line jsonb; v_no integer := 0; v_item record;
  v_qty numeric; v_entered numeric; v_unit uuid; v_unit_factor numeric; v_unit_base uuid;
  v_item_factor numeric; v_item_base uuid; v_system numeric; v_counted numeric; v_number integer;
  v_prefix text; v_nonzero integer := 0;
BEGIN
  IF v_key IS NULL OR length(v_key) < 8 THEN RAISE EXCEPTION 'Falta la clave de idempotencia.'; END IF;
  SELECT id INTO v_id FROM warehouse_documents WHERE tenant_id = p_tenant AND idempotency_key = v_key;
  IF FOUND THEN RETURN v_id; END IF;

  IF v_type NOT IN ('receipt', 'issue', 'adjustment', 'return') THEN RAISE EXCEPTION 'Tipo de documento inválido.'; END IF;
  PERFORM 1 FROM warehouse_warehouses WHERE id = v_wh AND tenant_id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Almacén no disponible.'; END IF;
  IF p_doc->>'supplier_id' IS NOT NULL THEN
    PERFORM 1 FROM warehouse_supplier_profiles WHERE id = (p_doc->>'supplier_id')::uuid AND tenant_id = p_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Proveedor no encontrado.'; END IF;
  END IF;
  IF jsonb_typeof(p_doc->'lines') <> 'array' OR jsonb_array_length(p_doc->'lines') = 0 THEN
    RAISE EXCEPTION 'El documento debe tener al menos una línea.';
  END IF;
  IF jsonb_array_length(p_doc->'lines') > 500 THEN RAISE EXCEPTION 'Máximo 500 líneas por documento.'; END IF;

  INSERT INTO warehouse_doc_counters (tenant_id, doc_type, last_number) VALUES (p_tenant, v_type, 1)
  ON CONFLICT (tenant_id, doc_type) DO UPDATE SET last_number = warehouse_doc_counters.last_number + 1
  RETURNING last_number INTO v_number;
  v_prefix := CASE v_type WHEN 'receipt' THEN 'ENT' WHEN 'issue' THEN 'SAL' WHEN 'adjustment' THEN 'AJU' ELSE 'DEV' END;

  INSERT INTO warehouse_documents (tenant_id, doc_type, number, status, warehouse_id, supplier_id, reason,
    reference, notes, evidence_url, idempotency_key, created_by)
  VALUES (p_tenant, v_type, v_prefix || '-' || lpad(v_number::text, 6, '0'), 'pending_approval', v_wh,
    (p_doc->>'supplier_id')::uuid, nullif(trim(p_doc->>'reason'), ''), nullif(trim(p_doc->>'reference'), ''),
    nullif(trim(p_doc->>'notes'), ''), nullif(trim(p_doc->>'evidence_url'), ''), v_key, p_actor)
  RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_doc->'lines') LOOP
    v_no := v_no + 1;
    SELECT i.id, i.sku, i.track_stock, i.status, i.unit_id, coalesce(u.base_unit_id, u.id) AS base, u.factor
      INTO v_item
      FROM warehouse_items i JOIN warehouse_units u ON u.id = i.unit_id
      WHERE i.id = (v_line->>'item_id')::uuid AND i.tenant_id = p_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Línea %: artículo no encontrado.', v_no; END IF;
    IF NOT v_item.track_stock THEN RAISE EXCEPTION 'Línea %: % no maneja existencias.', v_no, v_item.sku; END IF;
    IF v_item.status <> 'active' AND v_type IN ('receipt', 'issue') THEN
      RAISE EXCEPTION 'Línea %: % está inactivo.', v_no, v_item.sku;
    END IF;
    v_system := NULL; v_counted := NULL; v_unit := NULL;

    IF v_type = 'adjustment' THEN
      v_counted := (v_line->>'counted_qty')::numeric;
      IF v_counted IS NULL OR v_counted < 0 THEN RAISE EXCEPTION 'Línea %: conteo inválido.', v_no; END IF;
      SELECT coalesce(on_hand, 0) INTO v_system FROM warehouse_balances
        WHERE item_id = v_item.id AND warehouse_id = v_wh;
      v_system := coalesce(v_system, 0);
      v_entered := v_counted; v_qty := v_counted - v_system;
      IF v_qty = 0 THEN CONTINUE; END IF;
    ELSE
      v_entered := (v_line->>'quantity')::numeric;
      IF v_entered IS NULL OR v_entered <= 0 THEN RAISE EXCEPTION 'Línea %: la cantidad debe ser mayor a cero.', v_no; END IF;
      v_qty := v_entered;
      v_unit := (v_line->>'unit_id')::uuid;
      IF v_unit IS NOT NULL AND v_unit <> v_item.unit_id THEN
        SELECT coalesce(base_unit_id, id), factor INTO v_unit_base, v_unit_factor
          FROM warehouse_units WHERE id = v_unit AND tenant_id = p_tenant AND status = 'active';
        IF NOT FOUND OR v_unit_base <> v_item.base THEN
          RAISE EXCEPTION 'Línea %: la unidad no es convertible a la del artículo %.', v_no, v_item.sku;
        END IF;
        v_qty := round(v_entered * v_unit_factor / v_item.factor, 3);
        IF v_qty <= 0 THEN RAISE EXCEPTION 'Línea %: cantidad convertida inválida.', v_no; END IF;
      END IF;
    END IF;
    IF v_type = 'return' AND coalesce(v_line->>'condition', '') NOT IN ('sellable', 'damaged') THEN
      RAISE EXCEPTION 'Línea %: indica la condición del artículo devuelto.', v_no;
    END IF;
    IF v_type = 'receipt' AND (v_line->>'unit_cost') IS NULL THEN
      RAISE EXCEPTION 'Línea %: el costo es obligatorio en entradas.', v_no;
    END IF;

    v_nonzero := v_nonzero + 1;
    INSERT INTO warehouse_document_lines (tenant_id, document_id, line_no, item_id, quantity, entered_qty,
      entered_unit_id, unit_cost, system_qty, counted_qty, condition, reason)
    VALUES (p_tenant, v_id, v_no, v_item.id, v_qty, v_entered, v_unit,
      -- El costo se captura por unidad ingresada y se lleva a la unidad del artículo.
      CASE WHEN v_type = 'receipt' THEN round((v_line->>'unit_cost')::numeric * v_entered / v_qty, 6) END,
      v_system, v_counted,
      CASE WHEN v_type = 'return' THEN v_line->>'condition' END,
      nullif(trim(v_line->>'reason'), ''));
  END LOOP;

  IF v_nonzero = 0 THEN RAISE EXCEPTION 'No hay diferencias que ajustar.'; END IF;
  IF p_post THEN PERFORM warehouse_post_document(p_tenant, v_id, p_actor); END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION public.warehouse_reject_document(p_tenant uuid, p_document uuid, p_actor uuid, p_note text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE warehouse_documents SET status = 'rejected', decided_by = p_actor, decided_at = now(),
    decision_note = nullif(trim(p_note), '')
  WHERE id = p_document AND tenant_id = p_tenant AND status = 'pending_approval';
  IF NOT FOUND THEN RAISE EXCEPTION 'El documento no está pendiente de aprobación.'; END IF;
END $$;

-- Reverso auditado: genera movimientos inversos; falla si el stock ya no alcanza.
CREATE FUNCTION public.warehouse_reverse_document(p_tenant uuid, p_document uuid, p_actor uuid, p_note text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_doc record; v_mov record;
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN RAISE EXCEPTION 'Indica el motivo del reverso.'; END IF;
  SELECT * INTO v_doc FROM warehouse_documents WHERE id = p_document AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_doc.status <> 'posted' THEN RAISE EXCEPTION 'Solo se reversan documentos contabilizados.'; END IF;
  FOR v_mov IN SELECT * FROM warehouse_movements
      WHERE document_id = p_document AND movement_type <> 'reversal' ORDER BY item_id, id LOOP
    PERFORM warehouse_apply_movement(p_tenant, v_mov.item_id, v_mov.warehouse_id, 'reversal',
      -v_mov.quantity, v_mov.unit_cost, v_mov.bucket, p_document, 'reversal', v_doc.number,
      p_note, 'rev:' || v_mov.id, p_actor, v_mov.id);
  END LOOP;
  UPDATE warehouse_documents SET status = 'reversed', decision_note = p_note,
    decided_by = p_actor, decided_at = now() WHERE id = p_document;
END $$;

-- Integración POS (WH-14): venta descuenta y devolución/anulación repone, idempotente por referencia.
-- p_event: {kind: 'sale'|'return', reference, warehouse_id?, lines: [{sku, quantity}]}
CREATE FUNCTION public.warehouse_register_pos_event(p_tenant uuid, p_actor uuid, p_event jsonb)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_kind text := p_event->>'kind'; v_ref text := nullif(trim(p_event->>'reference'), '');
  v_wh uuid := (p_event->>'warehouse_id')::uuid; v_line record; v_item record; v_count integer := 0;
BEGIN
  IF v_kind NOT IN ('sale', 'return') THEN RAISE EXCEPTION 'Evento POS inválido.'; END IF;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'Falta la referencia de la venta.'; END IF;
  IF v_wh IS NULL THEN
    SELECT default_warehouse_id INTO v_wh FROM warehouse_settings WHERE tenant_id = p_tenant;
  END IF;
  IF v_wh IS NULL THEN RAISE EXCEPTION 'No hay almacén predeterminado para el POS.'; END IF;
  -- Agrupa por SKU: la clave idempotente es por SKU, así líneas repetidas no se pierden.
  FOR v_line IN
      SELECT value->>'sku' AS sku, sum((value->>'quantity')::numeric) AS qty, bool_or((value->>'quantity')::numeric <= 0) AS bad
      FROM jsonb_array_elements(coalesce(p_event->'lines', '[]'::jsonb))
      GROUP BY 1 ORDER BY 1 LOOP
    SELECT id, sku, track_stock INTO v_item FROM warehouse_items
      WHERE tenant_id = p_tenant AND sku = v_line.sku;
    IF NOT FOUND THEN RAISE EXCEPTION 'SKU % no existe en el catálogo.', v_line.sku; END IF;
    IF v_line.qty IS NULL OR v_line.bad THEN RAISE EXCEPTION 'Cantidad inválida para %.', v_item.sku; END IF;
    IF NOT v_item.track_stock THEN CONTINUE; END IF;
    PERFORM warehouse_apply_movement(p_tenant, v_item.id, v_wh,
      CASE v_kind WHEN 'sale' THEN 'pos_sale' ELSE 'pos_return' END,
      CASE v_kind WHEN 'sale' THEN -v_line.qty ELSE v_line.qty END, NULL, 'on_hand', NULL,
      'pos', v_ref, NULL, 'pos:' || v_kind || ':' || v_ref || ':' || v_item.sku, p_actor);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- Aplica una importación validada. Todo o nada por defecto; parcial solo si se pide explícitamente.
CREATE FUNCTION public.warehouse_apply_import(p_tenant uuid, p_job uuid, p_actor uuid, p_partial boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_job record; v_row record; v_d jsonb; v_item uuid; v_cat uuid; v_code text;
  v_created integer := 0; v_updated integer := 0; v_moves integer := 0;
BEGIN
  SELECT * INTO v_job FROM warehouse_import_jobs WHERE id = p_job AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Importación no encontrada.'; END IF;
  IF v_job.status = 'applied' THEN RAISE EXCEPTION 'Esta importación ya fue aplicada.'; END IF;
  IF v_job.status = 'cancelled' THEN RAISE EXCEPTION 'La importación fue cancelada.'; END IF;
  IF v_job.status = 'invalid' AND NOT p_partial THEN
    RAISE EXCEPTION 'La importación tiene errores; corrige el archivo o acepta la aplicación parcial.';
  END IF;
  IF v_job.valid_rows = 0 THEN RAISE EXCEPTION 'No hay filas válidas para aplicar.'; END IF;
  IF EXISTS (SELECT 1 FROM warehouse_import_jobs WHERE tenant_id = p_tenant AND operation = v_job.operation
             AND file_sha256 = v_job.file_sha256 AND status = 'applied') THEN
    RAISE EXCEPTION 'Este archivo ya fue importado anteriormente.';
  END IF;

  FOR v_row IN SELECT * FROM warehouse_import_rows
      WHERE job_id = p_job AND jsonb_array_length(errors) = 0 AND action <> 'skip' ORDER BY row_number LOOP
    v_d := v_row.data;
    IF v_job.operation = 'items' THEN
      v_cat := NULL;
      IF nullif(v_d->>'category', '') IS NOT NULL THEN
        INSERT INTO warehouse_categories (tenant_id, name) VALUES (p_tenant, v_d->>'category')
          ON CONFLICT (tenant_id, name) DO NOTHING;
        SELECT id INTO v_cat FROM warehouse_categories WHERE tenant_id = p_tenant AND name = v_d->>'category';
      END IF;
      IF v_row.action = 'create' THEN
        INSERT INTO warehouse_items (tenant_id, sku, name, description, item_type, category_id, unit_id,
          price_usd, tax_rate, min_stock, attributes, created_by)
        VALUES (p_tenant, v_d->>'sku', v_d->>'name', nullif(v_d->>'description', ''), v_d->>'item_type', v_cat,
          (v_d->>'unit_id')::uuid, (v_d->>'price_usd')::numeric, (v_d->>'tax_rate')::numeric,
          (v_d->>'min_stock')::numeric, coalesce(v_d->'attributes', '{}'::jsonb), p_actor)
        RETURNING id INTO v_item;
        v_created := v_created + 1;
      ELSE
        UPDATE warehouse_items SET name = v_d->>'name',
          description = nullif(v_d->>'description', ''), item_type = v_d->>'item_type', category_id = v_cat,
          unit_id = (v_d->>'unit_id')::uuid, price_usd = (v_d->>'price_usd')::numeric,
          tax_rate = (v_d->>'tax_rate')::numeric, min_stock = (v_d->>'min_stock')::numeric,
          attributes = coalesce(v_d->'attributes', '{}'::jsonb), updated_at = now()
        WHERE tenant_id = p_tenant AND sku = v_d->>'sku' RETURNING id INTO v_item;
        IF NOT FOUND THEN RAISE EXCEPTION 'Fila %: el SKU % ya no existe.', v_row.row_number, v_d->>'sku'; END IF;
        v_updated := v_updated + 1;
      END IF;
      FOR v_code IN SELECT jsonb_array_elements_text(coalesce(v_d->'barcodes', '[]'::jsonb)) LOOP
        INSERT INTO warehouse_item_barcodes (tenant_id, item_id, code) VALUES (p_tenant, v_item, v_code)
          ON CONFLICT (tenant_id, code) DO NOTHING;
        PERFORM 1 FROM warehouse_item_barcodes WHERE tenant_id = p_tenant AND code = v_code AND item_id = v_item;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Fila %: el código % ya pertenece a otro artículo.', v_row.row_number, v_code;
        END IF;
      END LOOP;
    ELSIF v_job.operation = 'initial_stock' THEN
      PERFORM warehouse_apply_movement(p_tenant, (v_d->>'item_id')::uuid, (v_d->>'warehouse_id')::uuid,
        'import', (v_d->>'quantity')::numeric, (v_d->>'unit_cost')::numeric, 'on_hand', NULL,
        'import', v_job.id::text, 'Stock inicial importado', 'imp:' || v_job.id || ':' || v_row.row_number, p_actor);
      v_moves := v_moves + 1;
    ELSIF v_job.operation = 'prices' THEN
      UPDATE warehouse_items SET price_usd = (v_d->>'price_usd')::numeric, updated_at = now()
        WHERE id = (v_d->>'item_id')::uuid AND tenant_id = p_tenant;
      IF NOT FOUND THEN RAISE EXCEPTION 'Fila %: artículo no encontrado.', v_row.row_number; END IF;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  UPDATE warehouse_import_jobs SET status = 'applied', applied_by = p_actor, applied_at = now(),
    apply_mode = CASE WHEN p_partial AND v_job.error_rows > 0 THEN 'partial' ELSE 'all_or_nothing' END,
    summary = summary || jsonb_build_object('applied_created', v_created, 'applied_updated', v_updated, 'applied_movements', v_moves)
  WHERE id = p_job;
  RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'movements', v_moves);
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'warehouse_bootstrap(uuid)',
    'warehouse_apply_movement(uuid,uuid,uuid,text,numeric,numeric,text,uuid,text,text,text,text,uuid,uuid)',
    'warehouse_post_document(uuid,uuid,uuid)',
    'warehouse_create_document(uuid,uuid,jsonb,boolean)',
    'warehouse_reject_document(uuid,uuid,uuid,text)',
    'warehouse_reverse_document(uuid,uuid,uuid,text)',
    'warehouse_register_pos_event(uuid,uuid,jsonb)',
    'warehouse_apply_import(uuid,uuid,uuid,boolean)',
    'warehouse_movements_immutable()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'warehouse_bootstrap(uuid)',
    'warehouse_apply_movement(uuid,uuid,uuid,text,numeric,numeric,text,uuid,text,text,text,text,uuid,uuid)',
    'warehouse_post_document(uuid,uuid,uuid)',
    'warehouse_create_document(uuid,uuid,jsonb,boolean)',
    'warehouse_reject_document(uuid,uuid,uuid,text)',
    'warehouse_reverse_document(uuid,uuid,uuid,text)',
    'warehouse_register_pos_event(uuid,uuid,jsonb)',
    'warehouse_apply_import(uuid,uuid,uuid,boolean)']
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
