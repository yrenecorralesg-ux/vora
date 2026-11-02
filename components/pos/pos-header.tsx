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
  } = usePos();

  if (currentView === 'POS-01' && !notification) {
    return null;
  }

  return (
    <header className="sticky top-0 z-30 w-full bg-[#F6F5F0]/90 px-6 pt-5 pb-1 lg:px-8 backdrop-blur-md print:hidden">
      <div className="mx-auto max-w-7xl">
        {/* Toast Notificación con bordes suaves */}
        {notification && (
          <div
            role="status"
            className={`mb-3 flex items-center justify-between rounded-2xl px-5 py-2.5 text-xs font-semibold shadow-xs ${
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
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigateTo('POS-01')}
              className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white px-3.5 py-1.5 text-xs font-bold text-[#111827] shadow-2xs transition hover:bg-[#F6F5F0]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al inicio</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
