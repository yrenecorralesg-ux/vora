/*
# EKOSCRM Seed Data

## Overview
Inserts reference data: business templates, feature catalog, platform roles, plans,
role permissions, and schema version record.

## Data inserted
- 3 business templates (retail_ecommerce, services, general_crm)
- 15 features (CRM modules + integrations including SIIGO and Predictivo)
- 4 platform roles (super_admin, tenant_admin, comercial, atencion)
- 2 plans (starter, growth)
- Role permissions matrix
- Schema version record for platform v001

## Notes
- Idempotent: uses ON CONFLICT DO NOTHING / DO UPDATE
- SIIGO and Predictivo are 'planned' implementation_status — not implemented in Sprint 1
- Reserved features (whatsapp, conversations, generative_chatbot, visual_builder) excluded from seed
*/

-- Business Templates
INSERT INTO business_templates (key, name, description, suggested_features) VALUES
  ('retail_ecommerce', 'Retail / Ecommerce', 'Plantilla para empresas de retail con ventas online y fisicas. Incluye clientes, productos, ventas, pedidos e integracion de tienda.', ARRAY['crm.dashboard','crm.customers','crm.products','crm.sales','crm.orders','crm.tasks','integration.shopify']),
  ('services', 'Servicios', 'Plantilla para empresas de servicios. Enfocada en clientes, seguimiento comercial y gestion de oportunidades.', ARRAY['crm.dashboard','crm.customers','crm.sales','crm.tasks','crm.segments']),
  ('general_crm', 'CRM General', 'Plantilla CRM generica adaptable a cualquier tipo de empresa. Modulos basicos de clientes, ventas y seguimiento.', ARRAY['crm.dashboard','crm.customers','crm.sales','crm.tasks'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  suggested_features = EXCLUDED.suggested_features,
  updated_at = now();

-- Features Catalog
INSERT INTO features (key, name, description, category, dependencies, implementation_status, sort_order) VALUES
  ('crm.dashboard', 'Resumen y Reportes', 'Panel principal con metricas clave y reportes base del CRM.', 'crm', '{}', 'implemented', 1),
  ('crm.customers', 'Clientes', 'Gestion de fichas de clientes con contactos, notas, tags y consentimientos.', 'crm', '{}', 'implemented', 2),
  ('crm.products', 'Productos y Catalogos', 'Administracion de productos, categorias y catalogos de venta.', 'crm', '{}', 'implemented', 3),
  ('crm.sales', 'Ventas y Oportunidades', 'Gestion de oportunidades y ventas con items y estados.', 'crm', '{}', 'implemented', 4),
  ('crm.orders', 'Pedidos', 'Gestion de pedidos con eventos de seguimiento y estados.', 'crm', '{}', 'implemented', 5),
  ('crm.tasks', 'Seguimiento', 'Tareas de seguimiento comercial asignables con fechas y estados.', 'crm', '{}', 'implemented', 6),
  ('crm.segments', 'Segmentacion', 'Segmentacion de clientes por criterios y reglas.', 'crm', '{}', 'implemented', 7),
  ('crm.campaigns', 'Campanas', 'Campanas comerciales dirigidas a segmentos de clientes.', 'crm', ARRAY['crm.segments'], 'implemented', 8),
  ('capture.fairs', 'Captura QR / Ferias', 'Captura de contactos por codigo QR en ferias y eventos.', 'crm', ARRAY['crm.customers'], 'implemented', 9),
  ('integration.shopify', 'Shopify', 'Integracion con tienda Shopify para sincronizacion de productos y pedidos.', 'integration', '{}', 'planned', 10),
  ('channel.email', 'Correo', 'Canal de correo para comunicaciones comerciales y notificaciones.', 'channel', '{}', 'planned', 11),
  ('chatbot.guided_web', 'Chatbot Web Guiado', 'Bot web guiado para captacion por web, QR y Shopify. Hasta 30 respuestas y 20 productos.', 'channel', ARRAY['crm.customers','crm.tasks'], 'planned', 12),
  ('automation.followups', 'Reglas de Seguimiento', 'Reglas automatizadas de seguimiento y recompra base.', 'automation', ARRAY['crm.tasks'], 'planned', 13),
  ('integration.siigo', 'Facturacion SIIGO', 'Integracion con SIIGO para facturacion de ventas directas autorizadas. Cliente, productos, impuestos, NIT y numeracion.', 'integration', ARRAY['crm.sales'], 'planned', 14),
  ('analytics.repurchase_pilot', 'Predictivo de Recompra', 'Piloto predictivo de recompra: diagnostico, reglas, modelo validado y lista priorizada. Hasta 50.000 pedidos / 12 meses.', 'analytics', ARRAY['crm.orders','automation.followups'], 'planned', 15)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  dependencies = EXCLUDED.dependencies,
  implementation_status = EXCLUDED.implementation_status,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Platform Roles
INSERT INTO platform_roles (key, name, description, scope) VALUES
  ('super_admin', 'Super Admin EKOSCRM', 'Administrador global de la plataforma EKOSCRM con acceso total al Super Admin.', 'platform'),
  ('tenant_admin', 'Administrador de Tenant', 'Administrador de una empresa especifica con acceso a su shell CRM y configuracion.', 'tenant'),
  ('comercial', 'Comercial', 'Rol comercial con acceso a clientes, ventas y seguimiento. Permiso base para sprints posteriores.', 'tenant'),
  ('atencion', 'Atencion', 'Rol de atencion al cliente con acceso a clientes y seguimiento. Permiso base para sprints posteriores.', 'tenant')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- Role Permissions
INSERT INTO role_permissions (role_key, permission, scope) VALUES
  ('super_admin', 'tenant.create', 'platform'),
  ('super_admin', 'tenant.update', 'platform'),
  ('super_admin', 'tenant.suspend', 'platform'),
  ('super_admin', 'branding.manage', 'platform'),
  ('super_admin', 'modules.manage', 'platform'),
  ('super_admin', 'database.register', 'platform'),
  ('super_admin', 'database.check', 'platform'),
  ('super_admin', 'admin.invite', 'platform'),
  ('super_admin', 'preview.access', 'platform'),
  ('tenant_admin', 'crm.customers', 'tenant'),
  ('tenant_admin', 'crm.products', 'tenant'),
  ('tenant_admin', 'crm.sales', 'tenant'),
  ('tenant_admin', 'crm.orders', 'tenant'),
  ('tenant_admin', 'crm.tasks', 'tenant'),
  ('tenant_admin', 'crm.segments', 'tenant'),
  ('tenant_admin', 'crm.campaigns', 'tenant'),
  ('tenant_admin', 'capture.fairs', 'tenant'),
  ('tenant_admin', 'branding.manage', 'tenant'),
  ('comercial', 'crm.customers', 'tenant'),
  ('comercial', 'crm.sales', 'tenant'),
  ('comercial', 'crm.tasks', 'tenant'),
  ('atencion', 'crm.customers', 'tenant'),
  ('atencion', 'crm.tasks', 'tenant')
ON CONFLICT (role_key, permission) DO NOTHING;

-- Plans
INSERT INTO plans (name, description, limits, is_active) VALUES
  ('Starter', 'Plan inicial para empresas pequenas.', '{"max_users":5,"max_concurrent_users":3,"max_customers":10000,"max_orders_month":1000,"storage_gb":10,"max_stores":1,"max_nit":1}', true),
  ('Growth', 'Plan para empresas en crecimiento con mayores limites.', '{"max_users":15,"max_concurrent_users":8,"max_customers":50000,"max_orders_month":5000,"storage_gb":50,"max_stores":3,"max_nit":2}', true)
ON CONFLICT DO NOTHING;

-- Schema version record
INSERT INTO schema_versions (scope, version, name, description) VALUES
  ('platform', '001', 'Platform Core Schema', 'Esquema inicial de Platform DB con tenants, features, memberships, roles, branding, databases, audit y demo requests.')
ON CONFLICT (scope, version) DO NOTHING;
