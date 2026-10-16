-- VORA optional modules: catalog only, no tenant assignments or activations.
-- Existing Siigo and Shopify integrations remain untouched.
INSERT INTO features (key, name, description, category, implementation_status, sort_order)
VALUES
  ('commerce.billing', 'VORA Billing', 'Facturación independiente del CRM; documentos y numeración. Requiere implementación y validación fiscal.', 'commerce', 'planned', 200),
  ('commerce.storefront', 'VORA Store', 'Tienda web multitenant con catálogo público y pedidos.', 'commerce', 'planned', 210),
  ('commerce.network', 'VORA Network', 'Red de asesoras, catálogos, comisiones y distribución.', 'commerce', 'planned', 220),
  ('finance.bank', 'VORA Bank', 'Importación y conciliación de movimientos bancarios.', 'finance', 'planned', 230),
  ('finance.pay', 'VORA Pay', 'Registro y verificación de cobros y comprobantes.', 'finance', 'planned', 240),
  ('fiscal.venezuela', 'VORA Fiscal', 'Configuración tributaria venezolana, libros y reportes.', 'fiscal', 'planned', 250)
ON CONFLICT (key) DO NOTHING;
