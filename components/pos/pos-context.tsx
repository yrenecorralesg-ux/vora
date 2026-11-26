'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  PosBranch,
  PosRegister,
  PosShift,
  PosProduct,
  PosCustomer,
  PosSale,
  PosSaleReturn,
  PosCashMovement,
  PosSettings,
  PosPromotion,
  PosSalesRep,
  PosDispatchOrder,
  PosDispatchStatus,
  PosFiscalIntegration,
} from '@/lib/types';
import {
  enqueueOfflineOp,
  getOfflineIdMap,
  getOfflineQueue,
  loadParkedSalesLocal,
  removeOfflineSale,
  retryRejectedOfflineOp,
  saveParkedSalesLocal,
  syncOfflineOperations,
  type OfflineOperation,
} from '@/lib/pos-offline';
import {
  signOfflineMessage,
  verifyAndSignOfflineProof,
  verifyPinAndUnlockKey,
  type OfflineOperatorInfo,
} from '@/lib/pos-offline-crypto';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '@/lib/pos-offline-db';
import { publishCustomerDisplayState } from '@/lib/desktop-bridge';
import { formatPagoMovilQrPayload } from '@/lib/pos-pago-movil';
import {
  apiError,
  buildSalesBookCsv,
  deriveDispatchOrders,
  type PosMe,
  type PosStaffUser,
  type PosSupervisor,
} from '@/lib/pos/client-utils';

/** Marcadores mientras cargan sedes y cajas reales (no son datos de negocio). */
const EMPTY_BRANCH: PosBranch = {
  id: '',
  tenant_id: '',
  code: '',
  name: 'Sin sede',
  fiscal_address: null,
  phone: null,
  timezone: 'America/Caracas',
  is_primary: false,
  status: 'active',
  created_at: '',
  updated_at: '',
};
const EMPTY_REGISTER: PosRegister = {
  id: '',
  tenant_id: '',
  branch_id: '',
  code: '',
  name: 'Sin caja',
  status: 'active',
  created_at: '',
  updated_at: '',
};
const EMPTY_SETTINGS: PosSettings = {
  id: '',
  tenant_id: '',
  branch_id: '',
  active_methods: ['efectivo', 'pago_movil', 'tarjeta', 'cashea'],
  max_cashier_discount_percent: 0,
  allow_partial_payments: true,
  cross_currency_change_enabled: true,
  internal_doc_prefix: 'COMP-INT-',
  next_internal_seq: 1,
  next_sale_seq: 1,
  active_exchange_rate: 0,
  updated_by: null,
  updated_at: '',
};

/** Aviso flotante del POS (ver pos-toaster.tsx). */
export interface PosToast {
  id: number;
  title: string;
  detail: string;
  type: 'success' | 'alert' | 'critical';
}

export interface ParkedSale {
  id: string;
  createdAt: string;
  customer: PosCustomer | null;
  cart: CartLine[];
  notes: string;
  totalUsd: number;
}

export interface CartLine {
  productId?: string;
  sku: string;
  name: string;
  isService: boolean;
  quantity: number;
  unitPriceUsd: number;
  discountPercent: number;
  discountAmountUsd: number;
  taxRatePercent: number;
  taxAmountUsd: number;
  lineSubtotalUsd: number;
  lineTotalUsd: number;
}

export interface OfflineDiscountAuth {
  supervisor_id: string;
  proof: string;
  authorized_at: string;
  reason: string;
  limit_snapshot: Record<string, unknown>;
}

export type PosViewKey =
  | 'POS-01'
  | 'POS-02'
  | 'POS-03-04'
  | 'POS-05'
  | 'POS-06'
  | 'POS-11'
  | 'POS-12'
  | 'POS-13'
  | 'POS-14'
  | 'POS-15'
  | 'POS-16'
  | 'POS-17'
  | 'POS-18'
  | 'POS-19'
  | 'POS-20';

export interface PosTenantBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  loginBgColor: string;
  fontFamily: string;
  logoUrl: string | null;
  bannerUrl: string | null;
}

interface PosContextType {
  // Context Switchers & Tenant Meta
  tenantId: string;
  tenantName: string;
  tenantCurrency: string;
  tenantCountry: string;
  tenantBranding: PosTenantBranding;
  activeTenantSlug: string;
  setActiveTenantSlug: (slug: string) => void;
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  activeBranch: PosBranch;
  /** Usuario de la sesión (Supabase Auth + membresía o cambio rápido con PIN). */
  activeUser: PosMe;
  me: PosMe | null;
  can: (permission: string) => boolean;
  activeRegisterId: string;
  setActiveRegisterId: (id: string) => void;
  activeRegister: PosRegister;

  // View Navigation
  currentView: PosViewKey;
  navigateTo: (view: PosViewKey) => void;

  // Operational State
  activeShift: PosShift | null;
  refreshActiveShift: () => Promise<void>;
  exchangeRate: number;
  settings: PosSettings;
  reloadSettings: () => Promise<void>;
  saveSettings: (patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  catalogSource: 'warehouse' | 'pos';
  branches: PosBranch[];
  registers: PosRegister[];
  products: PosProduct[];
  customers: PosCustomer[];
  sales: PosSale[];
  returns: PosSaleReturn[];
  shifts: PosShift[];
  cashMovements: PosCashMovement[];
  fiscalIntegration: PosFiscalIntegration | null;
  reloadSales: () => Promise<void>;
  reloadReturns: () => Promise<void>;
  reloadShifts: () => Promise<void>;

  // Cart & Active Sale
  cart: CartLine[];
  addToCart: (product: PosProduct, quantity?: number) => void;
  updateCartQuantity: (index: number, quantity: number) => void;
  updateCartDiscount: (index: number, discountPercent: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  cartNotes: string;
  setCartNotes: (notes: string) => void;
  selectedCustomer: PosCustomer | null;
  setSelectedCustomer: (cust: PosCustomer | null) => void;
  discountAuthorizedBy: string | null;
  setDiscountAuthorizedBy: (id: string | null) => void;
  offlineDiscountAuth: OfflineDiscountAuth | null;
  setOfflineDiscountAuth: (auth: OfflineDiscountAuth | null) => void;
  draftSaleKey: string;
  ensureDraftSaleKey: () => string;

  // Confirmed Sale Focus
  lastConfirmedSale: PosSale | null;
  setLastConfirmedSale: (sale: PosSale | null) => void;

  // Parked Sales (Multiticket)
  parkedSales: ParkedSale[];
  parkCurrentSale: (note?: string) => void;
  resumeParkedSale: (id: string) => void;
  deleteParkedSale: (id: string) => void;

  // Connectivity, Offline Queue & Operator Lock
  isOnline: boolean;
  lastSyncedAt: string | null;
  offlineQueue: OfflineOperation[];
  offlineQueueCount: number;
  offlineRejectedCount: number;
  triggerSyncOfflineSales: () => Promise<void>;
  retryOfflineOperation: (id: string) => Promise<void>;
  discardOfflineOperation: (id: string) => void;
  isQueueModalOpen: boolean;
  setIsQueueModalOpen: (open: boolean) => void;
  isOperatorModalOpen: boolean;
  setIsOperatorModalOpen: (open: boolean) => void;
  isTerminalLocked: boolean;
  setIsTerminalLocked: (locked: boolean) => void;
  offlineOperators: OfflineOperatorInfo[];
  switchOperator: (params: { userId: string; pin: string }) => Promise<{ ok: boolean; error?: string }>;
  clearOfflineSigningSession: () => void;

  // Offline-capable mutations
  openShift: (params: {
    branchId: string;
    registerId: string;
    openingUsd: number;
    openingVes: number;
    notes?: string;
  }) => Promise<{ ok: boolean; shift?: PosShift; offline?: boolean; error?: string }>;
  addCashMovement: (params: {
    shiftId: string;
    movementType: 'ingreso_efectivo' | 'retiro_efectivo' | 'ajuste_caja' | 'cambio_saldo_inicial';
    currency: 'USD' | 'VES';
    amount: number;
    reason: string;
    supervisorId?: string;
    supervisorPin?: string;
  }) => Promise<{ ok: boolean; offline?: boolean; error?: string }>;
  closeShift: (params: {
    shiftId: string;
    declared: Record<string, number>;
    justification?: string;
  }) => Promise<{ ok: boolean; shift?: PosShift; offline?: boolean; error?: string }>;
  recordOfflineSale: (params: {
    salePayload: Record<string, any>;
    provisionalSale: PosSale;
  }) => Promise<{ ok: boolean; sale: PosSale }>;
  recordDebtPayment: (params: {
    saleId: string;
    shiftId: string;
    method: 'efectivo' | 'pago_movil' | 'tarjeta';
    currency: 'USD' | 'VES';
    amount: number;
    referenceNumber?: string;
  }) => Promise<{ ok: boolean; balanceDueUsd?: number; offline?: boolean; error?: string }>;
  recordSaleReturn: (params: {
    originalSale: PosSale;
    shiftId: string;
    returnType: 'devolucion_parcial' | 'anulacion_total';
    lines: Array<{ saleLineId: string; lineIndex: number; sku: string; quantity: number; condition: 'sellable' | 'damaged' }>;
    reason: string;
    notes?: string;
    refundMethod: 'efectivo_usd' | 'efectivo_ves' | 'reverso_electronico' | 'nota_credito_interna';
    supervisorId?: string;
    supervisorPin?: string;
  }) => Promise<{ ok: boolean; returnNumber?: string; totalRefundedUsd?: number; offline?: boolean; error?: string }>;

  // Barcode quick scan
  scanBarcode: (code: string) => boolean;

  // Exchange Rate
  refreshExchangeRate: (customUrl?: string) => Promise<{ ok: boolean; rate?: number; error?: string }>;
  isFetchingExchangeRate: boolean;

  // Feature Flags
  isModuleEnabled: boolean;
  isWarehouseEnabled: boolean;
  posFeatures: Record<string, boolean>;
  isFuncActive: (funcKey: string) => boolean;
  reloadTenantFeatures: () => Promise<void>;
  reloadProducts: () => Promise<void>;
  reloadBranches: () => Promise<void>;
  reloadRegisters: () => Promise<void>;
  reloadCustomers: () => Promise<void>;
  stockPolicy: 'warn_and_allow' | 'strict_block' | 'allow_unrestricted';

  // Asesores, promociones y pantalla de cliente
  salesReps: PosSalesRep[];
  promotions: PosPromotion[];
  selectedSalesRep: PosSalesRep | null;
  setSelectedSalesRep: (rep: PosSalesRep | null) => void;
  isCustomerDisplayOpen: boolean;
  setIsCustomerDisplayOpen: (open: boolean) => void;

  // Personal y supervisión
  staffUsers: PosStaffUser[];
  supervisors: PosSupervisor[];
  reloadStaff: () => Promise<void>;
  requestSupervisorAuthorization: (params: {
    supervisorId: string;
    pin: string;
    operationType: 'discount_override' | 'sale_void' | 'sale_return' | 'cash_movement';
    reason: string;
    limitSnapshot?: Record<string, unknown>;
    saleIdempotencyKey?: string;
  }) => Promise<{
    ok: boolean;
    authorizationId?: string;
    offlineDiscountAuth?: OfflineDiscountAuth;
    approverName?: string | null;
    offline?: boolean;
    error?: string;
  }>;

  // Comandas y Despacho KDS
  dispatchOrders: PosDispatchOrder[];
  updateDispatchStatus: (orderId: string, status: PosDispatchStatus, preparedBy?: string) => Promise<boolean>;
  toggleDispatchItem: (orderId: string, itemSku: string) => Promise<boolean>;

  // Exportación Contable SENIAT
  generateAccountingSalesBookCsv: (params?: { startDate?: string; endDate?: string }) => string;

  // Notificaciones
  notification: PosToast | null;
  toasts: PosToast[];
  dismissToast: (id: number) => void;
  showNotification: (title: string, detail: string, type?: 'success' | 'alert' | 'critical') => void;
  clearNotification: () => void;

  // Sedes, Cajas y Clientes
  addBranch: (branch: Omit<PosBranch, 'id' | 'created_at' | 'updated_at'>) => Promise<PosBranch | null>;
  addRegister: (register: Omit<PosRegister, 'id' | 'created_at' | 'updated_at'>) => Promise<PosRegister | null>;
  addCustomer: (
    customer: Omit<
      PosCustomer,
      'id' | 'tenant_id' | 'total_purchases_count' | 'total_purchases_usd' | 'last_purchase_at' | 'created_at' | 'updated_at'
    >,
  ) => Promise<PosCustomer | null>;
}

const PosContext = createContext<PosContextType | null>(null);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function makeOpKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = String((err as Error)?.message || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed');
}

export function PosProvider({
  children,
  initialSlug,
  initialTenant,
  initialBranding,
}: {
  children: React.ReactNode;
  initialSlug: string;
  initialTenant?: {
    id?: string;
    commercial_name?: string;
    currency?: string;
    country?: string;
  } | null;
  initialBranding?: {
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    login_background_color?: string;
    font_family?: string;
    logo_url?: string | null;
    banner_url?: string | null;
  } | null;
}) {
  const isSolee = (initialSlug || '').toLowerCase() === 'solee';
  const [activeTenantSlug, setActiveTenantSlug] = useState<string>(initialSlug);
  const [tenantId, setTenantId] = useState<string>(initialTenant?.id || '');
  const [tenantName, setTenantName] = useState<string>(
    initialTenant?.commercial_name || (isSolee ? 'SOLEÉ' : initialSlug),
  );
  const [tenantCurrency, setTenantCurrency] = useState<string>(initialTenant?.currency || 'USD');
  const [tenantCountry, setTenantCountry] = useState<string>(initialTenant?.country || 'VE');
  const [tenantBranding, setTenantBranding] = useState<PosTenantBranding>({
    primaryColor: initialBranding?.primary_color || (isSolee ? '#4a1d6e' : '#285C49'),
    secondaryColor: initialBranding?.secondary_color || (isSolee ? '#63DCE5' : '#A9BEA5'),
    accentColor: initialBranding?.accent_color || (isSolee ? '#00AFEF' : '#C97857'),
    loginBgColor: initialBranding?.login_background_color || '#F6F2E9',
    fontFamily: initialBranding?.font_family || 'Poppins',
    logoUrl: initialBranding?.logo_url || null,
    bannerUrl: initialBranding?.banner_url || null,
  });
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [activeRegisterId, setActiveRegisterId] = useState<string>('');
  const [currentView, setCurrentView] = useState<PosViewKey>('POS-01');

  // Estado operativo
  const [branches, setBranches] = useState<PosBranch[]>([]);
  const [registers, setRegisters] = useState<PosRegister[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [returns, setReturns] = useState<PosSaleReturn[]>([]);
  const [shifts, setShifts] = useState<PosShift[]>([]);
  const [cashMovements, setCashMovements] = useState<PosCashMovement[]>([]);
  const [settings, setSettings] = useState<PosSettings>(EMPTY_SETTINGS);
  const [catalogSource, setCatalogSource] = useState<'warehouse' | 'pos'>('pos');
  const [me, setMe] = useState<PosMe | null>(null);
  const [staffUsers, setStaffUsers] = useState<PosStaffUser[]>([]);
  const [supervisors, setSupervisors] = useState<PosSupervisor[]>([]);
  const [offlineOperators, setOfflineOperators] = useState<OfflineOperatorInfo[]>([]);
  const [fiscalIntegration, setFiscalIntegration] = useState<PosFiscalIntegration | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartNotes, setCartNotes] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null);
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState<string | null>(null);
  const [offlineDiscountAuth, setOfflineDiscountAuth] = useState<OfflineDiscountAuth | null>(null);
  const [draftSaleKey, setDraftSaleKey] = useState<string>('');
  const [lastConfirmedSale, setLastConfirmedSale] = useState<PosSale | null>(null);
  const [toasts, setToasts] = useState<PosToast[]>([]);
  const notification = toasts[toasts.length - 1] ?? null;

  // Multiticket / Ventas en Espera (persistido en localStorage)
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);

