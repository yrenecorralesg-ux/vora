import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PosCashMovement,
  PosCustomer,
  PosPagoMovilConfig,
  PosPaymentMethod,
  PosProduct,
  PosSale,
  PosSaleReturn,
  PosSettings,
  PosShift,
} from '@/lib/types';
import { normalizePagoMovilConfig } from '@/lib/pos-pago-movil';

/**
 * Capa de servidor del POS: Supabase es la fuente de verdad. Las rutas
 * /api/t/[slug]/pos/* autorizan con authorizeTenantApi y luego usan estas
 * funciones con el cliente de servicio, siempre filtrando por tenantId.
 */

export type CatalogSource = 'warehouse' | 'pos';
export type StockPolicy = 'strict_block' | 'warn_and_allow' | 'allow_unrestricted';

const PAYMENT_METHODS: PosPaymentMethod[] = ['efectivo', 'pago_movil', 'tarjeta', 'cashea'];
const STOCK_POLICIES: StockPolicy[] = ['strict_block', 'warn_and_allow', 'allow_unrestricted'];

export class PosError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Traduce el error de una función SQL a un mensaje legible para el cajero. */
export function sqlErrorMessage(error: { message?: string } | null | undefined, fallback: string): string {
  const msg = error?.message?.trim();
  return msg ? msg.replace(/^ERROR:\s*/, '') : fallback;
}

// --------------------------------------------------------------------------
// Configuración por empresa
// --------------------------------------------------------------------------

export interface PosTenantSettingsRow {
  tenant_id: string;
  active_exchange_rate: number | null;
  exchange_rate_source: string | null;
  exchange_rate_api_url: string | null;
  auto_fetch_exchange_rate: boolean;
  exchange_rate_updated_at: string | null;
  max_cashier_discount_percent: number;
  allow_partial_payments: boolean;
  active_methods: PosPaymentMethod[];
  internal_doc_prefix: string;
  require_pin_for_withdrawals: boolean;
  next_sale_seq: number;
  next_doc_seq: number;
  updated_by: string | null;
  updated_at: string;
}

export interface PosRuntimeConfig {
  catalogSource: CatalogSource;
  /** Warehouse contratado y activo. */
  warehouseActive: boolean;
  /** Si la venta mueve existencias (Warehouse integrado o catálogo propio del POS). */
  trackStock: boolean;
  /** Warehouse activo con la integración POS encendida (las ventas mueven su stock). */
  warehouseStockSync: boolean;
  stockPolicy: StockPolicy;
  settings: PosTenantSettingsRow;
  pagoMovilConfig: PosPagoMovilConfig | null;
}

