-- ============================================================================
-- VORA POS MODULE (commerce.pos)
-- Migration: 20261019000000_vora_pos_module.sql
-- Scope: platform & tenant
-- Version: 008
-- ============================================================================

-- 1. Registrar versión en schema_versions
INSERT INTO schema_versions (scope, version, name, description)
VALUES (
  'platform',
  '008',
  'VORA POS Module & Transactional RPCs',
  'Módulo de punto de venta presencial multisede bimoneda con arqueo, inventario, devoluciones y facturación.'
)
ON CONFLICT (scope, version) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  applied_at = now();

-- 2. Registrar el feature commerce.pos en el catálogo de features
INSERT INTO features (key, name, description, category, implementation_status, sort_order, available_functions)
VALUES (
  'commerce.pos',
  'VORA POS — Punto de Venta',
  'Punto de venta presencial multisede y bimoneda con arqueo de turnos, trazabilidad de existencias, pagos mixtos y facturación fiscal.',
  'commerce',
  'implemented',
  205,
  '[
    {"key": "pos_sales", "name": "Emisión ágil de ventas y caja rápida", "description": "Líneas de producto, lector de códigos y cálculo bimoneda.", "default_enabled": true},
    {"key": "pos_shifts", "name": "Apertura y control de turnos de caja", "description": "Control estricto de concurrencia y saldos iniciales.", "default_enabled": true},
    {"key": "pos_payments", "name": "Cobros mixtos multimoneda", "description": "Efectivo USD/VES, Pago Móvil, tarjeta y Cashea.", "default_enabled": true},
    {"key": "pos_returns", "name": "Devoluciones y anulaciones trazables", "description": "Reintegro de stock y reverso de saldos auditado.", "default_enabled": true},
    {"key": "pos_authorizations", "name": "Aprobaciones de supervisor en caliente", "description": "Descuentos excepcionales y anulaciones con PIN.", "default_enabled": true},
    {"key": "pos_documents", "name": "Comprobantes internos PDF", "description": "Generación e impresión de comprobantes no fiscales.", "default_enabled": true},
    {"key": "pos_fiscal", "name": "Adaptador fiscal The Factory HKA", "description": "Emisión desacoplada y consulta de estatus fiscal.", "default_enabled": true},
    {"key": "pos_kardex", "name": "Kardex e inventario físico de sede", "description": "Descuento atómico e inmutable de existencias.", "default_enabled": true},
    {"key": "pos_settings", "name": "Configuración de cajas y sedes", "description": "Administración de cajas físicas y límites operativos.", "default_enabled": true},
    {"key": "pos_reports", "name": "Reportes operativos y cortes de caja", "description": "Métricas consolidadas de ventas y turnos por cajero.", "default_enabled": true}
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  implementation_status = EXCLUDED.implementation_status,
  sort_order = EXCLUDED.sort_order,
  available_functions = EXCLUDED.available_functions,
  updated_at = now();

-- 3. Registrar roles específicos de POS en platform_roles (scope = 'tenant')
INSERT INTO platform_roles (key, name, description, scope)
VALUES
  ('pos_cashier', 'Cajero POS', 'Operador de caja para ventas y cobros durante su turno asignado.', 'tenant'),
  ('pos_supervisor', 'Supervisor de Caja POS', 'Supervisor de tienda facultado para autorizar descuentos, cancelaciones y arqueos.', 'tenant'),
  ('pos_store_admin', 'Administrador de Tienda POS', 'Administrador general de la tienda, cajas, inventario y parámetros POS.', 'tenant'),
  ('pos_auditor', 'Auditor / Contador POS', 'Acceso de lectura a reportes de caja, arqueos y conciliación financiera.', 'tenant')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- 4. Registrar los 10 permisos oficiales de POS en role_permissions
INSERT INTO role_permissions (role_key, permission, scope)
VALUES
  -- pos.sales.create
  ('pos_cashier', 'pos.sales.create', 'tenant'),
  ('pos_supervisor', 'pos.sales.create', 'tenant'),
  ('pos_store_admin', 'pos.sales.create', 'tenant'),
  ('tenant_admin', 'pos.sales.create', 'tenant'),

  -- pos.payments.register
  ('pos_cashier', 'pos.payments.register', 'tenant'),
  ('pos_supervisor', 'pos.payments.register', 'tenant'),
  ('pos_store_admin', 'pos.payments.register', 'tenant'),
  ('tenant_admin', 'pos.payments.register', 'tenant'),

  -- pos.cash.open
  ('pos_cashier', 'pos.cash.open', 'tenant'),
  ('pos_supervisor', 'pos.cash.open', 'tenant'),
  ('pos_store_admin', 'pos.cash.open', 'tenant'),
  ('tenant_admin', 'pos.cash.open', 'tenant'),

  -- pos.cash.close
  ('pos_cashier', 'pos.cash.close', 'tenant'),
  ('pos_supervisor', 'pos.cash.close', 'tenant'),
  ('pos_store_admin', 'pos.cash.close', 'tenant'),
  ('tenant_admin', 'pos.cash.close', 'tenant'),

  -- pos.sales.discount.override
  ('pos_supervisor', 'pos.sales.discount.override', 'tenant'),
  ('pos_store_admin', 'pos.sales.discount.override', 'tenant'),
  ('tenant_admin', 'pos.sales.discount.override', 'tenant'),

  -- pos.sales.void
  ('pos_supervisor', 'pos.sales.void', 'tenant'),
  ('pos_store_admin', 'pos.sales.void', 'tenant'),
  ('tenant_admin', 'pos.sales.void', 'tenant'),

  -- pos.refunds.approve
  ('pos_supervisor', 'pos.refunds.approve', 'tenant'),
  ('pos_store_admin', 'pos.refunds.approve', 'tenant'),
  ('tenant_admin', 'pos.refunds.approve', 'tenant'),

  -- pos.reports.view
  ('pos_supervisor', 'pos.reports.view', 'tenant'),
  ('pos_store_admin', 'pos.reports.view', 'tenant'),
  ('pos_auditor', 'pos.reports.view', 'tenant'),
  ('tenant_admin', 'pos.reports.view', 'tenant'),

  -- pos.settings.manage
  ('pos_store_admin', 'pos.settings.manage', 'tenant'),
  ('tenant_admin', 'pos.settings.manage', 'tenant'),

  -- pos.fiscal.issue
  ('pos_store_admin', 'pos.fiscal.issue', 'tenant'),
  ('tenant_admin', 'pos.fiscal.issue', 'tenant')
ON CONFLICT (role_key, permission) DO NOTHING;

-- 5. Tablas del Módulo VORA POS

-- 5.1 Sedes operativas
CREATE TABLE IF NOT EXISTS public.tenant_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  fiscal_address text,
  phone text,
  timezone text NOT NULL DEFAULT 'America/Caracas',
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- 5.2 Cajas físicas o lógicas por sede
CREATE TABLE IF NOT EXISTS public.pos_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, branch_id, code)
);

-- 5.3 Asignaciones de cajeros a cajas
CREATE TABLE IF NOT EXISTS public.pos_register_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  register_id uuid NOT NULL REFERENCES public.pos_registers(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  cashier_display_name text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.4 Turnos de caja
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  register_id uuid NOT NULL REFERENCES public.pos_registers(id) ON DELETE CASCADE,
  cashier_user_id uuid NOT NULL,
  cashier_name_snapshot text,
  status text NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'cerrado')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_amount_usd numeric(18,2) NOT NULL DEFAULT 0 CHECK (opening_amount_usd >= 0),
  opening_amount_ves numeric(18,2) NOT NULL DEFAULT 0 CHECK (opening_amount_ves >= 0),
  expected_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  declared_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  differences_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  opening_notes text,
  closing_justification text,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice de concurrencia: solo un turno abierto por caja