  // Conectividad, cola offline y bloqueo de operador
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const offlineQueueCount = useMemo(() => offlineQueue.filter((q) => !q.rejected).length, [offlineQueue]);
  const offlineRejectedCount = useMemo(() => offlineQueue.filter((q) => q.rejected).length, [offlineQueue]);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState<boolean>(false);
  const [isTerminalLocked, setIsTerminalLocked] = useState<boolean>(false);

  // Clave temporal en RAM solo para operador cambiado sin conexión
  const offlineOperatorKeyRef = useRef<{ userId: string; signingKey: CryptoKey } | null>(null);
  const switchedOfflineUserRef = useRef<PosMe | null>(null);
  const snapshotHydratedRef = useRef<boolean>(false);

  // Tasa de cambio BCV / API
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [isFetchingExchangeRate, setIsFetchingExchangeRate] = useState<boolean>(false);

  // Modularidad & Feature Flags
  const [isModuleEnabled, setIsModuleEnabled] = useState<boolean>(true);
  const [isWarehouseEnabled, setIsWarehouseEnabled] = useState<boolean>(false);
  const [stockPolicy, setStockPolicy] = useState<'warn_and_allow' | 'strict_block' | 'allow_unrestricted'>('strict_block');
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [posFeatures, setPosFeatures] = useState<Record<string, boolean>>({
    pos_sales: true,
    pos_shifts: true,
    pos_payments: true,
    pos_cashea: true,
    pos_fiscal: true,
    pos_fiscal_reports: true,
    pos_c2p_debit: true,
    pos_multiticket: true,
    pos_scanner: true,
    pos_thermal_print: true,
    pos_blind_reconciliation: true,
    pos_exchange_rate_api: true,
    pos_returns: true,
    pos_authorizations: true,
    pos_documents: true,
    pos_kardex: true,
    pos_settings: true,
    pos_reports: true,
    pos_credit_sales: true,
    pos_digital_wallet: true,
    pos_customer_display: true,
    pos_whatsapp_receipt: true,
    pos_scale_weighing: true,
    pos_sales_commissions: true,
    pos_promotions_engine: true,
    pos_tenant_isolated_login: true,
    pos_supervisor_panel: true,
    pos_supervisor_users_crud: true,
    pos_order_dispatch_kds: true,
    pos_accounting_export: true,
  });

  const [selectedSalesRep, setSelectedSalesRep] = useState<PosSalesRep | null>(null);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState<boolean>(false);

  const isFuncActive = (funcKey: string): boolean => {
    if (!isModuleEnabled) return false;
    if (posFeatures[funcKey] === undefined) return true;
    return Boolean(posFeatures[funcKey]);
  };

  const refreshQueueState = useCallback(
    (slug = activeTenantSlug) => {
      setOfflineQueue(getOfflineQueue(slug));
    },
    [activeTenantSlug],
  );

