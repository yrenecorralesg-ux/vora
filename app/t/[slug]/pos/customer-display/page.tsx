'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { QrCode, ShoppingBag, Smartphone } from 'lucide-react';
import {
  CUSTOMER_DISPLAY_CHANNEL,
  customerDisplayStorageKey,
  type CustomerDisplaySyncPayload,
} from '@/lib/desktop-bridge';

export default function PosCustomerDisplayPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || '');
  const [state, setState] = useState<CustomerDisplaySyncPayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem(customerDisplayStorageKey(slug));
      if (raw) {
        setState(JSON.parse(raw) as CustomerDisplaySyncPayload);
      }
    } catch {
      // Ignorar JSON inválido
    }

    const onMessage = (incoming: CustomerDisplaySyncPayload) => {
      if (!incoming || incoming.tenantSlug.toLowerCase() !== slug.toLowerCase()) return;
      setState(incoming);
    };

    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      ch.onmessage = (ev) => onMessage(ev.data as CustomerDisplaySyncPayload);
    }

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === customerDisplayStorageKey(slug) && ev.newValue) {
        try {
          onMessage(JSON.parse(ev.newValue) as CustomerDisplaySyncPayload);
        } catch {
          // Ignorar
        }
      }
    };
    window.addEventListener('storage', onStorage);

    const offDesktop = window.voraDesktop?.onCustomerDisplayState
      ? window.voraDesktop.onCustomerDisplayState(onMessage)
      : undefined;

    return () => {
      ch?.close();
      window.removeEventListener('storage', onStorage);
      offDesktop?.();
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    if (!state?.isPagoMovilEnabled || !state?.qrPayload) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(state.qrPayload, {
      width: 320,
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
  }, [state?.isPagoMovilEnabled, state?.qrPayload]);

  const displayCompany = state?.tenantName || slug.toUpperCase() || 'VORA COMMERCE';
  const brandColor = state?.primaryColor || '#1E6B4E';
  const items = state?.items ?? [];
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalUsd = state?.totalUsd ?? 0;
  const totalVes = state?.totalVes ?? 0;
  const exchangeRate = state?.exchangeRate ?? 0;
  const pmConfig = state?.pagoMovilConfig ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F0]">
      <header className="flex items-center justify-between border-b border-[#DCE3DF] bg-white px-8 py-4">
        <div className="flex items-center gap-4">
          {state?.logoUrl ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#DCE3DF] bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.logoUrl} alt={displayCompany} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-white font-black text-lg uppercase"
              style={{ backgroundColor: brandColor }}
            >
              {displayCompany.slice(0, 2)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-black tracking-tight text-[#111827]">{displayCompany}</h1>
            <p className="text-xs text-[#52635A]">
              {state ? `${state.branchName} · ${state.registerName}` : 'Pantalla del Cliente'}
            </p>
          </div>
        </div>
      </header>

      <div className="px-8 py-3 text-white" style={{ backgroundColor: brandColor }}>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span>
            {state?.customerName && state.customerTier !== 'consumidor_final'
              ? `¡Bienvenido(a), ${state.customerName}!`
              : '¡Gracias por su visita! Estamos procesando su orden en caja.'}
          </span>
          <span className="font-bold">
            Tasa Oficial BCV: <span className="text-[#FDE047]">Bs. {exchangeRate.toFixed(2)} / USD</span>
          </span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <div className="flex flex-col border-r border-[#DCE3DF] bg-white p-8 lg:col-span-7 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#52635A]">
              Artículos en mostrador ({totalItemsCount})
            </span>
            <span className="text-xs font-bold" style={{ color: brandColor }}>
              En Vivo
            </span>
          </div>

          {items.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center py-20 text-center text-[#52635A]">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F6F5F0]" style={{ color: brandColor }}>
                <ShoppingBag className="h-10 w-10" />
              </div>
              <p className="mt-4 text-lg font-bold text-[#111827]">Listo para escanear productos</p>
              <p className="mt-1 text-xs">Pase sus artículos por la caja para visualizarlos aquí en tiempo real.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#E5E9E7]">
              {items.map((line, idx) => (
                <div key={idx} className="flex items-center justify-between py-4">
                  <div className="pr-4">
                    <p className="text-base font-bold text-[#111827]">{line.name}</p>
                    <p className="text-xs text-[#52635A]">
                      {line.quantity} × ${line.unitPriceUsd.toFixed(2)} USD
                      {line.discountPercent > 0 && (
                        <span className="ml-2 font-bold text-[#15803D]">(-{line.discountPercent}%)</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#111827]">${line.lineTotalUsd.toFixed(2)} USD</span>
                    <p className="text-xs text-[#52635A]">
                      {(line.lineTotalUsd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between bg-[#F6F5F0] p-8 lg:col-span-5">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-7 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-[#52635A]">Total a Liquidar</span>
            <div className="mt-2">
              <p className="text-5xl font-black tracking-tight text-[#111827]">${totalUsd.toFixed(2)} USD</p>
              <p className="mt-2 text-2xl font-bold" style={{ color: brandColor }}>
                Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES
              </p>
            </div>
          </div>

          {state?.isPagoMovilEnabled && pmConfig && (
            <div className="mt-6 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" style={{ color: brandColor }} />
                <span className="text-sm font-bold text-[#111827]">
                  Pago Móvil · {pmConfig.bank_name}
                </span>
              </div>

              <div className="flex items-center gap-4 bg-[#F6F5F0] p-4 rounded-2xl border border-[#E5E9E7]">
                <div className="h-32 w-32 rounded-xl border border-[#DCE3DF] bg-white flex items-center justify-center p-1.5 shrink-0">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="Código QR de Pago Móvil" className="h-full w-full object-contain" />
                  ) : (
                    <QrCode className="h-10 w-10 animate-pulse" style={{ color: brandColor }} />
                  )}
                </div>
                <div className="text-xs space-y-1 text-[#111827] min-w-0">
                  {(pmConfig.holder_name || displayCompany) && (
                    <p className="truncate">
                      <strong>Titular:</strong> {pmConfig.holder_name || displayCompany}
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
                  <p className="font-bold" style={{ color: brandColor }}>
                    Monto exacto: Bs. {totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-center text-[#52635A]">
                Escanee el código QR o utilice los datos mostrados para realizar su Pago Móvil.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-[11px] text-[#52635A]">
            VORA POS · Facturación electrónica y control comercial inteligente
          </p>
        </div>
      </div>
    </div>
  );
}
