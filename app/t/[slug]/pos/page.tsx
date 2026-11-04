'use client';

import React from 'react';
import { PosProvider, usePos } from '@/components/pos/pos-context';
import { PosSidebar } from '@/components/pos/pos-sidebar';
import { PosHeader } from '@/components/pos/pos-header';
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

function PosModuleContent() {
  const { currentView } = usePos();

  return (
    <div className="flex min-h-screen bg-[#F6F5F0] text-[#111827] print:block print:bg-white">
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
            {currentView === 'POS-18' && <PosView18FiscalConfig />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function PosPage({ params }: { params: { slug: string } }) {
  return (
    <PosProvider initialSlug={params.slug}>
      <PosModuleContent />
    </PosProvider>
  );
}
