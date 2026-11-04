'use client';

import React, { useState } from 'react';
import { Settings, ShieldCheck, Plus, ArrowLeft, RefreshCw, Globe, CheckCircle2 } from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';
import type { PosPaymentMethod } from '@/lib/types';

export function PosView17Settings() {
  const {
    settings,
    registers,
    activeBranch,
    activeUser,
    showNotification,
    navigateTo,
    exchangeRate,
    refreshExchangeRate,
    isFetchingExchangeRate,
  } = usePos();

  const [maxDiscount, setMaxDiscount] = useState<number>(settings.max_cashier_discount_percent);
  const [allowPartial, setAllowPartial] = useState<boolean>(settings.allow_partial_payments);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(settings.active_exchange_rate.toString());
  const [exchangeRateApiUrl, setExchangeRateApiUrl] = useState<string>(
    settings.exchange_rate_api_url || 'https://ve.dolarapi.com/v1/dolares/oficial',
  );
  const [autoFetchRate, setAutoFetchRate] = useState<boolean>(
    settings.auto_fetch_exchange_rate ?? true,
  );
  const [docPrefix, setDocPrefix] = useState<string>(settings.internal_doc_prefix);
  const [activeMethods, setActiveMethods] = useState<PosPaymentMethod[]>([...settings.active_methods]);

  // Nueva Caja
  const [newRegCode, setNewRegCode] = useState('');
  const [newRegName, setNewRegName] = useState('');
  const [showNewRegForm, setShowNewRegForm] = useState(false);

  const isStoreAdminOrSuper =
    activeUser.role === 'pos_store_admin' ||
    activeUser.role === 'tenant_admin';

  const handleToggleMethod = (method: PosPaymentMethod) => {
    setActiveMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  };

  const handleSyncExchangeRate = async () => {
    const res = await refreshExchangeRate(exchangeRateApiUrl.trim());
    if (res.ok && res.rate) {
      setExchangeRateInput(res.rate.toString());
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(exchangeRateInput);
    if (isNaN(rateVal) || rateVal <= 0) {
      showNotification('Tasa inválida', 'La tasa debe ser mayor a cero [mock].', 'critical');
      return;
    }

    settings.max_cashier_discount_percent = maxDiscount;
    settings.allow_partial_payments = allowPartial;
    settings.active_exchange_rate = rateVal;
    settings.exchange_rate_api_url = exchangeRateApiUrl.trim();
    settings.auto_fetch_exchange_rate = autoFetchRate;
    settings.internal_doc_prefix = docPrefix.trim() || 'COMP-INT-';
    settings.active_methods = activeMethods;
    settings.updated_at = new Date().toISOString();

    posStore.addAudit({
      branch_id: activeBranch.id,
      shift_id: null,
      actor_id: activeUser.id,
      event_type: 'actualizacion_parametros_pos',
      entity_type: 'pos_settings',
      entity_id: settings.id,
      description: `Parámetros operativos de ${activeBranch.name} actualizados [mock]`,
      metadata: { maxDiscount, allowPartial, rateVal, exchangeRateApiUrl, autoFetchRate, activeMethods },
    });

    showNotification(
      'Configuración guardada',
      'Parámetros operativos de sede, API de tasa BCV y límites de descuento actualizados en el sistema [mock].',
      'success',
    );
  };

  const handleCreateRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegCode.trim() || !newRegName.trim()) return;

    const newReg = {
      id: `reg-${Date.now()}`,
      tenant_id: 't-demo',
      branch_id: activeBranch.id,
      code: newRegCode.trim().toUpperCase(),
      name: `${newRegName.trim()} [mock]`,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    posStore.registers.push(newReg);
    setNewRegCode('');
    setNewRegName('');
    setShowNewRegForm(false);
    showNotification('Caja registrada', `Nueva caja física ${newReg.code} agregada a ${activeBranch.name} [mock].`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera con Bordes Redondeados */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">
            Configuración Operativa POS
          </h1>
          <p className="mt-1 text-xs text-[#52635A]">
            Límites de descuento, métodos de pago y cajas físicas de {activeBranch.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('POS-01')}
          className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
        >
          Volver al inicio
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Parámetros Operativos (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <form onSubmit={handleSaveSettings} className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#111827]">
              Parámetros de venta y límites de cajero
            </h2>

            <div>
              <label className="block text-xs font-bold text-[#111827]">
                Límite máximo de descuento permitido al cajero (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827]"
              />
              <p className="mt-1 text-[11px] text-[#52635A]">
                Cualquier descuento superior exige aprobación en caliente con PIN de supervisor.
              </p>
            </div>

            {/* Bloque Integración Tasa BCV & APIs */}
            <div className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0]/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#1E6B4E]" />
                  <span className="text-xs font-bold text-[#111827]">
                    Tasa Oficial BCV e Integración con APIs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncExchangeRate}
                  disabled={isFetchingExchangeRate}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1E6B4E] px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-[#144D37] transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isFetchingExchangeRate ? 'animate-spin' : ''}`} />
                  <span>{isFetchingExchangeRate ? 'Sincronizando...' : 'Sincronizar tasa BCV ahora'}</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#111827]">
                  URL de API cambiaria (REST JSON)
                </label>
                <input
                  type="url"
                  value={exchangeRateApiUrl}
                  onChange={(e) => setExchangeRateApiUrl(e.target.value)}
                  placeholder="https://ve.dolarapi.com/v1/dolares/oficial"
                  className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-white p-2.5 text-xs font-semibold text-[#111827] outline-none"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setExchangeRateApiUrl('https://ve.dolarapi.com/v1/dolares/oficial');
                    }}
                    className="rounded-lg border border-[#DCE3DF] bg-white px-2 py-0.5 text-[10px] font-medium text-[#52635A] hover:bg-[#DCE3DF]"
                  >
                    Preset: DolarApi Oficial (BCV)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExchangeRateApiUrl('https://ve.dolarapi.com/v1/dolares/paralelo');
                    }}
                    className="rounded-lg border border-[#DCE3DF] bg-white px-2 py-0.5 text-[10px] font-medium text-[#52635A] hover:bg-[#DCE3DF]"
                  >
                    Preset: DolarApi Paralelo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#111827]">
                    Tasa de cambio activa (VES/USD)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={exchangeRateInput}
                    onChange={(e) => setExchangeRateInput(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-white p-2.5 text-xs font-black text-[#111827]"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white p-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoFetchRate}
                      onChange={(e) => setAutoFetchRate(e.target.checked)}
                      className="accent-[#1E6B4E]"
                    />
                    <span className="text-[11px] font-bold text-[#111827]">
                      Actualizar tasa BCV automáticamente
                    </span>
                  </label>
                </div>
              </div>

              {settings.last_exchange_rate_fetch && (
                <div className="flex items-center gap-2 text-[10px] text-[#52635A]">
                  <CheckCircle2 className="h-3 w-3 text-[#1E6B4E]" />
                  <span>
                    Última sincronización: {new Date(settings.last_exchange_rate_fetch).toLocaleString('es-VE')} ({settings.exchange_rate_source || 'dolarapi'})
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827]">
                Prefijo correlativo de comprobantes internos
              </label>
              <input
                type="text"
                value={docPrefix}
                onChange={(e) => setDocPrefix(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827]">
                Métodos de cobro habilitados en mostrador
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {(['efectivo', 'pago_movil', 'tarjeta', 'cashea'] as PosPaymentMethod[]).map((m) => (
                  <label key={m} className="flex items-center gap-2 rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeMethods.includes(m)}
                      onChange={() => handleToggleMethod(m)}
                      className="accent-[#1E6B4E]"
                    />
                    <span className="font-semibold capitalize text-[#111827]">{m.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 w-full rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B]"
            >
              Guardar cambios de configuración
            </button>
          </form>
        </div>

        {/* Cajas Físicas en Sede (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
              <h2 className="text-base font-bold text-[#111827]">Cajas físicas registradas</h2>
              <button
                type="button"
                onClick={() => setShowNewRegForm(!showNewRegForm)}
                className="rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-1 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
              >
                + Nueva caja
              </button>
            </div>

            {showNewRegForm && (
              <form onSubmit={handleCreateRegister} className="mt-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-4 text-xs space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Código (Ej: CAJA-03)"
                  value={newRegCode}
                  onChange={(e) => setNewRegCode(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-white p-2"
                />
                <input
                  type="text"
                  required
                  placeholder="Nombre de la caja"
                  value={newRegName}
                  onChange={(e) => setNewRegName(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-white p-2"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#1E6B4E] py-2 text-xs font-bold text-white hover:bg-[#16523B]"
                >
                  Confirmar creación de caja
                </button>
              </form>
            )}

            <div className="mt-4 space-y-2">
              {registers.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl border border-[#E5E9E7] bg-[#FDFDFD] p-3 text-xs">
                  <div>
                    <span className="font-bold text-[#111827] block">{r.name}</span>
                    <span className="text-[10px] text-[#52635A]">Código: {r.code}</span>
                  </div>
                  <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[10px] font-bold text-[#14532D]">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
