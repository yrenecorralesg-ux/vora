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
} from '@/lib/types';
import {
  MOCK_TENANT_ID,
  MOCK_TENANT_SLUG,
  MOCK_USERS,
  MOCK_EXCHANGE_RATE,
  type PosMockUser,
} from '@/lib/pos-demo-data';
import { posStore } from '@/lib/pos-service';

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
  | 'POS-18';

interface PosContextType {
  // Contex Switchers
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
  posFeatures: Record<string, boolean>;
  isFuncActive: (funcKey: string) => boolean;
  reloadTenantFeatures: () => Promise<void>;

  // Notification Toast Message (Pure Typography)
  notification: { title: string; detail: string; type: 'success' | 'alert' | 'critical' } | null;
  showNotification: (title: string, detail: string, type?: 'success' | 'alert' | 'critical') => void;
  clearNotification: () => void;
}

const PosContext = createContext<PosContextType | null>(null);

export function PosProvider({
  children,
  initialSlug,
}: {
  children: React.ReactNode;
  initialSlug: string;
}) {
  const [activeTenantSlug, setActiveTenantSlug] = useState<string>(initialSlug || MOCK_TENANT_SLUG);
  const [activeBranchId, setActiveBranchId] = useState<string>('b0000000-0000-0000-0000-000000000001');
  const [activeUserId, setActiveUserId] = useState<string>('u0000000-0000-0000-0000-000000000001');
  const [activeRegisterId, setActiveRegisterId] = useState<string>('r0000000-0000-0000-0000-000000000001');
  const [currentView, setCurrentView] = useState<PosViewKey>('POS-01');

  // Operational State synced from store
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartNotes, setCartNotes] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(posStore.customers[0] ?? null);
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState<string | null>(null);
  const [lastConfirmedSale, setLastConfirmedSale] = useState<PosSale | null>(posStore.sales[0] ?? null);
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
  });

  const isFuncActive = (funcKey: string): boolean => {
    if (!isModuleEnabled) return false;
    if (posFeatures[funcKey] === undefined) return true;
    return Boolean(posFeatures[funcKey]);
  };

  const reloadTenantFeatures = async () => {
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/features`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setIsModuleEnabled(Boolean(data.is_module_enabled));
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
  }, [activeTenantSlug]);

  const activeBranch = posStore.branches.find((b) => b.id === activeBranchId) ?? posStore.branches[0];
  const activeUser = MOCK_USERS.find((u) => u.id === activeUserId) ?? MOCK_USERS[0];
  const activeRegister = posStore.registers.find((r) => r.id === activeRegisterId) ?? posStore.registers[0];

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

  // Cart operations
  const addToCart = (product: PosProduct, quantity = 1) => {
    if (!product.is_service && product.stock_quantity < quantity) {
      showNotification('Existencia insuficiente', `No hay existencias suficientes para ${product.sku} [mock]`, 'critical');
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((l) => l.productId === product.id);
      if (existingIdx >= 0) {
        const line = prev[existingIdx];
        const newQty = line.quantity + quantity;
        if (!product.is_service && product.stock_quantity < newQty) {
          showNotification('Límite de almacén alcanzado', `Existencia máxima disponible: ${product.stock_quantity} und. [mock]`, 'critical');
          return prev;
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
        const prod = posStore.products.find((p) => p.id === line.productId);
        if (prod && prod.stock_quantity < quantity) {
          showNotification('Existencia insuficiente', `Solo quedan ${prod.stock_quantity} unidades físicas en almacén [mock]`, 'alert');
          return prev;
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
    const product = posStore.products.find(
      (p) =>
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
        branches: posStore.branches,
        registers: posStore.registers,
        products: posStore.products,
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
        posFeatures,
        isFuncActive,
        reloadTenantFeatures,
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

