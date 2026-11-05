export type CommercialStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
export type TechnicalStatus = 'pending_setup' | 'ready' | 'error';
export type ConnectionStatus =
  'not_configured' | 'checking' | 'connected' | 'error';
export type ImplementationStatus = 'implemented' | 'planned' | 'unavailable';
export type FeatureConfigState =
  'enabled' | 'pending_config' | 'configured' | 'operational';
export type ReleaseStatus =
  | 'planned'
  | 'in_development'
  | 'released_for_testing'
  | 'accepted'
  | 'accepted_with_pending';
export type DomainType = 'subdomain' | 'custom';
export type DomainVerification = 'pending' | 'verified' | 'failed';

export interface BusinessTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  suggested_features: string[];
}

export interface Feature {
  key: string;
  name: string;
  description: string;
  category: string;
  dependencies: string[];
  implementation_status: ImplementationStatus;
  sort_order: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  limits: Record<string, number | string>;
  is_active: boolean;
}

export interface Tenant {
  id: string;
  commercial_name: string;
  legal_name: string | null;
  tax_id?: string | null;
  slug: string;
  commercial_status: CommercialStatus;
  technical_status: TechnicalStatus;
  country: string | null;
  currency: string;
  language: string;
  timezone: string;
  business_template_id: string | null;
  plan_id: string | null;
  wizard_step: number;
  wizard_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantBranding {
  id: string;
  tenant_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  login_background_color: string;
  banner_url: string | null;
}

export interface TenantDatabase {
  id: string;
  tenant_id: string;
  provider: string;
  project_ref: string | null;
  supabase_url: string | null;
  secret_ref: string | null;
  connection_status: ConnectionStatus;
  schema_version: string | null;
  expected_tenant_id: string | null;
  last_checked_at: string | null;
  error_message: string | null;
}

export interface TenantDomain {
  id: string;
  tenant_id: string;
  hostname: string;
  domain_type: DomainType;
  verification_status: DomainVerification;
  is_primary: boolean;
}

export interface TenantFeature {
  id: string;
  tenant_id: string;
  feature_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  config_state: FeatureConfigState;
  release_status: ReleaseStatus;
}

export interface PlatformRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: string;
}

export interface PlatformUserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  auth_user_id: string;
  role: string;
  status: string;
  created_at: string;
}

export interface DemoRequest {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  phone: string | null;
  interest: string | null;
  consent: boolean;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  tenant_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  correlation_id: string | null;
  created_at: string;
}


/* -------------------------------------------------------------------------- */
/*  VORA POS (commerce.pos) Entities & Interfaces                             */
/* -------------------------------------------------------------------------- */

export type PosRegisterStatus = 'active' | 'inactive' | 'maintenance';
export type PosShiftStatus = 'abierto' | 'cerrado';
export type PosMovementType = 'ingreso_efectivo' | 'retiro_efectivo' | 'ajuste_caja' | 'cambio_saldo_inicial';
export type PosProductStatus = 'disponible' | 'agotado' | 'descontinuado';
export type PosCustomerTier = 'frecuente' | 'nuevo' | 'consumidor_final';
export type PosOperationType = 'discount_override' | 'sale_void' | 'sale_return' | 'cash_movement';
export type PosCommercialStatus = 'borrador' | 'confirmada' | 'anulada' | 'parcialmente_devuelta' | 'devuelta';
export type PosPaymentStatus = 'pendiente' | 'parcial' | 'pagada' | 'reversada';
export type PosPaymentMethod = 'efectivo' | 'pago_movil' | 'tarjeta' | 'cashea';
export type PosProviderStatus = 'registrado' | 'pendiente_verificacion' | 'verificado' | 'conciliado' | 'rechazado' | 'revertido';
export type PosReturnType = 'anulacion_total' | 'devolucion_parcial' | 'devolucion_total';
export type PosRefundMethod = 'efectivo_usd' | 'efectivo_ves' | 'reverso_electronico' | 'nota_credito_interna';
export type PosFiscalStatus = 'no_solicitado' | 'pendiente' | 'emitido' | 'rechazado' | 'error' | 'por_revisar';