CREATE UNIQUE INDEX IF NOT EXISTS one_open_shift_per_register
ON public.pos_shifts(register_id)
WHERE status = 'abierto';

-- 5.5 Movimientos manuales de caja durante el turno
CREATE TABLE IF NOT EXISTS public.pos_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('ingreso_efectivo', 'retiro_efectivo', 'ajuste_caja', 'cambio_saldo_inicial')),
  currency text NOT NULL CHECK (currency IN ('USD', 'VES')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  performed_by uuid NOT NULL,
  authorization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.6 Productos de sede e inventario POS
CREATE TABLE IF NOT EXISTS public.pos_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  sku text NOT NULL,
  barcode text,
  name text NOT NULL,
  category text NOT NULL,
  is_service boolean NOT NULL DEFAULT false,
  price_usd numeric(18,4) NOT NULL CHECK (price_usd >= 0),
  tax_rate_percent numeric(5,2) NOT NULL DEFAULT 16.00,
  stock_quantity numeric(18,3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'agotado', 'descontinuado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, branch_id, sku)
);

-- 5.7 Clientes fiscales POS
CREATE TABLE IF NOT EXISTS public.pos_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('V', 'E', 'J', 'G', 'P')),
  document_number text NOT NULL,
  legal_name text NOT NULL,
  phone text,
  email text,
  fiscal_address text,
  customer_tier text NOT NULL DEFAULT 'nuevo' CHECK (customer_tier IN ('frecuente', 'nuevo', 'consumidor_final')),
  total_purchases_count int NOT NULL DEFAULT 0,
  total_purchases_usd numeric(18,2) NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, document_type, document_number)
);

-- 5.8 Aprobaciones y sobregiros de supervisor
CREATE TABLE IF NOT EXISTS public.pos_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.pos_shifts(id) ON DELETE SET NULL,
  sale_id uuid,
  operation_type text NOT NULL CHECK (operation_type IN ('discount_override', 'sale_void', 'sale_return', 'cash_movement')),
  requested_by uuid NOT NULL,
  approved_by uuid NOT NULL,
  approver_name_snapshot text,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  limit_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.9 Ventas POS (Cabecera)
CREATE TABLE IF NOT EXISTS public.pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE RESTRICT,
  register_id uuid NOT NULL REFERENCES public.pos_registers(id) ON DELETE RESTRICT,
  cashier_user_id uuid NOT NULL,
  customer_id uuid REFERENCES public.pos_customers(id) ON DELETE RESTRICT,
  sale_number text NOT NULL,
  commercial_status text NOT NULL DEFAULT 'borrador' CHECK (commercial_status IN ('borrador', 'confirmada', 'anulada', 'parcialmente_devuelta', 'devuelta')),
  payment_status text NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'parcial', 'pagada', 'reversada')),
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate_snapshot numeric(18,6) NOT NULL CHECK (exchange_rate_snapshot > 0),
  subtotal_usd numeric(18,2) NOT NULL DEFAULT 0,
  discount_total_usd numeric(18,2) NOT NULL DEFAULT 0,
  tax_total_usd numeric(18,2) NOT NULL DEFAULT 0,
  total_usd numeric(18,2) NOT NULL DEFAULT 0,
  total_ves numeric(18,2) NOT NULL DEFAULT 0,
  paid_total_usd numeric(18,2) NOT NULL DEFAULT 0,
  paid_total_ves numeric(18,2) NOT NULL DEFAULT 0,
  balance_due_usd numeric(18,2) NOT NULL DEFAULT 0,
  balance_due_ves numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  discount_authorization_id uuid REFERENCES public.pos_authorizations(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  correlation_id text NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sale_number),
  UNIQUE(tenant_id, idempotency_key)
);

-- 5.10 Líneas de Venta
CREATE TABLE IF NOT EXISTS public.pos_sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.pos_products(id) ON DELETE RESTRICT,
  sku_snapshot text NOT NULL,
  name_snapshot text NOT NULL,
  is_service boolean NOT NULL DEFAULT false,
  quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
  returned_quantity numeric(18,3) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity),
  unit_price_usd numeric(18,4) NOT NULL CHECK (unit_price_usd >= 0),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount_usd numeric(18,2) NOT NULL DEFAULT 0,
  tax_rate_percent numeric(5,2) NOT NULL DEFAULT 16.00,
  tax_amount_usd numeric(18,2) NOT NULL DEFAULT 0,
  line_subtotal_usd numeric(18,2) NOT NULL DEFAULT 0,
  line_total_usd numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.11 Pagos y Abonos por Venta
CREATE TABLE IF NOT EXISTS public.pos_sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE RESTRICT,
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('efectivo', 'pago_movil', 'tarjeta', 'cashea')),
  currency text NOT NULL CHECK (currency IN ('USD', 'VES')),
  amount_received numeric(18,2) NOT NULL CHECK (amount_received >= 0),
  amount_applied numeric(18,2) NOT NULL CHECK (amount_applied >= 0),
  change_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  change_currency text CHECK (change_currency IN ('USD', 'VES')),
  exchange_rate_snapshot numeric(18,6) NOT NULL CHECK (exchange_rate_snapshot > 0),
  reference_number text,
  bank_code text,
  bank_name text,
  payer_phone text,
  payer_document text,
  terminal_id text,
  card_last4 text CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  approval_code text,
  cashea_operation_id text,
  cashea_merchant_amount numeric(18,2),
  provider_status text NOT NULL DEFAULT 'registrado' CHECK (provider_status IN ('registrado', 'pendiente_verificacion', 'verificado', 'conciliado', 'rechazado', 'revertido')),
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.12 Devoluciones y Anulaciones
CREATE TABLE IF NOT EXISTS public.pos_sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  original_sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE RESTRICT,
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE RESTRICT,
  return_number text NOT NULL,
  return_type text NOT NULL CHECK (return_type IN ('anulacion_total', 'devolucion_parcial', 'devolucion_total')),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  notes text,
  requested_by uuid NOT NULL,
  approved_by uuid NOT NULL,
  authorization_id uuid REFERENCES public.pos_authorizations(id) ON DELETE SET NULL,
  refund_method text NOT NULL CHECK (refund_method IN ('efectivo_usd', 'efectivo_ves', 'reverso_electronico', 'nota_credito_interna')),
  total_refunded_usd numeric(18,2) NOT NULL DEFAULT 0,
  total_refunded_ves numeric(18,2) NOT NULL DEFAULT 0,
  stock_reversal_reference text,
  financial_reversal_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, return_number)
);

