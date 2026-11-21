'use client';

import React from 'react';
import { PosProvider, usePos } from '@/components/pos/pos-context';
import { PosSidebar } from '@/components/pos/pos-sidebar';
import { PosHeader } from '@/components/pos/pos-header';
import { PosToaster } from '@/components/pos/pos-toaster';
import { PosCustomerDisplayModal } from '@/components/pos/pos-customer-display-modal';
import { PosView01Dashboard } from '@/components/pos/pos-view-01-dashboard';
import { PosView02OpenShift } from '@/components/pos/pos-view-02-open-shift';
import { PosView0304SaleCart } from '@/components/pos/pos-view-03-04-sale-cart';
import { PosView05CustomerSelector } from '@/components/pos/pos-view-05-customer-selector';
import { PosView06Checkout } from '@/components/pos/pos-view-06-checkout';
import { PosView11ConfirmedSale } from '@/components/pos/pos-view-11-confirmed-sale';
import { PosView12DocumentPdf } from '@/components/pos/pos-view-12-document-pdf';
import { PosView13History } from '@/components/pos/pos-view-13-history';
import { PosView14Returns } from '@/components/pos/pos-view-14-returns';
import { PosView15ShiftClosure } from '@/components/pos/pos-view-15-shift-closure';
import { PosView16Reports } from '@/components/pos/pos-view-16-reports';
import { PosView17Settings } from '@/components/pos/pos-view-17-settings';
import { PosView18FiscalConfig } from '@/components/pos/pos-view-18-fiscal-config';
import { PosView19Users } from '@/components/pos/pos-view-19-users';
import { PosView20DispatchKds } from '@/components/pos/pos-view-20-dispatch-kds';

export function PosModuleContent() {
  const { currentView, isModuleEnabled, isFuncActive, activeTenantSlug, tenantName, tenantBranding } = usePos();

  if (!isModuleEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F5F0] p-6 text-[#111827]">
        <div className="max-w-md rounded-3xl border border-[#DCE3DF] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C83E3B]/10 text-[#C83E3B]">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Módulo POS Inhabilitado</h1>
          <p className="mt-2 text-xs text-[#52635A] leading-relaxed">
            El módulo de Punto de Venta (POS) se encuentra inactivo para {tenantName || 'esta empresa'}.
            Puedes activarlo o personalizar sus funcionalidades individuales desde el panel del Gestor de VORA.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href={`/t/${activeTenantSlug}`}
              className="inline-flex h-10 items-center justify-center rounded-2xl px-6 text-xs font-bold text-white transition hover:opacity-90"
              style={{ backgroundColor: tenantBranding?.primaryColor || 'var(--crm-primary, #144D37)' }}
            >
              Volver al CRM
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tenant-root
      className="flex min-h-screen bg-[#F6F5F0] text-[#111827] print:block print:bg-white"
      style={{
        '--crm-primary': tenantBranding.primaryColor,
        '--crm-secondary': tenantBranding.secondaryColor,
        '--crm-accent': tenantBranding.accentColor,
        fontFamily: tenantBranding.fontFamily,
      } as React.CSSProperties}
    >
      {/* Notificaciones flotantes */}
      <PosToaster />

      {/* Modal Pantalla de Cara al Cliente (pos_customer_display) */}
      <PosCustomerDisplayModal />

      {/* Barra Lateral estilo PDF */}
      <PosSidebar />

      {/* Área de Trabajo Principal */}
      <div className="flex min-w-0 flex-1 flex-col print:block print:w-full">
        {/* Cabecera sin pestañas de desarrollo */}
        <PosHeader />

        {/* Lienzo Operativo Central */}
        <main
          className={`flex-1 px-6 pb-8 lg:px-8 lg:pb-8 print:p-0 print:m-0 ${
            currentView === 'POS-01' ? 'pt-6 lg:pt-8' : 'pt-1.5 lg:pt-2'
          }`}
        >
          <div className="mx-auto max-w-7xl print:max-w-none print:w-full">
            {currentView === 'POS-01' && <PosView01Dashboard />}
            {currentView === 'POS-02' && <PosView02OpenShift />}
            {currentView === 'POS-03-04' && <PosView0304SaleCart />}
            {currentView === 'POS-05' && <PosView05CustomerSelector />}
            {currentView === 'POS-06' && <PosView06Checkout />}
            {currentView === 'POS-11' && <PosView11ConfirmedSale />}
            {currentView === 'POS-12' && <PosView12DocumentPdf />}
            {currentView === 'POS-13' && <PosView13History />}
            {currentView === 'POS-14' && <PosView14Returns />}
            {currentView === 'POS-15' && <PosView15ShiftClosure />}
            {currentView === 'POS-16' && <PosView16Reports />}
            {currentView === 'POS-17' && <PosView17Settings />}
            {currentView === 'POS-18' && (isFuncActive('pos_fiscal') ? <PosView18FiscalConfig /> : <PosView17Settings />)}
            {currentView === 'POS-19' && <PosView19Users />}
            {currentView === 'POS-20' && (isFuncActive('pos_order_dispatch_kds') ? <PosView20DispatchKds /> : <PosView01Dashboard />)}
          </div>
        </main>
      </div>
    </div>
  );
}

export function PosClient({
  initialSlug,
  initialTenant,
  initialBranding,
}: {
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
  return (
    <PosProvider
      initialSlug={initialSlug}
      initialTenant={initialTenant}
      initialBranding={initialBranding}
    >
      <PosModuleContent />
    </PosProvider>
  );
}
