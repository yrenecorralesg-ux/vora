'use client';

import React, { useState } from 'react';
import {
  Search,
  ScanLine,
  UserPlus,
  FileText,
  MoreHorizontal,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Clock,
  Wifi,
  WifiOff,
  PauseCircle,
  PlayCircle,
  X,
  Scale,
  Sparkles,
} from 'lucide-react';
import { usePos } from './pos-context';
import type { PosProduct } from '@/lib/types';
import { MOCK_USERS } from '@/lib/pos-demo-data';

export function PosView0304SaleCart() {
  const {
    products,
    cart,
    addToCart,
    updateCartQuantity,
    updateCartDiscount,
    removeFromCart,
    clearCart,
    cartNotes,
    setCartNotes,
    selectedCustomer,
    discountAuthorizedBy,
    setDiscountAuthorizedBy,
    settings,
    exchangeRate,
    navigateTo,
    showNotification,
    activeShift,
    parkedSales,
    parkCurrentSale,
    resumeParkedSale,
    deleteParkedSale,
    isOnline,
    scanBarcode,
    isFuncActive,
    promotions,
    staffUsers,
    validateSupervisorPin,
  } = usePos();

  // Filtros de Catálogo
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas las categorías');

  // Modales
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteInput, setNoteInput] = useState(cartNotes);
  const [showParkedModal, setShowParkedModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Modal de Autorización de Descuento
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [supervisorIndex, setSupervisorIndex] = useState<number | null>(null);
  const [requestedDiscountPercent, setRequestedDiscountPercent] = useState<number>(0);
  const [supervisorId, setSupervisorId] = useState(MOCK_USERS[2].id);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [supervisorReason, setSupervisorReason] = useState('Campaña de fidelización autorizada en mostrador [mock]');
  const [supervisorError, setSupervisorError] = useState<string | null>(null);

  // Modal de Pesaje en Balanza (pos_scale_weighing)
  const [weighingProduct, setWeighingProduct] = useState<PosProduct | null>(null);
  const [scaleWeightKg, setScaleWeightKg] = useState<string>('0.750');
  const [scaleTareKg, setScaleTareKg] = useState<string>('0.000');

  // Motor de Promociones Automáticas (pos_promotions_engine)
  const matchedPromo = React.useMemo(() => {
    if (!isFuncActive('pos_promotions_engine')) return null;
    const cartSkus = cart.map((c) => c.sku);
    for (const promo of promotions) {
      if (!promo.is_active) continue;
      const allMatched = promo.trigger_skus.every((sku) => cartSkus.includes(sku));
      if (allMatched && promo.type === 'combo') {
        return promo;
      }
      const matchQty = cart.find((c) => promo.trigger_skus.includes(c.sku) && c.quantity >= promo.required_quantity);
      if (matchQty && promo.type === 'buy_x_get_y') {
        return promo;
      }
    }
    return null;
  }, [cart, promotions, isFuncActive]);

  const categories = [
    'Todas las categorías',
    'Ropa',
    'Calzado',
    'Accesorios',
    'Perfumería',
    'Hogar',
    'Servicios',
  ];

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'Todas las categorías' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q));
    return matchesCategory && matchesQuery;
  });

  // Totales
  const subtotalUsd = cart.reduce((sum, item) => sum + item.unitPriceUsd * item.quantity, 0);
  const totalDiscountUsd = cart.reduce(
    (sum, item) => sum + item.unitPriceUsd * item.quantity * (item.discountPercent / 100),
    0,
  );
  const taxUsd = cart.reduce((sum, item) => {
    const discounted = item.unitPriceUsd * (1 - item.discountPercent / 100);
    return sum + discounted * item.quantity * (item.taxRatePercent / 100);
  }, 0);
  const totalUsd = Math.max(0, subtotalUsd - totalDiscountUsd + taxUsd);
  const totalVes = totalUsd * exchangeRate;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleDiscountChange = (index: number, newPercent: number) => {
    if (newPercent > settings.max_cashier_discount_percent) {
      setSupervisorIndex(index);
      setRequestedDiscountPercent(newPercent);
      setSupervisorError(null);
      setSupervisorPin('');
      setShowSupervisorModal(true);
    } else {
      updateCartDiscount(index, newPercent);
    }
  };

  const handleApproveDiscount = () => {
    const supervisor = staffUsers.find((u) => u.id === supervisorId);
    const isValid =
      (supervisor && supervisorPin === supervisor.pin) ||
      validateSupervisorPin(supervisorPin);

    if (!isValid) {
      setSupervisorError('El PIN del supervisor no es válido. Operación denegada.');
      return;
    }

    if (supervisorIndex !== null) {
      updateCartDiscount(supervisorIndex, requestedDiscountPercent);
      const authName = supervisor?.name || 'Supervisor de Guardia';
      setDiscountAuthorizedBy(authName);
      showNotification(
        'Descuento Aprobado',
        `Descuento del ${requestedDiscountPercent}% autorizado por ${authName} [mock].`,
        'success',
      );
    }

    setShowSupervisorModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Alerta si el turno no está abierto */}
      {!activeShift && (
        <div className="flex items-center justify-between rounded-3xl border border-[#FDE68A] bg-[#FEF3C7] p-4 text-xs font-semibold text-[#92400E] shadow-xs">
          <span>
            No hay turno abierto en esta caja. Para procesar cobros, debe realizar la apertura formal.
          </span>
          <button
            type="button"
            onClick={() => navigateTo('POS-02')}
            className="rounded-2xl border border-[#92400E] bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider hover:bg-[#FEF3C7]"
          >
            Aperturar Turno
          </button>
        </div>
      )}

      {/* Disposición en Dos Columnas: Catálogo (Izquierda ~60%) y Carrito (Derecha ~40%) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Columna Izquierda: Buscador, Categorías y Grilla de Productos */}
        <div className="space-y-4 lg:col-span-7">
          {/* Barra de Estado: Conectividad y Lector USB */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                isOnline ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#92400E]'
              }`}>
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? 'Online (Sincronizado)' : 'Offline (Contingencia)'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#52635A]">
                <ScanLine className="h-3 w-3 text-[#1E6B4E]" />
                Lector USB activo (escucha automática)
              </span>
            </div>
          </div>

          {/* Buscador de Alto Contraste con Bordes Redondeados */}
          <div className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white p-2 shadow-xs transition focus-within:border-[#1E6B4E]">
            <Search className="ml-2 h-5 w-5 text-[#52635A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos por nombre, código o código de barras..."
              className="w-full bg-transparent p-1.5 text-xs font-medium text-[#111827] outline-none placeholder:text-[#52635A]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-2 text-xs font-bold text-[#52635A] hover:text-[#111827]"
              >
                Limpiar
              </button>
            )}
            {isFuncActive('pos_scanner') && (
              <div className="flex items-center border-l border-[#DCE3DF] pl-2 pr-1">
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(true)}
                  title="Lector manual o pistola USB"
                  className="flex h-8 items-center gap-1.5 rounded-xl bg-[#F6F5F0] px-2.5 text-xs font-semibold text-[#52635A] hover:bg-[#DCE3DF]"
                >
                  <ScanLine className="h-4 w-4" />
                  <span className="hidden sm:inline text-[11px]">Escanear</span>
                </button>
              </div>
            )}
          </div>

          {/* Pastillas de Categorías Redondeadas */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#111827]">Categorías</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all ${isSelected
                      ? 'bg-[#144D37] text-white shadow-xs'
                      : 'border border-[#DCE3DF] bg-white text-[#52635A] hover:bg-[#F6F5F0]'
                      }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grilla de Productos */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {filteredProducts.map((p) => {
              const isOutOfStock = !p.is_service && p.stock_quantity <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => {
                    if (p.is_weighable && isFuncActive('pos_scale_weighing')) {
                      setWeighingProduct(p);
                      setScaleWeightKg('0.750');
                      setScaleTareKg('0.000');
                    } else {
                      addToCart(p);
                    }
                  }}
                  className={`group flex flex-col justify-between rounded-3xl border border-[#E5E9E7] bg-white p-4 text-left shadow-xs transition hover:border-[#1E6B4E] hover:shadow-md ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                >
                  <div>
                    {/* Placeholder de Foto del Producto */}
                    <div className="relative mb-3 flex aspect-square w-full items-center justify-center rounded-2xl bg-[#F6F5F0] text-3xl font-bold text-[#A9BEA5] overflow-hidden group-hover:scale-102 transition">
                      <span>{p.name.charAt(0)}</span>
                      {p.is_service && (
                        <span className="absolute top-2 left-2 rounded-full bg-[#1E6B4E] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          Servicio
                        </span>
                      )}
                      {p.is_weighable && isFuncActive('pos_scale_weighing') && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-[#3B82F6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          <Scale className="h-2.5 w-2.5" /> Balanza
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-[#111827] line-clamp-2">
                      {p.name}
                    </h4>
                    <p className="mt-0.5 text-[10px] text-[#52635A]">SKU: {p.sku}</p>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-[#F6F5F0]">
                    <span className="text-sm font-extrabold text-[#111827]">
                      ${p.price_usd.toFixed(2)}
                    </span>
                    {!p.is_service && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          p.stock_quantity <= 0
                            ? 'bg-[#FEF2F2] text-[#B91C1C]'
                            : p.stock_quantity <= 3
                            ? 'bg-[#FEF3C7] text-[#92400E]'
                            : 'text-[#52635A]'
                        }`}
                      >
                        {p.stock_quantity <= 0
                          ? 'Agotado'
                          : p.stock_quantity <= 3
                          ? `Bajo: ${p.stock_quantity} u.`
                          : `Disp: ${p.stock_quantity}`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Panel del Carrito de Venta Actual */}
        <div className="lg:col-span-5">
          <div className="flex flex-col justify-between rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-sm">
            <div>
              {/* Cabecera del Carrito */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E9E7]">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#111827]">Venta actual</h3>
                  {/* Botón de Ventas en Espera / Multiticket */}
                  {isFuncActive('pos_multiticket') && (
                    <button
                      type="button"
                      onClick={() => setShowParkedModal(true)}
                      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        parkedSales.length > 0
                          ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] hover:bg-[#FDE68A]'
                          : 'bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]'
                      }`}
                      title="Ventas pausadas en espera"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>En Espera ({parkedSales.length})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Botón Selector de Cliente */}
                  <button
                    type="button"
                    onClick={() => navigateTo('POS-05')}
                    className="flex items-center gap-1.5 rounded-xl bg-[#144D37] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1E6B4E]"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{selectedCustomer ? (selectedCustomer.legal_name || 'Cliente').split(' ')[0] : '+ Cliente'}</span>
                  </button>

                  {/* Botón de Nota */}
                  <button
                    type="button"
                    onClick={() => setShowNotesModal(true)}
                    className="flex items-center gap-1 rounded-xl border border-[#DCE3DF] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-xs transition hover:bg-[#F6F5F0]"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#52635A]" />
                    <span>Nota</span>
                  </button>

                  {/* Opciones Adicionales */}
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) handleDiscountChange(0, 15);
                    }}
                    title="Autorizar descuento de supervisor"
                    className="flex items-center rounded-xl border border-[#DCE3DF] bg-white p-2 text-[#52635A] shadow-xs hover:bg-[#F6F5F0]"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Cliente Seleccionado Banner */}
              {selectedCustomer && (
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#DCFCE7] p-2.5 text-xs text-[#14532D]">
                  <div>
                    <span className="font-bold">{selectedCustomer.legal_name}</span>
                    <span className="ml-2 text-[10px] text-[#52635A]">{selectedCustomer.document_number}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo('POS-05')}
                    className="text-[10px] font-bold underline"
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {/* Banner de Promoción Automática (pos_promotions_engine) */}
              {matchedPromo && (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-900 shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold">{matchedPromo.name}</span>
                      <p className="text-[10px] text-emerald-700">{matchedPromo.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {matchedPromo.discount_percent}% OFF Auto
                  </span>
                </div>
              )}

              {/* Lista de Líneas de Carrito */}
              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-[#52635A]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6F5F0] text-[#A9BEA5]">
                      <svg
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="8" cy="21" r="1" />
                        <circle cx="19" cy="21" r="1" />
                        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                      </svg>
                    </div>
                    <p className="mt-3 text-xs font-bold text-[#111827]">El carrito está vacío</p>
                    <p className="mt-1 text-[11px]">Haga clic en los productos para agregarlos a la venta</p>
                  </div>
                ) : (
                  cart.map((line, idx) => (
                    <div
                      key={line.productId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#F0F2F1] bg-[#FDFDFD] p-3 text-xs shadow-2xs"
                    >
                      {/* Mini Thumbnail */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F5F0] text-xs font-bold text-[#52635A]">
                        {line.name.charAt(0)}
                      </div>

                      {/* Detalles del Producto */}
                      <div className="min-w-0 flex-1">
                        <span className="truncate font-bold text-[#111827] block">
                          {line.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-[#52635A]">
                          <span>${line.unitPriceUsd.toFixed(2)}</span>
                          {line.discountPercent > 0 && (
                            <span className="rounded-full bg-[#FEF3C7] px-1.5 py-0.2 font-bold text-[#92400E]">
                              -{line.discountPercent}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stepper de Cantidad */}
                      <div className="flex items-center rounded-xl border border-[#DCE3DF] bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(idx, line.quantity - 1)}
                          className="px-2 py-1 text-[#52635A] hover:bg-[#F6F5F0]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-[#111827]">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(idx, line.quantity + 1)}
                          className="px-2 py-1 text-[#52635A] hover:bg-[#F6F5F0]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Subtotal de Línea */}
                      <div className="w-16 text-right">
                        <span className="font-extrabold text-[#111827]">
                          ${line.lineTotalUsd.toFixed(2)}
                        </span>
                      </div>

                      {/* Eliminar Línea */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="p-1 text-[#52635A] hover:text-[#B91C1C]"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Totales y Botón Cobrar */}
            <div className="mt-6 pt-4 border-t border-[#E5E9E7]">
              {/* Desglose */}
              <div className="space-y-1.5 text-xs text-[#52635A]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#111827]">${subtotalUsd.toFixed(2)}</span>
                </div>
                {totalDiscountUsd > 0 && (
                  <div className="flex justify-between text-[#B91C1C]">
                    <span>Descuento aplicado</span>
                    <span className="font-semibold">-${totalDiscountUsd.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>IVA (16%)</span>
                  <span className="font-semibold text-[#111827]">${taxUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* Total Destacado */}
              <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-[#FDF2E2] border border-[#F5CBA7] p-4">
                <div>
                  <span className="text-[11px] font-bold text-[#92400E] block">
                    Total ({totalItemsCount} {totalItemsCount === 1 ? 'producto' : 'productos'})
                  </span>
                  <span className="text-xs font-semibold text-[#92400E]">
                    {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#111827]">${totalUsd.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={clearCart}
                  className="rounded-2xl border border-[#DCE3DF] bg-white px-3 py-3 text-xs font-bold text-[#B91C1C] hover:bg-[#FEF2F2] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Limpiar
                </button>

                {isFuncActive('pos_multiticket') && (
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => parkCurrentSale()}
                    className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-3 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title="Pausar esta venta para atender a otro cliente (Multiticket)"
                  >
                    <PauseCircle className="h-4 w-4 text-[#52635A]" />
                    <span>Pausar</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => navigateTo('POS-06')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#1E6B4E] py-3.5 text-center text-sm font-bold text-white shadow-md hover:bg-[#16523B] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Cobrar</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Nota Comercial */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#111827]">Nota comercial de la venta</h3>
            <textarea
              rows={3}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827] outline-none"
              placeholder="Instrucciones especiales de empaque, referencia de cliente o entrega..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827]"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={() => {
                  setCartNotes(noteInput);
                  setShowNotesModal(false);
                }}
                className="rounded-2xl bg-[#1E6B4E] px-4 py-2 text-xs font-bold text-white hover:bg-[#16523B]"
              >
                Fijar nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Autorización de Supervisor en Caliente */}
      {showSupervisorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#C97857] bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-[#C97857]">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Autorización de Supervisor
              </h3>
            </div>
            <p className="mt-2 text-xs text-[#52635A]">
              El descuento solicitado ({requestedDiscountPercent}%) supera el límite del cajero (
              {settings.max_cashier_discount_percent}%). Ingrese credenciales de supervisor.
            </p>

            {supervisorError && (
              <div role="alert" className="mt-3 rounded-2xl border border-[#C83E3B] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C]">
                {supervisorError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                  Supervisor autorizante
                </label>
                <select
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2.5 text-xs font-semibold text-[#111827]"
                >
                  {MOCK_USERS.filter((u) => u.role === 'pos_supervisor' || u.role === 'pos_store_admin').map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                  PIN de seguridad del supervisor
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="PIN numérico (ej. 9876 para Carlos R.)"
                  className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-2.5 text-xs text-[#111827]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                  Justificación
                </label>
                <input
                  type="text"
                  value={supervisorReason}
                  onChange={(e) => setSupervisorReason(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-2.5 text-xs text-[#111827]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSupervisorModal(false)}
                className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApproveDiscount}
                className="rounded-2xl bg-[#1E6B4E] px-4 py-2 text-xs font-bold text-white hover:bg-[#16523B]"
              >
                Autorizar descuento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Multiticket / Ventas en Espera */}
      {showParkedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#1E6B4E]" />
                <h3 className="text-base font-bold text-[#111827]">
                  Ventas en Espera ({parkedSales.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowParkedModal(false)}
                className="p-1 text-[#52635A] hover:text-[#111827]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-xs text-[#52635A]">
              Tickets suspendidos en mostrador. Seleccione uno para reanudar el cobro.
            </p>

            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {parkedSales.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCE3DF] p-6 text-center text-xs text-[#52635A]">
                  No hay ventas pausadas en este momento.
                </div>
              ) : (
                parkedSales.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl border border-[#E5E9E7] bg-[#FDFDFD] p-4 text-xs transition hover:border-[#1E6B4E]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#111827]">
                          {p.customer ? p.customer.legal_name : 'Consumidor Final'}
                        </span>
                        <span className="rounded-full bg-[#F6F5F0] px-2 py-0.5 text-[10px] font-mono text-[#52635A]">
                          #{p.id.slice(-4)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#52635A]">
                        {p.cart.length} {p.cart.length === 1 ? 'producto' : 'productos'} · {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {p.notes && (
                        <p className="text-[10px] italic text-[#1E6B4E]">“{p.notes}”</p>
                      )}
                      <div className="font-extrabold text-[#111827] text-sm">
                        ${p.totalUsd.toFixed(2)} USD
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => deleteParkedSale(p.id)}
                        className="rounded-xl border border-[#DCE3DF] p-2 text-[#B91C1C] hover:bg-[#FEF2F2]"
                        title="Descartar ticket"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resumeParkedSale(p.id);
                          setShowParkedModal(false);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-[#1E6B4E] px-3.5 py-2 font-bold text-white hover:bg-[#16523B]"
                      >
                        <PlayCircle className="h-4 w-4" />
                        <span>Reanudar</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowParkedModal(false)}
                className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Escáner Manual de Código de Barras */}
      {showBarcodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E9E7]">
              <div className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-[#1E6B4E]" />
                <h3 className="text-base font-bold text-[#111827]">Lector de Código</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBarcodeModal(false)}
                className="p-1 text-[#52635A] hover:text-[#111827]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#52635A]">
              Ingrese el código SKU o código de barras para agregarlo inmediatamente al carrito:
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!barcodeInput.trim()) return;
                const ok = scanBarcode(barcodeInput.trim());
                if (ok) {
                  setBarcodeInput('');
                  setShowBarcodeModal(false);
                }
              }}
              className="space-y-3"
            >
              <input
                type="text"
                autoFocus
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Ej: CMB-001 o 7591234..."
                className="w-full rounded-2xl border border-[#DCE3DF] p-3 text-sm font-bold text-[#111827] outline-none focus:border-[#1E6B4E]"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="flex-1 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] py-2.5 text-xs font-bold text-[#111827]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-[#1E6B4E] py-2.5 text-xs font-bold text-white hover:bg-[#16523B]"
                >
                  Buscar y Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Báscula / Balanza Electrónica (pos_scale_weighing) */}
      {weighingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111827]">Pesaje en Balanza</h3>
                  <p className="text-[10px] text-[#52635A]">{weighingProduct.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWeighingProduct(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-center">
                <span className="text-[10px] font-bold uppercase text-blue-900 tracking-wider">
                  Peso Bruto en Báscula (Kg)
                </span>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-mono">
                  <input
                    type="number"
                    step="0.005"
                    min="0.005"
                    max="100"
                    value={scaleWeightKg}
                    onChange={(e) => setScaleWeightKg(e.target.value)}
                    className="w-32 bg-transparent text-center text-4xl font-black text-blue-950 outline-none"
                  />
                  <span className="text-sm font-bold text-blue-800">kg</span>
                </div>
                <div className="mt-2 flex justify-center gap-2">
                  {['0.250', '0.500', '0.750', '1.000', '1.500'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setScaleWeightKg(preset)}
                      className="rounded-lg border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-bold text-blue-900 hover:bg-blue-100"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F6F5F0] p-3 text-xs">
                <span className="text-[#52635A]">Precio por Kilo:</span>
                <span className="font-bold text-[#111827]">${weighingProduct.price_usd.toFixed(2)} USD / Kg</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 font-bold">
                <span>Subtotal calculado:</span>
                <span className="text-base font-black">
                  ${(Number(scaleWeightKg || 0) * weighingProduct.price_usd).toFixed(2)} USD
                </span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#E5E9E7]">
                <button
                  type="button"
                  onClick={() => setWeighingProduct(null)}
                  className="flex-1 rounded-xl border border-[#DCE3DF] bg-white py-2.5 text-xs font-bold text-[#111827]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const weight = Number(scaleWeightKg);
                    if (weight > 0) {
                      addToCart(weighingProduct, weight);
                      showNotification(
                        'Producto Pesado',
                        `${weighingProduct.name} (${weight.toFixed(3)} Kg) agregado al carrito [mock].`,
                        'success',
                      );
                      setWeighingProduct(null);
                    }
                  }}
                  className="flex-1 rounded-xl bg-[#144D37] py-2.5 text-xs font-bold text-white hover:bg-[#1E6B4E]"
                >
                  Agregar Peso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