export async function getTenantSettings(service: SupabaseClient, tenantId: string): Promise<PosTenantSettingsRow> {
  const { data } = await service.from('pos_tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (data) return normalizeSettings(data);
  const { data: created, error } = await service
    .from('pos_tenant_settings')
    .upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id' })
    .select('*')
    .single();
  if (error || !created) throw new PosError('No se pudo preparar la configuración del POS.', 500);
  return normalizeSettings(created);
}

function normalizeSettings(row: Record<string, any>): PosTenantSettingsRow {
  return {
    ...(row as PosTenantSettingsRow),
    active_exchange_rate: row.active_exchange_rate === null ? null : Number(row.active_exchange_rate),
    max_cashier_discount_percent: Number(row.max_cashier_discount_percent ?? 0),
    next_sale_seq: Number(row.next_sale_seq ?? 1),
    next_doc_seq: Number(row.next_doc_seq ?? 1),
    active_methods: (row.active_methods ?? PAYMENT_METHODS) as PosPaymentMethod[],
  };
}

/** Forma que espera la interfaz del POS (PosSettings). */
export function toClientSettings(
  s: PosTenantSettingsRow,
  pagoMovilConfig?: PosPagoMovilConfig | null,
): PosSettings {
  return {
    id: s.tenant_id,
    tenant_id: s.tenant_id,
    branch_id: '',
    active_methods: s.active_methods,
    pago_movil_config: pagoMovilConfig ?? null,
    max_cashier_discount_percent: s.max_cashier_discount_percent,
    allow_partial_payments: s.allow_partial_payments,
    cross_currency_change_enabled: true,
    internal_doc_prefix: s.internal_doc_prefix,
    next_internal_seq: s.next_doc_seq,
    next_sale_seq: s.next_sale_seq,
    active_exchange_rate: s.active_exchange_rate ?? 0,
    exchange_rate_api_url: s.exchange_rate_api_url ?? undefined,
    auto_fetch_exchange_rate: s.auto_fetch_exchange_rate,
    last_exchange_rate_fetch: s.exchange_rate_updated_at,
    exchange_rate_source: s.exchange_rate_source,
    updated_by: s.updated_by,
    updated_at: s.updated_at,
    require_pin_for_withdrawals: s.require_pin_for_withdrawals,
    require_pin_for_returns: true,
  };
}

/**
 * Origen del catálogo: lo fija el gestor en commerce.pos → config.catalog_source.
 * Sin configurar: Warehouse si está activo, si no el catálogo propio del POS.
 */
export async function loadPosConfig(service: SupabaseClient, tenantId: string): Promise<PosRuntimeConfig> {
  const [{ data: features }, settings] = await Promise.all([
    service.from('tenant_features').select('feature_key, enabled, contracted, config').eq('tenant_id', tenantId),
    getTenantSettings(service, tenantId),
  ]);
  const rows = (features ?? []) as Array<{ feature_key: string; enabled: boolean; contracted?: boolean; config: any }>;
  const pos = rows.find((f) => f.feature_key === 'commerce.pos');
  const wh = rows.find((f) => f.feature_key === 'warehouse.inventory');
  const posCfg = (pos?.config ?? {}) as Record<string, any>;
  const whCfg = (wh?.config ?? {}) as Record<string, any>;

  const warehouseActive = Boolean(wh?.enabled) && wh?.contracted !== false;
  const configured = posCfg.catalog_source;
  const catalogSource: CatalogSource =
    configured === 'warehouse' || configured === 'pos' ? configured : warehouseActive ? 'warehouse' : 'pos';
  const policyRaw = posCfg.pos_stock_policy ?? whCfg.pos_stock_policy;
  const stockPolicy: StockPolicy = STOCK_POLICIES.includes(policyRaw) ? policyRaw : 'strict_block';
  const whIntegration = (whCfg.functions ?? {}).wh_pos_integration !== false;

  return {
    catalogSource,
    warehouseActive,
    trackStock: catalogSource === 'warehouse' ? warehouseActive && whIntegration : true,
    warehouseStockSync: warehouseActive && whIntegration,
    // Con Warehouse el stock nunca queda negativo: la sobreventa no es posible.
    stockPolicy: catalogSource === 'warehouse' && warehouseActive ? 'strict_block' : stockPolicy,
    settings,
    pagoMovilConfig: normalizePagoMovilConfig(posCfg.pago_movil),
  };
}

// --------------------------------------------------------------------------
// Catálogo
// --------------------------------------------------------------------------

interface CatalogEntry {
  id: string;
  sku: string;
  name: string;
  price_usd: number;
  tax_rate_percent: number;
  is_service: boolean;
  status: string;
}

async function loadCatalogEntries(
  service: SupabaseClient,
  tenantId: string,
  source: CatalogSource,
  ids: string[],
): Promise<Map<string, CatalogEntry>> {
  const map = new Map<string, CatalogEntry>();
  if (!ids.length) return map;
  if (source === 'warehouse') {
    const { data } = await service
      .from('warehouse_items')
      .select('id, sku, name, price_usd, tax_rate, track_stock, status')
      .eq('tenant_id', tenantId)
      .in('id', ids);
    for (const r of data ?? [])
      map.set(r.id, {
        id: r.id,
        sku: r.sku,
        name: r.name,
        price_usd: num(r.price_usd),
        tax_rate_percent: num(r.tax_rate),
        is_service: r.track_stock === false,
        status: r.status,
      });
  } else {
    const { data } = await service
      .from('pos_products')
      .select('id, sku, name, price_usd, tax_rate_percent, is_service, status')
      .eq('tenant_id', tenantId)
      .in('id', ids);
    for (const r of data ?? [])
      map.set(r.id, {
        id: r.id,
        sku: r.sku,
        name: r.name,
        price_usd: num(r.price_usd),
        tax_rate_percent: num(r.tax_rate_percent),
        is_service: Boolean(r.is_service),
        status: r.status,
      });
  }
  return map;
}

/** Catálogo que ve el POS, según el origen configurado. */
export async function listCatalog(
  service: SupabaseClient,
  tenantId: string,
  config: PosRuntimeConfig,
): Promise<PosProduct[]> {
  if (config.catalogSource === 'warehouse') {
    const { data: settings } = await service
      .from('warehouse_settings')
      .select('default_warehouse_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const { data, error } = await service
      .from('warehouse_items')
      .select(
        'id, sku, name, price_usd, tax_rate, track_stock, status, created_at, updated_at, warehouse_categories(name), warehouse_item_barcodes(code), warehouse_balances(on_hand, reserved, warehouse_id)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('name');
    if (error) throw new PosError('No se pudo cargar el catálogo de Warehouse.', 500);
    const defaultWh = settings?.default_warehouse_id as string | undefined;
    return (data ?? []).map((r: any) => {
      const balances = (r.warehouse_balances ?? []) as Array<{ on_hand: number; reserved: number; warehouse_id: string }>;
      const relevant = defaultWh ? balances.filter((b) => b.warehouse_id === defaultWh) : balances;
      const available = relevant.reduce((s, b) => s + num(b.on_hand) - num(b.reserved), 0);
      const isService = r.track_stock === false;
      const stock = isService ? 999 : Math.max(0, available);
      return {
        id: r.id,
        tenant_id: tenantId,
        branch_id: '',
        sku: r.sku,
        barcode: r.warehouse_item_barcodes?.[0]?.code ?? null,
        name: r.name,
        category: r.warehouse_categories?.name ?? 'General',
        is_service: isService,
        price_usd: num(r.price_usd),
        tax_rate_percent: num(r.tax_rate),
        stock_quantity: stock,
        status: isService || stock > 0 ? 'disponible' : 'agotado',
        created_at: r.created_at,
        updated_at: r.updated_at,
      } satisfies PosProduct;
    });
  }
  const { data, error } = await service
    .from('pos_products')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('status', 'descontinuado')
    .order('name');
  if (error) throw new PosError('No se pudo cargar el catálogo del POS.', 500);
  return (data ?? []).map((r: any) => ({
    ...r,
    price_usd: num(r.price_usd),
    tax_rate_percent: num(r.tax_rate_percent),
    stock_quantity: num(r.stock_quantity),
  }));
}

// --------------------------------------------------------------------------
// Ventas: el servidor recalcula con precios del catálogo
// --------------------------------------------------------------------------

export interface SaleRequestLine {
  productId?: string;
  quantity: number;
  discountPercent?: number;
}

export interface SaleRequestPayment {
  method: PosPaymentMethod;
  currency: 'USD' | 'VES';
  amountReceived: number;
  amountApplied: number;
  changeAmount?: number;
  changeCurrency?: 'USD' | 'VES';
  referenceNumber?: string;
  bankCode?: string;
  bankName?: string;
  payerPhone?: string;
  payerDocument?: string;
  terminalId?: string;
  cardLast4?: string;
  approvalCode?: string;
  casheaOperationId?: string;
  casheaMerchantAmount?: number;
  providerStatus?: 'registrado' | 'pendiente_verificacion' | 'verificado';
}

/**
 * Valida la petición del navegador y arma el payload de pos_record_sale. Del
 * cliente solo se aceptan producto, cantidad, % de descuento y pagos; precio,
 * impuesto y totales salen del catálogo y de la configuración.
 */
export async function buildSalePayload(params: {
  service: SupabaseClient;
  tenantId: string;
  config: PosRuntimeConfig;
  body: Record<string, any>;
  canOverrideDiscount: boolean;
}): Promise<Record<string, unknown>> {
  const { service, tenantId, config, body, canOverrideDiscount } = params;
  const rate = config.settings.active_exchange_rate;
  if (!rate || rate <= 0) throw new PosError('Configura la tasa de cambio del POS antes de vender.');

  const idempotencyKey = String(body.idempotency_key ?? '').trim();
  if (!idempotencyKey || idempotencyKey.length > 200) throw new PosError('Falta la clave de idempotencia de la venta.');
  if (!body.shift_id) throw new PosError('No hay un turno de caja abierto.');

  const rawLines = Array.isArray(body.lines) ? (body.lines as SaleRequestLine[]) : [];
  if (!rawLines.length) throw new PosError('La venta no tiene productos.');
  if (rawLines.length > 300) throw new PosError('La venta excede el máximo de 300 líneas.');

  const ids = Array.from(new Set(rawLines.map((l) => String(l.productId ?? ''))));
  const catalog = await loadCatalogEntries(service, tenantId, config.catalogSource, ids.filter(Boolean));
  const maxDiscount = config.settings.max_cashier_discount_percent;
  const authorizationId = body.discount_authorization_id ? String(body.discount_authorization_id) : null;

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let total = 0;
  let needsOverride = false;
  const lines = rawLines.map((l) => {
    const entry = catalog.get(String(l.productId ?? ''));
    if (!entry) throw new PosError('Un producto del carrito no existe en el catálogo de la empresa.');
    if (entry.status !== 'active' && entry.status !== 'disponible' && entry.status !== 'agotado')
      throw new PosError(`El producto ${entry.sku} no está disponible para la venta.`);
    const quantity = Number(l.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000)
      throw new PosError(`Cantidad inválida para ${entry.sku}.`);
    const pct = Number(l.discountPercent ?? 0);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new PosError(`Descuento inválido para ${entry.sku}.`);
    if (pct > maxDiscount) needsOverride = true;

    const lineSubtotal = round2(entry.price_usd * quantity);
    const discount = round2(lineSubtotal * (pct / 100));
    const tax = round2((lineSubtotal - discount) * (entry.tax_rate_percent / 100));
    const lineTotal = round2(lineSubtotal - discount + tax);
    subtotal += lineSubtotal;
    discountTotal += discount;
    taxTotal += tax;
    total += lineTotal;
    return {
      [config.catalogSource === 'warehouse' ? 'item_id' : 'product_id']: entry.id,
      sku: entry.sku,
      name: entry.name,
      is_service: entry.is_service,
      quantity,
      unit_price_usd: entry.price_usd,
      discount_percent: pct,
      discount_amount_usd: discount,
      tax_rate_percent: entry.tax_rate_percent,
      tax_amount_usd: tax,
      line_subtotal_usd: lineSubtotal,
      line_total_usd: lineTotal,
    };
  });
  if (needsOverride && !canOverrideDiscount && !authorizationId)
    throw new PosError(
      `El descuento supera el máximo del cajero (${maxDiscount}%). Requiere autorización de un supervisor.`,
      403,
    );

  total = round2(total);
  // Si el catálogo cambió desde que el cajero lo cargó, no se cobra un total distinto al mostrado.
  if (body.total_usd !== undefined && body.total_usd !== null) {
    const shown = Number(body.total_usd);
    if (Number.isFinite(shown) && Math.abs(shown - total) > 0.01)
      throw new PosError(
        `El total cambió (precios actualizados): ahora es $${total.toFixed(2)} USD. Recarga el catálogo y revisa el carrito antes de cobrar.`,
        409,
      );
  }
  const rawPayments = Array.isArray(body.payments) ? (body.payments as SaleRequestPayment[]) : [];
  let paidUsd = 0;
  let changeUsd = 0;
  const payments = rawPayments.map((p) => {
    if (!config.settings.active_methods.includes(p.method)) throw new PosError('Método de pago no habilitado.');
    if (p.currency !== 'USD' && p.currency !== 'VES') throw new PosError('Moneda de pago inválida.');
    const received = Number(p.amountReceived);
    const applied = Number(p.amountApplied);
    const change = Number(p.changeAmount ?? 0);
    if (![received, applied, change].every((v) => Number.isFinite(v) && v >= 0))
      throw new PosError('Montos de pago inválidos.');
    if (p.cardLast4 && !/^[0-9]{4}$/.test(p.cardLast4)) throw new PosError('Los últimos 4 dígitos de la tarjeta no son válidos.');
    paidUsd += p.currency === 'USD' ? applied : applied / rate;
    changeUsd += p.changeCurrency === 'VES' ? change / rate : change;
    return {
      method: p.method,
      currency: p.currency,
      amount_received: received,
      amount_applied: applied,
      change_amount: change,
      change_currency: p.changeCurrency ?? null,
      reference_number: p.referenceNumber ?? null,
      bank_code: p.bankCode ?? null,
      bank_name: p.bankName ?? null,
      payer_phone: p.payerPhone ?? null,
      payer_document: p.payerDocument ?? null,
      terminal_id: p.terminalId ?? null,
      card_last4: p.cardLast4 ?? null,
      approval_code: p.approvalCode ?? null,
      cashea_operation_id: p.casheaOperationId ?? null,
      cashea_merchant_amount: p.casheaMerchantAmount ?? null,
      provider_status: p.providerStatus ?? 'registrado',
    };
  });

  const walletUsed = round2(Math.max(0, Number(body.wallet_used_usd ?? 0)));
  const walletDeposited = round2(Math.max(0, Number(body.wallet_change_deposited_usd ?? 0)));
  if (walletDeposited > round2(changeUsd) + 0.01) throw new PosError('El abono al monedero excede el vuelto de la venta.');

  paidUsd = round2(paidUsd);
  const balanceUsd = Math.max(0, round2(total - paidUsd - walletUsed));
  if (balanceUsd > 0.05 && !config.settings.allow_partial_payments)
    throw new PosError('La venta tiene saldo pendiente y los pagos parciales no están permitidos.');
  const paymentStatus = balanceUsd <= 0.05 ? 'pagada' : paidUsd + walletUsed > 0 ? 'parcial' : 'pendiente';

  return {
    idempotency_key: idempotencyKey,
    correlation_id: body.correlation_id ? String(body.correlation_id).slice(0, 200) : null,
    shift_id: String(body.shift_id),
    customer_id: body.customer_id || null,
    catalog_source: config.catalogSource,
    track_stock: config.trackStock,
    stock_policy: config.stockPolicy,
    warehouse_id: body.warehouse_id || null,
    exchange_rate: rate,
    subtotal_usd: round2(subtotal),
    discount_total_usd: round2(discountTotal),
    tax_total_usd: round2(taxTotal),
    total_usd: total,
    total_ves: round2(total * rate),
    paid_total_usd: paidUsd,
    paid_total_ves: round2(paidUsd * rate),
    balance_due_usd: balanceUsd,
    balance_due_ves: round2(balanceUsd * rate),
    payment_status: paymentStatus,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    discount_authorization_id: authorizationId,
    wallet_used_usd: walletUsed,
    wallet_deposited_usd: walletDeposited,
    metadata: {
      sales_rep_id: body.sales_rep_id ?? null,
      sales_rep_name: body.sales_rep_name ?? null,
      applied_promotion_title: body.applied_promotion_title ?? null,
      wallet_used_usd: walletUsed,
      wallet_change_deposited_usd: walletDeposited,
    },
    lines,
    payments,
  };
}

// --------------------------------------------------------------------------
// Lectura y mapeo a los tipos de la interfaz
// --------------------------------------------------------------------------

const SALE_SELECT =
  '*, pos_sale_lines(*), pos_sale_payments(*), pos_customers(*), pos_commercial_documents(*), pos_fiscal_requests(*)';

function mapSale(r: any): PosSale {
  const meta = (r.metadata ?? {}) as Record<string, any>;
  const numeric = [
    'exchange_rate_snapshot', 'subtotal_usd', 'discount_total_usd', 'tax_total_usd', 'total_usd', 'total_ves',
    'paid_total_usd', 'paid_total_ves', 'balance_due_usd', 'balance_due_ves',
  ];
  const sale: any = { ...r };
  for (const k of numeric) sale[k] = num(r[k]);
  sale.lines = (r.pos_sale_lines ?? []).map((l: any) => ({
    ...l,
    product_id: l.product_id ?? l.item_id ?? null,
    quantity: num(l.quantity),
    returned_quantity: num(l.returned_quantity),
    unit_price_usd: num(l.unit_price_usd),
    discount_percent: num(l.discount_percent),
    discount_amount_usd: num(l.discount_amount_usd),
    tax_rate_percent: num(l.tax_rate_percent),
    tax_amount_usd: num(l.tax_amount_usd),
    line_subtotal_usd: num(l.line_subtotal_usd),
    line_total_usd: num(l.line_total_usd),
  }));
  sale.payments = (r.pos_sale_payments ?? []).map((p: any) => ({
    ...p,
    amount_received: num(p.amount_received),
    amount_applied: num(p.amount_applied),
    change_amount: num(p.change_amount),
    exchange_rate_snapshot: num(p.exchange_rate_snapshot),
    cashea_merchant_amount: p.cashea_merchant_amount === null ? null : num(p.cashea_merchant_amount),
  }));
  sale.customer = r.pos_customers ? mapCustomer(r.pos_customers) : null;
  const doc = Array.isArray(r.pos_commercial_documents) ? r.pos_commercial_documents[0] : r.pos_commercial_documents;
  sale.document = doc ?? null;
  const fiscal = (r.pos_fiscal_requests ?? []) as any[];
  sale.fiscal_request = fiscal.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] ?? null;
  sale.sales_rep_id = meta.sales_rep_id ?? null;
  sale.sales_rep_name = meta.sales_rep_name ?? null;
  sale.applied_promotion_title = meta.applied_promotion_title ?? null;
  sale.wallet_used_usd = num(meta.wallet_used_usd);
  sale.wallet_change_deposited_usd = num(meta.wallet_change_deposited_usd);
  delete sale.pos_sale_lines;
  delete sale.pos_sale_payments;
  delete sale.pos_customers;
  delete sale.pos_commercial_documents;
  delete sale.pos_fiscal_requests;
  return sale as PosSale;
}

export function mapCustomer(c: any): PosCustomer {
  return {
    ...c,
    total_purchases_count: num(c.total_purchases_count),
    total_purchases_usd: num(c.total_purchases_usd),
    wallet_balance_usd: num(c.wallet_balance_usd),
  };
}

function mapShift(s: any): PosShift {
  const toNums = (o: Record<string, unknown> | null) =>
    Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, num(v)]));
  return {
    ...s,
    opening_amount_usd: num(s.opening_amount_usd),
    opening_amount_ves: num(s.opening_amount_ves),
    expected_totals: toNums(s.expected_totals),
    declared_totals: toNums(s.declared_totals),
    differences_totals: toNums(s.differences_totals),
  };
}