  const api = `/api/t/${activeTenantSlug}/pos`;
  const getJson = async (path: string) => {
    const res = await fetch(`${api}${path}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
    return data;
  };

  const postJson = async (path: string, body: unknown) => {
    const res = await fetch(`${api}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
    return data;
  };

  // Ref de estado actual para persistir snapshot sin race conditions
  const latestStateRef = useRef({
    tenantId,
    tenantName,
    tenantCurrency,
    tenantCountry,
    tenantBranding,
    isModuleEnabled,
    isWarehouseEnabled,
    stockPolicy,
    catalogSource,
    posFeatures,
    me,
    staffUsers,
    supervisors,
    offlineOperators,
    settings,
    exchangeRate,
    branches,
    registers,
    activeBranchId,
    activeRegisterId,
    products,
    customers,
    sales,
    returns,
    shifts,
    cashMovements,
    activeShift,
    fiscalIntegration,
    lastSyncedAt,
  });
  latestStateRef.current = {
    tenantId,
    tenantName,
    tenantCurrency,
    tenantCountry,
    tenantBranding,
    isModuleEnabled,
    isWarehouseEnabled,
    stockPolicy,
    catalogSource,
    posFeatures,
    me,
    staffUsers,
    supervisors,
    offlineOperators,
    settings,
    exchangeRate,
    branches,
    registers,
    activeBranchId,
    activeRegisterId,
    products,
    customers,
    sales,
    returns,
    shifts,
    cashMovements,
    activeShift,
    fiscalIntegration,
    lastSyncedAt,
  };

  const persistSnapshotNow = useCallback(
    (overrides?: Partial<typeof latestStateRef.current>) => {
      if (!activeTenantSlug || !snapshotHydratedRef.current) return;
      const s = { ...latestStateRef.current, ...(overrides ?? {}) };
      if (!s.me && s.products.length === 0 && s.branches.length === 0) return;
      void saveOfflineSnapshot({
        slug: activeTenantSlug,
        tenantId: s.tenantId,
        savedAt: s.lastSyncedAt || new Date().toISOString(),
        tenantMeta: {
          tenantName: s.tenantName,
          tenantCurrency: s.tenantCurrency,
          tenantCountry: s.tenantCountry,
          tenantBranding: s.tenantBranding,
          isModuleEnabled: s.isModuleEnabled,
          isWarehouseEnabled: s.isWarehouseEnabled,
          stockPolicy: s.stockPolicy,
          catalogSource: s.catalogSource,
          posFeatures: s.posFeatures,
        },
        me: s.me,
        staffUsers: s.staffUsers,
        supervisors: s.supervisors,
        offlineOperators: s.offlineOperators,
        settings: s.settings,
        exchangeRate: s.exchangeRate,
        branches: s.branches,
        registers: s.registers,
        activeBranchId: s.activeBranchId,
        activeRegisterId: s.activeRegisterId,
        products: s.products,
        customers: s.customers,
        sales: s.sales,
        returns: s.returns,
        shifts: s.shifts,
        cashMovements: s.cashMovements,
        activeShift: s.activeShift,
        fiscalIntegration: s.fiscalIntegration,
      });
    },
    [activeTenantSlug],
  );

  // Firma de operador si se cambió de usuario en modo offline
  const signOfflineOperatorProof = useCallback(
    async (actionScope: string) => {
      const opKey = offlineOperatorKeyRef.current;
      const tId = latestStateRef.current.tenantId || settings.tenant_id;
      if (!opKey || !tId) return undefined;
      const proof = await signOfflineMessage(opKey.signingKey, `operator:${tId}:${opKey.userId}:${actionScope}`);
      return { operator_id: opKey.userId, proof };
    },
    [settings.tenant_id],
  );

  // Si aún quedan operaciones pendientes en cola, bloqueamos sobreescritura ciega desde servidor
  const hasUnsettledQueueFor = (types: OfflineOperation['type'][]) =>
    getOfflineQueue(activeTenantSlug).some((op) => types.includes(op.type));

  const reloadProducts = async () => {
    try {
      const data = await getJson('/products');
      if (!hasUnsettledQueueFor(['sale', 'sale_return'])) {
        setProducts(Array.isArray(data.products) ? data.products : []);
      }
      if (data.source === 'warehouse' || data.source === 'pos') setCatalogSource(data.source);
      if (data.stock_policy) setStockPolicy(data.stock_policy);
    } catch (err) {
      console.warn('[pos-context] reloadProducts error:', err);
    }
  };

  const reloadBranches = async () => {
    try {
      const data = await getJson('/branches');
      const list: PosBranch[] = Array.isArray(data.branches) ? data.branches : [];
      setBranches(list);
      if (list.length && !list.some((b) => b.id === activeBranchId)) setActiveBranchId(list[0].id);
    } catch (err) {
      console.warn('[pos-context] reloadBranches error:', err);
    }
  };

  const reloadRegisters = async () => {
    try {
      const data = await getJson('/registers');
      const list: PosRegister[] = Array.isArray(data.registers) ? data.registers : [];
      setRegisters(list);
      if (list.length && !list.some((r) => r.id === activeRegisterId)) setActiveRegisterId(list[0].id);
    } catch (err) {
      console.warn('[pos-context] reloadRegisters error:', err);
    }
  };

  const reloadCustomers = async () => {
    try {
      const data = await getJson('/customers');
      const list: PosCustomer[] = Array.isArray(data.customers) ? data.customers : [];
      if (!hasUnsettledQueueFor(['customer_create', 'sale'])) {
        setCustomers(list);
        setSelectedCustomer((prev) => (prev ? list.find((c) => c.id === prev.id) ?? prev : list[0] ?? null));
      }
    } catch (err) {
      console.warn('[pos-context] reloadCustomers error:', err);
    }
  };

  const reloadSettings = async () => {
    try {
      const data = await getJson('/settings');
      if (!hasUnsettledQueueFor(['settings_update'])) {
        setSettings(data.settings);
        setExchangeRate(Number(data.settings?.active_exchange_rate) || 0);
      }
      if (data.catalog_source) setCatalogSource(data.catalog_source);
      if (data.stock_policy) setStockPolicy(data.stock_policy);
    } catch (err) {
      console.warn('[pos-context] reloadSettings error:', err);
    }
  };

  const reloadSales = async () => {
    try {
      const data = await getJson('/sales?limit=500');
      if (!hasUnsettledQueueFor(['sale', 'debt_payment', 'dispatch', 'sale_return'])) {
        setSales(Array.isArray(data.sales) ? data.sales : []);
      }
    } catch (err) {
      console.warn('[pos-context] reloadSales error:', err);
    }
  };

  const reloadReturns = async () => {
    try {
      const data = await getJson('/returns');
      if (!hasUnsettledQueueFor(['sale_return'])) {
        setReturns(Array.isArray(data.returns) ? data.returns : []);
      }
    } catch (err) {
      console.warn('[pos-context] reloadReturns error:', err);
    }
  };

  const reloadShifts = async () => {
    try {
      const q = activeRegisterId ? `?register_id=${encodeURIComponent(activeRegisterId)}` : '';
      const data = await getJson(`/shifts${q}`);
      if (!hasUnsettledQueueFor(['shift_open', 'cash_movement', 'sale', 'debt_payment', 'sale_return', 'shift_close'])) {
        setShifts(Array.isArray(data.shifts) ? data.shifts : []);
        setActiveShift(data.active_shift ?? null);
        setCashMovements(Array.isArray(data.movements) ? data.movements : []);
      }
    } catch (err) {
      console.warn('[pos-context] reloadShifts error:', err);
    }
  };

  const reloadStaff = async () => {
    try {
      const [users, sup, bundleRes] = await Promise.all([
        getJson('/users'),
        getJson('/authorizations'),
        getJson('/offline-bundle').catch(() => null),
      ]);
      if (!switchedOfflineUserRef.current) {
        setMe(users.me ?? null);
      }
      setStaffUsers(Array.isArray(users.users) ? users.users : []);
      setSupervisors(Array.isArray(sup.supervisors) ? sup.supervisors : []);
      if (bundleRes?.ok) {
        if (bundleRes.tenant_id) setTenantId(bundleRes.tenant_id);
        if (Array.isArray(bundleRes.operators)) setOfflineOperators(bundleRes.operators);
      }
    } catch (err) {
      console.warn('[pos-context] reloadStaff error:', err);
    }
  };

  const reloadFiscalIntegration = async () => {
    try {
      const data = await getJson('/fiscal');
      if (data?.integration) setFiscalIntegration(data.integration);
    } catch {
      // Mantener caché local
    }
  };

  const reloadTenantFeatures = async () => {
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/features`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        if (data.tenant_id) setTenantId(data.tenant_id);
        setIsModuleEnabled(Boolean(data.is_module_enabled));
        setIsWarehouseEnabled(Boolean(data.is_warehouse_enabled));
        if (data.stock_policy) setStockPolicy(data.stock_policy);
        if (data.tenant_name) setTenantName(data.tenant_name);
        if (data.currency) setTenantCurrency(data.currency);
        if (data.country) setTenantCountry(data.country);
        if (data.branding) {
          setTenantBranding({
            primaryColor: data.branding.primary_color || '#285C49',
            secondaryColor: data.branding.secondary_color || '#A9BEA5',
            accentColor: data.branding.accent_color || '#C97857',
            loginBgColor: data.branding.login_background_color || '#F6F2E9',
            fontFamily: data.branding.font_family || 'Poppins',
            logoUrl: data.branding.logo_url || null,
            bannerUrl: data.branding.banner_url || null,
          });
        }
        if (data.functions) {
          setPosFeatures(data.functions);
        }
      }
    } catch {
      // Mantener configuración local segura
    }
  };

  // Hidratación inicial desde IndexedDB + sincronización online cuando hay red
  useEffect(() => {
    let cancelled = false;
    snapshotHydratedRef.current = false;
    switchedOfflineUserRef.current = null;
    offlineOperatorKeyRef.current = null;

    const boot = async () => {
      setParkedSales(loadParkedSalesLocal<ParkedSale>(activeTenantSlug));
      setOfflineQueue(getOfflineQueue(activeTenantSlug));

      const snap = await loadOfflineSnapshot(activeTenantSlug);
      if (cancelled) return;
      if (snap) {
        if (snap.tenantId) setTenantId(snap.tenantId);
        setTenantName(snap.tenantMeta.tenantName);
        setTenantCurrency(snap.tenantMeta.tenantCurrency);
        setTenantCountry(snap.tenantMeta.tenantCountry);
        setTenantBranding(snap.tenantMeta.tenantBranding);
        setIsModuleEnabled(snap.tenantMeta.isModuleEnabled);
        setIsWarehouseEnabled(snap.tenantMeta.isWarehouseEnabled);
        setStockPolicy(snap.tenantMeta.stockPolicy);
        setCatalogSource(snap.tenantMeta.catalogSource);
        setPosFeatures(snap.tenantMeta.posFeatures);
        setMe(snap.me);
        setStaffUsers(snap.staffUsers);
        setSupervisors(snap.supervisors);
        setOfflineOperators(snap.offlineOperators || []);
        setSettings(snap.settings);
        setExchangeRate(snap.exchangeRate);
        setBranches(snap.branches);
        setRegisters(snap.registers);
        if (snap.activeBranchId) setActiveBranchId(snap.activeBranchId);
        if (snap.activeRegisterId) setActiveRegisterId(snap.activeRegisterId);
        setProducts(snap.products);
        setCustomers(snap.customers);
        setSelectedCustomer((prev) => prev ?? snap.customers[0] ?? null);
        setSales(snap.sales);
        setReturns(snap.returns);
        setShifts(snap.shifts);
        setCashMovements(snap.cashMovements);
        setActiveShift(snap.activeShift);
        setFiscalIntegration(snap.fiscalIntegration ?? null);
        setLastSyncedAt(snap.savedAt);

        // Verificar si el usuario desbloqueó desde /login offline
        try {
          const unlockedRaw = sessionStorage.getItem(`vora_pos_offline_unlock_${activeTenantSlug}`);
          if (unlockedRaw) {
            sessionStorage.removeItem(`vora_pos_offline_unlock_${activeTenantSlug}`);
            const parsed = JSON.parse(unlockedRaw) as { userId?: string };
            if (parsed.userId && snap.me && parsed.userId !== snap.me.id) {
              setIsTerminalLocked(true);
            }
          }
        } catch {
          // Ignorar
        }
      }
      snapshotHydratedRef.current = true;

      if (typeof navigator === 'undefined' || navigator.onLine) {
        const pending = getOfflineQueue(activeTenantSlug);
        if (pending.some((q) => !q.rejected)) {
          await syncOfflineOperations(activeTenantSlug);
          refreshQueueState(activeTenantSlug);
        }
        await Promise.all([
          reloadTenantFeatures(),
          reloadSettings(),
          reloadProducts(),
          reloadBranches(),
          reloadRegisters(),
          reloadCustomers(),
          reloadStaff(),
          reloadSales(),
          reloadReturns(),
          reloadFiscalIntegration(),
        ]);
        if (!cancelled) {
          const nowIso = new Date().toISOString();
          setLastSyncedAt(nowIso);
          persistSnapshotNow({ lastSyncedAt: nowIso });
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantSlug]);

  // Turno abierto de la caja seleccionada
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    void reloadShifts().then(() => persistSnapshotNow());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantSlug, activeRegisterId]);

  // Persistir automáticamente cambios de estado en IndexedDB
  useEffect(() => {
    persistSnapshotNow();
  }, [
    persistSnapshotNow,
    products,
    customers,
    sales,
    returns,
    shifts,
    cashMovements,
    activeShift,
    settings,
    exchangeRate,
    branches,
    registers,
    activeBranchId,
    activeRegisterId,
    me,
    staffUsers,
    supervisors,
    offlineOperators,
    fiscalIntegration,
  ]);

  // Persistir ventas en espera
  useEffect(() => {
    saveParkedSalesLocal(activeTenantSlug, parkedSales);
  }, [activeTenantSlug, parkedSales]);

  // Escucha de conectividad y sincronización automática
  const triggerSyncOfflineSales = useCallback(async () => {
    const res = await syncOfflineOperations(activeTenantSlug);
    refreshQueueState(activeTenantSlug);
    if (res.syncedCount > 0) {
      await Promise.all([
        reloadSales(),
        reloadShifts(),
        reloadProducts(),
        reloadCustomers(),
        reloadReturns(),
        reloadSettings(),
      ]);
      const nowIso = new Date().toISOString();
      setLastSyncedAt(nowIso);
      persistSnapshotNow({ lastSyncedAt: nowIso });
      showNotification(
        'Datos sincronizados',
        `Se enviaron ${res.syncedCount} operación(es) pendiente(s) al servidor.`,
        'success',
      );
    }
    if (res.newlyRejected > 0) {
      showNotification(
        'Operaciones rechazadas al sincronizar',
        `${res.newlyRejected} operación(es) sin conexión fueron rechazadas. Abre "Pendientes / Rechazadas" para revisarlas.`,
        'critical',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantSlug]);

  const triggerSyncRef = useRef(triggerSyncOfflineSales);
  triggerSyncRef.current = triggerSyncOfflineSales;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      const q = getOfflineQueue(activeTenantSlug);
      setOfflineQueue(q);
      if (online && q.some((op) => !op.rejected)) {
        void triggerSyncRef.current();
      }
    };
    syncStatus();
    const onOnline = () => {
      setIsOnline(true);
      showNotification('Conexión reanudada', 'VORA POS reconectado. Sincronizando operaciones pendientes.', 'success');
      void triggerSyncRef.current();
    };
    const onOffline = () => {
      setIsOnline(false);
      showNotification('Modo sin conexión', 'Operando en contingencia local. Tus operaciones se sincronizarán al volver la red.', 'alert');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantSlug]);

  const retryOfflineOperation = async (id: string) => {
    retryRejectedOfflineOp(activeTenantSlug, id);
    refreshQueueState(activeTenantSlug);
    if (isOnline) {
      await triggerSyncOfflineSales();
    }
  };

  const discardOfflineOperation = (id: string) => {
    removeOfflineSale(activeTenantSlug, id);
    refreshQueueState(activeTenantSlug);
    if (isOnline) {
      void Promise.all([reloadSales(), reloadShifts(), reloadProducts(), reloadCustomers(), reloadReturns()]);
    }
    showNotification('Operación descartada', 'Registro removido de la cola local.', 'alert');
  };

  const addBranch = async (data: Omit<PosBranch, 'id' | 'created_at' | 'updated_at'>): Promise<PosBranch | null> => {
    try {
      const res = await postJson('/branches', data);
      await reloadBranches();
      return res.branch as PosBranch;
    } catch (err) {
      showNotification('No se pudo crear la sede', (err as Error).message, 'critical');
      return null;
    }
  };

  const addRegister = async (data: Omit<PosRegister, 'id' | 'created_at' | 'updated_at'>): Promise<PosRegister | null> => {
    try {
      const res = await postJson('/registers', data);
      await reloadRegisters();
      return res.register as PosRegister;
    } catch (err) {
      showNotification('No se pudo crear la caja', (err as Error).message, 'critical');
      return null;
    }
  };

  const addCustomer = async (
    data: Omit<
      PosCustomer,
      'id' | 'tenant_id' | 'total_purchases_count' | 'total_purchases_usd' | 'last_purchase_at' | 'created_at' | 'updated_at'
    >,
  ): Promise<PosCustomer | null> => {
    if (isOnline) {
      try {
        const res = await postJson('/customers', data);
        const created = res.customer as PosCustomer;
        setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
        return created;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          showNotification('No se pudo registrar el cliente', (err as Error).message, 'critical');
          return null;
        }
      }
    }

    const tempId = makeOpKey('off-cust');
    const now = new Date().toISOString();
    const provisional: PosCustomer = {
      id: tempId,
      tenant_id: tenantId || settings.tenant_id || '',
      document_type: data.document_type,
      document_number: data.document_number,
      legal_name: data.legal_name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      fiscal_address: data.fiscal_address ?? null,
      customer_tier: data.customer_tier || 'nuevo',
      total_purchases_count: 0,
      total_purchases_usd: 0,
      last_purchase_at: null,
      wallet_balance_usd: 0,
      created_at: now,
      updated_at: now,
    };
    enqueueOfflineOp(activeTenantSlug, {
      type: 'customer_create',
      tempId,
      summary: `Cliente: ${data.legal_name} (${data.document_type}-${data.document_number})`,
      payload: data,
    });
    refreshQueueState(activeTenantSlug);
    setCustomers((prev) => [provisional, ...prev]);
    showNotification('Cliente guardado sin conexión', `${provisional.legal_name} encolado para sincronizar.`, 'alert');
    return provisional;
  };

  const saveSettings = async (patch: Record<string, unknown>) => {
    const opKey = makeOpKey('cfg');
    const offlineOpAuth = await signOfflineOperatorProof(`settings:${opKey}`);
    const body = { action: 'update_settings', ...patch, offline_op_key: opKey, ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}) };

    if (isOnline) {
      try {
        const res = await fetch(`${api}/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) return { ok: false, error: await apiError(res, 'No se pudo guardar la configuración.') };
        const data = await res.json();
        setSettings(data.settings);
        setExchangeRate(Number(data.settings?.active_exchange_rate) || 0);
        return { ok: true };
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    enqueueOfflineOp(activeTenantSlug, {
      type: 'settings_update',
      summary: 'Actualización de parámetros POS sin conexión',
      payload: body,
    });
    refreshQueueState(activeTenantSlug);
    setSettings((prev) => ({
      ...prev,
      ...(patch as Partial<PosSettings>),
      updated_at: new Date().toISOString(),
    }));
    if (typeof patch.active_exchange_rate === 'number' && patch.active_exchange_rate > 0) {
      setExchangeRate(patch.active_exchange_rate);
    }
    return { ok: true };
  };

  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? branches[0] ?? EMPTY_BRANCH;
  const activeRegister = registers.find((r) => r.id === activeRegisterId) ?? registers[0] ?? EMPTY_REGISTER;

