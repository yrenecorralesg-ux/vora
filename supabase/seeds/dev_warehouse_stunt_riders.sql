-- ============================================================
-- Datos DE PRUEBA de Warehouse para la empresa stunt-riders. SOLO desarrollo.
-- Ejecutar a mano en el SQL Editor de la base de desarrollo, después de las migraciones.
-- Idempotente: se puede ejecutar varias veces sin duplicar artículos ni movimientos
-- (claves de idempotencia fijas 'seed-wh-sr-*').
--
-- Todo el stock entra por warehouse_create_document → warehouse_apply_movement, igual
-- que desde la aplicación: el kardex, el costo promedio y los saldos quedan coherentes.
--
-- Qué deja para probar:
--   · 6 categorías y 3 proveedores.
--   · 15 artículos nuevos con código de barras (físicos, uno a granel en KG, 2 servicios
--     sin stock, uno inactivo) + categoría y código a los 5 que ya existían.
--   · 2.º almacén "TIENDA" para probar traslados.
--   · Entradas con costo (incluye dos compras a distinto costo → promedio ponderado),
--     una salida, una devolución con unidad dañada y un ajuste PENDIENTE de aprobación.
--   · Alertas: GUA-202 bajo mínimo, ROD-310 sin existencia, CAS-099 (existente) en cero.
-- ============================================================

DO $$
DECLARE
  v_tenant uuid;
  v_principal uuid;
  v_tienda uuid;
  v_branch uuid;
  v_und uuid;
  v_kg uuid;
  v_sup1 uuid; v_sup2 uuid; v_sup3 uuid;
  r record;
