'use client';

import React from 'react';
import {
  ShoppingCart,
  Coins,
  Package,
  Users,
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { usePos } from './pos-context';

export function PosView01Dashboard() {
  const {
    activeUser,
    activeBranch,
    activeShift,
    navigateTo,
    sales,
    returns,
    showNotification,
    tenantBranding,
    me,
  } = usePos();

  const primaryColor = tenantBranding?.primaryColor || 'var(--crm-primary, #1E6B4E)';
  const secondaryColor = tenantBranding?.secondaryColor || 'var(--crm-secondary, #1E6B4E)';

  const isShiftOpen = activeShift && activeShift.status === 'abierto';

  // Métricas reales: "hoy" en hora de Caracas; la caja solo cuenta el turno abierto.
  const dayKey = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) : '';
  const today = dayKey(new Date().toISOString());
  const isConfirmed = (s: (typeof sales)[number]) =>
    s.commercial_status === 'confirmada' || s.commercial_status === 'parcialmente_devuelta';

  const todaySales = sales.filter((s) => isConfirmed(s) && dayKey(s.confirmed_at ?? s.created_at) === today);
  const totalSalesUsd = todaySales.reduce((sum, s) => sum + s.total_usd, 0);
  const totalSalesCount = todaySales.length;
  const totalUnitsSold = todaySales
    .flatMap((s) => s.lines ?? [])
    .filter((l) => !l.is_service)
    .reduce((sum, l) => sum + (l.quantity - l.returned_quantity), 0);
  const averageTicketUsd = totalSalesCount > 0 ? totalSalesUsd / totalSalesCount : 0;

  const shiftSales = isShiftOpen ? sales.filter((s) => s.shift_id === activeShift!.id && isConfirmed(s)) : [];
  const shiftSalesUsd = shiftSales.reduce((sum, s) => sum + s.total_usd, 0);
  const shiftReturnsUsd = isShiftOpen
    ? returns.filter((r) => r.shift_id === activeShift!.id).reduce((sum, r) => sum + r.total_refunded_usd, 0)
    : 0;
  const openingUsd = isShiftOpen ? activeShift!.opening_amount_usd : 0;

  const byMethod: Record<string, number> = { efectivo: 0, pago_movil: 0, tarjeta: 0, cashea: 0 };
  for (const p of shiftSales.flatMap((s) => s.payments ?? [])) {
    const usd = p.currency === 'USD' ? p.amount_applied : p.exchange_rate_snapshot > 0 ? p.amount_applied / p.exchange_rate_snapshot : 0;
    byMethod[p.method] = (byMethod[p.method] ?? 0) + usd;
  }
  const methodRows = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'pago_movil', label: 'Pago Móvil', icon: Smartphone },
    { key: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { key: 'cashea', label: 'Cashea', icon: Wallet },
  ];
  const usd = (n: number) => `$${n.toFixed(2)} USD`;
  const firstName = me ? activeUser.name.split(' ')[0] : '';

  const handleStartSale = () => {
    if (!isShiftOpen) {
      showNotification(
        'Turno requerido',
        'No existe un turno abierto en la caja actual. Debe aperturar turno antes de operar ventas.',
        'alert',
      );
      navigateTo('POS-02');
      return;
    }
    navigateTo('POS-03-04');
  };

  return (
    <div className="space-y-8">
      {/* Saludo y Estado Principal */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#111827]">
          {firstName ? `¡Hola, ${firstName}!` : '¡Hola!'}
        </h1>
        <p className="mt-1 text-sm font-medium text-[#52635A]">
          {isShiftOpen ? 'Todo listo para vender' : 'Abre la caja para empezar a vender'}
        </p>
      </div>

      {/* 4 Tarjetas de Acciones Rápidas con Bordes Curvos Suaves */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* 1. Nueva Venta */}
        <button
          type="button"
          onClick={handleStartSale}
          className="group flex flex-col items-center justify-center rounded-3xl p-6 text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg aspect-square"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 transition group-hover:scale-105">
            <ShoppingCart className="h-8 w-8 text-white" />
          </div>
          <span className="mt-4 text-sm font-bold tracking-tight">Nueva venta</span>
        </button>

        {/* 2. Abrir / Gestionar Caja */}
        <button
          type="button"
          onClick={() => navigateTo(isShiftOpen ? 'POS-15' : 'POS-02')}
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs transition-all hover:shadow-md aspect-square"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl transition group-hover:scale-105"
            style={{
              backgroundColor: `color-mix(in srgb, ${secondaryColor} 15%, transparent)`,
              color: secondaryColor,
            }}
          >
            <Coins className="h-8 w-8" />
          </div>
          <span className="mt-4 text-sm font-bold text-[#111827]">
            {isShiftOpen ? 'Caja activa' : 'Abrir caja'}
          </span>
        </button>

        {/* 3. Productos / Catálogo */}
        <button
          type="button"
          onClick={() => navigateTo('POS-03-04')}
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs transition-all hover:shadow-md aspect-square"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#92400E] transition group-hover:scale-105">
            <Package className="h-8 w-8 text-[#C97857]" />
          </div>
          <span className="mt-4 text-sm font-bold text-[#111827]">Productos</span>
        </button>

        {/* 4. Clientes */}
        <button
          type="button"
          onClick={() => navigateTo('POS-05')}
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs transition-all hover:shadow-md aspect-square"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl transition group-hover:scale-105"
            style={{
              backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
              color: primaryColor,
            }}
          >
            <Users className="h-8 w-8" />
          </div>
          <span className="mt-4 text-sm font-bold text-[#111827]">Clientes</span>
        </button>
      </div>

      {/* Resumen del Día */}
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Resumen del día</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Ventas Hoy */}
          <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
            <span className="text-xs font-semibold text-[#52635A]">Ventas hoy</span>
            <div className="mt-2 text-2xl font-black text-[#111827]">
              ${totalSalesUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-[#52635A]">
              {totalSalesCount} {totalSalesCount === 1 ? 'venta' : 'ventas'}
            </div>
          </div>

          {/* Productos Vendidos */}
          <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
            <span className="text-xs font-semibold text-[#52635A]">Productos vendidos</span>
            <div className="mt-2 text-2xl font-black text-[#111827]">
              {totalUnitsSold}
            </div>
            <div className="mt-1 text-xs text-[#52635A]">Unidades</div>
          </div>

          {/* Ticket Promedio */}
          <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
            <span className="text-xs font-semibold text-[#52635A]">Ticket promedio</span>
            <div className="mt-2 text-2xl font-black text-[#111827]">
              ${averageTicketUsd.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-[#52635A]">Por venta</div>
          </div>
        </div>
      </div>

      {/* Caja - Sede Principal */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[#111827]">
              Caja - {activeBranch.name}
            </h2>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${isShiftOpen
                ? 'border border-[#86EFAC] bg-[#DCFCE7] text-[#14532D]'
                : 'border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
                }`}
            >
              {isShiftOpen ? 'Abierta' : 'Cerrada'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('POS-16')}
              className="rounded-2xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold text-[#52635A] shadow-xs transition hover:border-[#1E6B4E] hover:text-[#111827]"
            >
              Ver reportes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Resumen de Caja */}
          <div className="flex flex-col justify-between rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Resumen de caja</h3>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between text-[#52635A]">
                  <span>Saldo inicial</span>
                  <span className="font-bold text-[#111827]">
                    {usd(openingUsd)}
                  </span>
                </div>
                <div className="flex justify-between text-[#52635A]">
                  <span>Ventas</span>
                  <div className="text-right">
                    <span className="font-bold text-[#111827]">{usd(shiftSalesUsd)}</span>
                    <span className="ml-1 text-[10px]">
                      ({shiftSales.length} {shiftSales.length === 1 ? 'venta' : 'ventas'})
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-[#52635A]">
                  <span>Devoluciones</span>
                  <span className="font-bold text-[#B91C1C]">{usd(shiftReturnsUsd)}</span>
                </div>
              </div>
            </div>

            {/* Total Destacado en Caja */}
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#F5CBA7] bg-[#FDF2E2] p-4 text-[#111827]">
              <span className="text-sm font-bold">Total en caja</span>
              <span className="text-xl font-extrabold">
                {usd(openingUsd + shiftSalesUsd - shiftReturnsUsd)}
              </span>
            </div>
          </div>

          {/* Resumen por Método de Pago */}
          <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
            <h3 className="text-sm font-bold text-[#111827]">Resumen por método de pago</h3>
            <div className="mt-4 space-y-3.5 text-xs">
              {methodRows.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#52635A]">
                    <Icon className="h-4 w-4 text-[#52635A]" />
                    <span>{label}</span>
                  </div>
                  <span className="font-bold text-[#111827]">{usd(byMethod[key] ?? 0)}</span>
                </div>
              ))}
              {!isShiftOpen && <p className="pt-1 text-[11px] text-[#8A968F]">Sin turno abierto: los montos se muestran al abrir la caja.</p>}
            </div>
          </div>
        </div>

        {/* Botones de Acción Inferiores */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => navigateTo('POS-15')}
            className="flex-1 rounded-2xl border-2 border-[#C83E3B] bg-white py-3.5 text-center text-sm font-bold text-[#B91C1C] shadow-xs transition hover:bg-[#FEF2F2]"
          >
            Cerrar caja
          </button>
          <button
            type="button"
            onClick={() => navigateTo('POS-13')}
            className="flex-1 rounded-2xl py-3.5 text-center text-sm font-bold text-white shadow-md transition hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            Ver detalle de ventas
          </button>
        </div>
      </div>
    </div>
  );
}
