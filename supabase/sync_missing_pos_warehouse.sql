CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
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
INSERT INTO role_permissions (role_key, permission, scope)
VALUES
  ('pos_cashier', 'pos.sales.create', 'tenant'),
  ('pos_supervisor', 'pos.sales.create', 'tenant'),
  ('pos_store_admin', 'pos.sales.create', 'tenant'),
  ('tenant_admin', 'pos.sales.create', 'tenant'),
  ('pos_cashier', 'pos.payments.register', 'tenant'),
  ('pos_supervisor', 'pos.payments.register', 'tenant'),
  ('pos_store_admin', 'pos.payments.register', 'tenant'),
  ('tenant_admin', 'pos.payments.register', 'tenant'),
  ('pos_cashier', 'pos.cash.open', 'tenant'),
  ('pos_supervisor', 'pos.cash.open', 'tenant'),
  ('pos_store_admin', 'pos.cash.open', 'tenant'),
  ('tenant_admin', 'pos.cash.open', 'tenant'),
  ('pos_cashier', 'pos.cash.close', 'tenant'),
  ('pos_supervisor', 'pos.cash.close', 'tenant'),
  ('pos_store_admin', 'pos.cash.close', 'tenant'),
  ('tenant_admin', 'pos.cash.close', 'tenant'),
  ('pos_supervisor', 'pos.sales.discount.override', 'tenant'),
  ('pos_store_admin', 'pos.sales.discount.override', 'tenant'),
  ('tenant_admin', 'pos.sales.discount.override', 'tenant'),
  ('pos_supervisor', 'pos.sales.void', 'tenant'),
  ('pos_store_admin', 'pos.sales.void', 'tenant'),
  ('tenant_admin', 'pos.sales.void', 'tenant'),
  ('pos_supervisor', 'pos.refunds.approve', 'tenant'),
  ('pos_store_admin', 'pos.refunds.approve', 'tenant'),
  ('tenant_admin', 'pos.refunds.approve', 'tenant'),
  ('pos_supervisor', 'pos.reports.view', 'tenant'),
  ('pos_store_admin', 'pos.reports.view', 'tenant'),
  ('pos_auditor', 'pos.reports.view', 'tenant'),
  ('tenant_admin', 'pos.reports.view', 'tenant'),
  ('pos_store_admin', 'pos.settings.manage', 'tenant'),
  ('tenant_admin', 'pos.settings.manage', 'tenant'),
  ('pos_store_admin', 'pos.fiscal.issue', 'tenant'),
  ('tenant_admin', 'pos.fiscal.issue', 'tenant')
ON CONFLICT (role_key, permission) DO NOTHING;
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
CREATE UNIQUE INDEX IF NOT EXISTS one_open_shift_per_register
ON public.pos_shifts(register_id)
WHERE status = 'abierto';
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
  IF NOT public.vora_pos_has_permission(v_tenant_id, 'pos.sales.create') THEN
    RAISE EXCEPTION 'Operación rechazada: no posee autorización para emisión de ventas.';
  END IF;
  SELECT * INTO v_shift
  FROM public.pos_shifts
  WHERE id = v_shift_id AND tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN
    RAISE EXCEPTION 'El turno de caja especificado no existe o se encuentra cerrado.';
  END IF;
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
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.pos_customers
    SET total_purchases_count = total_purchases_count + 1,
        total_purchases_usd = total_purchases_usd + v_total_usd,
        last_purchase_at = now(),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;
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
  SELECT COALESCE(SUM(amount_applied - change_amount), 0)
  INTO v_cash_in_usd
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'efectivo' AND currency = 'USD';
  SELECT COALESCE(SUM(amount_applied - change_amount), 0)
  INTO v_cash_in_ves
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'efectivo' AND currency = 'VES';
  SELECT COALESCE(SUM(amount_applied), 0)
  INTO v_pm_ves
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'pago_movil';
  SELECT COALESCE(SUM(amount_applied), 0)
  INTO v_tarjeta_ves
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'tarjeta';
  SELECT COALESCE(SUM(amount_applied), 0)
  INTO v_cashea_usd
  FROM public.pos_sale_payments
  WHERE shift_id = p_shift_id AND method = 'cashea';
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
BEGIN;
CREATE TABLE IF NOT EXISTS public.warehouse_supplier_profiles (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code         TEXT,                    -- Código único opcional por tenant (ej. PROV-001)
  name         TEXT        NOT NULL,    -- Razón social o nombre comercial
  tax_id       TEXT,                    -- RIF, NIT, CIF, RFC o documento fiscal
  contact_name TEXT,                    -- Nombre de la persona de contacto
  email        TEXT,                    -- Correo electrónico comercial
  phone        TEXT,                    -- Teléfono de contacto
  address      TEXT,                    -- Dirección física
  city         TEXT,
  country      TEXT        DEFAULT 'VE',
  category     TEXT        DEFAULT 'general', -- 'materia_prima', 'empaque', 'insumo', 'servicios', 'general'
  status       TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'blocked')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wh_sup_prof_tenant_name UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS wh_sup_prof_tenant_idx
  ON public.warehouse_supplier_profiles (tenant_id, status);
CREATE INDEX IF NOT EXISTS wh_sup_prof_tenant_cat_idx
  ON public.warehouse_supplier_profiles (tenant_id, category);
ALTER TABLE public.warehouse_supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_supplier_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY wh_sup_prof_tenant_isolation ON public.warehouse_supplier_profiles
  FOR ALL TO authenticated
  USING (
    public.vora_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = warehouse_supplier_profiles.tenant_id
        AND m.auth_user_id = auth.uid()
        AND m.status = 'active'
    )
  );
REVOKE ALL ON public.warehouse_supplier_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_supplier_profiles TO authenticated;
GRANT ALL ON public.warehouse_supplier_profiles TO service_role;
CREATE TABLE IF NOT EXISTS public.warehouse_supplier_terms (
  id                       UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id              UUID          NOT NULL REFERENCES public.warehouse_supplier_profiles(id) ON DELETE CASCADE,
  payment_terms_days       INTEGER       NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0), -- 0=contado, 15, 30, etc.
  currency                 CHAR(3)       NOT NULL DEFAULT 'USD',
  credit_limit             NUMERIC(14,2) DEFAULT 0 CHECK (credit_limit >= 0),
  discount_percentage      NUMERIC(5,2)  DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  lead_time_days           INTEGER       DEFAULT 0 CHECK (lead_time_days >= 0),
  preferred_payment_method TEXT          DEFAULT 'transfer', -- 'transfer', 'pago_movil', 'cash', 'zelle'
  bank_details             JSONB         DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT wh_sup_terms_tenant_supplier UNIQUE (tenant_id, supplier_id)
);
CREATE INDEX IF NOT EXISTS wh_sup_terms_tenant_supplier_idx
  ON public.warehouse_supplier_terms (tenant_id, supplier_id);
