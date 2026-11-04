'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { usePos } from './pos-context';

export function PosHeader() {
  const {
    currentView,
    navigateTo,
    notification,
    clearNotification,
    exchangeRate,
    refreshExchangeRate,
    isFetchingExchangeRate,
    isFuncActive,
  } = usePos();

  if (currentView === 'POS-01' && !notification) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 w-full bg-[#F6F5F0]/95 px-6 pt-2.5 pb-1 lg:px-8 backdrop-blur-md print:hidden">
      <div className="mx-auto max-w-7xl">
        {/* Toast Notificación con bordes suaves */}
        {notification && (
          <div
            role="status"
            className={`mb-2 flex items-center justify-between rounded-2xl px-5 py-2.5 text-xs font-semibold shadow-xs ${
              notification.type === 'critical'
                ? 'border border-[#C83E3B] bg-[#FEF2F2] text-[#B91C1C]'
                : notification.type === 'alert'
                ? 'border border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
                : 'border border-[#86EFAC] bg-[#DCFCE7] text-[#14532D]'
            }`}
          >
            <div>
              <span className="font-bold underline mr-2">{notification.title}:</span>
              <span>{notification.detail}</span>
            </div>
            <button
              type="button"
              onClick={clearNotification}
              className="rounded-xl border border-current px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider hover:opacity-80"
            >
              Cerrar aviso
            </button>
          </div>
        )}

        {currentView !== 'POS-01' && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateTo('POS-01')}
              className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white px-3.5 py-1.5 text-xs font-bold text-[#111827] shadow-2xs transition hover:bg-[#F6F5F0]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al inicio</span>
            </button>

            {/* Pill Tasa Oficial en cabecera */}
            <div className="flex items-center gap-2">
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
