'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@/lib/types';
import { getOfflineQueue, syncOfflineSales } from '@/lib/pos-offline';
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
  tenantName: string;
  tenantCurrency: string;
  tenantCountry: string;
  tenantBranding: PosTenantBranding;
  activeTenantSlug: string;
  setActiveTenantSlug: (slug: string) => void;
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  activeBranch: PosBranch;
  /** Usuario de la sesión (Supabase Auth + membresía). */
  activeUser: PosMe;
  me: PosMe | null;
  can: (permission: string) => boolean;
  activeRegisterId: string;
  setActiveRegisterId: (id: string) => void;
  activeRegister: PosRegister;

  // View Navigation
  currentView: PosViewKey;
  navigateTo: (view: PosViewKey) => void;

  // Operational State (Supabase es la fuente de verdad)
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
  /** Id de pos_authorizations (descuento autorizado por un supervisor). */
  discountAuthorizedBy: string | null;
  setDiscountAuthorizedBy: (id: string | null) => void;

  // Confirmed Sale Focus
  lastConfirmedSale: PosSale | null;
  setLastConfirmedSale: (sale: PosSale | null) => void;

  // Parked Sales (Multiticket)
  parkedSales: ParkedSale[];
  parkCurrentSale: (note?: string) => void;
  resumeParkedSale: (id: string) => void;
  deleteParkedSale: (id: string) => void;

  // Connectivity & Offline
  isOnline: boolean;
  offlineQueueCount: number;
  offlineRejectedCount: number;
  triggerSyncOfflineSales: () => Promise<void>;

  // Barcode quick scan
  scanBarcode: (code: string) => boolean;

  // Exchange Rate (BCV / DolarApi)
  refreshExchangeRate: (customUrl?: string) => Promise<{ ok: boolean; rate?: number; error?: string }>;
  isFetchingExchangeRate: boolean;

  // Feature Flags from Gestor / Admin Panel
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

  // Personal y supervisión (usuarios reales; PIN validado en el servidor)
  staffUsers: PosStaffUser[];
  supervisors: PosSupervisor[];
  reloadStaff: () => Promise<void>;
  requestSupervisorAuthorization: (params: {
    supervisorId: string;
    pin: string;
    operationType: 'discount_override' | 'sale_void' | 'sale_return' | 'cash_movement';
    reason: string;
    limitSnapshot?: Record<string, unknown>;
  }) => Promise<{ ok: boolean; authorizationId?: string; approverName?: string | null; error?: string }>;

  // Comandas y Despacho KDS (pos_order_dispatch_kds)
  dispatchOrders: PosDispatchOrder[];
  updateDispatchStatus: (orderId: string, status: PosDispatchStatus, preparedBy?: string) => Promise<boolean>;
  toggleDispatchItem: (orderId: string, itemSku: string) => Promise<boolean>;

  // Exportación Contable SENIAT (pos_accounting_export)
  generateAccountingSalesBookCsv: (params?: { startDate?: string; endDate?: string }) => string;

  // Notification Toast Message (Pure Typography)
  /** Último aviso (compatibilidad); los avisos visibles están en toasts. */
  notification: PosToast | null;
  toasts: PosToast[];
  dismissToast: (id: number) => void;
  showNotification: (title: string, detail: string, type?: 'success' | 'alert' | 'critical') => void;
  clearNotification: () => void;

  // Sedes, Cajas y Clientes
  addBranch: (branch: Omit<PosBranch, 'id' | 'created_at' | 'updated_at'>) => Promise<PosBranch | null>;
  addRegister: (register: Omit<PosRegister, 'id' | 'created_at' | 'updated_at'>) => Promise<PosRegister | null>;
  addCustomer: (customer: Omit<PosCustomer, 'id' | 'tenant_id' | 'total_purchases_count' | 'total_purchases_usd' | 'last_purchase_at' | 'created_at' | 'updated_at'>) => Promise<PosCustomer | null>;
}