export interface SaleFilters {
  branchId?: string | null;
  shiftId?: string | null;
  cashierId?: string | null;
  commercialStatus?: string | null;
  paymentStatus?: string | null;
  query?: string | null;
  limit?: number;
}

export async function listSales(service: SupabaseClient, tenantId: string, f: SaleFilters = {}): Promise<PosSale[]> {
  let q = service.from('pos_sales').select(SALE_SELECT).eq('tenant_id', tenantId);
  if (f.branchId) q = q.eq('branch_id', f.branchId);
  if (f.shiftId) q = q.eq('shift_id', f.shiftId);
  if (f.cashierId) q = q.eq('cashier_user_id', f.cashierId);
  if (f.commercialStatus) q = q.eq('commercial_status', f.commercialStatus);
  if (f.paymentStatus) q = q.eq('payment_status', f.paymentStatus);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(Math.min(f.limit ?? 500, 2000));
  if (error) throw new PosError('No se pudieron cargar las ventas.', 500);
  let sales = (data ?? []).map(mapSale);
  const query = f.query?.toLowerCase().trim();
  if (query)
    sales = sales.filter(
      (s) =>
        s.sale_number.toLowerCase().includes(query) ||
        s.customer?.legal_name.toLowerCase().includes(query) ||
        s.customer?.document_number.toLowerCase().includes(query),
    );
  return sales;
}