-- 5.13 Líneas de Devolución
CREATE TABLE IF NOT EXISTS public.pos_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES public.pos_sale_returns(id) ON DELETE CASCADE,
  sale_line_id uuid NOT NULL REFERENCES public.pos_sale_lines(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.pos_products(id) ON DELETE RESTRICT,
  quantity_returned numeric(18,3) NOT NULL CHECK (quantity_returned > 0),
  refund_amount_usd numeric(18,2) NOT NULL DEFAULT 0,
  refund_amount_ves numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.14 Comprobantes Comerciales Internos
CREATE TABLE IF NOT EXISTS public.pos_commercial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL UNIQUE REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  document_kind text NOT NULL DEFAULT 'comprobante_interno' CHECK (document_kind IN ('comprobante_interno')),
  internal_number text NOT NULL,
  pdf_path text,
  status text NOT NULL DEFAULT 'generado' CHECK (status IN ('generado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.15 Integraciones Fiscales (HKA)
CREATE TABLE IF NOT EXISTS public.pos_fiscal_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'HKA',
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  enabled boolean NOT NULL DEFAULT false,
  company_rif text,
  company_legal_name text,
  fiscal_address text,
  secret_reference text,
  legal_status text NOT NULL DEFAULT 'sin_configurar' CHECK (legal_status IN ('sin_configurar', 'sandbox_verificado', 'productivo_activo')),
  last_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.16 Solicitudes Fiscales (HKA Requests)
CREATE TABLE IF NOT EXISTS public.pos_fiscal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  request_hash text,
  provider_reference text,
  fiscal_invoice_number text,
  fiscal_control_number text,
  status text NOT NULL DEFAULT 'no_solicitado' CHECK (status IN ('no_solicitado', 'pendiente', 'emitido', 'rechazado', 'error', 'por_revisar')),
  error_code text,
  response_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5.17 Configuración POS por Sede
CREATE TABLE IF NOT EXISTS public.pos_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  active_methods text[] NOT NULL DEFAULT ARRAY['efectivo', 'pago_movil', 'tarjeta', 'cashea'],
  max_cashier_discount_percent numeric(5,2) NOT NULL DEFAULT 5.00,
  allow_partial_payments boolean NOT NULL DEFAULT true,
  cross_currency_change_enabled boolean NOT NULL DEFAULT true,
  internal_doc_prefix text NOT NULL DEFAULT 'COMP-INT-',
  next_internal_seq int NOT NULL DEFAULT 1,
  next_sale_seq int NOT NULL DEFAULT 1259,
  active_exchange_rate numeric(18,6) NOT NULL DEFAULT 36.500000,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, branch_id)
);

-- 5.18 Kardex e Histórico de Inventario
CREATE TABLE IF NOT EXISTS public.pos_inventory_kardex (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('venta_pos', 'reverso_devolucion', 'ajuste_inicial')),
  reference_id uuid,
  quantity_delta numeric(18,3) NOT NULL,
  stock_before numeric(18,3) NOT NULL,
  stock_after numeric(18,3) NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.19 Eventos de Auditoría Específicos de POS
CREATE TABLE IF NOT EXISTS public.pos_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.tenant_branches(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES public.pos_shifts(id) ON DELETE SET NULL,
  actor_id uuid,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tenant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_register_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_fiscal_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_fiscal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_inventory_kardex ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_audit_events ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS RLS (AISLAMIENTO MULTITENANT POR TENANT_MEMBERSHIPS)

CREATE POLICY pos_branch_tenant_isolate ON public.tenant_branches
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_registers_tenant_isolate ON public.pos_registers
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_assignments_tenant_isolate ON public.pos_register_assignments
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_shifts_tenant_isolate ON public.pos_shifts
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_movements_tenant_isolate ON public.pos_cash_movements
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_products_tenant_isolate ON public.pos_products
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_customers_tenant_isolate ON public.pos_customers
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_auth_tenant_isolate ON public.pos_authorizations
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_sales_tenant_isolate ON public.pos_sales
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_sale_lines_tenant_isolate ON public.pos_sale_lines
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_sale_payments_tenant_isolate ON public.pos_sale_payments
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_returns_tenant_isolate ON public.pos_sale_returns
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_return_lines_tenant_isolate ON public.pos_return_lines
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_docs_tenant_isolate ON public.pos_commercial_documents
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_fiscal_integ_isolate ON public.pos_fiscal_integrations
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_fiscal_req_isolate ON public.pos_fiscal_requests
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_settings_tenant_isolate ON public.pos_settings
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_kardex_tenant_isolate ON public.pos_inventory_kardex
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pos_audit_events_tenant_isolate ON public.pos_audit_events
FOR ALL TO authenticated
USING (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
)
WITH CHECK (
  public.vora_is_super_admin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE auth_user_id = auth.uid() AND status = 'active')
);

-- 8. REVOKE/GRANT PRIVILEGIOS EXPLÍCITOS
REVOKE ALL ON TABLE
  public.tenant_branches,
  public.pos_registers,
  public.pos_register_assignments,
  public.pos_shifts,
  public.pos_cash_movements,
  public.pos_products,
  public.pos_customers,
  public.pos_authorizations,
  public.pos_sales,
  public.pos_sale_lines,
  public.pos_sale_payments,
  public.pos_sale_returns,
  public.pos_return_lines,
  public.pos_commercial_documents,
  public.pos_fiscal_integrations,
  public.pos_fiscal_requests,
  public.pos_settings,
  public.pos_inventory_kardex,
  public.pos_audit_events
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tenant_branches,
  public.pos_registers,
  public.pos_register_assignments,
  public.pos_shifts,
  public.pos_cash_movements,
  public.pos_products,
  public.pos_customers,
  public.pos_authorizations,
  public.pos_sales,
  public.pos_sale_lines,
  public.pos_sale_payments,
  public.pos_sale_returns,
  public.pos_return_lines,
  public.pos_commercial_documents,
  public.pos_fiscal_integrations,
  public.pos_fiscal_requests,
  public.pos_settings,
  public.pos_inventory_kardex,
  public.pos_audit_events
TO authenticated;

GRANT ALL ON TABLE
  public.tenant_branches,
  public.pos_registers,
  public.pos_register_assignments,
  public.pos_shifts,
  public.pos_cash_movements,
  public.pos_products,
  public.pos_customers,
  public.pos_authorizations,
  public.pos_sales,
  public.pos_sale_lines,
  public.pos_sale_payments,
  public.pos_sale_returns,
  public.pos_return_lines,
  public.pos_commercial_documents,
  public.pos_fiscal_integrations,
  public.pos_fiscal_requests,
  public.pos_settings,
  public.pos_inventory_kardex,
  public.pos_audit_events
TO service_role;

-- 9. FUNCIONES TRANSACCIONALES RPC (SECURITY DEFINER)

-- 9.1 Validador de permisos granulares pos.*
CREATE OR REPLACE FUNCTION public.vora_pos_has_permission(
  p_tenant uuid,
  p_permission text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.vora_is_super_admin() THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE tenant_id = p_tenant
    AND auth_user_id = v_uid
    AND status = 'active';

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'tenant_admin' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_key = v_role
      AND permission = p_permission
      AND scope = 'tenant'
  );
END;
$$;

-- 9.2 Apertura atómica de turno en caja
CREATE OR REPLACE FUNCTION public.vora_pos_open_shift(
  p_tenant uuid,
  p_branch uuid,
  p_register uuid,
  p_cashier uuid,
  p_cashier_name text,
  p_initial_usd numeric,
  p_initial_ves numeric,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_register public.pos_registers%ROWTYPE;
  v_existing_shift_id uuid;
  v_new_shift_id uuid;
BEGIN
  IF NOT public.vora_pos_has_permission(p_tenant, 'pos.cash.open') THEN
    RAISE EXCEPTION 'Operación rechazada: no posee autorización para apertura de turnos.';
  END IF;

  SELECT * INTO v_register
  FROM public.pos_registers
  WHERE id = p_register AND tenant_id = p_tenant AND branch_id = p_branch
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada o no pertenece a la sede indicada.';
  END IF;

  IF v_register.status <> 'active' THEN
    RAISE EXCEPTION 'La caja seleccionada se encuentra en mantenimiento o inactiva.';
  END IF;

  SELECT id INTO v_existing_shift_id
  FROM public.pos_shifts
  WHERE register_id = p_register AND status = 'abierto';

  IF v_existing_shift_id IS NOT NULL THEN
    RAISE EXCEPTION 'La caja seleccionada ya posee un turno abierto por otro operador. No se permiten dos turnos simultáneos en la misma caja.';
  END IF;

  INSERT INTO public.pos_shifts (
    tenant_id,
    branch_id,
    register_id,
    cashier_user_id,
    cashier_name_snapshot,
    status,
    opened_at,
    opening_amount_usd,
    opening_amount_ves,
    opening_notes
  ) VALUES (
    p_tenant,
    p_branch,
    p_register,
    p_cashier,
    p_cashier_name,
    'abierto',
    now(),
    COALESCE(p_initial_usd, 0),
    COALESCE(p_initial_ves, 0),
    p_notes
  ) RETURNING id INTO v_new_shift_id;

  INSERT INTO public.platform_audit_logs (
    actor_id,
    tenant_id,
    action,
    resource,
    resource_id,
    details
  ) VALUES (
    p_cashier,
    p_tenant,
    'pos.shift.open',
    'pos_shifts',
    v_new_shift_id::text,
    jsonb_build_object(
      'register_id', p_register,
      'branch_id', p_branch,
      'opening_amount_usd', p_initial_usd,
      'opening_amount_ves', p_initial_ves,
      'cashier_name', p_cashier_name
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shift_id', v_new_shift_id,
    'register_id', p_register,
    'status', 'abierto'
  );
END;
$$;

-- 9.3 Confirmación atómica e idempotente de venta
CREATE OR REPLACE FUNCTION public.vora_pos_confirm_sale(
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := (p_payload->>'tenant_id')::uuid;
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_shift_id uuid := (p_payload->>'shift_id')::uuid;
  v_register_id uuid := (p_payload->>'register_id')::uuid;
  v_cashier_id uuid := (p_payload->>'cashier_user_id')::uuid;
  v_customer_id uuid;
  v_idempotency_key text := p_payload->>'idempotency_key';
  v_correlation_id text := COALESCE(p_payload->>'correlation_id', gen_random_uuid()::text);
  v_existing_sale public.pos_sales%ROWTYPE;
  v_shift public.pos_shifts%ROWTYPE;
  v_settings public.pos_settings%ROWTYPE;
  v_rate numeric(18,6);
  v_sale_number text;
  v_new_sale_id uuid;
  v_line jsonb;
  v_line_prod public.pos_products%ROWTYPE;
  v_payment jsonb;
  v_doc_num text;
  v_doc_prefix text;
  v_next_doc_seq int;
  v_discount_auth uuid;
  v_total_usd numeric(18,2) := (p_payload->>'total_usd')::numeric;
  v_total_ves numeric(18,2) := (p_payload->>'total_ves')::numeric;
  v_paid_usd numeric(18,2) := COALESCE((p_payload->>'paid_total_usd')::numeric, 0);
  v_paid_ves numeric(18,2) := COALESCE((p_payload->>'paid_total_ves')::numeric, 0);
  v_balance_usd numeric(18,2);
  v_balance_ves numeric(18,2);
  v_p_status text;
BEGIN
  IF p_payload->>'customer_id' IS NOT NULL AND length(trim(p_payload->>'customer_id')) > 0 THEN
    v_customer_id := (p_payload->>'customer_id')::uuid;
  END IF;

  IF p_payload->>'discount_authorization_id' IS NOT NULL AND length(trim(p_payload->>'discount_authorization_id')) > 0 THEN
    v_discount_auth := (p_payload->>'discount_authorization_id')::uuid;
  END IF;

  -- 1. Idempotencia primero
  SELECT * INTO v_existing_sale
  FROM public.pos_sales
  WHERE tenant_id = v_tenant_id AND idempotency_key = v_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'sale_id', v_existing_sale.id,
      'sale_number', v_existing_sale.sale_number,
      'commercial_status', v_existing_sale.commercial_status,
      'total_usd', v_existing_sale.total_usd,
      'total_ves', v_existing_sale.total_ves
    );
  END IF;

  -- 2. Permiso
  IF NOT public.vora_pos_has_permission(v_tenant_id, 'pos.sales.create') THEN
    RAISE EXCEPTION 'Operación rechazada: no posee autorización para emisión de ventas.';
  END IF;

  -- 3. Turno abierto
  SELECT * INTO v_shift
  FROM public.pos_shifts
  WHERE id = v_shift_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_shift.status <> 'abierto' THEN
    RAISE EXCEPTION 'El turno de caja especificado no existe o se encuentra cerrado.';
  END IF;

  -- 4. Parámetros de sede
  SELECT * INTO v_settings
  FROM public.pos_settings
  WHERE tenant_id = v_tenant_id AND branch_id = v_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_doc_prefix := 'COMP-INT-';
    v_next_doc_seq := 1;
    v_rate := COALESCE((p_payload->>'exchange_rate_snapshot')::numeric, 36.500000);
    v_sale_number := 'VTA-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
  ELSE
    v_doc_prefix := v_settings.internal_doc_prefix;
    v_next_doc_seq := v_settings.next_internal_seq;
    v_rate := COALESCE((p_payload->>'exchange_rate_snapshot')::numeric, v_settings.active_exchange_rate);
    v_sale_number := 'VTA-' || lpad(v_settings.next_sale_seq::text, 7, '0');
    UPDATE public.pos_settings
    SET next_sale_seq = next_sale_seq + 1,
        next_internal_seq = next_internal_seq + 1,
        updated_at = now()
    WHERE id = v_settings.id;
  END IF;

  v_doc_num := v_doc_prefix || lpad(v_next_doc_seq::text, 6, '0');

  v_balance_usd := GREATEST(0, v_total_usd - v_paid_usd);
  v_balance_ves := GREATEST(0, v_total_ves - v_paid_ves);

  IF v_paid_usd >= v_total_usd THEN
    v_p_status := 'pagada';
  ELSIF v_paid_usd > 0 THEN
    v_p_status := 'parcial';
  ELSE
    v_p_status := 'pendiente';
  END IF;

  -- 5. Insertar venta
  INSERT INTO public.pos_sales (
    tenant_id,
    branch_id,
    shift_id,
    register_id,
    cashier_user_id,
    customer_id,
    sale_number,
    commercial_status,
    payment_status,
    currency,
    exchange_rate_snapshot,
    subtotal_usd,
    discount_total_usd,
    tax_total_usd,
    total_usd,
    total_ves,
    paid_total_usd,
    paid_total_ves,
    balance_due_usd,
    balance_due_ves,
    notes,
    discount_authorization_id,
    idempotency_key,
    correlation_id,
    confirmed_at
  ) VALUES (
    v_tenant_id,
    v_branch_id,
    v_shift_id,
    v_register_id,
    v_cashier_id,
    v_customer_id,
    v_sale_number,
    'confirmada',
    v_p_status,
    'USD',
    v_rate,
    (p_payload->>'subtotal_usd')::numeric,
    COALESCE((p_payload->>'discount_total_usd')::numeric, 0),
    COALESCE((p_payload->>'tax_total_usd')::numeric, 0),
    v_total_usd,
    v_total_ves,
    v_paid_usd,
    v_paid_ves,
    v_balance_usd,
    v_balance_ves,
    p_payload->>'notes',
    v_discount_auth,
    v_idempotency_key,
    v_correlation_id,
    now()
  ) RETURNING id INTO v_new_sale_id;

  -- 6. Insertar líneas y descontar existencias
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    IF (v_line->>'is_service')::boolean = false AND v_line->>'product_id' IS NOT NULL THEN
      SELECT * INTO v_line_prod
      FROM public.pos_products
      WHERE id = (v_line->>'product_id')::uuid
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto con identificador % no existe en la sede.', v_line->>'product_id';
      END IF;

      IF v_line_prod.stock_quantity < (v_line->>'quantity')::numeric THEN
        RAISE EXCEPTION 'Existencia insuficiente en almacén para SKU %: solicitado %, disponible %',
          v_line_prod.sku, v_line->>'quantity', v_line_prod.stock_quantity;
      END IF;

      UPDATE public.pos_products
      SET stock_quantity = stock_quantity - (v_line->>'quantity')::numeric,
          status = CASE WHEN stock_quantity - (v_line->>'quantity')::numeric <= 0 THEN 'agotado' ELSE 'disponible' END,
          updated_at = now()
      WHERE id = v_line_prod.id;

      INSERT INTO public.pos_inventory_kardex (
        tenant_id,
        branch_id,
        product_id,
        movement_type,
        reference_id,
        quantity_delta,
        stock_before,
        stock_after,
        actor_id
      ) VALUES (
        v_tenant_id,
        v_branch_id,
        v_line_prod.id,
        'venta_pos',
        v_new_sale_id,
        - (v_line->>'quantity')::numeric,
        v_line_prod.stock_quantity,
        v_line_prod.stock_quantity - (v_line->>'quantity')::numeric,
        v_cashier_id
      );
    END IF;

    INSERT INTO public.pos_sale_lines (
      tenant_id,
      sale_id,
      product_id,
      sku_snapshot,
      name_snapshot,
      is_service,
      quantity,
      unit_price_usd,
      discount_percent,
      discount_amount_usd,
      tax_rate_percent,
      tax_amount_usd,
      line_subtotal_usd,
      line_total_usd
    ) VALUES (
      v_tenant_id,
      v_new_sale_id,
      CASE WHEN v_line->>'product_id' IS NOT NULL THEN (v_line->>'product_id')::uuid ELSE NULL END,
      COALESCE(v_line->>'sku', 'SRV-001'),
      v_line->>'name',
      COALESCE((v_line->>'is_service')::boolean, false),
      (v_line->>'quantity')::numeric,
      (v_line->>'unit_price_usd')::numeric,
      COALESCE((v_line->>'discount_percent')::numeric, 0),
      COALESCE((v_line->>'discount_amount_usd')::numeric, 0),
      COALESCE((v_line->>'tax_rate_percent')::numeric, 16.00),
      COALESCE((v_line->>'tax_amount_usd')::numeric, 0),
      (v_line->>'line_subtotal_usd')::numeric,
      (v_line->>'line_total_usd')::numeric
    );
  END LOOP;

  -- 7. Insertar cobros
  IF p_payload->'payments' IS NOT NULL THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payload->'payments')
    LOOP
      INSERT INTO public.pos_sale_payments (
        tenant_id,
        branch_id,
        sale_id,
        shift_id,
        method,
        currency,
        amount_received,
        amount_applied,
        change_amount,
        change_currency,
        exchange_rate_snapshot,
        reference_number,
        bank_code,
        bank_name,
        payer_phone,
        payer_document,
        terminal_id,
        card_last4,
        approval_code,
        cashea_operation_id,
        cashea_merchant_amount,
        provider_status,
        verified_by,
        verified_at
      ) VALUES (
        v_tenant_id,
        v_branch_id,
        v_new_sale_id,
        v_shift_id,
        v_payment->>'method',
        v_payment->>'currency',
        (v_payment->>'amount_received')::numeric,
        (v_payment->>'amount_applied')::numeric,
        COALESCE((v_payment->>'change_amount')::numeric, 0),
        v_payment->>'change_currency',
        v_rate,
        v_payment->>'reference_number',
        v_payment->>'bank_code',
        v_payment->>'bank_name',
        v_payment->>'payer_phone',
        v_payment->>'payer_document',
        v_payment->>'terminal_id',
        v_payment->>'card_last4',
        v_payment->>'approval_code',
        v_payment->>'cashea_operation_id',
        CASE WHEN v_payment->>'cashea_merchant_amount' IS NOT NULL THEN (v_payment->>'cashea_merchant_amount')::numeric ELSE NULL END,
        COALESCE(v_payment->>'provider_status', 'registrado'),
        CASE WHEN v_payment->>'provider_status' = 'verificado' THEN v_cashier_id ELSE NULL END,
        CASE WHEN v_payment->>'provider_status' = 'verificado' THEN now() ELSE NULL END
      );
    END LOOP;
  END IF;

  -- 8. Crear Comprobante Comercial Interno
  INSERT INTO public.pos_commercial_documents (
    tenant_id,
    sale_id,
    document_kind,
    internal_number,
    status
  ) VALUES (
    v_tenant_id,
    v_new_sale_id,
    'comprobante_interno',
    v_doc_num,
    'generado'
  );

  -- 9. Actualizar estadísticas de cliente si aplica
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.pos_customers
    SET total_purchases_count = total_purchases_count + 1,
        total_purchases_usd = total_purchases_usd + v_total_usd,
        last_purchase_at = now(),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  -- 10. Bitácora de Auditoría
  INSERT INTO public.platform_audit_logs (
    actor_id,
    tenant_id,
    action,
    resource,
    resource_id,
    details,
    correlation_id
  ) VALUES (
    v_cashier_id,
    v_tenant_id,
    'pos.sale.confirm',
    'pos_sales',
    v_new_sale_id::text,
    jsonb_build_object(
      'sale_number', v_sale_number,
      'total_usd', v_total_usd,
      'total_ves', v_total_ves,
      'shift_id', v_shift_id,
      'internal_document', v_doc_num
    ),
    v_correlation_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'sale_id', v_new_sale_id,
    'sale_number', v_sale_number,
    'internal_document_number', v_doc_num,
    'commercial_status', 'confirmada',
    'payment_status', v_p_status,
    'total_usd', v_total_usd,
    'total_ves', v_total_ves,
    'confirmed_at', now()
  );
END;
$$;

-- 9.4 Procesamiento atómico de anulaciones y devoluciones
CREATE OR REPLACE FUNCTION public.vora_pos_process_return(
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := (p_payload->>'tenant_id')::uuid;
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_sale_id uuid := (p_payload->>'original_sale_id')::uuid;
  v_shift_id uuid := (p_payload->>'shift_id')::uuid;
  v_return_type text := p_payload->>'return_type';
  v_refund_method text := p_payload->>'refund_method';
  v_reason text := p_payload->>'reason';
  v_requested_by uuid := (p_payload->>'requested_by')::uuid;
  v_approved_by uuid := (p_payload->>'approved_by')::uuid;
  v_auth_id uuid;
  v_sale public.pos_sales%ROWTYPE;
  v_new_return_id uuid;
  v_return_number text;
  v_line jsonb;
  v_sale_line public.pos_sale_lines%ROWTYPE;
  v_prod public.pos_products%ROWTYPE;
  v_total_refund_usd numeric(18,2) := 0;
  v_total_refund_ves numeric(18,2) := 0;
  v_any_remaining boolean := false;
BEGIN
  IF p_payload->>'authorization_id' IS NOT NULL AND length(trim(p_payload->>'authorization_id')) > 0 THEN
    v_auth_id := (p_payload->>'authorization_id')::uuid;
  END IF;

  IF NOT (
    public.vora_pos_has_permission(v_tenant_id, 'pos.refunds.approve') OR
    public.vora_pos_has_permission(v_tenant_id, 'pos.sales.void')
  ) THEN
    RAISE EXCEPTION 'Operación rechazada: se requiere aprobación formal de Supervisor.';
  END IF;

  SELECT * INTO v_sale
  FROM public.pos_sales
  WHERE id = v_sale_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta de referencia no encontrada.';
  END IF;

  IF v_sale.commercial_status IN ('anulada', 'devuelta') THEN
    RAISE EXCEPTION 'La venta ya se encuentra completamente anulada o devuelta.';
  END IF;

  v_return_number := 'DEV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');

  INSERT INTO public.pos_sale_returns (
    tenant_id,
    branch_id,
    original_sale_id,
    shift_id,
    return_number,
    return_type,
    reason,
    notes,
    requested_by,
    approved_by,
    authorization_id,
    refund_method,
    total_refunded_usd,
    total_refunded_ves
  ) VALUES (
    v_tenant_id,
    v_branch_id,
    v_sale_id,
    v_shift_id,
    v_return_number,
    v_return_type,
    v_reason,
    p_payload->>'notes',
    v_requested_by,
    v_approved_by,
    v_auth_id,
    v_refund_method,
    0,
    0
  ) RETURNING id INTO v_new_return_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    SELECT * INTO v_sale_line
    FROM public.pos_sale_lines
    WHERE id = (v_line->>'sale_line_id')::uuid AND sale_id = v_sale_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Línea de venta % no encontrada.', v_line->>'sale_line_id';
    END IF;

    IF v_sale_line.returned_quantity + (v_line->>'quantity_returned')::numeric > v_sale_line.quantity THEN
      RAISE EXCEPTION 'La cantidad solicitada para devolver (%) excede el remanente disponible (%).',
        v_line->>'quantity_returned', v_sale_line.quantity - v_sale_line.returned_quantity;
    END IF;

    UPDATE public.pos_sale_lines
    SET returned_quantity = returned_quantity + (v_line->>'quantity_returned')::numeric
    WHERE id = v_sale_line.id;

    v_total_refund_usd := v_total_refund_usd + ((v_line->>'quantity_returned')::numeric * v_sale_line.unit_price_usd);

    IF v_sale_line.is_service = false AND v_sale_line.product_id IS NOT NULL THEN
      SELECT * INTO v_prod
      FROM public.pos_products
      WHERE id = v_sale_line.product_id
      FOR UPDATE;

      UPDATE public.pos_products
      SET stock_quantity = stock_quantity + (v_line->>'quantity_returned')::numeric,
          status = 'disponible',
          updated_at = now()
      WHERE id = v_prod.id;

      INSERT INTO public.pos_inventory_kardex (
        tenant_id,
        branch_id,
        product_id,
        movement_type,
        reference_id,
        quantity_delta,
        stock_before,
        stock_after,
        actor_id
      ) VALUES (
        v_tenant_id,
        v_branch_id,
        v_prod.id,
        'reverso_devolucion',
        v_new_return_id,
        (v_line->>'quantity_returned')::numeric,
        v_prod.stock_quantity,
        v_prod.stock_quantity + (v_line->>'quantity_returned')::numeric,
        v_approved_by
      );
    END IF;

    INSERT INTO public.pos_return_lines (
      tenant_id,
      return_id,
      sale_line_id,
      product_id,
      quantity_returned,
      refund_amount_usd,
      refund_amount_ves
    ) VALUES (
      v_tenant_id,
      v_new_return_id,
      v_sale_line.id,
      v_sale_line.product_id,
      (v_line->>'quantity_returned')::numeric,
      ((v_line->>'quantity_returned')::numeric * v_sale_line.unit_price_usd),
      ((v_line->>'quantity_returned')::numeric * v_sale_line.unit_price_usd * v_sale.exchange_rate_snapshot)
    );
  END LOOP;

  v_total_refund_ves := v_total_refund_usd * v_sale.exchange_rate_snapshot;

  UPDATE public.pos_sale_returns
  SET total_refunded_usd = v_total_refund_usd,
      total_refunded_ves = v_total_refund_ves
  WHERE id = v_new_return_id;

  SELECT EXISTS (
    SELECT 1 FROM public.pos_sale_lines
    WHERE sale_id = v_sale_id AND returned_quantity < quantity
  ) INTO v_any_remaining;

  IF v_return_type = 'anulacion_total' OR NOT v_any_remaining THEN
    UPDATE public.pos_sales
    SET commercial_status = CASE WHEN v_return_type = 'anulacion_total' THEN 'anulada' ELSE 'devuelta' END
    WHERE id = v_sale_id;
  ELSE
    UPDATE public.pos_sales
    SET commercial_status = 'parcialmente_devuelta'
    WHERE id = v_sale_id;
  END IF;

  INSERT INTO public.platform_audit_logs (
    actor_id,
    tenant_id,
    action,
    resource,
    resource_id,
    details
  ) VALUES (
    v_approved_by,
    v_tenant_id,
    'pos.sale.return',
    'pos_sale_returns',
    v_new_return_id::text,
    jsonb_build_object(
      'sale_id', v_sale_id,
      'return_number', v_return_number,
      'refund_amount_usd', v_total_refund_usd,
      'refund_amount_ves', v_total_refund_ves,
      'method', v_refund_method
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'return_id', v_new_return_id,
    'return_number', v_return_number,
    'refund_usd', v_total_refund_usd,
    'refund_ves', v_total_refund_ves,
    'commercial_status', CASE WHEN v_return_type = 'anulacion_total' THEN 'anulada' WHEN NOT v_any_remaining THEN 'devuelta' ELSE 'parcialmente_devuelta' END
  );
END;
$$;

-- 9.5 Arqueo y cierre definitivo de turno
CREATE OR REPLACE FUNCTION public.vora_pos_close_shift(
  p_shift_id uuid,
  p_declared jsonb,
  p_justification text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shift public.pos_shifts%ROWTYPE;
  v_expected_usd numeric(18,2) := 0;
  v_expected_ves numeric(18,2) := 0;
  v_cash_in_usd numeric(18,2) := 0;
  v_cash_in_ves numeric(18,2) := 0;
  v_pm_ves numeric(18,2) := 0;
  v_tarjeta_ves numeric(18,2) := 0;
  v_cashea_usd numeric(18,2) := 0;
  v_manual_usd numeric(18,2) := 0;
  v_manual_ves numeric(18,2) := 0;
  v_diff_usd numeric(18,2);
  v_diff_ves numeric(18,2);
  v_has_difference boolean := false;
  v_expected_json jsonb;
  v_diff_json jsonb;
BEGIN
  SELECT * INTO v_shift
  FROM public.pos_shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El turno de caja especificado no existe.';
  END IF;

  IF v_shift.status = 'cerrado' THEN
    RAISE EXCEPTION 'El turno ya se encuentra cerrado e inmutable.';
  END IF;

  IF NOT public.vora_pos_has_permission(v_shift.tenant_id, 'pos.cash.close') THEN
    RAISE EXCEPTION 'Operación rechazada: no posee autorización para arqueo y cierre de turnos.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pos_sales
    WHERE shift_id = p_shift_id AND commercial_status = 'borrador'
  ) THEN
    RAISE EXCEPTION 'No se puede ejecutar el cierre de turno mientras existan ventas en estado borrador.';
  END IF;

  -- Sumar cobros en efectivo
  SELECT COALESCE(SUM(amount_applied - change_amount), 0)
  INTO v_cash_in_usd
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'efectivo' AND currency = 'USD';

  SELECT COALESCE(SUM(amount_applied - change_amount), 0)
  INTO v_cash_in_ves
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'efectivo' AND currency = 'VES';

  -- Sumar Pago Móvil VES
  SELECT COALESCE(SUM(amount_applied), 0)
  INTO v_pm_ves
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'pago_movil';

  -- Sumar Tarjeta Terminal VES
  SELECT COALESCE(SUM(amount_applied), 0)
  INTO v_tarjeta_ves
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'tarjeta';

  -- Sumar Cashea USD
  SELECT COALESCE(SUM(amount_applied), 0)
  INTO v_cashea_usd
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'cashea';

  -- Movimientos manuales
  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('ingreso_efectivo', 'cambio_saldo_inicial') THEN amount
      WHEN movement_type = 'retiro_efectivo' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_manual_usd
  FROM public.pos_cash_movements
  WHERE shift_id = p_shift_id AND currency = 'USD';

  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('ingreso_efectivo', 'cambio_saldo_inicial') THEN amount
      WHEN movement_type = 'retiro_efectivo' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_manual_ves
  FROM public.pos_cash_movements
  WHERE shift_id = p_shift_id AND currency = 'VES';

  v_expected_usd := v_shift.opening_amount_usd + v_cash_in_usd + v_manual_usd;
  v_expected_ves := v_shift.opening_amount_ves + v_cash_in_ves + v_manual_ves;

  v_expected_json := jsonb_build_object(
    'efectivo_usd', v_expected_usd,
    'efectivo_ves', v_expected_ves,
    'pago_movil_ves', v_pm_ves,
    'tarjeta_ves', v_tarjeta_ves,
    'cashea_usd', v_cashea_usd
  );

  v_diff_usd := COALESCE((p_declared->>'efectivo_usd')::numeric, 0) - v_expected_usd;
  v_diff_ves := COALESCE((p_declared->>'efectivo_ves')::numeric, 0) - v_expected_ves;

  v_diff_json := jsonb_build_object(
    'efectivo_usd', v_diff_usd,
    'efectivo_ves', v_diff_ves,
    'pago_movil_ves', COALESCE((p_declared->>'pago_movil_ves')::numeric, 0) - v_pm_ves,
    'tarjeta_ves', COALESCE((p_declared->>'tarjeta_ves')::numeric, 0) - v_tarjeta_ves,
    'cashea_usd', COALESCE((p_declared->>'cashea_usd')::numeric, 0) - v_cashea_usd
  );

  IF (v_diff_usd <> 0) OR (v_diff_ves <> 0) OR
     (COALESCE((p_declared->>'pago_movil_ves')::numeric, 0) - v_pm_ves <> 0) OR
     (COALESCE((p_declared->>'tarjeta_ves')::numeric, 0) - v_tarjeta_ves <> 0) THEN
    v_has_difference := true;
  END IF;

  IF v_has_difference AND (p_justification IS NULL OR length(trim(p_justification)) < 5) THEN
    RAISE EXCEPTION 'Diferencia detectada en arqueo. Exige ingresar justificación detallada de al menos 5 caracteres.';
  END IF;

  UPDATE public.pos_shifts
  SET status = 'cerrado',
      closed_at = now(),
      closed_by = auth.uid(),
      expected_totals = v_expected_json,
      declared_totals = p_declared,
      differences_totals = v_diff_json,
      closing_justification = p_justification
  WHERE id = p_shift_id;

  INSERT INTO public.platform_audit_logs (
    actor_id,
    tenant_id,
    action,
    resource,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    v_shift.tenant_id,
    'pos.shift.close',
    'pos_shifts',
    p_shift_id::text,
    jsonb_build_object(
      'register_id', v_shift.register_id,
      'expected_totals', v_expected_json,
      'declared_totals', p_declared,
      'differences_totals', v_diff_json,
      'closing_justification', p_justification
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shift_id', p_shift_id,
    'status', 'cerrado',
    'expected_totals', v_expected_json,
    'declared_totals', p_declared,
    'differences_totals', v_diff_json,
    'closed_at', now()
  );
END;
$$;

-- 9.6 Privilegios sobre funciones RPC
REVOKE ALL ON FUNCTION public.vora_pos_has_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vora_pos_open_shift(uuid, uuid, uuid, uuid, text, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vora_pos_confirm_sale(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vora_pos_process_return(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vora_pos_close_shift(uuid, jsonb, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vora_pos_has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vora_pos_open_shift(uuid, uuid, uuid, uuid, text, numeric, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vora_pos_confirm_sale(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vora_pos_process_return(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vora_pos_close_shift(uuid, jsonb, text) TO authenticated, service_role;

-- 10. DATOS SEMILLA PARA EL TENANT PILOTO test1 [mock]

DO $$
DECLARE
  v_plan_id uuid;
  v_template_id uuid;
  v_tenant_id uuid;
  v_branch_ccs uuid;
  v_branch_val uuid;
  v_reg_01 uuid;
  v_reg_02 uuid;
  v_reg_val uuid;
  v_user_maria uuid := '11111111-1111-4111-a111-111111111111'::uuid;
  v_user_luis uuid := '22222222-2222-4222-a222-222222222222'::uuid;
  v_user_carlos uuid := '33333333-3333-4333-a333-333333333333'::uuid;
  v_user_admin uuid := '44444444-4444-4444-a444-444444444444'::uuid;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Starter' LIMIT 1;
  SELECT id INTO v_template_id FROM public.business_templates WHERE key = 'retail_ecommerce' LIMIT 1;

  -- 10.1 Tenant test1 [mock]
  INSERT INTO public.tenants (
    commercial_name,
    legal_name,
    tax_id,
    slug,
    infrastructure_mode,
    commercial_status,
    technical_status,
    country,
    currency,
    language,
    timezone,
    business_type,
    business_template_id,
    plan_id,
    wizard_completed
  ) VALUES (
    'test1 [mock]',
    'VORA Retail Piloto test1 C.A. [mock]',
    'J-50123987-1',
    'test1',
    'shared',
    'active',
    'ready',
    'VE',
    'USD',
    'es',
    'America/Caracas',
    'Retail y Comercio Electrónico',
    v_template_id,
    v_plan_id,
    true
  )
  ON CONFLICT (slug) DO UPDATE SET
    commercial_name = EXCLUDED.commercial_name,
    legal_name = EXCLUDED.legal_name,
    commercial_status = 'active',
    technical_status = 'ready',
    country = 'VE',
    currency = 'USD',
    timezone = 'America/Caracas'
  RETURNING id INTO v_tenant_id;

  -- 10.2 Branding test1 [mock] con tokens oficiales VORA
  INSERT INTO public.tenant_branding (
    tenant_id,
    primary_color,
    secondary_color,
    accent_color,
    font_family,
    login_background_color
  ) VALUES (
    v_tenant_id,
    '#285C49',
    '#A9BEA5',
    '#C97857',
    'Inter',
    '#F6F2E9'
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    font_family = EXCLUDED.font_family,
    login_background_color = EXCLUDED.login_background_color;

  -- 10.3 Habilitar commerce.pos en tenant_features
  INSERT INTO public.tenant_features (
    tenant_id,
    feature_key,
    enabled,
    contracted,
    config,
    config_state,
    release_status
  ) VALUES (
    v_tenant_id,
    'commerce.pos',
    true,
    true,
    '{
      "functions": {
        "pos_sales": true,
        "pos_shifts": true,
        "pos_payments": true,
        "pos_returns": true,
        "pos_authorizations": true,
        "pos_documents": true,
        "pos_fiscal": true,
        "pos_kardex": true,
        "pos_settings": true,
        "pos_reports": true
      }
    }'::jsonb,
    'operational',
    'released_for_testing'
  )
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = true,
    contracted = true,
    config = EXCLUDED.config,
    config_state = 'operational',
    release_status = 'released_for_testing';

  -- 10.4 Tasa BCV Oficial en platform_exchange_rates
  INSERT INTO public.platform_exchange_rates (
    effective_date,
    ves_per_usd,
    source,
    created_by
  ) VALUES (
    (now() AT TIME ZONE 'America/Caracas')::date,
    36.500000,
    'Tasa BCV Oficial 36,500000 VES/USD [mock]',
    v_user_admin
  )
  ON CONFLICT (effective_date) DO UPDATE SET
    ves_per_usd = EXCLUDED.ves_per_usd,
    source = EXCLUDED.source;

  -- 10.5 Sedes
  INSERT INTO public.tenant_branches (
    tenant_id,
    code,
    name,
    fiscal_address,
    phone,
    is_primary,
    status
  ) VALUES (
    v_tenant_id,
    'CCS-01',
    'Sede Principal Caracas [mock]',
    'Av. Francisco de Miranda, Torre VORA, Nivel PB, Caracas [mock]',
    '+58 212 555 0101',
    true,
    'active'
  )
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_branch_ccs;

  INSERT INTO public.tenant_branches (
    tenant_id,
    code,
    name,
    fiscal_address,
    phone,
    is_primary,
    status
  ) VALUES (
    v_tenant_id,
    'VAL-01',
    'Sucursal Valencia [mock]',
    'Av. Bolívar Norte, C.C. La Granja, Valencia, Carabobo [mock]',
    '+58 241 555 0202',
    false,
    'active'
  )
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_branch_val;

  -- 10.6 Cajas
  INSERT INTO public.pos_registers (
    tenant_id,
    branch_id,
    code,
    name,
    status
  ) VALUES (
    v_tenant_id,
    v_branch_ccs,
    'CAJA-01',
    'Caja 01 - Mostrador Principal [mock]',
    'active'
  )
  ON CONFLICT (tenant_id, branch_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reg_01;

  INSERT INTO public.pos_registers (
    tenant_id,
    branch_id,
    code,
    name,
    status
  ) VALUES (
    v_tenant_id,
    v_branch_ccs,
    'CAJA-02',
    'Caja 02 - Autoservicio [mock]',
    'active'
  )
  ON CONFLICT (tenant_id, branch_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reg_02;

  INSERT INTO public.pos_registers (
    tenant_id,
    branch_id,
    code,
    name,
    status
  ) VALUES (
    v_tenant_id,
    v_branch_val,
    'CAJA-VAL-01',
    'Caja 01 - Sucursal Valencia [mock]',
    'active'
  )
  ON CONFLICT (tenant_id, branch_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reg_val;

  -- 10.7 Asignación de cajeros
  INSERT INTO public.pos_register_assignments (
    tenant_id,
    branch_id,
    register_id,
    auth_user_id,
    cashier_display_name,
    is_active
  ) VALUES
    (v_tenant_id, v_branch_ccs, v_reg_01, v_user_maria, 'María C. [mock]', true),
    (v_tenant_id, v_branch_ccs, v_reg_02, v_user_luis, 'Luis P. [mock]', true);

  -- 10.8 Parámetros de Sede
  INSERT INTO public.pos_settings (
    tenant_id,
    branch_id,
    active_methods,
    max_cashier_discount_percent,
    allow_partial_payments,
    cross_currency_change_enabled,
    internal_doc_prefix,
    next_internal_seq,
    next_sale_seq,
    active_exchange_rate
  ) VALUES (
    v_tenant_id,
    v_branch_ccs,
    ARRAY['efectivo', 'pago_movil', 'tarjeta', 'cashea'],
    5.00,
    true,
    true,
    'COMP-INT-',
    1,
    1259,
    36.500000
  )
  ON CONFLICT (tenant_id, branch_id) DO NOTHING;

  INSERT INTO public.pos_settings (
    tenant_id,
    branch_id,
    active_methods,
    max_cashier_discount_percent,
    allow_partial_payments,
    cross_currency_change_enabled,
    internal_doc_prefix,
    next_internal_seq,
    next_sale_seq,
    active_exchange_rate
  ) VALUES (
    v_tenant_id,
    v_branch_val,
    ARRAY['efectivo', 'pago_movil', 'tarjeta'],
    5.00,
    true,
    true,
    'COMP-VAL-',
    1,
    500,
    36.500000
  )
  ON CONFLICT (tenant_id, branch_id) DO NOTHING;

  -- 10.9 Integración The Factory HKA en Sandbox [mock]
  INSERT INTO public.pos_fiscal_integrations (
    tenant_id,
    provider,
    environment,
    enabled,
    company_rif,
    company_legal_name,
    fiscal_address,
    secret_reference,
    legal_status
  ) VALUES (
    v_tenant_id,
    'HKA',
    'sandbox',
    true,
    'J-50123987-1',
    'VORA Retail Piloto test1 C.A. [mock]',
    'Av. Francisco de Miranda, Torre VORA, Nivel PB, Caracas [mock]',
    'vault:hka_secret_pilot_mock',
    'sandbox_verificado'
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    environment = EXCLUDED.environment,
    enabled = EXCLUDED.enabled,
    legal_status = EXCLUDED.legal_status;

  -- 10.10 Clientes de demostración
  INSERT INTO public.pos_customers (
    tenant_id,
    document_type,
    document_number,
    legal_name,
    phone,
    email,
    fiscal_address,
    customer_tier,
    total_purchases_count,
    total_purchases_usd,
    last_purchase_at
  ) VALUES
    (v_tenant_id, 'V', '18492041', 'Ana López [mock]', '0414-1234567', 'ana.lopez@example.com', 'Urb. Altamira, Av. San Juan Bosco, Caracas [mock]', 'frecuente', 8, 420.00, now() - interval '2 days'),
    (v_tenant_id, 'J', '304928114', 'Carlos Pérez [mock]', '0424-9876543', 'carlos.perez@example.com', 'Colinas de Bello Monte, Calle Beethoven, Caracas [mock]', 'nuevo', 1, 65.00, now() - interval '10 days'),
    (v_tenant_id, 'V', '00000000', 'Consumidor Final [mock]', '0000-0000000', 'consumidor.final@vora.mock', 'Venta en mostrador sin registro fiscal [mock]', 'consumidor_final', 0, 0, null)
  ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    customer_tier = EXCLUDED.customer_tier;

  -- 10.11 Catálogo de productos e inventario de prueba
  INSERT INTO public.pos_products (
    tenant_id,
    branch_id,
    sku,
    barcode,
    name,
    category,
    is_service,
    price_usd,
    tax_rate_percent,
    stock_quantity,
    status
  ) VALUES
    (v_tenant_id, v_branch_ccs, 'CMB-001', '75910010001', 'Camiseta Básica CMB-001 [mock]', 'Ropa', false, 15.0000, 16.00, 45.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'JE-032', '75910010002', 'Pantalón Jean JE-032 [mock]', 'Ropa', false, 38.0000, 16.00, 22.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'ZD-104', '75910010003', 'Zapatos Deportivos ZD-104 [mock]', 'Calzado', false, 55.0000, 16.00, 14.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'PF-801', '75910010004', 'Perfume Floral PF-801 [mock]', 'Perfumería', false, 42.0000, 16.00, 18.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'GC-010', '75910010005', 'Gorra Casual GC-010 [mock]', 'Accesorios', false, 12.0000, 16.00, 30.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'JS-900', '75910010006', 'Juego de Sábanas King JS-900 [mock]', 'Hogar', false, 48.0000, 16.00, 8.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'SA-001', '75910010007', 'Servicio de Ajuste y Sastrería SA-001 [mock]', 'Servicios', true, 8.0000, 16.00, 999.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'BE-002', '75910010008', 'Bolsa Ecológica VORA BE-002 [mock]', 'Accesorios', false, 1.5000, 16.00, 120.000, 'disponible'),
    -- Sucursal Valencia
    (v_tenant_id, v_branch_val, 'CMB-001', '75910010001', 'Camiseta Básica CMB-001 [mock]', 'Ropa', false, 15.0000, 16.00, 15.000, 'disponible'),
    (v_tenant_id, v_branch_val, 'JE-032', '75910010002', 'Pantalón Jean JE-032 [mock]', 'Ropa', false, 38.0000, 16.00, 10.000, 'disponible')
  ON CONFLICT (tenant_id, branch_id, sku) DO UPDATE SET
    name = EXCLUDED.name,
    price_usd = EXCLUDED.price_usd,
    stock_quantity = EXCLUDED.stock_quantity;

END $$;

