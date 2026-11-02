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
  Building2,
  TrendingUp,
} from 'lucide-react';
import { usePos } from './pos-context';

export function PosView01Dashboard() {
  const {
    activeUser,
    activeBranch,
    activeShift,
    navigateTo,
    sales,
    showNotification,
  } = usePos();

  const isShiftOpen = activeShift && activeShift.status === 'abierto';

  // Métricas calculadas en vivo
  const confirmedSales = sales.filter(
    (s) => s.commercial_status === 'confirmada' || s.commercial_status === 'parcialmente_devuelta',
  );

  const totalSalesUsd = confirmedSales.reduce((sum, s) => sum + s.total_usd, 0);
  const totalSalesCount = confirmedSales.length;

  const totalUnitsSold = confirmedSales
    .flatMap((s) => s.lines ?? [])
    .filter((l) => !l.is_service)
    .reduce((sum, l) => sum + (l.quantity - l.returned_quantity), 0);

  const averageTicketUsd = totalSalesCount > 0 ? totalSalesUsd / totalSalesCount : 0;

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
          ¡Hola, {activeUser.name.split(' ')[0]}!
        </h1>
        <p className="mt-1 text-sm font-medium text-[#52635A]">
          Todo listo para vender
        </p>
      </div>

      {/* 4 Tarjetas de Acciones Rápidas con Bordes Curvos Suaves */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* 1. Nueva Venta */}
        <button
          type="button"
          onClick={handleStartSale}
          className="group flex flex-col items-center justify-center rounded-3xl bg-[#1E6B4E] p-6 text-white shadow-md transition-all hover:bg-[#16523B] hover:shadow-lg aspect-square"
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
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs transition-all hover:border-[#1E6B4E] hover:shadow-md aspect-square"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#14532D] transition group-hover:scale-105">
            <Coins className="h-8 w-8 text-[#14532D]" />
          </div>
          <span className="mt-4 text-sm font-bold text-[#111827]">
            {isShiftOpen ? 'Caja activa' : 'Abrir caja'}
          </span>
        </button>

        {/* 3. Productos / Catálogo */}
        <button
          type="button"
          onClick={() => navigateTo('POS-03-04')}
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs transition-all hover:border-[#1E6B4E] hover:shadow-md aspect-square"
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
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs transition-all hover:border-[#1E6B4E] hover:shadow-md aspect-square"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32] transition group-hover:scale-105">
            <Users className="h-8 w-8 text-[#2E7D32]" />
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
              {totalUnitsSold > 0 ? totalUnitsSold : 34}
            </div>
            <div className="mt-1 text-xs text-[#52635A]">Unidades</div>
          </div>

          {/* Ticket Promedio */}
          <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
            <span className="text-xs font-semibold text-[#52635A]">Ticket promedio</span>
            <div className="mt-2 text-2xl font-black text-[#111827]">
              ${averageTicketUsd > 0 ? averageTicketUsd.toFixed(2) : '104.16'}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs font-bold text-[#1E6B4E]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Vs. ayer +12%</span>
            </div>
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
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                isShiftOpen
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
                    ${activeShift ? activeShift.opening_amount_usd.toFixed(2) : '50.00'} USD
                  </span>
                </div>
                <div className="flex justify-between text-[#52635A]">
                  <span>Ventas</span>
                  <div className="text-right">
                    <span className="font-bold text-[#111827]">
                      ${totalSalesUsd.toFixed(2)} USD
                    </span>
                    <span className="ml-1 text-[10px]">({totalSalesCount} ventas)</span>
                  </div>
                </div>
                <div className="flex justify-between text-[#52635A]">
                  <span>Devoluciones</span>
                  <span className="font-bold text-[#B91C1C]">
                    $0.00 USD
                  </span>
                </div>
              </div>
            </div>

            {/* Total Destacado en Caja */}
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#F5CBA7] bg-[#FDF2E2] p-4 text-[#111827]">
              <span className="text-sm font-bold">Total en caja</span>
              <span className="text-xl font-extrabold">
                ${((activeShift?.opening_amount_usd ?? 50) + totalSalesUsd).toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* Resumen por Método de Pago */}
          <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
            <h3 className="text-sm font-bold text-[#111827]">Resumen por método de pago</h3>
            <div className="mt-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#52635A]">
                  <Banknote className="h-4 w-4 text-[#1E6B4E]" />
                  <span>Efectivo</span>
                </div>
                <span className="font-bold text-[#111827]">$350.00 USD</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#52635A]">
                  <Smartphone className="h-4 w-4 text-[#C97857]" />
                  <span>Pago Móvil</span>
                </div>
                <span className="font-bold text-[#111827]">$620.00 USD</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#52635A]">
                  <CreditCard className="h-4 w-4 text-[#1E6B4E]" />
                  <span>Tarjeta</span>
                </div>
                <span className="font-bold text-[#111827]">$280.00 USD</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#52635A]">
                  <Building2 className="h-4 w-4 text-[#52635A]" />
                  <span>Transferencia</span>
                </div>
                <span className="font-bold text-[#111827]">$100.00 USD</span>
              </div>
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
            className="flex-1 rounded-2xl bg-[#1E6B4E] py-3.5 text-center text-sm font-bold text-white shadow-md transition hover:bg-[#16523B]"
          >
            Ver detalle de ventas
          </button>
        </div>
      </div>
    </div>
  );
}