export async function getSale(service: SupabaseClient, tenantId: string, idOrNumber: string): Promise<PosSale | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrNumber);
  const { data } = await service
    .from('pos_sales')
    .select(SALE_SELECT)
    .eq('tenant_id', tenantId)
    .eq(isUuid ? 'id' : 'sale_number', idOrNumber)
    .maybeSingle();
  return data ? mapSale(data) : null;
}

export async function listShifts(
  service: SupabaseClient,
  tenantId: string,
  f: { branchId?: string | null; registerId?: string | null; status?: string | null } = {},
): Promise<PosShift[]> {
  let q = service.from('pos_shifts').select('*').eq('tenant_id', tenantId);
  if (f.branchId) q = q.eq('branch_id', f.branchId);
  if (f.registerId) q = q.eq('register_id', f.registerId);
  if (f.status) q = q.eq('status', f.status);
  const { data, error } = await q.order('opened_at', { ascending: false }).limit(200);
  if (error) throw new PosError('No se pudieron cargar los turnos.', 500);
  return (data ?? []).map(mapShift);
}

export async function getShift(service: SupabaseClient, tenantId: string, shiftId: string): Promise<PosShift | null> {
  const { data } = await service.from('pos_shifts').select('*').eq('tenant_id', tenantId).eq('id', shiftId).maybeSingle();
  return data ? mapShift(data) : null;
}