  // Pantalla Cliente en vivo (IPC Electron + BroadcastChannel + localStorage)
  useEffect(() => {
    if (!activeTenantSlug) return;
    const totalUsd = cart.reduce((sum, item) => sum + item.lineTotalUsd, 0);
    const totalVes = Number((totalUsd * exchangeRate).toFixed(2));
    const isPmEnabled = settings.active_methods.includes('pago_movil');
    const pmCfg = settings.pago_movil_config ?? null;
    publishCustomerDisplayState({
      tenantSlug: activeTenantSlug,
      tenantName: tenantName || 'VORA COMMERCE',
      logoUrl: tenantBranding.logoUrl,
      primaryColor: tenantBranding.primaryColor || '#1E6B4E',
      branchName: activeBranch.name,
      registerName: activeRegister.name,
      exchangeRate,
      customerName: selectedCustomer?.legal_name ?? null,
      customerTier: selectedCustomer?.customer_tier ?? null,
      items: cart.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPriceUsd: l.unitPriceUsd,
        discountPercent: l.discountPercent,
        lineTotalUsd: l.lineTotalUsd,
      })),
      totalUsd,
      totalVes,
      isPagoMovilEnabled: isPmEnabled,
      pagoMovilConfig: pmCfg,
      qrPayload: isPmEnabled && pmCfg ? formatPagoMovilQrPayload(pmCfg, totalVes, tenantName) : null,
      updatedAt: Date.now(),
    });
  }, [
    activeTenantSlug,
    tenantName,
    tenantBranding.logoUrl,
    tenantBranding.primaryColor,
    activeBranch.name,
    activeRegister.name,
    exchangeRate,
    selectedCustomer,
    cart,
    settings.active_methods,
    settings.pago_movil_config,
  ]);

  const activeUser: PosMe = me ?? {
    id: '',
    name: 'Cargando…',
    email: null,
    role: '',
    has_pin: false,
    can_approve: false,
    permissions: {},
  };
  const can = (permission: string) =>
    Boolean(me && (me.role === 'tenant_admin' || me.role === 'super_admin' || me.permissions[permission]));

  const refreshActiveShift = async () => {
    await reloadShifts();
  };

  const showNotification = (title: string, detail: string, type: 'success' | 'alert' | 'critical' = 'success') => {
    setToasts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.title === title && last.detail === detail && last.type === type) return prev;
      return [...prev, { id: Date.now() + Math.random(), title, detail, type }].slice(-4);
    });
  };

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearNotification = () => setToasts([]);

  const refreshExchangeRate = async (customUrl?: string): Promise<{ ok: boolean; rate?: number; error?: string }> => {
    if (!isOnline) {
      return { ok: false, error: 'Sin conexión para consultar tasa BCV.' };
    }
    setIsFetchingExchangeRate(true);
    try {
      const data = await postJson('/exchange-rate', { action: 'refresh', ...(customUrl ? { url: customUrl } : {}) });
      const newRate = Number(data.rate);
      setExchangeRate(newRate);
      if (data.settings) {
        setSettings((prev) => ({
          ...prev,
          ...data.settings,
          pago_movil_config: data.settings.pago_movil_config ?? prev.pago_movil_config,
        }));
      }
      showNotification(
        'Tasa BCV sincronizada',
        `Tasa oficial actualizada: ${newRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} VES/USD (${data.source || 'API'}).`,
        'success',
      );
      return { ok: true, rate: newRate };
    } catch (err) {
      const msg = (err as Error).message || 'No se pudo conectar con la API de tasa';
      showNotification('Error al sincronizar tasa', msg, 'critical');
      return { ok: false, error: msg };
    } finally {
      setIsFetchingExchangeRate(false);
    }
  };

  useEffect(() => {
    if (settings.tenant_id && settings.auto_fetch_exchange_rate !== false && isOnline) {
      void refreshExchangeRate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.tenant_id]);

  const ensureDraftSaleKey = useCallback(() => {
    if (draftSaleKey) return draftSaleKey;
    const reg = activeRegisterId || activeRegister.id || 'reg';
    const nextKey = `sale-${reg}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDraftSaleKey(nextKey);
    return nextKey;
  }, [draftSaleKey, activeRegisterId, activeRegister.id]);

  // Firma de supervisor sin conexión
  const signOfflineSupervisorProof = async (params: {
    supervisorId: string;
    pin: string;
    operationType: string;
    scopeKey: string;
    permission: string;
  }): Promise<
    | { ok: true; supervisorId: string; proof: string; authorizedAt: string }
    | { ok: false; error: string }
  > => {
    const tId = tenantId || settings.tenant_id;
    if (!tId) return { ok: false, error: 'Falta identificador de la empresa en caché local.' };
    const op = offlineOperators.find((o) => o.id === params.supervisorId);
    if (!op) return { ok: false, error: 'Supervisor no encontrado en el paquete offline.' };
    if (op.role !== 'tenant_admin' && !op.permissions[params.permission]) {
      return { ok: false, error: 'Ese usuario no tiene permiso para aprobar esta operación.' };
    }
    const message = `supervisor:${tId}:${params.supervisorId}:${params.operationType}:${params.scopeKey}`;
    const signed = await verifyAndSignOfflineProof({
      slug: activeTenantSlug,
      userId: params.supervisorId,
      bundle: op.offline_bundle,
      pin: params.pin,
      message,
    });
    if (!signed.ok) return signed;
    return {
      ok: true,
      supervisorId: params.supervisorId,
      proof: signed.proof,
      authorizedAt: new Date().toISOString(),
    };
  };

  const requestSupervisorAuthorization: PosContextType['requestSupervisorAuthorization'] = async (params) => {
    const saleKey = params.saleIdempotencyKey || ensureDraftSaleKey();
    if (isOnline) {
      try {
        const data = await postJson('/authorizations', {
          supervisorId: params.supervisorId,
          pin: params.pin,
          operationType: params.operationType,
          reason: params.reason,
          limitSnapshot: params.limitSnapshot ?? {},
          shiftId: activeShift?.id ?? null,
          branchId: activeBranch.id || null,
        });
        // Si además tenemos bundle offline, generamos respaldo por si la venta cae offline >10m antes de cobrar
        let fallbackOffline: OfflineDiscountAuth | undefined;
        const offSigned = await signOfflineSupervisorProof({
          supervisorId: params.supervisorId,
          pin: params.pin,
          operationType: params.operationType,
          scopeKey: saleKey,
          permission: 'pos.sales.discount.override',
        });
        if (offSigned.ok) {
          fallbackOffline = {
            supervisor_id: offSigned.supervisorId,
            proof: offSigned.proof,
            authorized_at: offSigned.authorizedAt,
            reason: params.reason,
            limit_snapshot: params.limitSnapshot ?? {},
          };
        }
        return {
          ok: true,
          authorizationId: data.authorization.id as string,
          offlineDiscountAuth: fallbackOffline,
          approverName: data.authorization.approver_name_snapshot as string | null,
        };
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    const signed = await signOfflineSupervisorProof({
      supervisorId: params.supervisorId,
      pin: params.pin,
      operationType: params.operationType,
      scopeKey: saleKey,
      permission: 'pos.sales.discount.override',
    });
    if (!signed.ok) return { ok: false, error: signed.error };
    const supName =
      supervisors.find((s) => s.id === params.supervisorId)?.name ||
      offlineOperators.find((o) => o.id === params.supervisorId)?.name ||
      'Supervisor';
    return {
      ok: true,
      authorizationId: `off-auth-${Date.now()}`,
      offlineDiscountAuth: {
        supervisor_id: signed.supervisorId,
        proof: signed.proof,
        authorized_at: signed.authorizedAt,
        reason: params.reason,
        limit_snapshot: params.limitSnapshot ?? {},
      },
      approverName: supName,
      offline: true,
    };
  };

  const switchOperator: PosContextType['switchOperator'] = async (params) => {
    if (isOnline) {
      try {
        const res = await postJson('/switch-operator', { userId: params.userId, pin: params.pin });
        if (res?.me) {
          switchedOfflineUserRef.current = null;
          offlineOperatorKeyRef.current = null;
          setMe(res.me);
          await Promise.all([reloadStaff(), reloadShifts()]);
          return { ok: true };
        }
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    const op = offlineOperators.find((o) => o.id === params.userId);
    if (!op) return { ok: false, error: 'Operador no encontrado en caché offline.' };
    const unlocked = await verifyPinAndUnlockKey({
      slug: activeTenantSlug,
      userId: op.id,
      bundle: op.offline_bundle,
      pin: params.pin,
    });
    if (!unlocked.ok) return unlocked;

    offlineOperatorKeyRef.current = { userId: op.id, signingKey: unlocked.signingKey };
    const nextMe: PosMe = {
      id: op.id,
      name: op.name,
      email: staffUsers.find((u) => u.id === op.id)?.email ?? null,
      role: op.role,
      has_pin: op.has_pin,
      offline_pin_ready: op.offline_pin_ready,
      can_approve: op.can_approve,
      permissions: op.permissions,
    };
    switchedOfflineUserRef.current = nextMe;
    setMe(nextMe);
    return { ok: true };
  };

  const clearOfflineSigningSession = useCallback(() => {
    offlineOperatorKeyRef.current = null;
    switchedOfflineUserRef.current = null;
  }, []);

  // Apertura de turno (online + offline)
  const openShift: PosContextType['openShift'] = async (params) => {
    const opKey = makeOpKey('shopen');
    const offlineOpAuth = await signOfflineOperatorProof(`shift_open:${opKey}`);
    const body = {
      action: 'open',
      branch_id: params.branchId,
      register_id: params.registerId,
      cashier_name: activeUser.name,
      opening_usd: params.openingUsd,
      opening_ves: params.openingVes,
      notes: params.notes || undefined,
      offline_op_key: opKey,
      ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}),
    };

    if (isOnline) {
      try {
        const res = await fetch(`${api}/shifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data.shift) {
          await reloadShifts();
          return { ok: true, shift: data.shift as PosShift };
        }
        if (res.status >= 400 && res.status < 500) {
          return { ok: false, error: data?.error ?? 'No se pudo abrir el turno.' };
        }
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    if (activeShift && activeShift.status === 'abierto') {
      return { ok: false, error: 'La caja seleccionada ya posee un turno abierto.' };
    }
    const existingOwn = shifts.find((s) => s.cashier_user_id === activeUser.id && s.status === 'abierto');
    if (existingOwn) {
      return { ok: false, error: 'Ya tienes un turno abierto en otra caja. Ciérralo antes de abrir uno nuevo.' };
    }

    const tempId = makeOpKey('off-shift');
    const now = new Date().toISOString();
    const provisionalShift: PosShift = {
      id: tempId,
      tenant_id: tenantId || settings.tenant_id || '',
      branch_id: params.branchId,
      register_id: params.registerId,
      cashier_user_id: activeUser.id,
      cashier_name_snapshot: activeUser.name,
      status: 'abierto',
      opened_at: now,
      closed_at: null,
      opening_amount_usd: params.openingUsd,
      opening_amount_ves: params.openingVes,
      expected_totals: {
        efectivo_usd: round2(params.openingUsd),
        efectivo_ves: round2(params.openingVes),
        pago_movil_ves: 0,
        tarjeta_ves: 0,
        cashea_usd: 0,
      },
      declared_totals: {},
      differences_totals: {},
      opening_notes: params.notes?.trim() || null,
      closing_justification: null,
      closed_by: null,
      created_at: now,
    };

    enqueueOfflineOp(activeTenantSlug, {
      type: 'shift_open',
      tempId,
      summary: `Apertura turno ($${params.openingUsd.toFixed(2)} / Bs.${params.openingVes.toFixed(2)})`,
      payload: body,
    });
    refreshQueueState(activeTenantSlug);
    setActiveShift(provisionalShift);
    setShifts((prev) => [provisionalShift, ...prev]);
    return { ok: true, shift: provisionalShift, offline: true };
  };

  // Movimientos de caja (online + offline)
  const addCashMovement: PosContextType['addCashMovement'] = async (params) => {
    const opKey = makeOpKey('mov');
    const offlineOpAuth = await signOfflineOperatorProof(`movement:${opKey}`);
    const isSupervisor = can('pos.refunds.approve');
    const needsPin = params.movementType === 'retiro_efectivo' && settings.require_pin_for_withdrawals !== false && !isSupervisor;

    let offlineSupAuth: { supervisor_id: string; proof: string; authorized_at: string } | undefined;
    if (!isOnline && needsPin) {
      if (!params.supervisorId || !params.supervisorPin) {
        return { ok: false, error: 'Los retiros de efectivo requieren el PIN de un supervisor.' };
      }
      const signed = await signOfflineSupervisorProof({
        supervisorId: params.supervisorId,
        pin: params.supervisorPin,
        operationType: 'cash_movement',
        scopeKey: opKey,
        permission: 'pos.refunds.approve',
      });
      if (!signed.ok) return { ok: false, error: signed.error };
      offlineSupAuth = {
        supervisor_id: signed.supervisorId,
        proof: signed.proof,
        authorized_at: signed.authorizedAt,
      };
    }

    const body = {
      action: 'movement',
      shift_id: params.shiftId,
      movement_type: params.movementType,
      currency: params.currency,
      amount: params.amount,
      reason: params.reason,
      offline_op_key: opKey,
      ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}),
      ...(needsPin && !offlineSupAuth
        ? { supervisor_id: params.supervisorId, supervisor_pin: params.supervisorPin }
        : {}),
      ...(offlineSupAuth ? { offline_supervisor_auth: offlineSupAuth } : {}),
    };

    if (isOnline) {
      try {
        const res = await fetch(`${api}/shifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          await reloadShifts();
          return { ok: true };
        }
        if (res.status >= 400 && res.status < 500) {
          return { ok: false, error: data?.error ?? 'No se pudo registrar el movimiento.' };
        }
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    if (needsPin && !offlineSupAuth) {
      if (!params.supervisorId || !params.supervisorPin) {
        return { ok: false, error: 'Los retiros de efectivo requieren el PIN de un supervisor.' };
      }
      const signed = await signOfflineSupervisorProof({
        supervisorId: params.supervisorId,
        pin: params.supervisorPin,
        operationType: 'cash_movement',
        scopeKey: opKey,
        permission: 'pos.refunds.approve',
      });
      if (!signed.ok) return { ok: false, error: signed.error };
      offlineSupAuth = {
        supervisor_id: signed.supervisorId,
        proof: signed.proof,
        authorized_at: signed.authorizedAt,
      };
      (body as any).offline_supervisor_auth = offlineSupAuth;
      delete (body as any).supervisor_id;
      delete (body as any).supervisor_pin;
    }

    if (!activeShift || activeShift.id !== params.shiftId || activeShift.status !== 'abierto') {
      return { ok: false, error: 'El turno no está abierto.' };
    }
    const bucket = params.currency === 'USD' ? 'efectivo_usd' : 'efectivo_ves';
    const delta = params.movementType === 'retiro_efectivo' ? -params.amount : params.amount;
    if ((activeShift.expected_totals?.[bucket] ?? 0) + delta < 0) {
      return { ok: false, error: 'El retiro excede el efectivo esperado en caja.' };
    }

    const tempId = makeOpKey('off-mov');
    const movement: PosCashMovement = {
      id: tempId,
      tenant_id: activeShift.tenant_id,
      branch_id: activeShift.branch_id,
      shift_id: activeShift.id,
      movement_type: params.movementType,
      currency: params.currency,
      amount: params.amount,
      reason: params.reason,
      performed_by: activeUser.id,
      authorization_id: offlineSupAuth ? 'offline-pin' : null,
      created_at: new Date().toISOString(),
    };

    const nextExpected = {
      ...activeShift.expected_totals,
      [bucket]: round2((activeShift.expected_totals?.[bucket] ?? 0) + delta),
    };
    const nextShift: PosShift = { ...activeShift, expected_totals: nextExpected };

    enqueueOfflineOp(activeTenantSlug, {
      type: 'cash_movement',
      tempId,
      summary: `${params.movementType}: ${params.amount} ${params.currency}`,
      payload: body,
    });
    refreshQueueState(activeTenantSlug);
    setActiveShift(nextShift);
    setShifts((prev) => prev.map((s) => (s.id === nextShift.id ? nextShift : s)));
    setCashMovements((prev) => [movement, ...prev]);
    return { ok: true, offline: true };
  };

  // Cierre de turno (online + offline)
  const closeShift: PosContextType['closeShift'] = async (params) => {
    const opKey = makeOpKey('shclose');
    const offlineOpAuth = await signOfflineOperatorProof(`shift_close:${opKey}`);
    const body = {
      action: 'close',
      shift_id: params.shiftId,
      declared: params.declared,
      justification: params.justification?.trim() || undefined,
      offline_op_key: opKey,
      ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}),
    };

    if (isOnline) {
      try {
        const res = await fetch(`${api}/shifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          await reloadShifts();
          return { ok: true, shift: data.shift as PosShift };
        }
        if (res.status >= 400 && res.status < 500) {
          return { ok: false, error: data?.error ?? 'No se pudo cerrar el turno.' };
        }
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    const target = shifts.find((s) => s.id === params.shiftId) ?? activeShift;
    if (!target || target.status === 'cerrado') {
      return { ok: false, error: 'El turno no existe o ya se encuentra cerrado.' };
    }
    const diffs: Record<string, number> = {};
    let hasDiff = false;
    for (const k of ['efectivo_usd', 'efectivo_ves', 'pago_movil_ves', 'tarjeta_ves', 'cashea_usd']) {
      const diff = round2((params.declared[k] ?? 0) - (target.expected_totals?.[k] ?? 0));
      diffs[k] = diff;
      if (diff !== 0) hasDiff = true;
    }
    if (hasDiff && (!params.justification || params.justification.trim().length < 5)) {
      return { ok: false, error: 'Diferencia detectada en el arqueo: ingresa una justificación de al menos 5 caracteres.' };
    }

    const closed: PosShift = {
      ...target,
      status: 'cerrado',
      closed_at: new Date().toISOString(),
      closed_by: activeUser.id,
      declared_totals: params.declared,
      differences_totals: diffs,
      closing_justification: params.justification?.trim() || null,
    };

    enqueueOfflineOp(activeTenantSlug, {
      type: 'shift_close',
      targetId: target.id,
      summary: `Cierre de turno (${target.cashier_name_snapshot ?? activeUser.name})`,
      payload: body,
    });
    refreshQueueState(activeTenantSlug);
    setActiveShift(null);
    setShifts((prev) => prev.map((s) => (s.id === closed.id ? closed : s)));
    return { ok: true, shift: closed, offline: true };
  };

  // Registrar venta offline + actualizar stock, ventas, cliente y turno localmente
  const recordOfflineSale: PosContextType['recordOfflineSale'] = async ({ salePayload, provisionalSale }) => {
    const idempKey = String(salePayload.idempotency_key);
    const offlineOpAuth = await signOfflineOperatorProof(`sale:${idempKey}`);
    const payloadToQueue = {
      ...salePayload,
      ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}),
      ...(offlineDiscountAuth ? { offline_discount_auth: offlineDiscountAuth } : {}),
    };
    const tempSaleId = provisionalSale.id;
    enqueueOfflineOp(activeTenantSlug, {
      type: 'sale',
      tempId: tempSaleId,
      summary: `Venta ${provisionalSale.sale_number} ($${provisionalSale.total_usd.toFixed(2)} USD)`,
      payload: payloadToQueue,
    });
    refreshQueueState(activeTenantSlug);

    // 1. Insertar venta provisional en historial local
    setSales((prev) => [provisionalSale, ...prev]);

    // 2. Descontar stock local del catálogo
    setProducts((prev) =>
      prev.map((p) => {
        const soldQty = (provisionalSale.lines ?? [])
          .filter((l) => !l.is_service && (l.product_id === p.id || l.sku_snapshot === p.sku))
          .reduce((sum, l) => sum + l.quantity, 0);
        if (soldQty <= 0) return p;
        const nextStock = Math.max(stockPolicy === 'strict_block' ? 0 : -999999, p.stock_quantity - soldQty);
        return {
          ...p,
          stock_quantity: nextStock,
          status: p.status === 'descontinuado' ? p.status : nextStock <= 0 ? 'agotado' : 'disponible',
        };
      }),
    );

    // 3. Actualizar expected_totals del turno activo
    if (activeShift && activeShift.id === provisionalSale.shift_id) {
      const nextExp = { ...activeShift.expected_totals };
      for (const pay of provisionalSale.payments ?? []) {
        if (pay.method === 'efectivo') {
          const k = pay.currency === 'USD' ? 'efectivo_usd' : 'efectivo_ves';
          nextExp[k] = round2((nextExp[k] ?? 0) + (pay.amount_applied - pay.change_amount));
        } else if (pay.method === 'pago_movil') {
          nextExp['pago_movil_ves'] = round2((nextExp['pago_movil_ves'] ?? 0) + pay.amount_applied);
        } else if (pay.method === 'tarjeta') {
          nextExp['tarjeta_ves'] = round2((nextExp['tarjeta_ves'] ?? 0) + pay.amount_applied);
        } else if (pay.method === 'cashea') {
          const usdAmt = pay.currency === 'USD' ? pay.amount_applied : pay.exchange_rate_snapshot > 0 ? pay.amount_applied / pay.exchange_rate_snapshot : 0;
          nextExp['cashea_usd'] = round2((nextExp['cashea_usd'] ?? 0) + usdAmt);
        }
      }
      const nextShift: PosShift = { ...activeShift, expected_totals: nextExp };
      setActiveShift(nextShift);
      setShifts((prev) => prev.map((s) => (s.id === nextShift.id ? nextShift : s)));
    }

    // 4. Actualizar cliente / billetera digital local
    if (provisionalSale.customer_id) {
      const used = Number(salePayload.wallet_used_usd ?? 0);
      const dep = Number(salePayload.wallet_change_deposited_usd ?? 0);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === provisionalSale.customer_id
            ? {
              ...c,
              total_purchases_count: c.total_purchases_count + 1,
              total_purchases_usd: round2(c.total_purchases_usd + provisionalSale.total_usd),
              last_purchase_at: provisionalSale.created_at,
              wallet_balance_usd: Math.max(0, round2((c.wallet_balance_usd ?? 0) - used + dep)),
            }
            : c,
        ),
      );
    }

    return { ok: true, sale: provisionalSale };
  };

  // Abonos a CxC (online + offline)
  const recordDebtPayment: PosContextType['recordDebtPayment'] = async (params) => {
    const idempKey = `abono-${params.saleId}-${Date.now()}`;
    const offlineOpAuth = await signOfflineOperatorProof(`debt:${idempKey}`);
    const body = {
      action: 'debt_payment',
      shift_id: params.shiftId,
      method: params.method,
      currency: params.currency,
      amount: params.amount,
      reference_number: params.referenceNumber || undefined,
      idempotency_key: idempKey,
      ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}),
    };

    if (isOnline && !params.saleId.startsWith('off-')) {
      try {
        const res = await fetch(`${api}/sales/${params.saleId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          await Promise.all([reloadSales(), reloadShifts()]);
          return { ok: true, balanceDueUsd: Number(data.sale?.balance_due_usd ?? 0) };
        }
        if (res.status >= 400 && res.status < 500) {
          return { ok: false, error: data?.error ?? 'Error al registrar abono.' };
        }
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    const sale = sales.find((s) => s.id === params.saleId);
    if (!sale) return { ok: false, error: 'Venta no encontrada.' };
    if (sale.balance_due_usd <= 0) return { ok: false, error: 'La venta ya está saldada.' };

    const rate = sale.exchange_rate_snapshot || exchangeRate || 1;
    const usdAmount = params.currency === 'USD' ? params.amount : params.amount / rate;
    const appliedUsd = round2(Math.min(usdAmount, sale.balance_due_usd));
    const nextBalance = Math.max(0, round2(sale.balance_due_usd - appliedUsd));
    const nextPaid = round2(sale.paid_total_usd + appliedUsd);

    enqueueOfflineOp(activeTenantSlug, {
      type: 'debt_payment',
      targetId: params.saleId,
      summary: `Abono CxC ${sale.sale_number} ($${appliedUsd.toFixed(2)} USD)`,
      payload: body,
    });
    refreshQueueState(activeTenantSlug);

    setSales((prev) =>
      prev.map((s) =>
        s.id === params.saleId
          ? {
            ...s,
            paid_total_usd: nextPaid,
            paid_total_ves: round2(nextPaid * rate),
            balance_due_usd: nextBalance,
            balance_due_ves: round2(nextBalance * rate),
            payment_status: nextBalance <= 0.05 ? 'pagada' : 'parcial',
          }
          : s,
      ),
    );

    if (activeShift && activeShift.id === params.shiftId) {
      const nextExp = { ...activeShift.expected_totals };
      if (params.method === 'efectivo') {
        const k = params.currency === 'USD' ? 'efectivo_usd' : 'efectivo_ves';
        nextExp[k] = round2((nextExp[k] ?? 0) + (params.currency === 'USD' ? appliedUsd : round2(appliedUsd * rate)));
      } else if (params.method === 'pago_movil') {
        nextExp['pago_movil_ves'] = round2((nextExp['pago_movil_ves'] ?? 0) + round2(appliedUsd * rate));
      } else if (params.method === 'tarjeta') {
        nextExp['tarjeta_ves'] = round2((nextExp['tarjeta_ves'] ?? 0) + round2(appliedUsd * rate));
      }
      const nextShift: PosShift = { ...activeShift, expected_totals: nextExp };
      setActiveShift(nextShift);
      setShifts((prev) => prev.map((s) => (s.id === nextShift.id ? nextShift : s)));
    }

    return { ok: true, balanceDueUsd: nextBalance, offline: true };
  };

  // Devoluciones y anulaciones (online + offline)
  const recordSaleReturn: PosContextType['recordSaleReturn'] = async (params) => {
    const idempKey = `ret-${params.originalSale.id}-${Date.now()}`;
    const offlineOpAuth = await signOfflineOperatorProof(`return:${idempKey}`);
    const isSupervisor = can('pos.refunds.approve');

    let offlineSupAuth: { supervisor_id: string; proof: string; authorized_at: string } | undefined;
    if (!isOnline && !isSupervisor) {
      if (!params.supervisorId || !params.supervisorPin) {
        return { ok: false, error: 'Seleccione el supervisor e ingrese su PIN.' };
      }
      const signed = await signOfflineSupervisorProof({
        supervisorId: params.supervisorId,
        pin: params.supervisorPin,
        operationType: 'sale_return',
        scopeKey: idempKey,
        permission: 'pos.refunds.approve',
      });
      if (!signed.ok) return { ok: false, error: signed.error };
      offlineSupAuth = {
        supervisor_id: signed.supervisorId,
        proof: signed.proof,
        authorized_at: signed.authorizedAt,
      };
    }

    const body = {
      idempotency_key: idempKey,
      original_sale_id: params.originalSale.id,
      shift_id: params.shiftId,
      return_type: params.returnType,
      lines: params.lines.map((l) => ({
        sale_line_id: l.saleLineId,
        line_index: l.lineIndex,
        sku: l.sku,
        quantity_returned: l.quantity,
        condition: l.condition,
      })),
      reason: params.reason,
      notes: params.notes,
      refund_method: params.refundMethod,
      ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}),
      ...(isSupervisor
        ? {}
        : offlineSupAuth
          ? { offline_supervisor_auth: offlineSupAuth }
          : { supervisor_id: params.supervisorId, supervisor_pin: params.supervisorPin }),
    };

    if (isOnline && !params.originalSale.id.startsWith('off-')) {
      try {
        const res = await fetch(`${api}/returns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data.return_record) {
          await Promise.all([reloadProducts(), reloadSales(), reloadReturns(), reloadShifts()]);
          return {
            ok: true,
            returnNumber: data.return_record.return_number,
            totalRefundedUsd: Number(data.return_record.total_refunded_usd || 0),
          };
        }
        if (res.status >= 400 && res.status < 500) {
          return { ok: false, error: data?.error ?? 'El servidor rechazó la devolución.' };
        }
      } catch (err) {
        if (!isNetworkFailure(err)) {
          return { ok: false, error: (err as Error).message };
        }
      }
    }

    if (!isSupervisor && !offlineSupAuth) {
      if (!params.supervisorId || !params.supervisorPin) {
        return { ok: false, error: 'Seleccione el supervisor e ingrese su PIN.' };
      }
      const signed = await signOfflineSupervisorProof({
        supervisorId: params.supervisorId,
        pin: params.supervisorPin,
        operationType: 'sale_return',
        scopeKey: idempKey,
        permission: 'pos.refunds.approve',
      });
      if (!signed.ok) return { ok: false, error: signed.error };
      offlineSupAuth = {
        supervisor_id: signed.supervisorId,
        proof: signed.proof,
        authorized_at: signed.authorizedAt,
      };
      (body as any).offline_supervisor_auth = offlineSupAuth;
      delete (body as any).supervisor_id;
      delete (body as any).supervisor_pin;
    }

    let totalRefundedUsd = 0;
    const origLines = params.originalSale.lines ?? [];
    for (const reqLine of params.lines) {
      const sl = origLines.find((x) => x.id === reqLine.saleLineId) ?? origLines[reqLine.lineIndex];
      if (!sl) continue;
      totalRefundedUsd += round2((sl.line_total_usd / sl.quantity) * reqLine.quantity);
    }
    totalRefundedUsd = round2(totalRefundedUsd);
    const rate = params.originalSale.exchange_rate_snapshot || exchangeRate || 1;
    const totalRefundedVes = round2(totalRefundedUsd * rate);

    if (params.refundMethod === 'efectivo_usd' || params.refundMethod === 'efectivo_ves') {
      const amt = params.refundMethod === 'efectivo_usd' ? totalRefundedUsd : totalRefundedVes;
      const avail = activeShift?.expected_totals?.[params.refundMethod] ?? 0;
      if (avail < amt) {
        return { ok: false, error: 'No hay efectivo suficiente en caja para el reembolso.' };
      }
    }

    const tempRetId = makeOpKey('off-ret');
    const retNum = `DEV-PEND-${idempKey.slice(-4).toUpperCase()}`;
    const provisionalReturn: PosSaleReturn = {
      id: tempRetId,
      tenant_id: params.originalSale.tenant_id,
      branch_id: params.originalSale.branch_id,
      original_sale_id: params.originalSale.id,
      shift_id: params.shiftId,
      return_number: retNum,
      return_type: params.returnType,
      reason: params.reason,
      notes: params.notes ?? null,
      requested_by: activeUser.id,
      approved_by: isSupervisor ? activeUser.id : offlineSupAuth?.supervisor_id ?? activeUser.id,
      authorization_id: null,
      total_refunded_usd: totalRefundedUsd,
      total_refunded_ves: totalRefundedVes,
      refund_method: params.refundMethod,
      stock_reversal_reference: null,
      financial_reversal_reference: null,
      created_at: new Date().toISOString(),
    };

    enqueueOfflineOp(activeTenantSlug, {
      type: 'sale_return',
      tempId: tempRetId,
      summary: `Devolución ${retNum} (-$${totalRefundedUsd.toFixed(2)} USD)`,
      payload: body,
    });
    refreshQueueState(activeTenantSlug);

    setReturns((prev) => [provisionalReturn, ...prev]);

    // Actualizar líneas y estado de venta localmente
    setSales((prev) =>
      prev.map((s) => {
        if (s.id !== params.originalSale.id) return s;
        const nextLines = (s.lines ?? []).map((sl, idx) => {
          const match = params.lines.find((l) => l.saleLineId === sl.id || l.lineIndex === idx);
          return match ? { ...sl, returned_quantity: sl.returned_quantity + match.quantity } : sl;
        });
        const anyPending = nextLines.some((sl) => sl.returned_quantity < sl.quantity);
        return {
          ...s,
          lines: nextLines,
          commercial_status:
            params.returnType === 'anulacion_total' ? 'anulada' : anyPending ? 'parcialmente_devuelta' : 'devuelta',
          payment_status:
            params.returnType === 'anulacion_total' || !anyPending ? 'reversada' : s.payment_status,
        };
      }),
    );

    // Reponer stock vendible local
    setProducts((prev) =>
      prev.map((p) => {
        let restock = 0;
        for (const reqLine of params.lines) {
          if (reqLine.condition !== 'sellable') continue;
          const sl = origLines.find((x) => x.id === reqLine.saleLineId) ?? origLines[reqLine.lineIndex];
          if (sl && !sl.is_service && (sl.product_id === p.id || sl.sku_snapshot === p.sku)) {
            restock += reqLine.quantity;
          }
        }
        if (restock <= 0) return p;
        const nextStock = p.stock_quantity + restock;
        return {
          ...p,
          stock_quantity: nextStock,
          status: p.status === 'descontinuado' ? p.status : nextStock > 0 ? 'disponible' : 'agotado',
        };
      }),
    );

    // Restar de efectivo esperado si aplica
    if (activeShift && activeShift.id === params.shiftId && (params.refundMethod === 'efectivo_usd' || params.refundMethod === 'efectivo_ves')) {
      const amt = params.refundMethod === 'efectivo_usd' ? totalRefundedUsd : totalRefundedVes;
      const nextExp = {
        ...activeShift.expected_totals,
        [params.refundMethod]: round2((activeShift.expected_totals?.[params.refundMethod] ?? 0) - amt),
      };
      const nextShift: PosShift = { ...activeShift, expected_totals: nextExp };
      setActiveShift(nextShift);
      setShifts((prev) => prev.map((s) => (s.id === nextShift.id ? nextShift : s)));
    }

    return { ok: true, returnNumber: retNum, totalRefundedUsd, offline: true };
  };

  const dispatchOrders = useMemo(() => deriveDispatchOrders(sales), [sales]);

  const updateDispatch = async (orderId: string, body: Record<string, unknown>) => {
    const opKey = makeOpKey('dsp');
    const offlineOpAuth = await signOfflineOperatorProof(`dispatch:${orderId}:${opKey}`);
    const reqBody = {
      action: 'dispatch',
      ...body,
      offline_op_key: opKey,
      ...(offlineOpAuth ? { offline_operator_auth: offlineOpAuth } : {}),
    };

    if (isOnline && !orderId.startsWith('off-')) {
      try {
        const data = await postJson(`/sales/${orderId}`, reqBody);
        setSales((prev) =>
          prev.map((s) =>
            s.id === orderId
              ? ({ ...s, metadata: { ...((s as any).metadata ?? {}), dispatch: data.dispatch } } as PosSale)
              : s,
          ),
        );
        return true;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          showNotification('No se pudo actualizar la comanda', (err as Error).message, 'critical');
          return false;
        }
      }
    }

    enqueueOfflineOp(activeTenantSlug, {
      type: 'dispatch',
      targetId: orderId,
      summary: `Comanda KDS (${body.status ?? body.toggle_sku ?? 'cambio'})`,
      payload: reqBody,
    });
    refreshQueueState(activeTenantSlug);

    setSales((prev) =>
      prev.map((s) => {
        if (s.id !== orderId) return s;
        const meta = ((s as any).metadata ?? {}) as Record<string, any>;
        const dispatch = { status: 'pendiente', completed_skus: [] as string[], ...(meta.dispatch ?? {}) };
        if (body.status !== undefined) {
          dispatch.status = body.status;
          dispatch.prepared_by = body.prepared_by ?? dispatch.prepared_by ?? null;
          if (body.status === 'listo' || body.status === 'entregado') dispatch.completed_at = new Date().toISOString();
        }
        if (body.toggle_sku) {
          const sku = String(body.toggle_sku);
          const set = new Set<string>(dispatch.completed_skus ?? []);
          if (set.has(sku)) set.delete(sku);
          else set.add(sku);
          dispatch.completed_skus = Array.from(set);
        }
        return { ...s, metadata: { ...meta, dispatch } } as PosSale;
      }),
    );
    return true;
  };

  const updateDispatchStatus = async (orderId: string, status: PosDispatchStatus, preparedBy?: string) => {
    const ok = await updateDispatch(orderId, { status, prepared_by: preparedBy });
    if (ok) showNotification('Comanda actualizada', `Pedido marcado como "${status}".`, 'success');
    return ok;
  };

  const toggleDispatchItem = (orderId: string, itemSku: string) => updateDispatch(orderId, { toggle_sku: itemSku });

  const generateAccountingSalesBookCsv = (params?: { startDate?: string; endDate?: string }): string =>
    buildSalesBookCsv(sales, params);

  const salesReps: PosSalesRep[] = useMemo(
    () =>
      staffUsers
        .filter((u) => u.role === 'pos_sales_rep' && u.is_active)
        .map((u) => ({
          id: u.id,
          name: u.name,
          code: (u.email ?? u.name).split('@')[0].toUpperCase().slice(0, 12),
          commission_rate_percent: 0,
          is_active: true,
        })),
    [staffUsers],
  );
  const promotions: PosPromotion[] = [];

  // Cart operations
  const addToCart = (product: PosProduct, quantity = 1) => {
    if (!product.is_service && product.stock_quantity < quantity) {
      if (stockPolicy === 'strict_block') {
        showNotification(
          'Bloqueo de inventario',
          `Existencias insuficientes para ${product.name} (${product.sku}). Solicitado: ${quantity}, disponible: ${product.stock_quantity}.`,
          'critical',
        );
        return;
      } else if (stockPolicy === 'warn_and_allow') {
        showNotification(
          'Advertencia de sobreventa',
          `Existencias bajas para ${product.name} (${product.sku}). Disponible: ${product.stock_quantity}. Venta autorizada.`,
          'alert',
        );
      }
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((l) => l.productId === product.id);
      if (existingIdx >= 0) {
        const line = prev[existingIdx];
        const newQty = line.quantity + quantity;
        if (!product.is_service && product.stock_quantity < newQty) {
          if (stockPolicy === 'strict_block') {
            showNotification(
              'Bloqueo de inventario',
              `Límite de almacén alcanzado. Existencia disponible: ${product.stock_quantity} und.`,
              'critical',
            );
            return prev;
          } else if (stockPolicy === 'warn_and_allow') {
            showNotification(
              'Advertencia de sobreventa',
              `Límite de stock físico excedido (${newQty}/${product.stock_quantity}). Venta autorizada.`,
              'alert',
            );
          }
        }
        const unitPrice = line.unitPriceUsd;
        const subtotal = Number((unitPrice * newQty).toFixed(2));
        const discAmount = Number((subtotal * (line.discountPercent / 100)).toFixed(2));
        const taxable = subtotal - discAmount;
        const taxAmount = Number((taxable * (line.taxRatePercent / 100)).toFixed(2));
        const total = Number((taxable + taxAmount).toFixed(2));

        const updated = [...prev];
        updated[existingIdx] = {
          ...line,
          quantity: newQty,
          lineSubtotalUsd: subtotal,
          discountAmountUsd: discAmount,
          taxAmountUsd: taxAmount,
          lineTotalUsd: total,
        };
        return updated;
      }

      const subtotal = Number((product.price_usd * quantity).toFixed(2));
      const taxAmount = Number((subtotal * (product.tax_rate_percent / 100)).toFixed(2));
      const total = Number((subtotal + taxAmount).toFixed(2));

      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          isService: product.is_service,
          quantity,
          unitPriceUsd: product.price_usd,
          discountPercent: 0,
          discountAmountUsd: 0,
          taxRatePercent: product.tax_rate_percent,
          taxAmountUsd: taxAmount,
          lineSubtotalUsd: subtotal,
          lineTotalUsd: total,
        },
      ];
    });
  };

  const updateCartQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    setCart((prev) => {
      const line = prev[index];
      if (!line) return prev;
      if (!line.isService && line.productId) {
        const prod = products.find((p) => p.id === line.productId || p.sku === line.sku);
        if (prod && prod.stock_quantity < quantity) {
          if (stockPolicy === 'strict_block') {
            showNotification(
              'Bloqueo de inventario',
              `Solo quedan ${prod.stock_quantity} unidades físicas en almacén para ${prod.name}.`,
              'critical',
            );
            return prev;
          } else if (stockPolicy === 'warn_and_allow') {
            showNotification(
              'Advertencia de sobreventa',
              `Cantidad solicitada (${quantity}) excede las existencias físicas (${prod.stock_quantity}).`,
              'alert',
            );
          }
        }
      }
      const subtotal = Number((line.unitPriceUsd * quantity).toFixed(2));
      const discAmount = Number((subtotal * (line.discountPercent / 100)).toFixed(2));
      const taxable = subtotal - discAmount;
      const taxAmount = Number((taxable * (line.taxRatePercent / 100)).toFixed(2));
      const total = Number((taxable + taxAmount).toFixed(2));

      const updated = [...prev];
      updated[index] = {
        ...line,
        quantity,
        lineSubtotalUsd: subtotal,
        discountAmountUsd: discAmount,
        taxAmountUsd: taxAmount,
        lineTotalUsd: total,
      };
      return updated;
    });
  };

  const updateCartDiscount = (index: number, discountPercent: number) => {
    setCart((prev) => {
      const line = prev[index];
      if (!line) return prev;
      const clampedPercent = Math.min(100, Math.max(0, discountPercent));
      const subtotal = line.lineSubtotalUsd;
      const discAmount = Number((subtotal * (clampedPercent / 100)).toFixed(2));
      const taxable = subtotal - discAmount;
      const taxAmount = Number((taxable * (line.taxRatePercent / 100)).toFixed(2));
      const total = Number((taxable + taxAmount).toFixed(2));

      const updated = [...prev];
      updated[index] = {
        ...line,
        discountPercent: clampedPercent,
        discountAmountUsd: discAmount,
        taxAmountUsd: taxAmount,
        lineTotalUsd: total,
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCart([]);
    setCartNotes('');
    setDiscountAuthorizedBy(null);
    setOfflineDiscountAuth(null);
    setDraftSaleKey('');
  };

  // Multiticket / Ventas en espera
  const parkCurrentSale = (note?: string) => {
    if (!isFuncActive('pos_multiticket')) {
      showNotification('Ventas en espera deshabilitadas', 'La funcionalidad de multiticket está inhabilitada en el Gestor de VORA.', 'alert');
      return;
    }
    if (cart.length === 0) {
      showNotification('Carrito vacío', 'Agregue al menos un producto para pausar la venta.', 'alert');
      return;
    }
    const totalUsd = cart.reduce((sum, item) => sum + item.lineTotalUsd, 0);
    const newParked: ParkedSale = {
      id: `park-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customer: selectedCustomer,
      cart: [...cart],
      notes: note || cartNotes,
      totalUsd,
    };

    setParkedSales((prev) => [newParked, ...prev]);
    clearCart();
    setSelectedCustomer(customers[0] ?? null);
    showNotification(
      'Venta en espera',
      `Carrito pausado (#${newParked.id.slice(-4)}). Puede atender al siguiente cliente.`,
      'success',
    );
  };

  const resumeParkedSale = (id: string) => {
    const found = parkedSales.find((p) => p.id === id);
    if (!found) return;

    if (cart.length > 0) {
      const totalUsd = cart.reduce((sum, item) => sum + item.lineTotalUsd, 0);
      const autoPark: ParkedSale = {
        id: `park-${Date.now()}`,
        createdAt: new Date().toISOString(),
        customer: selectedCustomer,
        cart: [...cart],
        notes: cartNotes,
        totalUsd,
      };
      setParkedSales((prev) => [autoPark, ...prev.filter((p) => p.id !== id)]);
    } else {
      setParkedSales((prev) => prev.filter((p) => p.id !== id));
    }

    setCart(found.cart);
    setCartNotes(found.notes);
    setSelectedCustomer(found.customer);
    showNotification('Venta reanudada', `Carrito recuperado (${found.cart.length} productos).`, 'success');
  };

  const deleteParkedSale = (id: string) => {
    setParkedSales((prev) => prev.filter((p) => p.id !== id));
    showNotification('Venta eliminada', 'Ticket pausado descartado de la memoria.', 'alert');
  };

  // Escaneo rápido de código de barras
  const scanBarcode = (code: string): boolean => {
    if (!isFuncActive('pos_scanner')) {
      showNotification('Lector deshabilitado', 'El lector de código de barras está inhabilitado en el Gestor de VORA.', 'alert');
      return false;
    }
    const clean = code.trim().toLowerCase();
    const product = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === clean) ||
        p.sku.toLowerCase() === clean ||
        p.id.toLowerCase() === clean ||
        p.name.toLowerCase().includes(clean),
    );

    if (product) {
      addToCart(product, 1);
      showNotification('Código escaneado', `${product.name} (+1 en carrito).`, 'success');
      return true;
    }

    showNotification('Código no encontrado', `No se encontró producto con código: ${code}`, 'alert');
    return false;
  };

  const scanBarcodeRef = useRef(scanBarcode);
  scanBarcodeRef.current = scanBarcode;
  const scannerEnabledRef = useRef(true);
  scannerEnabledRef.current = isFuncActive('pos_scanner');

  // Listener global de teclado para pistola USB HID
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scannerEnabledRef.current) return;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3 && (timeDiff < 70 || !isInput)) {
          const matched = scanBarcodeRef.current(buffer.trim());
          if (matched) {
            e.preventDefault();
            buffer = '';
            return;
          }
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 120 && buffer.length > 0) {
          buffer = '';
        }
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (view: PosViewKey) => {
    setCurrentView(view);
  };

  return (
    <PosContext.Provider
      value={{
        tenantId,
        tenantName,
        tenantCurrency,
        tenantCountry,
        tenantBranding,
        activeTenantSlug,
        setActiveTenantSlug,
        activeBranchId,
        setActiveBranchId,
        activeBranch,
        activeUser,
        me,
        can,
        activeRegisterId,
        setActiveRegisterId,
        activeRegister,
        currentView,
        navigateTo,
        activeShift,
        refreshActiveShift,
        exchangeRate,
        refreshExchangeRate,
        isFetchingExchangeRate,
        settings,
        reloadSettings,
        saveSettings,
        catalogSource,
        branches,
        registers,
        addBranch,
        addRegister,
        addCustomer,
        products,
        reloadProducts,
        reloadBranches,
        reloadRegisters,
        reloadCustomers,
        stockPolicy,
        customers,
        sales,
        returns,
        shifts,
        cashMovements,
        fiscalIntegration,
        reloadSales,
        reloadReturns,
        reloadShifts,
        cart,
        addToCart,
        updateCartQuantity,
        updateCartDiscount,
        removeFromCart,
        clearCart,
        cartNotes,
        setCartNotes,
        selectedCustomer,
        setSelectedCustomer,
        discountAuthorizedBy,
        setDiscountAuthorizedBy,
        offlineDiscountAuth,
        setOfflineDiscountAuth,
        draftSaleKey,
        ensureDraftSaleKey,
        lastConfirmedSale,
        setLastConfirmedSale,
        notification,
        toasts,
        dismissToast,
        showNotification,
        clearNotification,
        parkedSales,
        parkCurrentSale,
        resumeParkedSale,
        deleteParkedSale,
        isOnline,
        lastSyncedAt,
        offlineQueue,
        offlineQueueCount,
        offlineRejectedCount,
        triggerSyncOfflineSales,
        retryOfflineOperation,
        discardOfflineOperation,
        isQueueModalOpen,
        setIsQueueModalOpen,
        isOperatorModalOpen,
        setIsOperatorModalOpen,
        isTerminalLocked,
        setIsTerminalLocked,
        offlineOperators,
        switchOperator,
        clearOfflineSigningSession,
        openShift,
        addCashMovement,
        closeShift,
        recordOfflineSale,
        recordDebtPayment,
        recordSaleReturn,
        scanBarcode,
        isModuleEnabled,
        isWarehouseEnabled,
        posFeatures,
        isFuncActive,
        reloadTenantFeatures,
        salesReps,
        promotions,
        selectedSalesRep,
        setSelectedSalesRep,
        isCustomerDisplayOpen,
        setIsCustomerDisplayOpen,
        staffUsers,
        supervisors,
        reloadStaff,
        requestSupervisorAuthorization,
        dispatchOrders,
        updateDispatchStatus,
        toggleDispatchItem,
        generateAccountingSalesBookCsv,
      }}
    >
      {children}
    </PosContext.Provider>
  );
}

export function usePos() {
  const context = useContext(PosContext);
  if (!context) {
    throw new Error('usePos debe ser utilizado dentro de un PosProvider');
  }
  return context;
}
