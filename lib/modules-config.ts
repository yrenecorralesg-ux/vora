export interface ModuleFunction {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
}

export interface ModuleDefinition {
  key: string;
  name: string;
  category: 'crm' | 'integration' | 'channel' | 'automation' | 'analytics';
  description: string;
  href: string;
  functions: ModuleFunction[];
}

export const CRM_MODULES_CATALOG: Record<string, ModuleDefinition> = {
  'crm.dashboard': {
    key: 'crm.dashboard',
    name: 'Resumen y Reportes',
    category: 'crm',
    description: 'Panel principal con métricas clave y reportes base del CRM.',
    href: '/t/[slug]',
    functions: [
      { key: 'sales_kpi', name: 'Métricas de ventas en tiempo real', description: 'KPIs mensuales y comparativa de facturación.', defaultEnabled: true },
      { key: 'channel_distribution', name: 'Ventas por canal', description: 'Barras comparativas de ventas en ferias, Shopify, WhatsApp y web.', defaultEnabled: true },
      { key: 'smart_recommendations', name: 'Acciones recomendadas', description: 'Sugerencias predictivas de clientes a contactar hoy.', defaultEnabled: true },
    ],
  },
  'crm.customers': {
    key: 'crm.customers',
    name: 'Clientes',
    category: 'crm',
    description: 'Gestión de fichas de clientes sin duplicados con historial unificado.',
    href: '/t/[slug]/customers',
    functions: [
      { key: 'customer_list', name: 'Directorio consolidado de clientes', description: 'Vista unificada sin duplicar contactos entre canales.', defaultEnabled: true },
      { key: 'action_shortcuts', name: 'Botones de siguiente acción', description: 'Atajos contextuales (Reposición, Contactar, Seguimiento, Bienvenida).', defaultEnabled: true },
      { key: 'customer_profile', name: 'Ficha 360 del cliente', description: 'Historial completo de compras, tickets y origen.', defaultEnabled: true },
      { key: 'export_data', name: 'Exportación de datos', description: 'Exportación de contactos en formato CSV/Excel.', defaultEnabled: false },
    ],
  },
  'capture.fairs': {
    key: 'capture.fairs',
    name: 'Captura en feria / QR',
    category: 'crm',
    description: 'Captura de contactos por código QR y registro ágil en ferias y eventos.',
    href: '/t/[slug]/capture',
    functions: [
      { key: 'qr_generator', name: 'Código QR dinámico para stands', description: 'QR escaneable en ferias para captura directa de clientes.', defaultEnabled: true },
      { key: 'pos_quick_sale', name: 'Registro express de venta física', description: 'Formulario ágil para vincular producto, monto y medio de pago.', defaultEnabled: true },
      { key: 'instant_crm_sync', name: 'Alta inmediata en CRM', description: 'Creación y vinculación en tiempo real al CRM sin retrasos.', defaultEnabled: true },
    ],
  },
  'crm.segments': {
    key: 'crm.segments',
    name: 'Segmentación',
    category: 'crm',
    description: 'Segmentación de clientes por criterios de valor, canal y recurrencia.',
    href: '/t/[slug]/segments',
    functions: [
      { key: 'rfm_filters', name: 'Filtros por valor, canal y producto', description: 'Segmentación por monto de compra, canal feria/web y categoría.', defaultEnabled: true },
      { key: 'repurchase_kpis', name: 'Métricas rápidas del segmento', description: 'Indicadores de clientes encontrados, sin contacto y posibles reposiciones.', defaultEnabled: true },
      { key: 'repurchase_queue', name: 'Oportunidades de recompra priorizadas', description: 'Lista con tiempo transcurrido desde la última compra y valor acumulado.', defaultEnabled: true },
      { key: 'quick_contact', name: 'Disparo directo de contacto', description: 'Botón de contacto directo con la asesora asignada.', defaultEnabled: true },
    ],
  },
  'chatbot.guided_web': {
    key: 'chatbot.guided_web',
    name: 'Conversaciones',
    category: 'channel',
    description: 'Atención con asistente automático y traspaso inteligente a asesoras.',
    href: '/t/[slug]/conversations',
    functions: [
      { key: 'conversations_inbox', name: 'Bandeja de entrada multicanal', description: 'Centralización de chats de web, QR y WhatsApp.', defaultEnabled: true },
      { key: 'guided_assistant', name: 'Asistente automatizado guiado', description: 'Respuestas automáticas sobre disponibilidad y catálogo.', defaultEnabled: true },
      { key: 'purchase_intent_detection', name: 'Detección de intención de compra', description: 'Identificación de interés de compra para alertar al equipo.', defaultEnabled: true },
      { key: 'human_handover', name: 'Traspaso a asesora humana', description: 'Botón para que una asesora tome la conversación en el momento clave.', defaultEnabled: true },
    ],
  },
  'integration.shopify': {
    key: 'integration.shopify',
    name: 'Tienda virtual',
    category: 'integration',
    description: 'Showcase visual y sincronización con tienda virtual.',
    href: '/t/[slug]/store',
    functions: [
      { key: 'storefront_catalog', name: 'Catálogo visual de tienda virtual', description: 'Showcase de productos y colecciones de la marca.', defaultEnabled: true },
      { key: 'category_navigation', name: 'Navegación por categorías', description: 'Pestañas de colecciones como velas, fragancias, lámparas y sets.', defaultEnabled: true },
      { key: 'cart_indicator', name: 'Indicador de carrito y checkout', description: 'Badge de productos seleccionados e integración de carrito.', defaultEnabled: true },
    ],
  },
  'crm.orders': {
    key: 'crm.orders',
    name: 'Pedidos',
    category: 'crm',
    description: 'Gestión y trazabilidad completa de órdenes de compra.',
    href: '/t/[slug]/orders',
    functions: [
      { key: 'orders_list', name: 'Listado maestro de pedidos', description: 'Visualización de pedidos ordenados por fecha y canal.', defaultEnabled: true },
      { key: 'order_status_tracking', name: 'Gestión de estados de despacho', description: 'Pendiente, procesando, enviado, entregado y cancelado.', defaultEnabled: true },
    ],
  },
  'crm.products': {
    key: 'crm.products',
    name: 'Productos y Catálogos',
    category: 'crm',
    description: 'Administración de productos, inventario, precios y categorías.',
    href: '/t/[slug]/products',
    functions: [
      { key: 'product_catalog', name: 'Catálogo maestro de productos', description: 'SKU, nombre, categorías y precios de venta.', defaultEnabled: true },
      { key: 'stock_badges', name: 'Control y alertas de disponibilidad', description: 'Estados disponible, agotado y descontinuado.', defaultEnabled: true },
    ],
  },
  'crm.sales': {
    key: 'crm.sales',
    name: 'Ventas y Oportunidades',
    category: 'crm',
    description: 'Pipeline comercial con etapas de negociación y montos acumulados.',
    href: '/t/[slug]/sales',
    functions: [
      { key: 'pipeline_board', name: 'Embudo de ventas y pipeline', description: 'Etapas de negociación: prospección, propuesta, negociación, ganada.', defaultEnabled: true },
      { key: 'pipeline_metrics', name: 'Métricas de valor estimado', description: 'Cálculo total de oportunidades abiertas vs ganadas.', defaultEnabled: true },
    ],
  },
  'crm.tasks': {
    key: 'crm.tasks',
    name: 'Seguimiento',
    category: 'crm',
    description: 'Tareas comerciales asignadas a asesoras con vencimientos.',
    href: '/t/[slug]/tasks',
    functions: [
      { key: 'tasks_list', name: 'Gestión de tareas de seguimiento', description: 'Tareas asignadas por asesor con fechas límite.', defaultEnabled: true },
      { key: 'task_completion', name: 'Marcado rápido de cumplimiento', description: 'Cambio de estado ágil entre pendiente y completada.', defaultEnabled: true },
    ],
  },
  'crm.campaigns': {
    key: 'crm.campaigns',
    name: 'Campañas',
    category: 'crm',
    description: 'Campañas de marketing dirigidas a segmentos específicos.',
    href: '/t/[slug]/campaigns',
    functions: [
      { key: 'campaign_builder', name: 'Diseñador de campañas comerciales', description: 'Campañas orientadas a segmentos con metas de conversión.', defaultEnabled: true },
      { key: 'multichannel_dispatch', name: 'Envío multicanal', description: 'Soporte para email, SMS, WhatsApp y banners de feria.', defaultEnabled: true },
    ],
  },
  'analytics.repurchase_pilot': {
    key: 'analytics.repurchase_pilot',
    name: 'Predictivo de Recompra',
    category: 'analytics',
    description: 'Piloto predictivo de frecuencia de recompra y scoring de clientes.',
    href: '/t/[slug]/predictive',
    functions: [
      { key: 'predictive_model', name: 'Algoritmo de predicción de ciclo', description: 'Diagnóstico automático de frecuencia y fecha estimada de recompra.', defaultEnabled: true },
      { key: 'prioritized_queue', name: 'Cola priorizada de clientes', description: 'Listado ordenado de clientes listos para recompra.', defaultEnabled: true },
    ],
  },
  'integration.siigo': {
    key: 'integration.siigo',
    name: 'Facturación SIIGO',
    category: 'integration',
    description: 'Integración autorizada con SIIGO para facturación electrónica.',
    href: '/t/[slug]/siigo',
    functions: [
      { key: 'electronic_invoicing', name: 'Facturación electrónica automática', description: 'Emisión autorizada de comprobantes fiscales.', defaultEnabled: true },
      { key: 'dian_sync', name: 'Sincronización con DIAN y Siigo', description: 'Validación de NIT, impuestos y consecutivo fiscal.', defaultEnabled: true },
    ],
  },
};