export async function listCashMovements(
  service: SupabaseClient,
  tenantId: string,
  shiftId?: string | null,
): Promise<PosCashMovement[]> {
  let q = service.from('pos_cash_movements').select('*').eq('tenant_id', tenantId);
  if (shiftId) q = q.eq('shift_id', shiftId);
  const { data } = await q.order('created_at', { ascending: false }).limit(500);
  return (data ?? []).map((m: any) => ({ ...m, amount: num(m.amount) }));
}

export async function listReturns(service: SupabaseClient, tenantId: string): Promise<PosSaleReturn[]> {
  const { data, error } = await service
    .from('pos_sale_returns')
    .select('*, pos_return_lines(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new PosError('No se pudieron cargar las devoluciones.', 500);
  return (data ?? []).map((r: any) => {
    const { pos_return_lines, ...rest } = r;
    return {
      ...rest,
      total_refunded_usd: num(r.total_refunded_usd),
      total_refunded_ves: num(r.total_refunded_ves),
      lines: (pos_return_lines ?? []).map((l: any) => ({
        ...l,
        product_id: l.product_id ?? l.item_id ?? null,
        quantity_returned: num(l.quantity_returned),
        refund_amount_usd: num(l.refund_amount_usd),
        refund_amount_ves: num(l.refund_amount_ves),
      })),
    } as PosSaleReturn;
  });
}

// --------------------------------------------------------------------------
// PIN de supervisor (hash scrypt, bloqueo tras intentos fallidos)
// --------------------------------------------------------------------------

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

export function validatePinFormat(pin: unknown): string {
  const p = String(pin ?? '').trim();
  if (!/^[0-9]{4,8}$/.test(p)) throw new PosError('El PIN debe tener entre 4 y 8 dígitos.');
  if (/^(\d)\1+$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p))
    throw new PosError('Elige un PIN menos predecible (no repetido ni consecutivo).');
  return p;
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(pin, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

/**
 * Valida el PIN de un supervisor concreto y que su rol tenga el permiso pedido.
 * Bloquea el PIN 15 minutos tras 5 intentos fallidos.
 */
export async function verifySupervisorPin(params: {
  service: SupabaseClient;
  tenantId: string;
  supervisorId: string;
  pin: string;
  permission: string;
}): Promise<{ ok: true; role: string } | { ok: false; error: string; status: number }> {
  const { service, tenantId, supervisorId, pin, permission } = params;
  const { data: membership } = await service
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', supervisorId)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return { ok: false, error: 'El supervisor no pertenece a la empresa.', status: 403 };

  const role = membership.role as string;
  if (role !== 'tenant_admin') {
    const { data: perm } = await service
      .from('role_permissions')
      .select('permission')
      .eq('role_key', role)
      .eq('permission', permission)
      .eq('scope', 'tenant')
      .maybeSingle();
    if (!perm) return { ok: false, error: 'Ese usuario no tiene facultad para autorizar esta operación.', status: 403 };
  }

  const { data: row } = await service
    .from('pos_staff_pins')
    .select('pin_hash, failed_attempts, locked_until')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', supervisorId)
    .maybeSingle();
  if (!row) return { ok: false, error: 'El supervisor no tiene un PIN configurado.', status: 403 };
  if (row.locked_until && new Date(row.locked_until) > new Date())
    return { ok: false, error: 'PIN bloqueado temporalmente por intentos fallidos. Intenta más tarde.', status: 429 };

  if (!verifyPinHash(String(pin ?? '').trim(), row.pin_hash)) {
    const attempts = (row.failed_attempts ?? 0) + 1;
    await service
      .from('pos_staff_pins')
      .update({
        failed_attempts: attempts >= PIN_MAX_ATTEMPTS ? 0 : attempts,
        locked_until:
          attempts >= PIN_MAX_ATTEMPTS ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', supervisorId);
    return { ok: false, error: 'PIN de supervisor inválido.', status: 403 };
  }
  if (row.failed_attempts) {
    await service
      .from('pos_staff_pins')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('tenant_id', tenantId)
      .eq('auth_user_id', supervisorId);
  }
  return { ok: true, role };
}

/** Nombre visible de un usuario de Auth (metadatos o correo). */
export async function userDisplayNames(service: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(ids)).map(async (id) => {
      const { data } = await service.auth.admin.getUserById(id);
      const u = data?.user;
      if (u) names.set(id, (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || 'Usuario');
    }),
  );
  return names;
}