export interface PosBranch {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  fiscal_address: string | null;
  phone: string | null;
  timezone: string;
  is_primary: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface PosRegister {
  id: string;
  tenant_id: string;
  branch_id: string;
  code: string;
  name: string;
  status: PosRegisterStatus;
  created_at: string;
  updated_at: string;
}

export interface PosRegisterAssignment {
  id: string;
  tenant_id: string;
  branch_id: string;
  register_id: string;
  auth_user_id: string;
  cashier_display_name: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PosShift {
  id: string;
  tenant_id: string;
  branch_id: string;
  register_id: string;
  cashier_user_id: string;
  cashier_name_snapshot: string | null;
  status: PosShiftStatus;
  opened_at: string;
  closed_at: string | null;
  opening_amount_usd: number;
  opening_amount_ves: number;
  expected_totals: Record<string, number>;
  declared_totals: Record<string, number>;
  differences_totals: Record<string, number>;
  opening_notes: string | null;
  closing_justification: string | null;
  closed_by: string | null;
  created_at: string;
}

export interface PosCashMovement {
  id: string;
  tenant_id: string;
  branch_id: string;
  shift_id: string;
  movement_type: PosMovementType;
  currency: 'USD' | 'VES';
  amount: number;
  reason: string;
  performed_by: string;
  authorization_id: string | null;
  created_at: string;
}

export interface PosProduct {
  id: string;
  tenant_id: string;
  branch_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  is_service: boolean;
  price_usd: number;
  tax_rate_percent: number;
  stock_quantity: number;
  status: PosProductStatus;
  is_weighable?: boolean;
  unit_of_measure?: 'unit' | 'kg' | 'g';
  created_at: string;
  updated_at: string;
}

export interface PosCustomer {
  id: string;
  tenant_id: string;
  document_type: 'V' | 'E' | 'J' | 'G' | 'P';
  document_number: string;
  legal_name: string;
  phone: string | null;
  email: string | null;
  fiscal_address: string | null;
  customer_tier: PosCustomerTier;
  total_purchases_count: number;
  total_purchases_usd: number;
  wallet_balance_usd?: number;
  wallet_balance_ves?: number;
  last_purchase_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PosAuthorization {
  id: string;
  tenant_id: string;
  branch_id: string;
  shift_id: string | null;
  sale_id: string | null;
  operation_type: PosOperationType;
  requested_by: string;
  approved_by: string;
  approver_name_snapshot: string | null;
  reason: string;
  limit_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface PosSale {
  id: string;
  tenant_id: string;
  branch_id: string;
  shift_id: string;
  register_id: string;
  cashier_user_id: string;
  customer_id: string | null;
  sale_number: string;
  commercial_status: PosCommercialStatus;
  payment_status: PosPaymentStatus;
  currency: string;
  exchange_rate_snapshot: number;
  subtotal_usd: number;
  discount_total_usd: number;
  tax_total_usd: number;
  total_usd: number;
  total_ves: number;
  paid_total_usd: number;
  paid_total_ves: number;
  balance_due_usd: number;
  balance_due_ves: number;
  notes: string | null;
  discount_authorization_id: string | null;
  idempotency_key: string;
  correlation_id: string;
  confirmed_at: string | null;
  created_at: string;
  lines?: PosSaleLine[];
  payments?: PosSalePayment[];
  customer?: PosCustomer | null;
  document?: PosCommercialDocument | null;
  fiscal_request?: PosFiscalRequest | null;
  sales_rep_id?: string | null;
  sales_rep_name?: string | null;
  wallet_change_deposited_usd?: number;
  wallet_used_usd?: number;
  applied_promotion_title?: string | null;
}

export interface PosPromotion {
  id: string;
  name: string;
  description: string;
  type: 'combo' | 'percentage' | 'buy_x_get_y';
  discount_percent: number;
  trigger_skus: string[];
  required_quantity: number;
  is_active: boolean;
}

export interface PosSalesRep {
  id: string;
  name: string;
  code: string;
  commission_rate_percent: number;
  is_active: boolean;
}

export interface PosSaleLine {
  id: string;
  tenant_id: string;
  sale_id: string;
  product_id: string | null;
  sku_snapshot: string;
  name_snapshot: string;
  is_service: boolean;
  quantity: number;
  returned_quantity: number;
  unit_price_usd: number;
  discount_percent: number;
  discount_amount_usd: number;
  tax_rate_percent: number;
  tax_amount_usd: number;
  line_subtotal_usd: number;
  line_total_usd: number;
  created_at: string;
}

export interface PosSalePayment {
  id: string;
  tenant_id: string;
  branch_id: string;
  sale_id: string;
  shift_id: string;
  method: PosPaymentMethod;
  currency: 'USD' | 'VES';
  amount_received: number;
  amount_applied: number;
  change_amount: number;
  change_currency: 'USD' | 'VES' | null;
  exchange_rate_snapshot: number;
  reference_number: string | null;
  bank_code: string | null;
  bank_name: string | null;
  payer_phone: string | null;
  payer_document: string | null;
  terminal_id: string | null;
  card_last4: string | null;
  approval_code: string | null;
  cashea_operation_id: string | null;
  cashea_merchant_amount: number | null;
  provider_status: PosProviderStatus;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface PosSaleReturn {
  id: string;
  tenant_id: string;
  branch_id: string;
  original_sale_id: string;
  shift_id: string;
  return_number: string;
  return_type: PosReturnType;
  reason: string;
  notes: string | null;
  requested_by: string;
  approved_by: string;
  authorization_id: string | null;
  refund_method: PosRefundMethod;
  total_refunded_usd: number;
  total_refunded_ves: number;
  stock_reversal_reference: string | null;
  financial_reversal_reference: string | null;
  created_at: string;
  lines?: PosReturnLine[];
}

export interface PosReturnLine {
  id: string;
  tenant_id: string;
  return_id: string;
  sale_line_id: string;
  product_id: string | null;
  quantity_returned: number;
  refund_amount_usd: number;
  refund_amount_ves: number;
  created_at: string;
}

export interface PosCommercialDocument {
  id: string;
  tenant_id: string;
  sale_id: string;
  document_kind: 'comprobante_interno';
  internal_number: string;
  pdf_path: string | null;
  status: 'generado';
  created_at: string;
}

export interface PosFiscalIntegration {
  id: string;
  tenant_id: string;
  provider: string;
  environment: 'sandbox' | 'production';
  enabled: boolean;
  company_rif: string | null;
  company_legal_name: string | null;
  fiscal_address: string | null;
  secret_reference: string | null;
  legal_status: 'sin_configurar' | 'sandbox_verificado' | 'productivo_activo';
  last_checked_at: string | null;
  updated_at: string;
}

export interface PosFiscalRequest {
  id: string;
  tenant_id: string;
  sale_id: string;
  idempotency_key: string;
  request_hash: string | null;
  provider_reference: string | null;
  fiscal_invoice_number: string | null;
  fiscal_control_number: string | null;
  status: PosFiscalStatus;
  error_code: string | null;
  response_summary: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FiscalProviderInterface {
  validateConfiguration(config: PosFiscalIntegration): Promise<{ valid: boolean; message: string }>;
  issueDocument(sale: PosSale, idempotencyKey: string): Promise<{
    success: boolean;
    fiscalInvoiceNumber?: string;
    fiscalControlNumber?: string;
    providerReference?: string;
    status: PosFiscalStatus;
    errorCode?: string;
    message: string;
  }>;
  getDocumentStatus(saleId: string, idempotencyKey: string): Promise<{
    status: PosFiscalStatus;
    fiscalInvoiceNumber?: string;
    fiscalControlNumber?: string;
    providerReference?: string;
    message: string;
  }>;
}

export interface PosSettings {
  id: string;
  tenant_id: string;
  branch_id: string;
  active_methods: PosPaymentMethod[];
  max_cashier_discount_percent: number;
  allow_partial_payments: boolean;
  cross_currency_change_enabled: boolean;
  internal_doc_prefix: string;
  next_internal_seq: number;
  next_sale_seq: number;
  active_exchange_rate: number;
  exchange_rate_api_url?: string;
  auto_fetch_exchange_rate?: boolean;
  last_exchange_rate_fetch?: string | null;
  exchange_rate_source?: string | null;
  updated_by: string | null;
  updated_at: string;
  supervisor_pin?: string;
  require_pin_for_returns?: boolean;
  require_pin_for_withdrawals?: boolean;
  require_pin_for_cancel?: boolean;
  enforce_blind_count?: boolean;
}

export interface PosInventoryKardex {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  movement_type: 'venta_pos' | 'reverso_devolucion' | 'ajuste_inicial';
  reference_id: string | null;
  quantity_delta: number;
  stock_before: number;
  stock_after: number;
  actor_id: string | null;
  created_at: string;
}

export interface PosAuditEvent {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  shift_id: string | null;
  actor_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  correlation_id?: string | null;
  created_at: string;
}

export type PosDispatchStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';

export interface PosDispatchOrderItem {
  sku: string;
  name: string;
  quantity: number;
  notes?: string;
  completed?: boolean;
}

export interface PosDispatchOrder {
  id: string;
  order_number: string;
  sale_id: string;
  sale_number: string;
  branch_id: string;
  customer_name: string;
  created_at: string;
  status: PosDispatchStatus;
  station: 'almacen' | 'cocina' | 'empaque';
  items: PosDispatchOrderItem[];
  prepared_by?: string;
  completed_at?: string;
}
