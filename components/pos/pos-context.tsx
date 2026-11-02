'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  PosBranch,
  PosRegister,
  PosShift,
  PosProduct,
  PosCustomer,
  PosSale,
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
        exchangeRate: posStore.settings.active_exchange_rate,
        settings: posStore.settings,
        branches: posStore.branches,
        registers: posStore.registers,
        products: posStore.products,
        customers: posStore.customers,
        sales: posStore.sales,
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

