'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  PosBranch,
  PosRegister,
  PosShift,
  PosProduct,
  PosCustomer,
  PosSale,
  PosCashMovement,
  PosSettings,
  PosFiscalIntegration,
  PosPromotion,
  PosSalesRep,
  PosDispatchOrder,
  PosDispatchStatus,
} from '@/lib/types';
import {
  MOCK_TENANT_ID,
  MOCK_TENANT_SLUG,
  MOCK_USERS,
  MOCK_EXCHANGE_RATE,
  type PosMockUser,
} from '@/lib/pos-demo-data';
import { posStore } from '@/lib/pos-service';
import { getSupabaseClient } from '@/lib/supabase-client';

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
  activeUser: PosMockUser;
  setActiveUserId: (id: string) => void;
  activeRegisterId: string;
  setActiveRegisterId: (id: string) => void;
  activeRegister: PosRegister;

  // View Navigation
  currentView: PosViewKey;
  navigateTo: (view: PosViewKey) => void;

  // Operational State
  activeShift: PosShift | null;
  refreshActiveShift: () => void;
  exchangeRate: number;
  settings: PosSettings;
  branches: PosBranch[];
  registers: PosRegister[];
  products: PosProduct[];
  customers: PosCustomer[];
  sales: PosSale[];
  shifts: PosShift[];
  cashMovements: PosCashMovement[];

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
  stockPolicy: 'warn_and_allow' | 'strict_block' | 'allow_unrestricted';

  // Nuevas capacidades diferenciadoras
  salesReps: PosSalesRep[];
  promotions: PosPromotion[];
  selectedSalesRep: PosSalesRep | null;
  setSelectedSalesRep: (rep: PosSalesRep | null) => void;
  isCustomerDisplayOpen: boolean;
  setIsCustomerDisplayOpen: (open: boolean) => void;

  // Personal, Roles y Supervisión
  staffUsers: PosMockUser[];
  validateSupervisorPin: (pin: string) => boolean;
  updateSupervisorConfig: (params: {
    supervisorPin?: string;
    maxCashierDiscountPercent?: number;
    requirePinForReturns?: boolean;
    requirePinForWithdrawals?: boolean;
    requirePinForCancel?: boolean;
    enforceBlindCount?: boolean;
  }) => PosSettings;
  addStaffUser: (user: Omit<PosMockUser, 'id'>) => PosMockUser;
  createUser: (user: Omit<PosMockUser, 'id'>) => PosMockUser;
  updateUser: (id: string, updates: Partial<PosMockUser>) => PosMockUser | null;
  deleteUser: (id: string) => { ok: boolean; error?: string };
  toggleStaffUser: (id: string) => boolean;
  updateStaffPin: (id: string, newPin: string) => boolean;

  // Comandas y Despacho KDS (pos_order_dispatch_kds)
  dispatchOrders: PosDispatchOrder[];
  updateDispatchStatus: (orderId: string, status: PosDispatchStatus, preparedBy?: string) => boolean;
  toggleDispatchItem: (orderId: string, itemSku: string) => boolean;

  // Exportación Contable SENIAT (pos_accounting_export)
  generateAccountingSalesBookCsv: (params?: { startDate?: string; endDate?: string }) => string;

  // Notification Toast Message (Pure Typography)
  notification: { title: string; detail: string; type: 'success' | 'alert' | 'critical' } | null;
  showNotification: (title: string, detail: string, type?: 'success' | 'alert' | 'critical') => void;
  clearNotification: () => void;

  // Sedes y Cajas
  addBranch: (branch: Omit<PosBranch, 'id' | 'created_at' | 'updated_at'>) => PosBranch;
  addRegister: (register: Omit<PosRegister, 'id' | 'created_at' | 'updated_at'>) => PosRegister;
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
  const [activeTenantSlug, setActiveTenantSlug] = useState<string>(initialSlug || MOCK_TENANT_SLUG);
  const [tenantName, setTenantName] = useState<string>(
    initialTenant?.commercial_name || (isSolee ? 'SOLEÉ' : initialSlug || MOCK_TENANT_SLUG)
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
  const [activeBranchId, setActiveBranchId] = useState<string>('b0000000-0000-0000-0000-000000000001');
  const [activeUserId, setActiveUserId] = useState<string>('u0000000-0000-0000-0000-000000000001');
  const [activeRegisterId, setActiveRegisterId] = useState<string>('r0000000-0000-0000-0000-000000000001');
  const [currentView, setCurrentView] = useState<PosViewKey>('POS-01');

  // Operational State synced from store
  const [branches, setBranches] = useState<PosBranch[]>(posStore.branches);
  const [registers, setRegisters] = useState<PosRegister[]>(posStore.registers);
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartNotes, setCartNotes] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(posStore.customers[0] ?? null);
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState<string | null>(null);
  const [lastConfirmedSale, setLastConfirmedSale] = useState<PosSale | null>(null);
  const [notification, setNotification] = useState<{ title: string; detail: string; type: 'success' | 'alert' | 'critical' } | null>(null);

  // Multiticket / Ventas en Espera
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);

  // Conectividad & Offline
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  // Tasa de cambio BCV / API
  const [exchangeRate, setExchangeRate] = useState<number>(posStore.settings.active_exchange_rate);
  const [isFetchingExchangeRate, setIsFetchingExchangeRate] = useState<boolean>(false);

  // Modularidad & Feature Flags configurables desde el Gestor VORA
  const [isModuleEnabled, setIsModuleEnabled] = useState<boolean>(true);
  const [isWarehouseEnabled, setIsWarehouseEnabled] = useState<boolean>(false);
  const [stockPolicy, setStockPolicy] = useState<'warn_and_allow' | 'strict_block' | 'allow_unrestricted'>('warn_and_allow');
  const [products, setProducts] = useState<PosProduct[]>(posStore.products);
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
  const [selectedSalesRep, setSelectedSalesRep] = useState<PosSalesRep | null>(posStore.salesReps[0] ?? null);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState<boolean>(false);
  const [staffUsers, setStaffUsers] = useState<PosMockUser[]>(posStore.users);
  const [dispatchOrders, setDispatchOrders] = useState<PosDispatchOrder[]>(posStore.dispatchOrders);

  const isFuncActive = (funcKey: string): boolean => {
    if (!isModuleEnabled) return false;
    if (posFeatures[funcKey] === undefined) return true;
    return Boolean(posFeatures[funcKey]);
  };

  const reloadProducts = async () => {
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/products`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.products)) {
          setProducts(data.products);
          posStore.products = data.products;
        }
      }
    } catch (err) {
      console.warn('[pos-context] reloadProducts error:', err);
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
    reloadProducts();
  }, [activeTenantSlug]);

  useEffect(() => {
    async function initSessionUser() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const email = user.email || '';
          const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'Operador';
          setStaffUsers((prev) => {
            const existing = prev.find((u) => u.email?.toLowerCase() === email.toLowerCase());
            if (existing) {
              setActiveUserId(existing.id);
              return prev;
            }
            const authUserEntry: PosMockUser = {
              id: user.id,
              name,
              email,
              role: 'pos_store_admin',
              assignedBranchId: activeBranchId,
              pin: '0000',
              is_active: true,
            };
            setActiveUserId(authUserEntry.id);
            return [authUserEntry, ...prev];
          });
        }
      } catch (err) {
        console.warn('[pos-context] error loading session user', err);
      }
    }
    initSessionUser();
  }, []);

  const addBranch = (data: Omit<PosBranch, 'id' | 'created_at' | 'updated_at'>): PosBranch => {
    const newBranch: PosBranch = {
      ...data,
      id: `b-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    posStore.addBranch(newBranch);
    setBranches([...posStore.branches]);
    return newBranch;
  };

  const addRegister = (data: Omit<PosRegister, 'id' | 'created_at' | 'updated_at'>): PosRegister => {
    const newReg: PosRegister = {
      ...data,
      id: `r-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    posStore.addRegister(newReg);
    setRegisters([...posStore.registers]);
    return newReg;
  };

  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? branches[0] ?? posStore.branches[0];
  const activeUser = staffUsers.find((u) => u.id === activeUserId) ?? staffUsers[0] ?? MOCK_USERS[0];
  const activeRegister = registers.find((r) => r.id === activeRegisterId) ?? registers[0] ?? posStore.registers[0];

  const refreshActiveShift = () => {
    const shift = posStore.getOpenShift(activeRegisterId);
    setActiveShift(shift ?? null);
  };

  useEffect(() => {
    refreshActiveShift();
  }, [activeRegisterId]);

  const showNotification = (title: string, detail: string, type: 'success' | 'alert' | 'critical' = 'success') => {
    setNotification({ title, detail, type });
  };

  const clearNotification = () => setNotification(null);

  const refreshExchangeRate = async (customUrl?: string): Promise<{ ok: boolean; rate?: number; error?: string }> => {
    setIsFetchingExchangeRate(true);
    try {
      const urlParam = customUrl ? `?url=${encodeURIComponent(customUrl)}` : '';
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/exchange-rate${urlParam}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al consultar la tasa oficial');
      }

      const newRate = Number(data.rate);
      posStore.settings.active_exchange_rate = newRate;
      posStore.settings.last_exchange_rate_fetch = data.timestamp || new Date().toISOString();
      if (data.source) {
        posStore.settings.exchange_rate_source = data.source;
      }
      if (customUrl) {
        posStore.settings.exchange_rate_api_url = customUrl;
      }
      setExchangeRate(newRate);

      // Sincronizar en segundo plano
      fetch(`/api/t/${activeTenantSlug}/pos/exchange-rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate: newRate,
          source: data.source,
          url: customUrl || posStore.settings.exchange_rate_api_url,
          auto_fetch: posStore.settings.auto_fetch_exchange_rate,
        }),
      }).catch(() => {});

      showNotification(
        'Tasa BCV sincronizada',
        `Tasa oficial actualizada: ${newRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} VES/USD (${data.source || 'dolarapi'}).`,
        'success',
      );
      return { ok: true, rate: newRate };
    } catch (err: any) {
      const msg = err.message || 'No se pudo conectar con la API de tasa';
      showNotification('Error al sincronizar tasa', msg, 'critical');
      return { ok: false, error: msg };
    } finally {
      setIsFetchingExchangeRate(false);
    }
  };

  // Auto-sincronización de tasa BCV al inicializar
  useEffect(() => {
    if (posStore.settings.auto_fetch_exchange_rate !== false) {
      refreshExchangeRate();
    }
  }, []);

  // Supervisor & Staff Management
  const updateSupervisorConfig = (params: {
    supervisorPin?: string;
    maxCashierDiscountPercent?: number;
    requirePinForReturns?: boolean;
    requirePinForWithdrawals?: boolean;
    requirePinForCancel?: boolean;
    enforceBlindCount?: boolean;
  }) => {
    const updated = posStore.updateSupervisorConfig(params);
    showNotification('Supervisión actualizada', 'Políticas y parámetros de control guardados con éxito.', 'success');
    return updated;
  };

  const validateSupervisorPin = (pin: string): boolean => {
    return posStore.validateSupervisorPin(pin);
  };

  const addStaffUser = (user: Omit<PosMockUser, 'id'>) => {
    const created = posStore.addStaffUser(user);
    setStaffUsers([...posStore.users]);
    showNotification('Usuario creado', `Se ha registrado al usuario ${created.name} con éxito.`, 'success');
    return created;
  };

  const toggleStaffUser = (id: string) => {
    const ok = posStore.toggleStaffUser(id);
    if (ok) {
      setStaffUsers([...posStore.users]);
      showNotification('Estado actualizado', 'Estatus de activación del usuario modificado.', 'success');
    }
    return ok;
  };

  const updateStaffPin = (id: string, newPin: string) => {
    const ok = posStore.updateStaffPin(id, newPin);
    if (ok) {
      setStaffUsers([...posStore.users]);
      showNotification('PIN actualizado', 'La clave PIN del usuario ha sido modificada.', 'success');
    }
    return ok;
  };

  const createUser = (user: Omit<PosMockUser, 'id'>) => {
    const created = posStore.createUser(user);
    setStaffUsers([...posStore.users]);
    showNotification('Usuario Creado', `Usuario ${created.name} registrado con éxito en el sistema.`, 'success');
    return created;
  };

  const updateUser = (id: string, updates: Partial<PosMockUser>) => {
    const updated = posStore.updateUser(id, updates);
    if (updated) {
      setStaffUsers([...posStore.users]);
      showNotification('Usuario Actualizado', `Datos del usuario ${updated.name} guardados.`, 'success');
    }
    return updated;
  };

  const deleteUser = (id: string) => {
    const res = posStore.deleteUser(id);
    if (res.ok) {
      setStaffUsers([...posStore.users]);
      showNotification('Usuario Eliminado', 'El usuario fue eliminado del personal de esta sede.', 'alert');
    } else {
      showNotification('Error al eliminar', res.error || 'No se pudo eliminar el usuario.', 'critical');
    }
    return res;
  };

  const updateDispatchStatus = (orderId: string, status: PosDispatchStatus, preparedBy?: string) => {
    const ok = posStore.updateDispatchStatus(orderId, status, preparedBy);
    if (ok) {
      setDispatchOrders([...posStore.dispatchOrders]);
      showNotification('Comanda actualizada', `Pedido ${orderId} marcado como "${status}".`, 'success');
    }
    return ok;
  };

  const toggleDispatchItem = (orderId: string, itemSku: string) => {
    const ok = posStore.toggleDispatchItem(orderId, itemSku);
    if (ok) {
      setDispatchOrders([...posStore.dispatchOrders]);
    }
    return ok;
  };

  const generateAccountingSalesBookCsv = (params?: { startDate?: string; endDate?: string }): string => {
    return posStore.generateAccountingSalesBookCsv(params);
  };

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
    setSelectedCustomer(posStore.customers[0] ?? null);
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
        setActiveUserId,
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
        settings: posStore.settings,
        branches,
        registers,
        addBranch,
        addRegister,
        products,
        reloadProducts,
        stockPolicy,
        customers: posStore.customers,
        sales: posStore.sales,
        shifts: posStore.shifts,
        cashMovements: posStore.cashMovements,
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
        showNotification,
        clearNotification,
        parkedSales,
        parkCurrentSale,
        resumeParkedSale,
        deleteParkedSale,
        isOnline,
        offlineQueueCount,
        scanBarcode,
        isModuleEnabled,
        isWarehouseEnabled,
        posFeatures,
        isFuncActive,
        reloadTenantFeatures,
        salesReps: posStore.salesReps,
        promotions: posStore.promotions,
        selectedSalesRep,
        setSelectedSalesRep,
        isCustomerDisplayOpen,
        setIsCustomerDisplayOpen,
        staffUsers,
        validateSupervisorPin,
        updateSupervisorConfig,
        addStaffUser,
        createUser,
        updateUser,
        deleteUser,
        toggleStaffUser,
        updateStaffPin,
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

