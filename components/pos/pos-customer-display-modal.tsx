'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, ExternalLink, QrCode, ShoppingBag, Smartphone, AlertCircle } from 'lucide-react';
import { usePos } from './pos-context';
import { formatPagoMovilQrPayload } from '@/lib/pos-pago-movil';
import { openExternalCustomerDisplay } from '@/lib/desktop-bridge';

export function PosCustomerDisplayModal() {
  const {
    isCustomerDisplayOpen,
    setIsCustomerDisplayOpen,
    cart,
    exchangeRate,
    selectedCustomer,
    activeBranch,
    activeRegister,
    settings,
    activeTenantSlug,
    tenantName,
    tenantBranding,
    isFuncActive,
    can,
  } = usePos();

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const totalUsd = cart.reduce((sum, item) => sum + item.lineTotalUsd, 0);
  const totalVes = Number((totalUsd * exchangeRate).toFixed(2));
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isPagoMovilEnabled = settings.active_methods.includes('pago_movil');
  const pmConfig = settings.pago_movil_config ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!isCustomerDisplayOpen || !isPagoMovilEnabled || !pmConfig) {
      setQrDataUrl(null);
      return;
    }
    const payload = formatPagoMovilQrPayload(pmConfig, totalVes, tenantName);
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isCustomerDisplayOpen, isPagoMovilEnabled, pmConfig, totalVes, tenantName]);

  if (!isCustomerDisplayOpen || !isFuncActive('pos_customer_display')) {
    return null;
  }

  const displayCompany = tenantName || 'VORA COMMERCE';

  const handlePopOut = () => {
    // Abrir ventana dedicada (en Desktop Electron detecta y extiende al Monitor 2 automáticamente)
    const base =
      typeof window !== 'undefined' ? window.location.origin : '';
    const popUrl = `${base}/t/${encodeURIComponent(activeTenantSlug)}/pos/customer-display`;
    void openExternalCustomerDisplay(popUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#DCE3DF] bg-[#F6F5F0] shadow-2xl">
        {/* Cabecera de la Pantalla Secundaria */}
        <header className="flex items-center justify-between border-b border-[#DCE3DF] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            {tenantBranding?.logoUrl ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#DCE3DF] bg-white p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tenantBranding.logoUrl} alt={displayCompany} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E6B4E] text-white font-black text-lg uppercase">
                {displayCompany.slice(0, 2)}
              </div>
            )}
            <div>
              <h1 className="text-base font-black tracking-tight text-[#111827]">{displayCompany}</h1>
              <p className="text-xs text-[#52635A]">
                {activeBranch.name} · {activeRegister.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePopOut}
              title="Abrir en ventana independiente para segundo monitor físico"
              className="flex items-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-3.5 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Extender a Monitor 2</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCustomerDisplayOpen(false)}
              className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2 text-[#52635A] hover:bg-[#DCE3DF] hover:text-[#111827] transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Saludo al cliente */}
        <div className="bg-[#1E6B4E] px-6 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">
              <span>
                {selectedCustomer && selectedCustomer.customer_tier !== 'consumidor_final'
                  ? `¡Bienvenido(a), ${selectedCustomer.legal_name}!`
                  : '¡Gracias por su visita! Estamos procesando su orden en caja.'}
              </span>
            </div>
            <div className="text-xs font-bold">
              Tasa Oficial BCV: <span className="text-[#FDE047]">Bs. {exchangeRate.toFixed(2)} / USD</span>
            </div>
          </div>
        </div>

        {/* Contenido Principal: Carrito en Tiempo Real + Resumen y QR */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Lista de Productos (7 cols) */}
          <div className="flex flex-col border-r border-[#DCE3DF] bg-white p-6 lg:col-span-7 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#52635A]">
                Artículos en mostrador ({totalItemsCount})
              </span>
              <span className="text-xs font-bold text-[#1E6B4E]">En Vivo</span>
            </div>

            {cart.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center py-16 text-center text-[#52635A]">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F6F5F0] text-[#1E6B4E]">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <p className="mt-4 text-base font-bold text-[#111827]">Listo para escanear productos</p>
                <p className="mt-1 text-xs">Pase sus artículos por la caja para visualizarlos aquí en tiempo real.</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-[#E5E9E7]">
                {cart.map((line, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3.5">
                    <div className="pr-4">
                      <p className="text-sm font-bold text-[#111827]">{line.name}</p>
                      <p className="text-xs text-[#52635A]">
                        {line.quantity} × ${line.unitPriceUsd.toFixed(2)} USD
                        {line.discountPercent > 0 && (
                          <span className="ml-2 font-bold text-[#15803D]">(-{line.discountPercent}%)</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-[#111827]">${line.lineTotalUsd.toFixed(2)} USD</span>
                      <p className="text-xs text-[#52635A]">
                        {(line.lineTotalUsd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen Total y Pago Móvil / Cashea (5 cols) */}
          <div className="flex flex-col justify-between bg-[#F6F5F0] p-6 lg:col-span-5 overflow-y-auto">
            {/* Gran Total */}
            <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-[#52635A]">Total a Liquidar</span>
              <div className="mt-2">
                <p className="text-4xl font-black tracking-tight text-[#111827]">${totalUsd.toFixed(2)} USD</p>
                <p className="mt-1 text-xl font-bold text-[#1E6B4E]">
                  Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES
                </p>
              </div>
            </div>

            {/* QR Dinámico para Pago Rápido */}
            {isPagoMovilEnabled && (
              <div className="mt-4 rounded-3xl border border-[#DCE3DF] bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#1E6B4E]" />
                    <span className="text-xs font-bold text-[#111827]">
                      {pmConfig ? `Pago Móvil · ${pmConfig.bank_name}` : 'Pago Móvil'}
                    </span>
                  </div>
                </div>

                {pmConfig ? (
                  <>
                    <div className="flex items-center gap-4 bg-[#F6F5F0] p-3 rounded-2xl border border-[#E5E9E7]">
                      <div className="h-28 w-28 rounded-xl border border-[#DCE3DF] bg-white flex items-center justify-center p-1.5 shrink-0 shadow-2xs">
                        {qrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrDataUrl}
                            alt="Código QR de Pago Móvil"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <QrCode className="h-10 w-10 text-[#1E6B4E] animate-pulse" />
                        )}
                      </div>
                      <div className="text-[11px] space-y-1 text-[#111827] min-w-0">
                        {(pmConfig.holder_name || tenantName) && (
                          <p className="truncate">
                            <strong>Titular:</strong> {pmConfig.holder_name || tenantName}
                          </p>
                        )}
                        <p>
                          <strong>Cédula / RIF:</strong> {pmConfig.tax_id.replace(/[\s.\-]/g, '')}
                        </p>
                        <p className="truncate">
                          <strong>Banco:</strong> {pmConfig.bank_code} ({pmConfig.bank_name})
                        </p>
                        <p>
                          <strong>Teléfono:</strong> {pmConfig.phone.replace(/[\s\-()]/g, '')}
                        </p>
                        <p className="font-bold text-[#1E6B4E]">
                          Monto exacto: Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-center text-[#52635A]">
                      Escanee el código QR o utilice los datos mostrados para realizar su Pago Móvil.
                    </p>
                  </>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-3 text-[11px] text-[#52635A]">
                    <AlertCircle className="h-4 w-4 text-[#1E6B4E] shrink-0 mt-0.5" />
                    <p>
                      {can('pos.settings.manage') ? (
                        <>
                          Pago Móvil habilitado. Configura el banco, RIF y teléfono receptor en{' '}
                          <strong className="text-[#111827]">Configuración POS</strong> para mostrar los datos y el código QR aquí.
                        </>
                      ) : (
                        'Pago Móvil habilitado. Solicita a un usuario con permisos de configuración completar los datos de la cuenta receptora.'
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Pie de Pantalla */}
            <div className="mt-4 text-center">
              <p className="text-[11px] text-[#52635A]">
                VORA POS · Facturación electrónica y control comercial inteligente
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