ALTER TABLE public.warehouse_supplier_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_supplier_terms FORCE ROW LEVEL SECURITY;
CREATE POLICY wh_sup_terms_tenant_isolation ON public.warehouse_supplier_terms
  FOR ALL TO authenticated
  USING (
    public.vora_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = warehouse_supplier_terms.tenant_id
        AND m.auth_user_id = auth.uid()
        AND m.status = 'active'
    )
  );
REVOKE ALL ON public.warehouse_supplier_terms FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_supplier_terms TO authenticated;
GRANT ALL ON public.warehouse_supplier_terms TO service_role;
UPDATE public.features
SET implementation_status = 'implemented'
WHERE key = 'warehouse.suppliers';
COMMIT;
BEGIN;
CREATE FUNCTION public.warehouse_is_member(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.vora_is_super_admin() OR EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = p_tenant AND m.auth_user_id = auth.uid() AND m.status = 'active');
$$;
REVOKE ALL ON FUNCTION public.warehouse_is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.warehouse_is_member(uuid) TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.warehouse_settings (
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
CREATE TABLE IF NOT EXISTS public.warehouse_business_profiles (
  tenant_id        uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  sector           text NOT NULL,
  specialty        text,
  template_key     text NOT NULL,
  template_version integer NOT NULL DEFAULT 1,
  applied_by       uuid,
  applied_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.warehouse_units (
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
CREATE TABLE IF NOT EXISTS public.warehouse_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE TABLE IF NOT EXISTS public.warehouse_attribute_definitions (
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
CREATE TABLE IF NOT EXISTS public.warehouse_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku         text NOT NULL CHECK (length(trim(sku)) BETWEEN 1 AND 64),
  name        text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  description text,
  item_type   text NOT NULL CHECK (item_type IN (
                'physical', 'weighted', 'lot', 'serialized', 'variant', 'kit', 'manufactured',
                'service', 'service_consumables', 'service_work_order',
                'reservable_resource', 'rental_asset')),
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
CREATE INDEX IF NOT EXISTS warehouse_items_tenant_name_idx ON public.warehouse_items (tenant_id, lower(name));
CREATE TABLE IF NOT EXISTS public.warehouse_item_barcodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  code       text NOT NULL CHECK (code ~ '^[A-Za-z0-9\-\.\_/]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS warehouse_item_barcodes_item_idx ON public.warehouse_item_barcodes (item_id);
CREATE TABLE IF NOT EXISTS public.warehouse_warehouses (
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
CREATE TABLE IF NOT EXISTS public.warehouse_balances (
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
CREATE INDEX IF NOT EXISTS warehouse_balances_tenant_idx ON public.warehouse_balances (tenant_id, warehouse_id);
CREATE TABLE IF NOT EXISTS public.warehouse_documents (
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
CREATE INDEX IF NOT EXISTS warehouse_documents_tenant_idx ON public.warehouse_documents (tenant_id, doc_type, status, created_at DESC);
CREATE TABLE IF NOT EXISTS public.warehouse_document_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES public.warehouse_documents(id) ON DELETE CASCADE,
  line_no      integer NOT NULL,
  item_id      uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
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
CREATE TABLE IF NOT EXISTS public.warehouse_doc_counters (
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type    text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, doc_type)
);
CREATE TABLE IF NOT EXISTS public.warehouse_movements (
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
CREATE INDEX IF NOT EXISTS warehouse_movements_item_idx ON public.warehouse_movements (tenant_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS warehouse_movements_date_idx ON public.warehouse_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS warehouse_movements_type_idx ON public.warehouse_movements (tenant_id, movement_type, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_movements_single_reversal ON public.warehouse_movements (reversal_of) WHERE reversal_of IS NOT NULL;
CREATE FUNCTION public.warehouse_movements_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Los movimientos de inventario son inmutables; registra un reverso.';
END $$;
CREATE TRIGGER warehouse_movements_no_update
  BEFORE UPDATE OR DELETE ON public.warehouse_movements
  FOR EACH ROW EXECUTE FUNCTION public.warehouse_movements_immutable();
CREATE TABLE IF NOT EXISTS public.warehouse_import_jobs (
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
CREATE INDEX IF NOT EXISTS warehouse_import_jobs_tenant_idx ON public.warehouse_import_jobs (tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_import_jobs_applied_once
  ON public.warehouse_import_jobs (tenant_id, operation, file_sha256) WHERE status = 'applied';
CREATE TABLE IF NOT EXISTS public.warehouse_import_rows (
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
CREATE TABLE IF NOT EXISTS public.warehouse_audit_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id   uuid,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  details    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warehouse_audit_events_tenant_idx ON public.warehouse_audit_events (tenant_id, created_at DESC);
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
CREATE FUNCTION public.warehouse_post_document(p_tenant uuid, p_document uuid, p_actor uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_doc record; v_line record; v_type text; v_bucket text;
BEGIN
  SELECT * INTO v_doc FROM warehouse_documents WHERE id = p_document AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento no encontrado.'; END IF;
  IF v_doc.status <> 'pending_approval' THEN RAISE EXCEPTION 'El documento ya fue procesado.'; END IF;
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
  UPDATE warehouse_documents SET status = 'posted', posted_at = now(),
    decided_by = CASE WHEN doc_type = 'adjustment' THEN p_actor END,
    decided_at = CASE WHEN doc_type = 'adjustment' THEN now() END
  WHERE id = p_document;
END $$;
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
DO $$
DECLARE
  v_mock constant text := 'Tasa BCV Oficial 36,500000 VES/USD [mock]';
  v_used integer;
  v_deleted integer;
BEGIN
  SELECT count(*) INTO v_used
  FROM public.platform_invoices i
  JOIN public.platform_exchange_rates r ON r.id = i.exchange_rate_id
  WHERE r.source = v_mock;
  DELETE FROM public.platform_exchange_rates r
  WHERE r.source = v_mock
    AND NOT EXISTS (SELECT 1 FROM public.platform_invoices i WHERE i.exchange_rate_id = r.id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Tasas ficticias eliminadas: %', v_deleted;
  IF v_used > 0 THEN
    RAISE WARNING 'Hay % cobro(s) emitidos con la tasa ficticia [mock]; revísalos manualmente.', v_used;
  END IF;
END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS public.pos_tenant_settings (
  tenant_id                    uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_exchange_rate         numeric(18,6) CHECK (active_exchange_rate IS NULL OR active_exchange_rate > 0),
  exchange_rate_source         text,
  exchange_rate_api_url        text,
  auto_fetch_exchange_rate     boolean NOT NULL DEFAULT true,
  exchange_rate_updated_at     timestamptz,
  max_cashier_discount_percent numeric(5,2) NOT NULL DEFAULT 5
                               CHECK (max_cashier_discount_percent BETWEEN 0 AND 100),
  allow_partial_payments       boolean NOT NULL DEFAULT true,
  active_methods               text[] NOT NULL DEFAULT ARRAY['efectivo', 'pago_movil', 'tarjeta', 'cashea'],
  internal_doc_prefix          text NOT NULL DEFAULT 'COMP-INT-',
  require_pin_for_withdrawals  boolean NOT NULL DEFAULT true,
  next_sale_seq                bigint NOT NULL DEFAULT 1 CHECK (next_sale_seq > 0),
  next_doc_seq                 bigint NOT NULL DEFAULT 1 CHECK (next_doc_seq > 0),
  next_return_seq              bigint NOT NULL DEFAULT 1 CHECK (next_return_seq > 0),
  updated_by                   uuid,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pos_staff_pins (
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id    uuid NOT NULL,
  pin_hash        text NOT NULL CHECK (length(pin_hash) > 20),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, auth_user_id)
);
ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'pos'
    CHECK (catalog_source IN ('pos', 'warehouse')),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object');
ALTER TABLE public.pos_sale_lines
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.warehouse_items(id) ON DELETE RESTRICT;
ALTER TABLE public.pos_return_lines
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'sellable'
    CHECK (condition IN ('sellable', 'damaged'));
ALTER TABLE public.pos_sale_returns
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS pos_sale_returns_idempotency
  ON public.pos_sale_returns (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.pos_customers
  ADD COLUMN IF NOT EXISTS wallet_balance_usd numeric(18,2) NOT NULL DEFAULT 0
    CHECK (wallet_balance_usd >= 0);
ALTER TABLE public.pos_authorizations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
CREATE INDEX IF NOT EXISTS pos_sales_tenant_created_idx ON public.pos_sales (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pos_sales_shift_idx ON public.pos_sales (shift_id);
CREATE INDEX IF NOT EXISTS pos_sale_lines_sale_idx ON public.pos_sale_lines (sale_id);
CREATE INDEX IF NOT EXISTS pos_sale_payments_sale_idx ON public.pos_sale_payments (sale_id);
CREATE INDEX IF NOT EXISTS pos_shifts_tenant_idx ON public.pos_shifts (tenant_id, opened_at DESC);
ALTER TABLE public.pos_tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_staff_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_tenant_settings, public.pos_staff_pins FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.pos_bump_expected(p_shift uuid, p_key text, p_delta numeric)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  UPDATE pos_shifts
     SET expected_totals = jsonb_set(
           expected_totals, ARRAY[p_key],
           to_jsonb(round(coalesce((expected_totals->>p_key)::numeric, 0) + p_delta, 2)))
   WHERE id = p_shift;
$$;
CREATE OR REPLACE FUNCTION public.pos_audit(
  p_tenant uuid, p_branch uuid, p_shift uuid, p_actor uuid, p_event text,
  p_entity text, p_entity_id text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  INSERT INTO pos_audit_events (tenant_id, branch_id, shift_id, actor_id, event_type, entity_type,
                                entity_id, description, metadata)
  VALUES (p_tenant, p_branch, p_shift, p_actor, p_event, p_entity, p_entity_id, p_description,
          coalesce(p_metadata, '{}'::jsonb));
$$;
CREATE OR REPLACE FUNCTION public.pos_open_shift(
  p_tenant uuid, p_actor uuid, p_branch uuid, p_register uuid, p_cashier_name text,
  p_opening_usd numeric, p_opening_ves numeric, p_notes text
) RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Falta el usuario que abre el turno.'; END IF;
  IF coalesce(p_opening_usd, -1) < 0 OR coalesce(p_opening_ves, -1) < 0 THEN
    RAISE EXCEPTION 'Los montos de fondo inicial deben ser iguales o mayores a 0.';
  END IF;
  PERFORM 1 FROM pos_registers
    WHERE id = p_register AND tenant_id = p_tenant AND branch_id = p_branch AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'La caja no existe, no pertenece a la sede o no está activa.'; END IF;
  PERFORM 1 FROM pos_shifts WHERE tenant_id = p_tenant AND cashier_user_id = p_actor AND status = 'abierto';
  IF FOUND THEN RAISE EXCEPTION 'Ya tienes un turno abierto en otra caja. Ciérralo antes de abrir uno nuevo.'; END IF;
  BEGIN
    INSERT INTO pos_shifts (tenant_id, branch_id, register_id, cashier_user_id, cashier_name_snapshot,
                            opening_amount_usd, opening_amount_ves, opening_notes, expected_totals)
    VALUES (p_tenant, p_branch, p_register, p_actor, nullif(trim(p_cashier_name), ''),
            p_opening_usd, p_opening_ves, nullif(trim(p_notes), ''),
            jsonb_build_object('efectivo_usd', round(p_opening_usd, 2), 'efectivo_ves', round(p_opening_ves, 2),
                               'pago_movil_ves', 0, 'tarjeta_ves', 0, 'cashea_usd', 0))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'La caja seleccionada ya tiene un turno abierto. No se permiten dos turnos simultáneos en la misma caja.';
  END;
  PERFORM pos_audit(p_tenant, p_branch, v_id, p_actor, 'apertura_turno', 'pos_shifts', v_id::text,
    'Apertura de turno para ' || coalesce(nullif(trim(p_cashier_name), ''), 'cajero'),
    jsonb_build_object('opening_usd', p_opening_usd, 'opening_ves', p_opening_ves));
  RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.pos_add_cash_movement(
  p_tenant uuid, p_actor uuid, p_shift uuid, p_type text, p_currency text,
  p_amount numeric, p_reason text, p_authorization uuid
) RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_shift record; v_id uuid; v_key text; v_delta numeric;
BEGIN
  SELECT * INTO v_shift FROM pos_shifts WHERE id = p_shift AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN RAISE EXCEPTION 'El turno no existe o se encuentra cerrado.'; END IF;
  IF p_type NOT IN ('ingreso_efectivo', 'retiro_efectivo', 'ajuste_caja', 'cambio_saldo_inicial') THEN
    RAISE EXCEPTION 'Tipo de movimiento de caja inválido.';
  END IF;
  IF p_currency NOT IN ('USD', 'VES') THEN RAISE EXCEPTION 'Moneda inválida.'; END IF;
  IF coalesce(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a 0.'; END IF;
  IF length(trim(coalesce(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Indica el motivo del movimiento.'; END IF;
  v_key := CASE p_currency WHEN 'USD' THEN 'efectivo_usd' ELSE 'efectivo_ves' END;
  v_delta := CASE p_type WHEN 'retiro_efectivo' THEN -p_amount ELSE p_amount END;
  IF coalesce((v_shift.expected_totals->>v_key)::numeric, 0) + v_delta < 0 THEN
    RAISE EXCEPTION 'El retiro excede el efectivo esperado en caja.';
  END IF;
  INSERT INTO pos_cash_movements (tenant_id, branch_id, shift_id, movement_type, currency, amount,
                                  reason, performed_by, authorization_id)
  VALUES (p_tenant, v_shift.branch_id, p_shift, p_type, p_currency, p_amount, trim(p_reason), p_actor, p_authorization)
  RETURNING id INTO v_id;
  PERFORM pos_bump_expected(p_shift, v_key, v_delta);
  PERFORM pos_audit(p_tenant, v_shift.branch_id, p_shift, p_actor, 'movimiento_caja', 'pos_cash_movements', v_id::text,
    p_type || ' de ' || p_amount || ' ' || p_currency || ': ' || trim(p_reason), '{}'::jsonb);
  RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.pos_close_shift(
  p_tenant uuid, p_actor uuid, p_shift uuid, p_declared jsonb, p_justification text
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_shift record; v_key text; v_diff numeric; v_diffs jsonb := '{}'::jsonb; v_has_diff boolean := false;
BEGIN
  SELECT * INTO v_shift FROM pos_shifts WHERE id = p_shift AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El turno de caja especificado no existe.'; END IF;
  IF v_shift.status = 'cerrado' THEN RAISE EXCEPTION 'El turno ya se encuentra cerrado.'; END IF;
  FOREACH v_key IN ARRAY ARRAY['efectivo_usd', 'efectivo_ves', 'pago_movil_ves', 'tarjeta_ves', 'cashea_usd'] LOOP
    v_diff := round(coalesce((p_declared->>v_key)::numeric, 0) - coalesce((v_shift.expected_totals->>v_key)::numeric, 0), 2);
    v_diffs := v_diffs || jsonb_build_object(v_key, v_diff);
    IF v_diff <> 0 THEN v_has_diff := true; END IF;
  END LOOP;
  IF v_has_diff AND length(trim(coalesce(p_justification, ''))) < 5 THEN
    RAISE EXCEPTION 'Diferencia detectada en el arqueo: ingresa una justificación de al menos 5 caracteres.';
  END IF;
  UPDATE pos_shifts
     SET status = 'cerrado', closed_at = now(), closed_by = p_actor,
         declared_totals = coalesce(p_declared, '{}'::jsonb), differences_totals = v_diffs,
         closing_justification = nullif(trim(p_justification), '')
   WHERE id = p_shift;
  PERFORM pos_audit(p_tenant, v_shift.branch_id, p_shift, p_actor, 'cierre_turno', 'pos_shifts', p_shift::text,
    'Cierre de turno con arqueo', jsonb_build_object('expected', v_shift.expected_totals,
      'declared', p_declared, 'differences', v_diffs));
  RETURN v_diffs;
END $$;
CREATE OR REPLACE FUNCTION public.pos_record_sale(p_tenant uuid, p_actor uuid, p_sale jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_key text := nullif(trim(p_sale->>'idempotency_key'), '');
  v_source text := coalesce(p_sale->>'catalog_source', 'pos');
  v_existing record; v_shift record; v_cfg record; v_customer uuid; v_auth uuid;
  v_sale_id uuid; v_sale_number text; v_doc_number text; v_rate numeric;
  v_line jsonb; v_pay jsonb; v_prod record; v_stock_lines jsonb := '[]'::jsonb;
  v_amount numeric; v_wallet_used numeric; v_wallet_dep numeric; v_new_stock numeric;
BEGIN
  IF v_key IS NULL THEN RAISE EXCEPTION 'Falta la clave de idempotencia de la venta.'; END IF;
  SELECT id, sale_number, document_number INTO v_existing
    FROM pos_sales WHERE tenant_id = p_tenant AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('sale_id', v_existing.id, 'sale_number', v_existing.sale_number,
                              'document_number', v_existing.document_number, 'replay', true);
  END IF;
  IF v_source NOT IN ('pos', 'warehouse') THEN RAISE EXCEPTION 'Origen de catálogo inválido.'; END IF;
  IF jsonb_array_length(coalesce(p_sale->'lines', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene productos.';
  END IF;
  v_rate := (p_sale->>'exchange_rate')::numeric;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'No hay una tasa de cambio válida configurada.'; END IF;
  SELECT * INTO v_shift FROM pos_shifts
    WHERE id = (p_sale->>'shift_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN
    RAISE EXCEPTION 'El turno de caja especificado no existe o se encuentra cerrado.';
  END IF;
  IF v_shift.cashier_user_id <> p_actor THEN
    RAISE EXCEPTION 'El turno pertenece a otro cajero.';
  END IF;
  IF nullif(p_sale->>'customer_id', '') IS NOT NULL THEN
    SELECT id INTO v_customer FROM pos_customers
      WHERE id = (p_sale->>'customer_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente no encontrado.'; END IF;
  END IF;
  IF nullif(p_sale->>'discount_authorization_id', '') IS NOT NULL THEN
    UPDATE pos_authorizations SET consumed_at = now()
     WHERE id = (p_sale->>'discount_authorization_id')::uuid AND tenant_id = p_tenant
       AND operation_type = 'discount_override' AND consumed_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
    RETURNING id INTO v_auth;
    IF v_auth IS NULL THEN RAISE EXCEPTION 'La autorización de descuento no es válida o ya fue usada.'; END IF;
  END IF;
  INSERT INTO pos_tenant_settings (tenant_id) VALUES (p_tenant) ON CONFLICT (tenant_id) DO NOTHING;
  UPDATE pos_tenant_settings
     SET next_sale_seq = next_sale_seq + 1, next_doc_seq = next_doc_seq + 1
   WHERE tenant_id = p_tenant
  RETURNING next_sale_seq - 1 AS sale_seq, next_doc_seq - 1 AS doc_seq, internal_doc_prefix INTO v_cfg;
  v_sale_number := 'VTA-' || lpad(v_cfg.sale_seq::text, 7, '0');
  v_doc_number := v_cfg.internal_doc_prefix || lpad(v_cfg.doc_seq::text, 6, '0');
  INSERT INTO pos_sales (
    tenant_id, branch_id, shift_id, register_id, cashier_user_id, customer_id, sale_number,
    commercial_status, payment_status, currency, exchange_rate_snapshot, subtotal_usd,
    discount_total_usd, tax_total_usd, total_usd, total_ves, paid_total_usd, paid_total_ves,
    balance_due_usd, balance_due_ves, notes, discount_authorization_id, idempotency_key,
    correlation_id, confirmed_at, document_number, catalog_source, metadata)
  VALUES (
    p_tenant, v_shift.branch_id, v_shift.id, v_shift.register_id, p_actor, v_customer, v_sale_number,
    'confirmada', coalesce(p_sale->>'payment_status', 'pagada'), 'USD', v_rate,
    (p_sale->>'subtotal_usd')::numeric, (p_sale->>'discount_total_usd')::numeric,
    (p_sale->>'tax_total_usd')::numeric, (p_sale->>'total_usd')::numeric, (p_sale->>'total_ves')::numeric,
    (p_sale->>'paid_total_usd')::numeric, (p_sale->>'paid_total_ves')::numeric,
    (p_sale->>'balance_due_usd')::numeric, (p_sale->>'balance_due_ves')::numeric,
    nullif(trim(p_sale->>'notes'), ''), v_auth, v_key,
    coalesce(nullif(p_sale->>'correlation_id', ''), gen_random_uuid()::text), now(), v_doc_number,
    v_source, coalesce(p_sale->'metadata', '{}'::jsonb))
  RETURNING id INTO v_sale_id;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_sale->'lines') LOOP
    IF coalesce((v_line->>'quantity')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'Cantidad inválida en la venta.'; END IF;
    IF v_source = 'warehouse' THEN
      PERFORM 1 FROM warehouse_items WHERE id = (v_line->>'item_id')::uuid AND tenant_id = p_tenant;
    ELSE
      PERFORM 1 FROM pos_products WHERE id = (v_line->>'product_id')::uuid AND tenant_id = p_tenant;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto % no encontrado en el catálogo.', v_line->>'sku'; END IF;
    INSERT INTO pos_sale_lines (
      tenant_id, sale_id, product_id, item_id, sku_snapshot, name_snapshot, is_service, quantity,
      unit_price_usd, discount_percent, discount_amount_usd, tax_rate_percent, tax_amount_usd,
      line_subtotal_usd, line_total_usd)
    VALUES (
      p_tenant, v_sale_id,
      CASE WHEN v_source = 'pos' THEN (v_line->>'product_id')::uuid END,
      CASE WHEN v_source = 'warehouse' THEN (v_line->>'item_id')::uuid END,
      v_line->>'sku', v_line->>'name', coalesce((v_line->>'is_service')::boolean, false),
      (v_line->>'quantity')::numeric, (v_line->>'unit_price_usd')::numeric,
      coalesce((v_line->>'discount_percent')::numeric, 0), coalesce((v_line->>'discount_amount_usd')::numeric, 0),
      coalesce((v_line->>'tax_rate_percent')::numeric, 0), coalesce((v_line->>'tax_amount_usd')::numeric, 0),
      (v_line->>'line_subtotal_usd')::numeric, (v_line->>'line_total_usd')::numeric);
    IF NOT coalesce((v_line->>'is_service')::boolean, false) THEN
      IF v_source = 'warehouse' THEN
        v_stock_lines := v_stock_lines || jsonb_build_array(jsonb_build_object(
          'sku', v_line->>'sku', 'quantity', (v_line->>'quantity')::numeric));
      ELSIF coalesce((p_sale->>'track_stock')::boolean, true) THEN
        SELECT * INTO v_prod FROM pos_products WHERE id = (v_line->>'product_id')::uuid FOR UPDATE;
        v_new_stock := v_prod.stock_quantity - (v_line->>'quantity')::numeric;
        IF v_new_stock < 0 AND coalesce(p_sale->>'stock_policy', 'strict_block') = 'strict_block' THEN
          RAISE EXCEPTION 'Stock insuficiente para % (disponible: %).', v_prod.sku, v_prod.stock_quantity;
        END IF;
        UPDATE pos_products
           SET stock_quantity = v_new_stock, updated_at = now(),
               status = CASE WHEN status = 'descontinuado' THEN status
                             WHEN v_new_stock <= 0 THEN 'agotado' ELSE 'disponible' END
         WHERE id = v_prod.id;
        INSERT INTO pos_inventory_kardex (tenant_id, branch_id, product_id, movement_type, reference_id,
                                          quantity_delta, stock_before, stock_after, actor_id)
        VALUES (p_tenant, v_shift.branch_id, v_prod.id, 'venta_pos', v_sale_id,
                -(v_line->>'quantity')::numeric, v_prod.stock_quantity, v_new_stock, p_actor);
      END IF;
    END IF;
  END LOOP;
  FOR v_pay IN SELECT value FROM jsonb_array_elements(coalesce(p_sale->'payments', '[]'::jsonb)) LOOP
    INSERT INTO pos_sale_payments (
      tenant_id, branch_id, sale_id, shift_id, method, currency, amount_received, amount_applied,
      change_amount, change_currency, exchange_rate_snapshot, reference_number, bank_code, bank_name,
      payer_phone, payer_document, terminal_id, card_last4, approval_code, cashea_operation_id,
      cashea_merchant_amount, provider_status, verified_by, verified_at)
    VALUES (
      p_tenant, v_shift.branch_id, v_sale_id, v_shift.id, v_pay->>'method', v_pay->>'currency',
      (v_pay->>'amount_received')::numeric, (v_pay->>'amount_applied')::numeric,
      coalesce((v_pay->>'change_amount')::numeric, 0), nullif(v_pay->>'change_currency', ''), v_rate,
      nullif(v_pay->>'reference_number', ''), nullif(v_pay->>'bank_code', ''), nullif(v_pay->>'bank_name', ''),
      nullif(v_pay->>'payer_phone', ''), nullif(v_pay->>'payer_document', ''), nullif(v_pay->>'terminal_id', ''),
      nullif(v_pay->>'card_last4', ''), nullif(v_pay->>'approval_code', ''),
      nullif(v_pay->>'cashea_operation_id', ''), (v_pay->>'cashea_merchant_amount')::numeric,
      coalesce(v_pay->>'provider_status', 'registrado'),
      CASE WHEN v_pay->>'provider_status' = 'verificado' THEN p_actor END,
      CASE WHEN v_pay->>'provider_status' = 'verificado' THEN now() END);
    v_amount := (v_pay->>'amount_applied')::numeric;
    CASE v_pay->>'method'
      WHEN 'efectivo' THEN
        PERFORM pos_bump_expected(v_shift.id,
          CASE v_pay->>'currency' WHEN 'USD' THEN 'efectivo_usd' ELSE 'efectivo_ves' END,
          v_amount - coalesce((v_pay->>'change_amount')::numeric, 0));
      WHEN 'pago_movil' THEN PERFORM pos_bump_expected(v_shift.id, 'pago_movil_ves', v_amount);
      WHEN 'tarjeta' THEN PERFORM pos_bump_expected(v_shift.id, 'tarjeta_ves', v_amount);
      WHEN 'cashea' THEN
        PERFORM pos_bump_expected(v_shift.id, 'cashea_usd',
          CASE v_pay->>'currency' WHEN 'USD' THEN v_amount ELSE v_amount / v_rate END);
      ELSE RAISE EXCEPTION 'Método de pago inválido.';
    END CASE;
  END LOOP;
  v_wallet_used := coalesce((p_sale->>'wallet_used_usd')::numeric, 0);
  v_wallet_dep := coalesce((p_sale->>'wallet_deposited_usd')::numeric, 0);
  IF v_customer IS NOT NULL THEN
    UPDATE pos_customers
       SET total_purchases_count = total_purchases_count + 1,
           total_purchases_usd = total_purchases_usd + (p_sale->>'total_usd')::numeric,
           last_purchase_at = now(), updated_at = now(),
           wallet_balance_usd = wallet_balance_usd - v_wallet_used + v_wallet_dep
     WHERE id = v_customer;
  ELSIF v_wallet_used > 0 OR v_wallet_dep > 0 THEN
    RAISE EXCEPTION 'El monedero requiere un cliente identificado.';
  END IF;
  INSERT INTO pos_commercial_documents (tenant_id, sale_id, internal_number)
  VALUES (p_tenant, v_sale_id, v_doc_number);
  IF v_source = 'warehouse' AND coalesce((p_sale->>'track_stock')::boolean, false)
     AND jsonb_array_length(v_stock_lines) > 0 THEN
    PERFORM warehouse_register_pos_event(p_tenant, p_actor, jsonb_build_object(
      'kind', 'sale', 'reference', v_sale_number,
      'warehouse_id', nullif(p_sale->>'warehouse_id', ''), 'lines', v_stock_lines));
  END IF;
  PERFORM pos_audit(p_tenant, v_shift.branch_id, v_shift.id, p_actor, 'venta_confirmada', 'pos_sales',
    v_sale_id::text, 'Venta ' || v_sale_number || ' confirmada. Comprobante ' || v_doc_number,
    jsonb_build_object('total_usd', p_sale->'total_usd', 'catalog_source', v_source));
  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number,
                            'document_number', v_doc_number, 'replay', false);
END $$;
CREATE OR REPLACE FUNCTION public.pos_record_return(p_tenant uuid, p_actor uuid, p_return jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_key text := nullif(trim(p_return->>'idempotency_key'), '');
  v_existing record; v_sale record; v_shift record; v_line jsonb; v_sl record; v_prod record;
  v_ret_id uuid; v_ret_number text; v_seq bigint; v_qty numeric; v_refund numeric; v_total numeric := 0;
  v_total_ves numeric; v_cond text; v_type text := p_return->>'return_type';
  v_method text := p_return->>'refund_method'; v_wh uuid; v_pending boolean; v_track boolean;
  v_restock jsonb := '[]'::jsonb; v_cash_amount numeric; v_cash_available numeric;
BEGIN
  IF v_key IS NOT NULL THEN
    SELECT id, return_number INTO v_existing FROM pos_sale_returns
      WHERE tenant_id = p_tenant AND idempotency_key = v_key;
    IF FOUND THEN
      RETURN jsonb_build_object('return_id', v_existing.id, 'return_number', v_existing.return_number, 'replay', true);
    END IF;
  END IF;
  IF v_type NOT IN ('anulacion_total', 'devolucion_parcial', 'devolucion_total') THEN
    RAISE EXCEPTION 'Tipo de devolución inválido.';
  END IF;
  IF v_method NOT IN ('efectivo_usd', 'efectivo_ves', 'reverso_electronico', 'nota_credito_interna') THEN
    RAISE EXCEPTION 'Método de reembolso inválido.';
  END IF;
  IF length(trim(coalesce(p_return->>'reason', ''))) = 0 THEN RAISE EXCEPTION 'Indica el motivo de la devolución.'; END IF;
  IF nullif(p_return->>'approved_by', '') IS NULL THEN RAISE EXCEPTION 'La devolución requiere un aprobador.'; END IF;
  SELECT * INTO v_sale FROM pos_sales
    WHERE id = (p_return->>'original_sale_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta de referencia no encontrada.'; END IF;
  IF v_sale.commercial_status IN ('anulada', 'devuelta') THEN
    RAISE EXCEPTION 'La venta ya se encuentra completamente anulada o devuelta.';
  END IF;
  SELECT * INTO v_shift FROM pos_shifts
    WHERE id = (p_return->>'shift_id')::uuid AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN
    RAISE EXCEPTION 'Las devoluciones se registran en un turno abierto.';
  END IF;
  IF v_shift.cashier_user_id <> p_actor THEN RAISE EXCEPTION 'El turno pertenece a otro cajero.'; END IF;
  INSERT INTO pos_tenant_settings (tenant_id) VALUES (p_tenant) ON CONFLICT (tenant_id) DO NOTHING;
  UPDATE pos_tenant_settings SET next_return_seq = next_return_seq + 1
   WHERE tenant_id = p_tenant RETURNING next_return_seq - 1 INTO v_seq;
  v_ret_number := 'DEV-' || lpad(v_seq::text, 7, '0');
  INSERT INTO pos_sale_returns (
    tenant_id, branch_id, original_sale_id, shift_id, return_number, return_type, reason, notes,
    requested_by, approved_by, authorization_id, refund_method, idempotency_key,
    stock_reversal_reference, financial_reversal_reference)
  VALUES (
    p_tenant, v_shift.branch_id, v_sale.id, v_shift.id, v_ret_number, v_type, trim(p_return->>'reason'),
    nullif(trim(p_return->>'notes'), ''), p_actor, (p_return->>'approved_by')::uuid,
    nullif(p_return->>'authorization_id', '')::uuid, v_method, v_key,
    'KARDEX-REV-' || v_ret_number, 'CAJA-REV-' || v_ret_number)
  RETURNING id INTO v_ret_id;
  v_track := coalesce((p_return->>'track_stock')::boolean, false);
  FOR v_line IN SELECT value FROM jsonb_array_elements(coalesce(p_return->'lines', '[]'::jsonb))
                ORDER BY value->>'sale_line_id' LOOP
    v_qty := (v_line->>'quantity')::numeric;
    v_cond := coalesce(v_line->>'condition', 'sellable');
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Cantidad a devolver inválida.'; END IF;
    IF v_cond NOT IN ('sellable', 'damaged') THEN RAISE EXCEPTION 'Condición de devolución inválida.'; END IF;
    SELECT * INTO v_sl FROM pos_sale_lines
      WHERE id = (v_line->>'sale_line_id')::uuid AND sale_id = v_sale.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Línea de venta no encontrada.'; END IF;
    IF v_sl.returned_quantity + v_qty > v_sl.quantity THEN
      RAISE EXCEPTION 'La cantidad a devolver de % excede el remanente disponible.', v_sl.sku_snapshot;
    END IF;
    v_refund := round(v_sl.line_total_usd / v_sl.quantity * v_qty, 2);
    v_total := v_total + v_refund;
    UPDATE pos_sale_lines SET returned_quantity = returned_quantity + v_qty WHERE id = v_sl.id;
    INSERT INTO pos_return_lines (tenant_id, return_id, sale_line_id, product_id, item_id, quantity_returned,
                                  refund_amount_usd, refund_amount_ves, condition)
    VALUES (p_tenant, v_ret_id, v_sl.id, v_sl.product_id, v_sl.item_id, v_qty, v_refund,
            round(v_refund * v_sale.exchange_rate_snapshot, 2), v_cond);
    IF NOT v_sl.is_service AND v_track THEN
      IF v_sale.catalog_source = 'warehouse' AND v_sl.item_id IS NOT NULL THEN
        IF v_cond = 'sellable' THEN
          v_restock := v_restock || jsonb_build_array(jsonb_build_object('sku', v_sl.sku_snapshot, 'quantity', v_qty));
        ELSE
          v_wh := coalesce(nullif(p_return->>'warehouse_id', '')::uuid,
                           (SELECT default_warehouse_id FROM warehouse_settings WHERE tenant_id = p_tenant));
          IF v_wh IS NULL THEN RAISE EXCEPTION 'No hay almacén predeterminado para el POS.'; END IF;
          PERFORM 1 FROM warehouse_items WHERE id = v_sl.item_id AND track_stock;
          IF FOUND THEN
            PERFORM warehouse_apply_movement(p_tenant, v_sl.item_id, v_wh, 'return_damaged', v_qty, NULL,
              'damaged', NULL, 'pos', v_ret_number, trim(p_return->>'reason'),
              'pos:return-damaged:' || v_ret_number || ':' || v_sl.id, p_actor);
          END IF;
        END IF;
      ELSIF v_sale.catalog_source = 'pos' AND v_sl.product_id IS NOT NULL AND v_cond = 'sellable' THEN
        SELECT * INTO v_prod FROM pos_products WHERE id = v_sl.product_id FOR UPDATE;
        UPDATE pos_products
           SET stock_quantity = stock_quantity + v_qty, updated_at = now(),
               status = CASE WHEN status = 'descontinuado' THEN status ELSE 'disponible' END
         WHERE id = v_prod.id;
        INSERT INTO pos_inventory_kardex (tenant_id, branch_id, product_id, movement_type, reference_id,
                                          quantity_delta, stock_before, stock_after, actor_id)
        VALUES (p_tenant, v_shift.branch_id, v_prod.id, 'reverso_devolucion', v_ret_id, v_qty,
                v_prod.stock_quantity, v_prod.stock_quantity + v_qty, p_actor);
      END IF;
    END IF;
  END LOOP;
  IF v_total = 0 THEN RAISE EXCEPTION 'Selecciona al menos un producto y cantidad para devolver.'; END IF;
  IF jsonb_array_length(v_restock) > 0 THEN
    PERFORM warehouse_register_pos_event(p_tenant, p_actor, jsonb_build_object(
      'kind', 'return', 'reference', v_ret_number,
      'warehouse_id', nullif(p_return->>'warehouse_id', ''), 'lines', v_restock));
  END IF;
  v_total_ves := round(v_total * v_sale.exchange_rate_snapshot, 2);
  UPDATE pos_sale_returns SET total_refunded_usd = v_total, total_refunded_ves = v_total_ves WHERE id = v_ret_id;
  SELECT bool_or(returned_quantity < quantity) INTO v_pending FROM pos_sale_lines WHERE sale_id = v_sale.id;
  UPDATE pos_sales
     SET commercial_status = CASE WHEN v_type = 'anulacion_total' THEN 'anulada'
                                  WHEN coalesce(v_pending, false) THEN 'parcialmente_devuelta'
                                  ELSE 'devuelta' END,
         payment_status = CASE WHEN v_type = 'anulacion_total' OR NOT coalesce(v_pending, false)
                               THEN 'reversada' ELSE payment_status END
   WHERE id = v_sale.id;
  IF v_method IN ('efectivo_usd', 'efectivo_ves') THEN
    v_cash_amount := CASE WHEN v_method = 'efectivo_usd' THEN v_total ELSE v_total_ves END;
    SELECT coalesce((expected_totals->>v_method)::numeric, 0) INTO v_cash_available
      FROM pos_shifts WHERE id = v_shift.id;
    IF v_cash_available < v_cash_amount THEN
      RAISE EXCEPTION 'No hay efectivo suficiente en caja para el reembolso.';
    END IF;
    PERFORM pos_bump_expected(v_shift.id, v_method, -v_cash_amount);
  END IF;
  PERFORM pos_audit(p_tenant, v_shift.branch_id, v_shift.id, p_actor, 'devolucion_reverso', 'pos_sale_returns',
    v_ret_id::text, 'Devolución ' || v_ret_number || ' de la venta ' || v_sale.sale_number,
    jsonb_build_object('total_usd', v_total, 'method', v_method, 'approved_by', p_return->>'approved_by'));
  RETURN jsonb_build_object('return_id', v_ret_id, 'return_number', v_ret_number, 'replay', false);
END $$;
CREATE OR REPLACE FUNCTION public.pos_record_debt_payment(
  p_tenant uuid, p_actor uuid, p_sale uuid, p_shift uuid, p_payment jsonb
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_sale record; v_shift record; v_amount numeric := (p_payment->>'amount')::numeric;
  v_currency text := p_payment->>'currency'; v_method text := p_payment->>'method';
  v_usd numeric; v_applied_usd numeric; v_applied numeric; v_key text := nullif(trim(p_payment->>'idempotency_key'), '');
BEGIN
  IF v_method NOT IN ('efectivo', 'pago_movil', 'tarjeta') THEN RAISE EXCEPTION 'Método de abono inválido.'; END IF;
  IF v_currency NOT IN ('USD', 'VES') THEN RAISE EXCEPTION 'Moneda inválida.'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'El monto del abono debe ser mayor a 0.'; END IF;
  IF v_key IS NOT NULL THEN
    PERFORM 1 FROM pos_audit_events WHERE tenant_id = p_tenant AND correlation_id = 'abono:' || v_key;
    IF FOUND THEN RETURN jsonb_build_object('sale_id', p_sale, 'replay', true); END IF;
  END IF;
  SELECT * INTO v_sale FROM pos_sales WHERE id = p_sale AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada.'; END IF;
  IF v_sale.commercial_status IN ('anulada', 'devuelta') THEN RAISE EXCEPTION 'La venta está anulada o devuelta.'; END IF;
  IF v_sale.balance_due_usd <= 0 THEN RAISE EXCEPTION 'Esta venta ya se encuentra totalmente saldada.'; END IF;
  SELECT * INTO v_shift FROM pos_shifts WHERE id = p_shift AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND OR v_shift.status <> 'abierto' THEN RAISE EXCEPTION 'Los abonos se registran en un turno abierto.'; END IF;
  IF v_shift.cashier_user_id <> p_actor THEN RAISE EXCEPTION 'El turno pertenece a otro cajero.'; END IF;
  v_usd := CASE v_currency WHEN 'USD' THEN v_amount ELSE v_amount / v_sale.exchange_rate_snapshot END;
  v_applied_usd := round(least(v_usd, v_sale.balance_due_usd), 2);
  v_applied := CASE v_currency WHEN 'USD' THEN v_applied_usd
                               ELSE round(v_applied_usd * v_sale.exchange_rate_snapshot, 2) END;
  INSERT INTO pos_sale_payments (tenant_id, branch_id, sale_id, shift_id, method, currency, amount_received,
                                 amount_applied, change_amount, exchange_rate_snapshot, reference_number,
                                 provider_status, verified_by, verified_at)
  VALUES (p_tenant, v_shift.branch_id, v_sale.id, v_shift.id, v_method, v_currency, v_amount, v_applied,
          greatest(v_amount - v_applied, 0), v_sale.exchange_rate_snapshot,
          nullif(p_payment->>'reference_number', ''), 'verificado', p_actor, now());
  UPDATE pos_sales
     SET paid_total_usd = paid_total_usd + v_applied_usd,
         paid_total_ves = round(paid_total_ves + v_applied_usd * exchange_rate_snapshot, 2),
         balance_due_usd = greatest(round(balance_due_usd - v_applied_usd, 2), 0),
         balance_due_ves = greatest(round((balance_due_usd - v_applied_usd) * exchange_rate_snapshot, 2), 0),
         payment_status = CASE WHEN balance_due_usd - v_applied_usd <= 0.05 THEN 'pagada' ELSE 'parcial' END
   WHERE id = v_sale.id;
  CASE v_method
    WHEN 'efectivo' THEN
      PERFORM pos_bump_expected(v_shift.id, CASE v_currency WHEN 'USD' THEN 'efectivo_usd' ELSE 'efectivo_ves' END, v_applied);
    WHEN 'pago_movil' THEN PERFORM pos_bump_expected(v_shift.id, 'pago_movil_ves',
      CASE v_currency WHEN 'VES' THEN v_applied ELSE round(v_applied * v_sale.exchange_rate_snapshot, 2) END);
    WHEN 'tarjeta' THEN PERFORM pos_bump_expected(v_shift.id, 'tarjeta_ves',
      CASE v_currency WHEN 'VES' THEN v_applied ELSE round(v_applied * v_sale.exchange_rate_snapshot, 2) END);
  END CASE;
  INSERT INTO pos_audit_events (tenant_id, branch_id, shift_id, actor_id, event_type, entity_type, entity_id,
                                description, metadata, correlation_id)
  VALUES (p_tenant, v_shift.branch_id, v_shift.id, p_actor, 'abono_credito', 'pos_sales', v_sale.id::text,
          'Abono de ' || v_applied_usd || ' USD a la venta ' || v_sale.sale_number,
          jsonb_build_object('method', v_method, 'currency', v_currency, 'amount', v_amount),
          CASE WHEN v_key IS NOT NULL THEN 'abono:' || v_key END);
  RETURN jsonb_build_object('sale_id', v_sale.id, 'applied_usd', v_applied_usd, 'replay', false);
END $$;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pos_bump_expected(uuid,text,numeric)',
    'pos_audit(uuid,uuid,uuid,uuid,text,text,text,text,jsonb)',
    'pos_open_shift(uuid,uuid,uuid,uuid,text,numeric,numeric,text)',
    'pos_add_cash_movement(uuid,uuid,uuid,text,text,numeric,text,uuid)',
    'pos_close_shift(uuid,uuid,uuid,jsonb,text)',
    'pos_record_sale(uuid,uuid,jsonb)',
    'pos_record_return(uuid,uuid,jsonb)',
    'pos_record_debt_payment(uuid,uuid,uuid,uuid,jsonb)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
COMMIT;
BEGIN;
CREATE TABLE IF NOT EXISTS public.tenant_role_matrix (
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key    text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_key)
);
CREATE TABLE IF NOT EXISTS public.warehouse_user_scopes (
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouse_warehouses(id) ON DELETE CASCADE,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, auth_user_id, warehouse_id)
);
INSERT INTO public.role_permissions (role_key, permission, scope)
VALUES ('wh_manager', 'stock.transfer', 'tenant'),
       ('wh_supervisor', 'stock.transfer', 'tenant'),
       ('wh_clerk', 'stock.transfer', 'tenant')
ON CONFLICT (role_key, permission) DO NOTHING;
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
ALTER TABLE public.warehouse_documents
  ADD COLUMN IF NOT EXISTS evidence_path text
    CHECK (evidence_path IS NULL OR evidence_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]{1,200}$');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('warehouse-evidence', 'warehouse-evidence', false, 5242880,
            ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
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
