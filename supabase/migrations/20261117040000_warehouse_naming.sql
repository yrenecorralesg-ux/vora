-- ============================================================
-- VORA Warehouse: nombres visibles alineados con el portal.
-- Solo cambia textos del catálogo; las claves (warehouse.*) no cambian.
-- ============================================================
UPDATE public.features AS f
SET name = v.name, updated_at = now()
FROM (VALUES
  ('warehouse.inventory',    'VORA Warehouse · Inventario'),
  ('warehouse.suppliers',    'VORA Warehouse · Proveedores'),
  ('warehouse.purchasing',   'VORA Warehouse · Compras'),
  ('warehouse.locations',    'VORA Warehouse · Ubicaciones'),
  ('warehouse.traceability', 'VORA Warehouse · Trazabilidad')
) AS v(key, name)
WHERE f.key = v.key;
