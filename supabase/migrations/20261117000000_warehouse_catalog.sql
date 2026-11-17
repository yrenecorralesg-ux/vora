-- ============================================================
-- VORA Warehouse: catálogo de módulos, roles y permisos
-- Especificación: warehousedocs/VORA_Warehouse_Definicion_Integral_40_Vistas_v2.pdf
--
-- · warehouse.inventory (MVP WH-01..WH-23, WH-27) y warehouse.suppliers quedan
--   'implemented': pueden contratarse y activarse por empresa desde Core.
-- · purchasing, locations y traceability siguen 'planned' (no activables).
-- · No activa ningún módulo en empresas existentes.
-- ============================================================
BEGIN;

INSERT INTO public.features (key, name, description, category, implementation_status, sort_order, available_functions)
VALUES
  ('warehouse.inventory', 'VORA Inventario',
   'Catálogo unificado, almacenes, entradas, salidas, ajustes con aprobación, kardex, importaciones y escaneo.',
   'warehouse', 'implemented', 300,
   '[
     {"key": "wh_imports", "name": "Importación Excel/CSV", "description": "Plantillas, validación por fila y aplicación idempotente (WH-19 a WH-22, WH-27).", "default_enabled": true},
     {"key": "wh_scanner", "name": "Escaneo de códigos", "description": "Lector USB/Bluetooth tipo teclado o entrada manual (WH-23).", "default_enabled": true},
     {"key": "wh_pos_integration", "name": "Integración POS", "description": "Descuento y reverso de stock por ventas POS (WH-14).", "default_enabled": true},
     {"key": "wh_reports", "name": "Reportes Warehouse", "description": "Valorización, rotación y movimientos exportables (WH-11).", "default_enabled": true}
   ]'::jsonb),
  ('warehouse.suppliers', 'VORA Proveedores',
   'Perfiles de proveedores y condiciones comerciales.',
   'warehouse', 'implemented', 310, '[]'::jsonb),
  ('warehouse.purchasing', 'VORA Compras',
   'Órdenes de compra, recepciones parciales y documentos de proveedor.',
   'warehouse', 'planned', 320, '[]'::jsonb),
  ('warehouse.locations', 'VORA Ubicaciones',
   'Ubicaciones internas (bins) y transferencias entre almacenes.',
   'warehouse', 'planned', 330, '[]'::jsonb),
  ('warehouse.traceability', 'VORA Trazabilidad',
   'Lotes, números de serie y alertas de vencimiento.',
   'warehouse', 'planned', 340, '[]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  implementation_status = EXCLUDED.implementation_status,
  sort_order = EXCLUDED.sort_order,
  available_functions = EXCLUDED.available_functions,
  updated_at = now();

-- Roles de almacén (sección 7 del documento)
INSERT INTO public.platform_roles (key, name, description, scope)
VALUES
  ('wh_manager',    'Administrador de almacén', 'Gestiona catálogo, almacenes, configuración, importaciones y aprobaciones.', 'tenant'),
  ('wh_supervisor', 'Supervisor de almacén',    'Aprueba ajustes y supervisa entradas, salidas e importaciones.',          'tenant'),
  ('wh_clerk',      'Almacenista',              'Registra entradas, salidas, devoluciones y solicita ajustes.',            'tenant'),
  ('wh_scanner',    'Operador de escaneo',      'Registra entradas mediante escáner o entrada manual.',                   'tenant'),
  ('wh_auditor',    'Auditor / contador',       'Lectura de existencias, kardex, costos y reportes.',                    'tenant')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- Permisos granulares. tenant_admin y Super Admin tienen todos (se resuelve en servidor).
INSERT INTO public.role_permissions (role_key, permission, scope)
SELECT r, p, 'tenant'
FROM (VALUES
  ('wh_manager', ARRAY['catalog.create','stock.receive','stock.issue','stock.return','stock.adjust.request','stock.adjust.approve','import.validate','import.apply','cost.view','report.view','warehouse.configure']),
  ('wh_supervisor', ARRAY['stock.receive','stock.issue','stock.return','stock.adjust.request','stock.adjust.approve','import.validate','cost.view','report.view']),
  ('wh_clerk', ARRAY['stock.receive','stock.issue','stock.return','stock.adjust.request']),
  ('wh_scanner', ARRAY['stock.receive']),
  ('wh_auditor', ARRAY['cost.view','report.view'])
) AS m(r, perms), unnest(m.perms) AS p
ON CONFLICT (role_key, permission) DO NOTHING;

COMMIT;