const PosContext = createContext<PosContextType | null>(null);

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
  const [tenantName, setTenantName] = useState<string>(
    initialTenant?.commercial_name || (isSolee ? 'SOLEÉ' : initialSlug)
  );
  const [tenantCurrency, setTenantCurrency] = useState<string>(
    initialTenant?.currency || 'USD'
  );
  const [tenantCountry, setTenantCountry] = useState<string>(
    initialTenant?.country || 'VE'
  );
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

  // Estado operativo: se carga desde la API (Supabase)
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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartNotes, setCartNotes] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null);
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState<string | null>(null);
  const [lastConfirmedSale, setLastConfirmedSale] = useState<PosSale | null>(null);
  const [toasts, setToasts] = useState<PosToast[]>([]);
  const notification = toasts[toasts.length - 1] ?? null;

  // Multiticket / Ventas en Espera
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);

  // Conectividad & Offline
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [offlineRejectedCount, setOfflineRejectedCount] = useState<number>(0);

  // Tasa de cambio BCV / API (guardada por empresa en el servidor)
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [isFetchingExchangeRate, setIsFetchingExchangeRate] = useState<boolean>(false);

  // Modularidad & Feature Flags configurables desde el Gestor VORA
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

  // Estado nuevas capacidades
  const [selectedSalesRep, setSelectedSalesRep] = useState<PosSalesRep | null>(null);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState<boolean>(false);

  const isFuncActive = (funcKey: string): boolean => {
    if (!isModuleEnabled) return false;
    if (posFeatures[funcKey] === undefined) return true;
    return Boolean(posFeatures[funcKey]);
  };

  const api = `/api/t/${activeTenantSlug}/pos`;
  const getJson = async (path: string) => {
    const res = await fetch(`${api}${path}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
    return data;
  };

  const reloadProducts = async () => {
    try {
      const data = await getJson('/products');
      setProducts(Array.isArray(data.products) ? data.products : []);
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
      setCustomers(list);
      setSelectedCustomer((prev) => (prev ? list.find((c) => c.id === prev.id) ?? prev : list[0] ?? null));
    } catch (err) {
      console.warn('[pos-context] reloadCustomers error:', err);
    }
  };

  const reloadSettings = async () => {
    try {
      const data = await getJson('/settings');
      setSettings(data.settings);
      setExchangeRate(Number(data.settings?.active_exchange_rate) || 0);
      if (data.catalog_source) setCatalogSource(data.catalog_source);
      if (data.stock_policy) setStockPolicy(data.stock_policy);
    } catch (err) {
      console.warn('[pos-context] reloadSettings error:', err);
    }
  };

  const saveSettings = async (patch: Record<string, unknown>) => {
    const res = await fetch(`${api}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_settings', ...patch }),
    });
    if (!res.ok) return { ok: false, error: await apiError(res, 'No se pudo guardar la configuración.') };
    const data = await res.json();
    setSettings(data.settings);
    setExchangeRate(Number(data.settings?.active_exchange_rate) || 0);
    return { ok: true };
  };

  const reloadSales = async () => {
    try {
      const data = await getJson('/sales?limit=500');
      setSales(Array.isArray(data.sales) ? data.sales : []);
    } catch (err) {
      console.warn('[pos-context] reloadSales error:', err);
    }
  };

  const reloadReturns = async () => {
    try {
      const data = await getJson('/returns');
      setReturns(Array.isArray(data.returns) ? data.returns : []);
    } catch (err) {
      console.warn('[pos-context] reloadReturns error:', err);
    }
  };

  const reloadShifts = async () => {
    try {
      const q = activeRegisterId ? `?register_id=${encodeURIComponent(activeRegisterId)}` : '';
      const data = await getJson(`/shifts${q}`);
      setShifts(Array.isArray(data.shifts) ? data.shifts : []);
      setActiveShift(data.active_shift ?? null);
      setCashMovements(Array.isArray(data.movements) ? data.movements : []);
    } catch (err) {
      console.warn('[pos-context] reloadShifts error:', err);
    }
  };

  const reloadStaff = async () => {
    try {
      const [users, sup] = await Promise.all([getJson('/users'), getJson('/authorizations')]);
      setMe(users.me ?? null);
      setStaffUsers(Array.isArray(users.users) ? users.users : []);
      setSupervisors(Array.isArray(sup.supervisors) ? sup.supervisors : []);
    } catch (err) {
      console.warn('[pos-context] reloadStaff error:', err);
    }
  };

  const reloadTenantFeatures = async () => {
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/features`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
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

  useEffect(() => {
    reloadTenantFeatures();
    reloadSettings();
    reloadProducts();
    reloadBranches();
    reloadRegisters();
    reloadCustomers();
    reloadStaff();
    reloadSales();
    reloadReturns();
  }, [activeTenantSlug]);

  // Turno abierto de la caja seleccionada (siempre desde el servidor).
  useEffect(() => {
    reloadShifts();
  }, [activeTenantSlug, activeRegisterId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      const queue = getOfflineQueue(activeTenantSlug);
      setOfflineQueueCount(queue.filter((q) => !q.rejected).length);
      setOfflineRejectedCount(queue.filter((q) => q.rejected).length);
      if (online && queue.some((q) => !q.rejected)) triggerSyncOfflineSales();
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [activeTenantSlug]);

  const triggerSyncOfflineSales = async () => {
    const res = await syncOfflineSales(activeTenantSlug);
    setOfflineQueueCount(res.remainingCount);
    setOfflineRejectedCount(res.rejectedCount);
    if (res.syncedCount > 0) {
      await Promise.all([reloadSales(), reloadShifts(), reloadProducts()]);
      showNotification(
        'Ventas sincronizadas',
        `Se enviaron ${res.syncedCount} ventas pendientes al servidor.`,
        'success',
      );
    }
    if (res.newlyRejected > 0) {
      showNotification(
        'Ventas rechazadas al sincronizar',
        `${res.newlyRejected} venta(s) guardadas sin conexión fueron rechazadas por el servidor. Revísalas en el historial de la cola.`,
        'critical',
      );
    }
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
    data: Omit<PosCustomer, 'id' | 'tenant_id' | 'total_purchases_count' | 'total_purchases_usd' | 'last_purchase_at' | 'created_at' | 'updated_at'>,
  ): Promise<PosCustomer | null> => {
    try {
      const res = await postJson('/customers', data);
      const created = res.customer as PosCustomer;
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      return created;
    } catch (err) {
      showNotification('No se pudo registrar el cliente', (err as Error).message, 'critical');
      return null;
    }
  };

  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? branches[0] ?? EMPTY_BRANCH;
  const activeRegister = registers.find((r) => r.id === activeRegisterId) ?? registers[0] ?? EMPTY_REGISTER;
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

  // Se apilan como máximo 4 avisos; un aviso idéntico al último no se repite.
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

  /**
   * El servidor consulta la API de tasa y guarda el valor de la empresa; con
   * customUrl (solo administradores) cambia además la API configurada.
   */
  const refreshExchangeRate = async (customUrl?: string): Promise<{ ok: boolean; rate?: number; error?: string }> => {
    setIsFetchingExchangeRate(true);
    try {
      const data = await postJson('/exchange-rate', { action: 'refresh', ...(customUrl ? { url: customUrl } : {}) });
      const newRate = Number(data.rate);
      setExchangeRate(newRate);
      if (data.settings) setSettings(data.settings);
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

  // Auto-sincronización de tasa al abrir el POS (si la empresa la tiene activa).
  useEffect(() => {
    if (settings.tenant_id && settings.auto_fetch_exchange_rate !== false) {
      refreshExchangeRate();
    }
    // Solo una vez por carga de configuración de la empresa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.tenant_id]);

  const requestSupervisorAuthorization: PosContextType['requestSupervisorAuthorization'] = async (params) => {
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
      return {
        ok: true,
        authorizationId: data.authorization.id as string,
        approverName: data.authorization.approver_name_snapshot as string | null,
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  };

  const dispatchOrders = useMemo(() => deriveDispatchOrders(sales), [sales]);

  const updateDispatch = async (orderId: string, body: Record<string, unknown>) => {
    try {
      const data = await postJson(`/sales/${orderId}`, { action: 'dispatch', ...body });
      setSales((prev) =>
        prev.map((s) =>
          s.id === orderId
            ? ({ ...s, metadata: { ...((s as any).metadata ?? {}), dispatch: data.dispatch } } as PosSale)
            : s,
        ),
      );
      return true;
    } catch (err) {
      showNotification('No se pudo actualizar la comanda', (err as Error).message, 'critical');
      return false;
    }
  };

  const updateDispatchStatus = async (orderId: string, status: PosDispatchStatus, preparedBy?: string) => {
    const ok = await updateDispatch(orderId, { status, prepared_by: preparedBy });
    if (ok) showNotification('Comanda actualizada', `Pedido marcado como "${status}".`, 'success');
    return ok;
  };

  const toggleDispatchItem = (orderId: string, itemSku: string) => updateDispatch(orderId, { toggle_sku: itemSku });

  const generateAccountingSalesBookCsv = (params?: { startDate?: string; endDate?: string }): string =>
    buildSalesBookCsv(sales, params);

  // Asesores de venta = usuarios reales con rol de asesor.
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

    // Si el carrito actual tiene productos, pausarlo primero
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

  // Listener global de teclado para pistola USB HID
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFuncActive('pos_scanner')) return;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3 && (timeDiff < 70 || !isInput)) {
          const matched = scanBarcode(buffer.trim());
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

  // Listener de conectividad Online / Offline
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      showNotification('Conexión reanudada', 'VORA POS conectado y sincronizado con servidor.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showNotification('Modo sin conexión', 'Operando en contingencia local. Cobros en cola de sincronización.', 'alert');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navigateTo = (view: PosViewKey) => {
    setCurrentView(view);
  };

  return (
    <PosContext.Provider
      value={{
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
        offlineQueueCount,
        offlineRejectedCount,
        triggerSyncOfflineSales,
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

