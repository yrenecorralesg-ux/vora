'use client';

import React, { useState } from 'react';
import { Printer, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';
import { usePos } from './pos-context';
import { posStore, hkaProvider } from '@/lib/pos-service';

export function PosView12DocumentPdf() {
  const { lastConfirmedSale, activeBranch, showNotification, navigateTo } = usePos();
  const [fiscalSale, setFiscalSale] = useState(lastConfirmedSale ?? posStore.sales[0]);
  const [fiscalLoading, setFiscalLoading] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);

  if (!fiscalSale) {
    return (
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-8 text-center text-xs text-[#52635A]">
        No hay ventas seleccionadas para visualización documental.
      </div>
    );
  }

  const integration = posStore.fiscalIntegration;
  const isHkaConfigured = integration.legal_status !== 'sin_configurar' && integration.enabled;

  // Emisión Fiscal HKA
  const handleIssueFiscal = async () => {
    setFiscalLoading(true);
    setProviderMessage(null);

    try {
      const res = await fetch('/api/t/test1/pos/fiscal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'issue',
          sale_id: fiscalSale.id,
          idempotency_key: `idemp-hka-${fiscalSale.id}`,
        }),
      });

      const data = await res.json();
      if (data.fiscal_request) {
        fiscalSale.fiscal_request = data.fiscal_request;
      }

      setFiscalSale({ ...fiscalSale });
      setProviderMessage(data.result?.message || data.error || 'Respuesta fiscal recibida.');
      showNotification('The Factory HKA', data.result?.message || data.error, data.ok ? 'success' : 'critical');
    } catch (err: any) {
      setProviderMessage(`Error de red: ${err.message}`);
      showNotification('The Factory HKA', err.message, 'critical');
    } finally {
      setFiscalLoading(false);
    }
  };

  // Simular Timeout de Red HKA
  const handleSimulateTimeout = async () => {
    setFiscalLoading(true);
    setProviderMessage(null);

    try {
      const res = await fetch('/api/t/test1/pos/fiscal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_timeout',
          sale_id: fiscalSale.id,
        }),
      });
      const data = await res.json();
      if (data.fiscal_request) {
        fiscalSale.fiscal_request = data.fiscal_request;
      }
      setFiscalSale({ ...fiscalSale });
      setProviderMessage(data.result?.message || 'Timeout simulado');
      showNotification('Timeout HKA', data.result?.message || 'Estado marcado como por revisar', 'alert');
    } catch (err: any) {
      setProviderMessage(`Error: ${err.message}`);
    } finally {
      setFiscalLoading(false);
    }
  };

  // Consultar Estado por Idempotencia
  const handleGetStatus = async () => {
    setFiscalLoading(true);
    setProviderMessage(null);

    try {
      const res = await fetch('/api/t/test1/pos/fiscal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'status',
          sale_id: fiscalSale.id,
          idempotency_key: `idemp-hka-${fiscalSale.id}`,
          numero_documento: fiscalSale.fiscal_request?.fiscal_invoice_number || '1',
        }),
      });
      const data = await res.json();
      if (fiscalSale.fiscal_request && data.result) {
        fiscalSale.fiscal_request.status = data.result.status;
        if (data.result.fiscalInvoiceNumber) fiscalSale.fiscal_request.fiscal_invoice_number = data.result.fiscalInvoiceNumber;
        if (data.result.fiscalControlNumber) fiscalSale.fiscal_request.fiscal_control_number = data.result.fiscalControlNumber;
      }
      setFiscalSale({ ...fiscalSale });
      setProviderMessage(data.result?.message || 'Estado verificado');
      showNotification('Consulta de estado HKA', data.result?.message || 'Estado actualizado', 'success');
    } catch (err: any) {
      setProviderMessage(`Error: ${err.message}`);
    } finally {
      setFiscalLoading(false);
    }
  };

  return (
    <div className="space-y-6 print:space-y-0 print:m-0">
      {/* Estilos dedicados de impresión térmica / recibo limpio */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 8mm;
            size: auto;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          aside, header, nav, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Cabecera de Comprobante con Bordes Redondeados (Oculta al imprimir) */}
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">
              Comprobante interno y emisión fiscal
            </h1>
            <p className="mt-1 text-xs text-[#52635A]">
              Separación legal: Comprobante interno en mostrador vs. Adaptador The Factory HKA.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold text-[#111827] shadow-xs hover:bg-[#F6F5F0]"
            >
              <Printer className="h-4 w-4 text-[#52635A]" />
              <span>Imprimir comprobante</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('POS-01')}
              className="rounded-2xl bg-[#1E6B4E] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#16523B]"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 print:block print:w-full print:m-0">
        {/* DOCUMENTO PDF / COMPROBANTE INTERNO (7 cols) */}
        <div className="lg:col-span-7 print:w-full print:max-w-2xl print:mx-auto print:p-0">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-8 shadow-sm print:rounded-2xl print:border-2 print:border-[#111827] print:shadow-none print:p-8 print:m-0 print:text-black">
            {/* Rótulo Obligatorio en Bloque Visible con Bordes Redondeados */}
            <div className="rounded-2xl border-2 border-[#111827] bg-[#F6F5F0] p-3 text-center">
              <span className="text-xs font-black tracking-widest uppercase text-[#111827]">
                COMPROBANTE INTERNO — NO VÁLIDO COMO FACTURA FISCAL
              </span>
            </div>

            {/* Datos de Empresa */}
            <div className="mt-6 border-b border-[#E5E9E7] pb-4">
              <h2 className="text-lg font-black uppercase text-[#111827]">
                VORA RETAIL PILOTO TEST1 C.A. [mock]
              </h2>
              <p className="text-xs font-bold text-[#52635A]">RIF: J-50123987-1</p>
              <p className="text-xs text-[#52635A]">{activeBranch.fiscal_address}</p>
            </div>

            {/* Metadatos del Documento */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-b border-[#E5E9E7] pb-4 text-xs">
              <div>
                <span className="font-bold text-[#52635A]">NÚMERO DE COMPROBANTE:</span>
                <p className="text-sm font-black text-[#111827]">
                  {fiscalSale.document?.internal_number ?? 'COMP-INT-000001'}
                </p>
                <span className="mt-2 block font-bold text-[#52635A]">VENTA RELACIONADA:</span>
                <p className="font-semibold text-[#111827]">{fiscalSale.sale_number}</p>
              </div>

              <div className="text-right">
                <span className="font-bold text-[#52635A]">FECHA Y HORA OFICIAL:</span>
                <p className="text-[#111827]">
                  {new Date(fiscalSale.confirmed_at ?? fiscalSale.created_at).toLocaleString('es-VE')}
                </p>
                <span className="mt-2 block font-bold text-[#52635A]">CAJERO RESPONSABLE:</span>
                <p className="text-[#111827]">María C. [mock]</p>
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="mt-4 border-b border-[#E5E9E7] pb-4 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                DATOS DEL RECEPTOR
              </span>
              <p className="mt-1 font-bold text-[#111827]">
                {fiscalSale.customer?.legal_name ?? 'Consumidor Final [mock]'}
              </p>
              <p className="text-[#52635A]">
                Documento Cédula / RIF:{' '}
                {fiscalSale.customer
                  ? `${fiscalSale.customer.document_type}-${fiscalSale.customer.document_number}`
                  : 'V-00000000'}
              </p>
            </div>

            {/* Tabla de Artículos */}
            <div className="mt-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-[#111827] text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                    <th className="py-2">Descripción</th>
                    <th className="py-2 text-center">Cant.</th>
                    <th className="py-2 text-right">P. Unit USD</th>
                    <th className="py-2 text-right">Total USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E9E7]">
                  {(fiscalSale.lines ?? []).map((l, i) => (
                    <tr key={i}>
                      <td className="py-2">
                        <span className="font-bold text-[#111827]">{l.name_snapshot}</span>
                        <span className="block text-[10px] text-[#52635A]">SKU: {l.sku_snapshot}</span>
                      </td>
                      <td className="py-2 text-center font-bold text-[#111827]">{l.quantity}</td>
                      <td className="py-2 text-right text-[#52635A]">${l.unit_price_usd.toFixed(2)}</td>
                      <td className="py-2 text-right font-bold text-[#111827]">
                        ${l.line_total_usd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Desglose Financiero */}
            <div className="mt-6 border-t-2 border-[#111827] pt-4 text-xs">
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-right">
                  <div className="flex justify-between">
                    <span className="text-[#52635A]">Base Imponible:</span>
                    <span className="font-bold text-[#111827]">${fiscalSale.subtotal_usd.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52635A]">IVA (16%):</span>
                    <span className="font-bold text-[#111827]">${fiscalSale.tax_total_usd.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between border-t border-[#111827] pt-2 text-sm font-black text-[#111827]">
                    <span>TOTAL FACTURADO:</span>
                    <span>${fiscalSale.total_usd.toFixed(2)} USD</span>
                  </div>
                  <p className="text-[10px] text-[#52635A]">
                    Equivalente oficial: {fiscalSale.total_ves.toLocaleString('es-VE')} VES
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ADAPTADOR THE FACTORY HKA (5 cols) (Oculto al imprimir recibo) */}
        <div className="space-y-4 lg:col-span-5 print:hidden">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#111827]">
              Integración Fiscal HKA
            </h2>
            <p className="mt-1 text-xs text-[#52635A]">
              Ambiente: <strong className="text-[#111827]">{integration.environment.toUpperCase()}</strong>
            </p>

            {/* Estatus Actual */}
            <div className="mt-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-4 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#52635A]">Estatus fiscal:</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${fiscalSale.fiscal_request?.status === 'emitido'
                      ? 'bg-[#DCFCE7] text-[#14532D]'
                      : fiscalSale.fiscal_request?.status === 'por_revisar'
                        ? 'bg-[#FEF3C7] text-[#92400E]'
                        : 'bg-[#F6F5F0] text-[#52635A]'
                    }`}
                >
                  {fiscalSale.fiscal_request?.status ?? 'No solicitado'}
                </span>
              </div>

              {fiscalSale.fiscal_request?.fiscal_invoice_number && (
                <div className="mt-2 space-y-1 border-t border-[#DCE3DF] pt-2">
                  <div className="flex justify-between">
                    <span className="text-[#52635A]">Factura Fiscal:</span>
                    <span className="font-bold text-[#111827]">
                      {fiscalSale.fiscal_request.fiscal_invoice_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52635A]">Control:</span>
                    <span className="text-[#111827]">
                      {fiscalSale.fiscal_request.fiscal_control_number}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Mensajes del Adaptador */}
            {providerMessage && (
              <div role="status" className="mt-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs text-[#111827]">
                <span className="font-bold uppercase tracking-wider text-[#52635A]">Respuesta:</span>
                <p className="mt-1 text-[11px]">{providerMessage}</p>
              </div>
            )}

            {/* Acciones del Adaptador HKA */}
            <div className="mt-5 space-y-2">
              <button
                type="button"
                disabled={!isHkaConfigured || fiscalLoading}
                onClick={handleIssueFiscal}
                className="w-full rounded-2xl bg-[#1E6B4E] py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B] disabled:opacity-40"
              >
                {fiscalLoading ? 'Comunicando...' : 'Solicitar emisión fiscal HKA'}
              </button>

              <button
                type="button"
                disabled={fiscalLoading}
                onClick={handleSimulateTimeout}
                className="w-full rounded-2xl border border-[#C97857] bg-white py-2.5 text-xs font-bold uppercase tracking-wider text-[#C97857] hover:bg-[#FEF3C7]"
              >
                Simular Timeout de red HKA [mock]
              </button>

              <button
                type="button"
                disabled={fiscalLoading}
                onClick={handleGetStatus}
                className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] py-2.5 text-xs font-bold uppercase tracking-wider text-[#111827] hover:bg-[#DCE3DF]"
              >
                Consultar estado por Idempotencia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