BEGIN
  SELECT id INTO v_tenant FROM tenants WHERE slug = 'stunt-riders';
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No existe la empresa stunt-riders.'; END IF;

  SELECT id INTO v_und FROM warehouse_units WHERE tenant_id = v_tenant AND code = 'UND';
  SELECT id INTO v_kg  FROM warehouse_units WHERE tenant_id = v_tenant AND code = 'KG';
  IF v_und IS NULL OR v_kg IS NULL THEN RAISE EXCEPTION 'Faltan las unidades UND/KG: abre Warehouse una vez para inicializarlo.'; END IF;

  SELECT id INTO v_principal FROM warehouse_warehouses WHERE tenant_id = v_tenant AND code = 'PRINCIPAL';
  IF v_principal IS NULL THEN RAISE EXCEPTION 'Falta el almacén PRINCIPAL.'; END IF;
  SELECT id INTO v_branch FROM tenant_branches WHERE tenant_id = v_tenant ORDER BY created_at LIMIT 1;

  -- 1. Segundo almacén (para traslados) ------------------------------------
  INSERT INTO warehouse_warehouses (tenant_id, branch_id, code, name, address)
  VALUES (v_tenant, v_branch, 'TIENDA', 'Tienda / mostrador', 'Área de exhibición de la sede principal')
  ON CONFLICT (tenant_id, code) DO NOTHING;
  SELECT id INTO v_tienda FROM warehouse_warehouses WHERE tenant_id = v_tenant AND code = 'TIENDA';

  -- 2. Categorías -----------------------------------------------------------
  INSERT INTO warehouse_categories (tenant_id, name)
  SELECT v_tenant, n FROM unnest(ARRAY['Cascos', 'Ropa y protección', 'Lubricantes y químicos',
    'Repuestos', 'Accesorios', 'Servicios de taller']) AS n
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- 3. Proveedores ----------------------------------------------------------
  INSERT INTO warehouse_supplier_profiles (tenant_id, code, name, tax_id, contact_name, phone, city, category)
  VALUES
    (v_tenant, 'PROV-001', 'Moto Repuestos Prueba C.A.', 'J-00000001-0', 'Contacto de prueba', '0212-0000001', 'Caracas', 'general'),
    (v_tenant, 'PROV-002', 'Lubricantes Prueba S.A.', 'J-00000002-0', 'Contacto de prueba', '0241-0000002', 'Valencia', 'insumo'),
    (v_tenant, 'PROV-003', 'Textiles Racing Prueba C.A.', 'J-00000003-0', 'Contacto de prueba', '0261-0000003', 'Maracaibo', 'materia_prima')
  ON CONFLICT (tenant_id, name) DO NOTHING;
  SELECT id INTO v_sup1 FROM warehouse_supplier_profiles WHERE tenant_id = v_tenant AND code = 'PROV-001';
  SELECT id INTO v_sup2 FROM warehouse_supplier_profiles WHERE tenant_id = v_tenant AND code = 'PROV-002';
  SELECT id INTO v_sup3 FROM warehouse_supplier_profiles WHERE tenant_id = v_tenant AND code = 'PROV-003';

  -- 4. Artículos nuevos -----------------------------------------------------
  CREATE TEMP TABLE seed_items (sku text, name text, item_type text, category text, unit text,
    price numeric, min_stock numeric, barcode text) ON COMMIT DROP;
  INSERT INTO seed_items VALUES
    ('CAS-101', 'Casco Abierto Urban',                    'physical', 'Cascos',                 'UND', 65,   3,  '2000000000101'),
    ('GUA-201', 'Guantes Racing Cuero talla M',           'physical', 'Ropa y protección',      'UND', 28,   6,  '2000000000201'),
    ('GUA-202', 'Guantes Racing Cuero talla L',           'physical', 'Ropa y protección',      'UND', 28,   6,  '2000000000202'),
    ('CHA-301', 'Chaqueta de protección textil',          'physical', 'Ropa y protección',      'UND', 95,   2,  '2000000000301'),
    ('ROD-310', 'Rodilleras articuladas',                 'physical', 'Ropa y protección',      'UND', 35,   4,  '2000000000310'),
    ('LUB-401', 'Lubricante de cadena 400 ml',            'physical', 'Lubricantes y químicos', 'UND', 7.5,  10, '2000000000401'),
    ('LIM-402', 'Limpiador de cascos 250 ml',             'physical', 'Lubricantes y químicos', 'UND', 6,    8,  '2000000000402'),
    ('GRA-403', 'Grasa multipropósito a granel',          'weighted', 'Lubricantes y químicos', 'KG',  12,   2,  '2000000000403'),
    ('PAS-501', 'Pastillas de freno delanteras',          'physical', 'Repuestos',              'UND', 18,   6,  '2000000000501'),
    ('BUJ-502', 'Bujía iridium',                          'physical', 'Repuestos',              'UND', 11,   10, '2000000000502'),
    ('CAD-503', 'Kit de arrastre (cadena y piñones)',     'physical', 'Repuestos',              'UND', 85,   2,  '2000000000503'),
    ('ACC-601', 'Soporte de celular para manubrio',       'physical', 'Accesorios',             'UND', 16,   5,  '2000000000601'),
    ('ACC-699', 'Intercomunicador (modelo descontinuado)','physical', 'Accesorios',             'UND', 70,   0,  '2000000000699'),
    ('SRV-701', 'Servicio de cambio de aceite',           'service',  'Servicios de taller',    'UND', 10,   0,  NULL),
    ('SRV-702', 'Mantenimiento general',                  'service',  'Servicios de taller',    'UND', 45,   0,  NULL);

  INSERT INTO warehouse_items (tenant_id, sku, name, item_type, category_id, unit_id, price_usd, tax_rate, min_stock)
  SELECT v_tenant, s.sku, s.name, s.item_type, c.id,
         CASE s.unit WHEN 'KG' THEN v_kg ELSE v_und END, s.price,
         16, s.min_stock
  FROM seed_items s JOIN warehouse_categories c ON c.tenant_id = v_tenant AND c.name = s.category
  ON CONFLICT (tenant_id, sku) DO NOTHING;

  INSERT INTO warehouse_item_barcodes (tenant_id, item_id, code)
  SELECT v_tenant, i.id, s.barcode
  FROM seed_items s JOIN warehouse_items i ON i.tenant_id = v_tenant AND i.sku = s.sku
  WHERE s.barcode IS NOT NULL
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- Artículos que ya existían: categoría y código de barras si no tienen.
  UPDATE warehouse_items i SET category_id = c.id
  FROM (VALUES ('ACE-004', 'Lubricantes y químicos'), ('CMB-001', 'Ropa y protección'),
               ('CAS-099', 'Cascos'), ('GOR-015', 'Accesorios'), ('JE-032', 'Ropa y protección')) AS m(sku, cat)
  JOIN warehouse_categories c ON c.tenant_id = v_tenant AND c.name = m.cat
  WHERE i.tenant_id = v_tenant AND i.sku = m.sku AND i.category_id IS NULL;

  INSERT INTO warehouse_item_barcodes (tenant_id, item_id, code)
  SELECT v_tenant, i.id, m.code
  FROM (VALUES ('ACE-004', '2000000000004'), ('CMB-001', '2000000000001'), ('CAS-099', '2000000000099'),
               ('GOR-015', '2000000000015'), ('JE-032', '2000000000032')) AS m(sku, code)
  JOIN warehouse_items i ON i.tenant_id = v_tenant AND i.sku = m.sku
  WHERE NOT EXISTS (SELECT 1 FROM warehouse_item_barcodes b WHERE b.item_id = i.id)
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- 5. Documentos (se registran con las funciones del ledger) ----------------
  -- Helper: arma las líneas a partir de pares sku/cantidad/costo.
  CREATE TEMP TABLE seed_lines (doc text, sku text, qty numeric, cost numeric, cond text) ON COMMIT DROP;
  INSERT INTO seed_lines VALUES
    -- Compra a repuestos (PRINCIPAL)
    ('ent-1', 'CAS-101', 8, 38, NULL), ('ent-1', 'PAS-501', 15, 9.5, NULL), ('ent-1', 'BUJ-502', 40, 5.2, NULL),
    ('ent-1', 'CAD-503', 3, 52, NULL), ('ent-1', 'ACC-601', 18, 7, NULL), ('ent-1', 'ACC-699', 2, 41, NULL),
    -- Compra de lubricantes (PRINCIPAL)
    ('ent-2', 'LUB-401', 36, 3.9, NULL), ('ent-2', 'LIM-402', 24, 2.8, NULL), ('ent-2', 'GRA-403', 10, 6.5, NULL),
    -- Compra de ropa (PRINCIPAL)
    ('ent-3', 'GUA-201', 20, 14, NULL), ('ent-3', 'GUA-202', 4, 14, NULL), ('ent-3', 'CHA-301', 5, 58, NULL),
    -- Segunda compra de bujías a otro costo → promedio ponderado (40 × 5,20 + 20 × 5,80 = 5,40)
    ('ent-4', 'BUJ-502', 20, 5.8, NULL),
    -- Stock inicial en la tienda
    ('ent-5', 'GUA-201', 6, 14, NULL), ('ent-5', 'LUB-401', 12, 3.9, NULL),
    -- Salida: consumo del taller
    ('sal-1', 'PAS-501', 2, NULL, NULL),
    -- Devolución de un cliente con una unidad dañada
    ('dev-1', 'GUA-201', 1, NULL, 'damaged'),
    -- Ajuste por conteo: el sistema tiene 36, se contaron 34 (queda pendiente de aprobación)
    ('aju-1', 'LUB-401', 34, NULL, NULL);

  FOR r IN SELECT * FROM (VALUES
      ('ent-1', 'receipt',    v_principal, v_sup1, 'Compra inicial de repuestos y accesorios', 'FAC-PRUEBA-0001', true),
      ('ent-2', 'receipt',    v_principal, v_sup2, 'Compra de lubricantes',                    'FAC-PRUEBA-0002', true),
      ('ent-3', 'receipt',    v_principal, v_sup3, 'Compra de ropa de protección',             'FAC-PRUEBA-0003', true),
      ('ent-4', 'receipt',    v_principal, v_sup1, 'Reposición de bujías (nuevo precio)',      'FAC-PRUEBA-0004', true),
      ('ent-5', 'receipt',    v_tienda,    v_sup3, 'Stock inicial de la tienda',               'FAC-PRUEBA-0005', true),
      ('sal-1', 'issue',      v_principal, NULL::uuid, 'Consumo del taller',                   NULL, true),
      ('dev-1', 'return',     v_principal, NULL::uuid, 'Devolución de cliente: costura abierta', NULL, true),
      ('aju-1', 'adjustment', v_principal, NULL::uuid, 'Merma: envases dañados',               NULL, false)
    ) AS d(code, doc_type, wh, supplier, reason, reference, post)
  LOOP
    PERFORM warehouse_create_document(v_tenant, NULL, jsonb_build_object(
      'idempotency_key', 'seed-wh-sr-' || r.code,
      'doc_type', r.doc_type,
      'warehouse_id', r.wh,
      'supplier_id', r.supplier,
      'reason', r.reason,
      'reference', r.reference,
      'notes', 'Dato de prueba (seed de desarrollo)',
      'lines', (
        SELECT jsonb_agg(
          CASE r.doc_type
            WHEN 'adjustment' THEN jsonb_build_object('item_id', i.id, 'counted_qty', l.qty, 'reason', r.reason)
            WHEN 'return'     THEN jsonb_build_object('item_id', i.id, 'quantity', l.qty, 'condition', l.cond)
            WHEN 'receipt'    THEN jsonb_build_object('item_id', i.id, 'quantity', l.qty, 'unit_cost', l.cost)
            ELSE jsonb_build_object('item_id', i.id, 'quantity', l.qty)
          END)
        FROM seed_lines l JOIN warehouse_items i ON i.tenant_id = v_tenant AND i.sku = l.sku
        WHERE l.doc = r.code)
    ), r.post);
  END LOOP;

  -- El intercomunicador queda descontinuado (inactivo) con 2 unidades: prueba de artículos inactivos.
  UPDATE warehouse_items SET status = 'inactive' WHERE tenant_id = v_tenant AND sku = 'ACC-699';

  RAISE NOTICE 'Seed de Warehouse aplicado a stunt-riders.';
END $$;
