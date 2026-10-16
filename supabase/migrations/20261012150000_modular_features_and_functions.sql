-- Migration: 20261012150000_modular_features_and_functions.sql
-- Description: Adds available_functions metadata to features catalog, and ensures tenant_features has config jsonb for granular sub-function toggling.

-- 1. Add available_functions to features if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'features' AND column_name = 'available_functions'
  ) THEN
    ALTER TABLE features ADD COLUMN available_functions jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. Update features catalog with sub-functions & full modular descriptions
UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'sales_kpi', 'name', 'Métricas de ventas en tiempo real', 'description', 'KPIs mensuales y comparativa de facturación.', 'default_enabled', true),
  jsonb_build_object('key', 'channel_distribution', 'name', 'Ventas por canal', 'description', 'Barras comparativas de ventas en ferias, Shopify, WhatsApp y web.', 'default_enabled', true),
  jsonb_build_object('key', 'smart_recommendations', 'name', 'Acciones recomendadas', 'description', 'Sugerencias predictivas de clientes a contactar hoy.', 'default_enabled', true)
) WHERE key = 'crm.dashboard';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'customer_list', 'name', 'Directorio consolidado de clientes', 'description', 'Vista unificada sin duplicar contactos entre canales.', 'default_enabled', true),
  jsonb_build_object('key', 'action_shortcuts', 'name', 'Botones de siguiente acción', 'description', 'Atajos contextuales (Reposición, Contactar, Seguimiento, Bienvenida).', 'default_enabled', true),
  jsonb_build_object('key', 'customer_profile', 'name', 'Ficha 360 del cliente', 'description', 'Historial completo de compras, tickets y origen.', 'default_enabled', true),
  jsonb_build_object('key', 'export_data', 'name', 'Exportación de datos', 'description', 'Exportación de contactos en formato CSV/Excel.', 'default_enabled', false)
) WHERE key = 'crm.customers';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'qr_generator', 'name', 'Código QR dinámico para stands', 'description', 'QR escaneable en ferias para captura directa de clientes.', 'default_enabled', true),
  jsonb_build_object('key', 'pos_quick_sale', 'name', 'Registro express de venta en punto físico', 'description', 'Formulario ágil para vincular producto, monto y medio de pago.', 'default_enabled', true),
  jsonb_build_object('key', 'instant_crm_sync', 'name', 'Alta inmediata en CRM', 'description', 'Creación y vinculación en tiempo real al CRM sin retrasos.', 'default_enabled', true)
) WHERE key = 'capture.fairs';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'rfm_filters', 'name', 'Filtros por valor, canal y producto', 'description', 'Segmentación por monto de compra, canal feria/web y categoría.', 'default_enabled', true),
  jsonb_build_object('key', 'repurchase_kpis', 'name', 'Métricas rápidas del segmento', 'description', 'Indicadores de clientes encontrados, sin contacto y posibles reposiciones.', 'default_enabled', true),
  jsonb_build_object('key', 'repurchase_queue', 'name', 'Oportunidades de recompra priorizadas', 'description', 'Lista con tiempo transcurrido desde la última compra y valor acumulado.', 'default_enabled', true),
  jsonb_build_object('key', 'quick_contact', 'name', 'Disparo directo a WhatsApp / Email', 'description', 'Botón de contacto directo con la asesora asignada.', 'default_enabled', true)
) WHERE key = 'crm.segments';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'conversations_inbox', 'name', 'Bandeja de entrada multicanal', 'description', 'Centralización de chats de web, QR y WhatsApp.', 'default_enabled', true),
  jsonb_build_object('key', 'guided_assistant', 'name', 'Asistente automatizado guiado', 'description', 'Respuestas automáticas sobre disponibilidad y catálogo.', 'default_enabled', true),
  jsonb_build_object('key', 'purchase_intent_detection', 'name', 'Detección de intención de compra', 'description', 'Identificación de interés de compra para alertar al equipo.', 'default_enabled', true),
  jsonb_build_object('key', 'human_handover', 'name', 'Traspaso a asesora humana', 'description', 'Botón para que una asesora tome la conversación en el momento clave.', 'default_enabled', true)
) WHERE key = 'chatbot.guided_web';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'storefront_catalog', 'name', 'Catálogo visual de tienda virtual', 'description', 'Showcase de productos y colecciones de la marca.', 'default_enabled', true),
  jsonb_build_object('key', 'category_navigation', 'name', 'Navegación por categorías', 'description', 'Pestañas de colecciones como velas, fragancias, lámparas y sets.', 'default_enabled', true),
  jsonb_build_object('key', 'cart_indicator', 'name', 'Indicador de carrito y checkout', 'description', 'Badge de productos seleccionados e integración de carrito.', 'default_enabled', true)
) WHERE key = 'integration.shopify';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'orders_list', 'name', 'Listado maestro de pedidos', 'description', 'Visualización de pedidos ordenados por fecha y canal.', 'default_enabled', true),
  jsonb_build_object('key', 'order_status_tracking', 'name', 'Gestión de estados de despacho', 'description', 'Pendiente, procesando, enviado, entregado y cancelado.', 'default_enabled', true)
) WHERE key = 'crm.orders';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'product_catalog', 'name', 'Catálogo maestro de productos', 'description', 'SKU, nombre, categorías y precios de venta.', 'default_enabled', true),
  jsonb_build_object('key', 'stock_badges', 'name', 'Control y alertas de disponibilidad', 'description', 'Estados disponible, agotado y descontinuado.', 'default_enabled', true)
) WHERE key = 'crm.products';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'pipeline_board', 'name', 'Embudo de ventas y pipeline', 'description', 'Etapas de negociación: prospección, propuesta, negociación, ganada.', 'default_enabled', true),
  jsonb_build_object('key', 'pipeline_metrics', 'name', 'Métricas de valor estimado', 'description', 'Cálculo total de oportunidades abiertas vs ganadas.', 'default_enabled', true)
) WHERE key = 'crm.sales';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'tasks_list', 'name', 'Gestión de tareas de seguimiento', 'description', 'Tareas asignadas por asesor con fechas límite.', 'default_enabled', true),
  jsonb_build_object('key', 'task_completion', 'name', 'Marcado rápido de cumplimiento', 'description', 'Cambio de estado ágil entre pendiente y completada.', 'default_enabled', true)
) WHERE key = 'crm.tasks';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'campaign_builder', 'name', 'Diseñador de campañas comerciales', 'description', 'Campañas orientadas a segmentos con metas de conversión.', 'default_enabled', true),
  jsonb_build_object('key', 'multichannel_dispatch', 'name', 'Envío multicanal', 'description', 'Soporte para email, SMS, WhatsApp y banners de feria.', 'default_enabled', true)
) WHERE key = 'crm.campaigns';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'predictive_model', 'name', 'Algoritmo de predicción de ciclo', 'description', 'Diagnóstico automático de frecuencia y fecha estimada de recompra.', 'default_enabled', true),
  jsonb_build_object('key', 'prioritized_queue', 'name', 'Cola priorizada de clientes', 'description', 'Listado ordenado de clientes listos para recompra.', 'default_enabled', true)
) WHERE key = 'analytics.repurchase_pilot';

UPDATE features SET available_functions = jsonb_build_array(
  jsonb_build_object('key', 'electronic_invoicing', 'name', 'Facturación electrónica automática', 'description', 'Emisión autorizada de comprobantes fiscales.', 'default_enabled', true),
  jsonb_build_object('key', 'dian_sync', 'name', 'Sincronización con DIAN y Siigo', 'description', 'Validación de NIT, impuestos y consecutivo fiscal.', 'default_enabled', true)
) WHERE key = 'integration.siigo';

-- 3. Ensure all tenant_features rows have initialized config functions
UPDATE tenant_features
SET config = COALESCE(config, '{}'::jsonb) || '{"functions": {}}'::jsonb
WHERE config IS NULL OR NOT (config ? 'functions');
