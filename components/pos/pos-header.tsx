'use client';

import React from 'react';
import { ArrowLeft, Monitor, WifiOff, CloudUpload } from 'lucide-react';
import { usePos } from './pos-context';

export function PosHeader() {
  const {
    currentView,
    navigateTo,
    exchangeRate,
    refreshExchangeRate,
    isFetchingExchangeRate,
    isFuncActive,
    setIsCustomerDisplayOpen,
    isOnline,
    offlineQueueCount,
    triggerSyncOfflineSales,
  } = usePos();

  // Los avisos se muestran como notificaciones flotantes (pos-toaster.tsx).
  if (currentView === 'POS-01') {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 w-full bg-[#F6F5F0]/95 px-6 pt-2.5 pb-1 lg:px-8 backdrop-blur-md print:hidden">
      <div className="mx-auto max-w-7xl">
        {(
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateTo('POS-01')}
              className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white px-3.5 py-1.5 text-xs font-bold text-[#111827] shadow-2xs transition hover:bg-[#F6F5F0]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al inicio</span>
            </button>

            {/* Pill Tasa Oficial y Pantalla Cliente en cabecera */}
            <div className="flex items-center gap-2">
              {!isOnline && (
                <span className="flex items-center gap-1 rounded-xl border border-[#F87171] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-bold text-[#B91C1C]">
                  <WifiOff className="h-3 w-3" />
                  <span>Offline</span>
                </span>
              )}
              {offlineQueueCount > 0 && (
                <button
                  type="button"
                  onClick={() => triggerSyncOfflineSales()}
                  title="Sincronizar ventas offline pendientes ahora"
                  className="flex items-center gap-1.5 rounded-xl border border-[#F59E0B] bg-[#FFFBEB] px-2.5 py-1 text-[11px] font-bold text-[#B45309] hover:bg-[#FEF3C7] transition"
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>Pendientes ({offlineQueueCount})</span>
                </button>
              )}
              {isFuncActive('pos_customer_display') && (
                <button
                  type="button"
                  onClick={() => setIsCustomerDisplayOpen(true)}
                  title="Abrir pantalla de cara al cliente (Customer Display)"
                  className="flex items-center gap-1.5 rounded-xl border border-[#DCE3DF] bg-white px-3 py-1 text-xs font-bold text-[#111827] shadow-2xs hover:bg-[#F6F5F0] transition"
                >
                  <Monitor className="h-3.5 w-3.5 text-[#1E6B4E]" />
                  <span>Pantalla Cliente</span>
                </button>
              )}
              <span className="rounded-xl bg-white border border-[#DCE3DF] px-3 py-1 text-[11px] font-bold text-[#111827] shadow-2xs">
                Tasa BCV:{' '}
                <span className="text-[#1E6B4E]">
                  Bs. {exchangeRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / $
                </span>
              </span>
              {isFuncActive('pos_exchange_rate_api') && (
                <button
                  type="button"
                  onClick={() => refreshExchangeRate()}
                  disabled={isFetchingExchangeRate}
                  title="Sincronizar tasa BCV ahora con la API configurada"
                  className="rounded-xl border border-[#DCE3DF] bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-[#52635A] hover:bg-[#F6F5F0] hover:text-[#111827] transition disabled:opacity-50"
                >
                  {isFetchingExchangeRate ? '...' : 'Sync'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
