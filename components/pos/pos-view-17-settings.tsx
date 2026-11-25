'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Plus,
  ArrowLeft,
  RefreshCw,
  Globe,
  CheckCircle2,
  KeyRound,
  UserCheck,
  Users,
  Lock,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { usePos } from './pos-context';
import { VE_BANKS, findVeBankName, validatePagoMovilConfig } from '@/lib/pos-pago-movil';
import type { PosPaymentMethod } from '@/lib/types';

export function PosView17Settings() {
  const {
    settings,
    branches,
    registers,
    addBranch,
    addRegister,
    activeBranch,
    activeUser,
    showNotification,
    navigateTo,
    exchangeRate,
    refreshExchangeRate,
    isFetchingExchangeRate,
    isFuncActive,
    staffUsers,
    me,
    can,
    saveSettings,
    reloadSettings,
    reloadStaff,
    activeTenantSlug,
    tenantName,
  } = usePos();

  const ROLE_LABELS: Record<string, string> = {
    tenant_admin: 'Administrador',
    pos_store_admin: 'Admin. tienda',
    pos_supervisor: 'Supervisor',
    pos_cashier: 'Cajero',
    pos_sales_rep: 'Asesor',
    pos_auditor: 'Auditor',
    wh_manager: 'Administrador de almacén',
    wh_supervisor: 'Supervisor de almacén',
    wh_clerk: 'Almacenista',
    wh_scanner: 'Operador de escaneo',
    wh_auditor: 'Auditor de almacén',
  };
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

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
  const [pmBankCode, setPmBankCode] = useState<string>(settings.pago_movil_config?.bank_code || '0102');
  const [pmPhone, setPmPhone] = useState<string>(settings.pago_movil_config?.phone || '');
  const [pmTaxId, setPmTaxId] = useState<string>(settings.pago_movil_config?.tax_id || '');
  const [pmHolderName, setPmHolderName] = useState<string>(settings.pago_movil_config?.holder_name || '');

  const [requirePinWithdrawals, setRequirePinWithdrawals] = useState<boolean>(settings.require_pin_for_withdrawals !== false);

  const activeMethodsKey = settings.active_methods.join(',');
  const pmBankSaved = settings.pago_movil_config?.bank_code || '0102';
  const pmPhoneSaved = settings.pago_movil_config?.phone || '';
  const pmTaxIdSaved = settings.pago_movil_config?.tax_id || '';
  const pmHolderSaved = settings.pago_movil_config?.holder_name || '';

  useEffect(() => {
    setMaxDiscount(settings.max_cashier_discount_percent);
    setAllowPartial(settings.allow_partial_payments);
    setExchangeRateApiUrl(settings.exchange_rate_api_url || 'https://ve.dolarapi.com/v1/dolares/oficial');
    setAutoFetchRate(settings.auto_fetch_exchange_rate ?? true);
    setDocPrefix(settings.internal_doc_prefix);
    setActiveMethods([...settings.active_methods]);
    setRequirePinWithdrawals(settings.require_pin_for_withdrawals !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.tenant_id,
    settings.max_cashier_discount_percent,
    settings.allow_partial_payments,
    settings.exchange_rate_api_url,
    settings.auto_fetch_exchange_rate,
    settings.internal_doc_prefix,
    settings.require_pin_for_withdrawals,
    activeMethodsKey,
  ]);

  useEffect(() => {
    setExchangeRateInput(settings.active_exchange_rate ? settings.active_exchange_rate.toString() : '');
  }, [settings.active_exchange_rate]);

  useEffect(() => {
    setPmBankCode(pmBankSaved);
    setPmPhone(pmPhoneSaved);
    setPmTaxId(pmTaxIdSaved);
    setPmHolderName(pmHolderSaved);
  }, [pmBankSaved, pmPhoneSaved, pmTaxIdSaved, pmHolderSaved]);

  // Nueva Sede / Sucursal
  const [showNewBranchForm, setShowNewBranchForm] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');

  // Nueva Caja
  const [newRegCode, setNewRegCode] = useState('');
  const [newRegName, setNewRegName] = useState('');
  const [targetBranchId, setTargetBranchId] = useState(activeBranch.id);
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(exchangeRateInput);
    if (isNaN(rateVal) || rateVal <= 0) {
      showNotification('Tasa inválida', 'La tasa debe ser mayor a cero.', 'critical');
      return;
    }

    let pagoMovilPatch: Record<string, unknown> = {};
    if (activeMethods.includes('pago_movil')) {
      const validated = validatePagoMovilConfig({
        bank_code: pmBankCode,
        bank_name: findVeBankName(pmBankCode),
        phone: pmPhone,
        tax_id: pmTaxId,
        holder_name: pmHolderName,
      });
      if (!validated.ok) {
        showNotification('Datos de Pago Móvil inválidos', validated.error, 'critical');
        return;
      }
      pagoMovilPatch = { pago_movil_config: validated.value };
    }

    const result = await saveSettings({
      max_cashier_discount_percent: maxDiscount,
      allow_partial_payments: allowPartial,
      active_methods: activeMethods,
      internal_doc_prefix: docPrefix.trim() || 'COMP-INT-',
      ...pagoMovilPatch,
      ...(rateVal !== settings.active_exchange_rate ? { active_exchange_rate: rateVal } : {}),
    });
    if (!result.ok) {
      showNotification('No se guardó la configuración', result.error ?? 'Error al guardar.', 'critical');
      return;
    }
    if (
      exchangeRateApiUrl.trim() !== (settings.exchange_rate_api_url ?? '') ||
      autoFetchRate !== (settings.auto_fetch_exchange_rate ?? true)
    ) {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/exchange-rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', url: exchangeRateApiUrl.trim(), auto_fetch: autoFetchRate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showNotification('API de tasa no guardada', data?.error ?? 'Error al guardar la API de tasa.', 'critical');
        return;
      }
      await reloadSettings();
    }

    showNotification(
      'Configuración guardada',
      'Parámetros operativos de sede, API de tasa BCV y límites de descuento actualizados en el sistema.',
      'success',
    );
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchCode.trim() || !newBranchName.trim()) return;

    const created = await addBranch({
      tenant_id: activeBranch.tenant_id,
      code: newBranchCode.trim().toUpperCase(),
      name: newBranchName.trim(),
      fiscal_address: newBranchAddress.trim() || null,
      phone: newBranchPhone.trim() || null,
      timezone: 'America/Caracas',
      is_primary: false,
      status: 'active',
    });

    if (!created) return;
    setNewBranchCode('');
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setShowNewBranchForm(false);
    showNotification('Sede registrada', `Nueva sede ${created.name} (${created.code}) agregada exitosamente.`, 'success');
  };

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegCode.trim() || !newRegName.trim()) return;

    const created = await addRegister({
      tenant_id: activeBranch.tenant_id,
      branch_id: targetBranchId || activeBranch.id,
      code: newRegCode.trim().toUpperCase(),
      name: newRegName.trim(),
      status: 'active',
    });

    if (!created) return;
    setNewRegCode('');
    setNewRegName('');
    setShowNewRegForm(false);
    showNotification('Caja registrada', `Nueva caja física ${created.code} agregada exitosamente.`, 'success');
  };

  const handleSavePolicies = async () => {
    const result = await saveSettings({ require_pin_for_withdrawals: requirePinWithdrawals });
    showNotification(
      result.ok ? 'Políticas guardadas' : 'No se guardaron las políticas',
      result.ok ? 'Políticas de supervisión actualizadas.' : result.error ?? 'Error al guardar.',
      result.ok ? 'success' : 'critical',
    );
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      showNotification('PIN no coincide', 'Repite el mismo PIN en ambos campos.', 'critical');
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin.trim(), current_pin: currentPin.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showNotification('PIN no guardado', data?.error ?? 'No se pudo guardar el PIN.', 'critical');
        return;
      }
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      await reloadStaff();
      showNotification('PIN guardado', 'Tu PIN de supervisor quedó configurado.', 'success');
    } finally {
      setSavingPin(false);
    }
  };

  if (me && !can('pos.settings.manage')) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-[#DCE3DF] bg-white p-8 text-center shadow-sm space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-[#111827]">Acceso restringido</h1>
        <p className="text-xs text-[#52635A]">
          Tu rol actual no tiene permisos para acceder a la configuración de este módulo.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('POS-01')}
          className="inline-flex items-center justify-center rounded-2xl bg-[#1E6B4E] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#16523B]"
        >
          Volver a Caja y Terminal
        </button>
      </div>
    );
  }

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
            {isFuncActive('pos_exchange_rate_api') ? (
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
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#111827]">
                  Tasa de cambio activa oficial (VES/USD)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRateInput}
                  onChange={(e) => setExchangeRateInput(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827]"
                />
              </div>
            )}

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
                {(['efectivo', 'pago_movil', 'tarjeta', 'cashea'] as PosPaymentMethod[])
                  .filter((m) => m !== 'cashea' || isFuncActive('pos_cashea'))
                  .map((m) => (
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

            {activeMethods.includes('pago_movil') && (
              <div className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0]/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#1E6B4E]" />
                    <span className="text-xs font-bold text-[#111827]">
                      Datos de Pago Móvil del comercio
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#52635A]">
                    Visible en Pantalla Cliente y QR
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#111827]">
                      Banco receptor
                    </label>
                    <select
                      value={pmBankCode}
                      onChange={(e) => setPmBankCode(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-white p-2.5 text-xs font-semibold text-[#111827] outline-none"
                    >
                      {VE_BANKS.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111827]">
                      RIF o Cédula receptora
                    </label>
                    <input
                      type="text"
                      value={pmTaxId}
                      onChange={(e) => setPmTaxId(e.target.value)}
                      placeholder="Ej. 12345678 o J123456789"
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-white p-2.5 text-xs font-semibold text-[#111827] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#111827]">
                      Teléfono Pago Móvil
                    </label>
                    <input
                      type="tel"
                      value={pmPhone}
                      onChange={(e) => setPmPhone(e.target.value)}
                      placeholder="Ej. 04141234567"
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-white p-2.5 text-xs font-semibold text-[#111827] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#111827]">
                      Titular / Razón social (opcional)
                    </label>
                    <input
                      type="text"
                      value={pmHolderName}
                      onChange={(e) => setPmHolderName(e.target.value)}
                      placeholder={tenantName || 'Nombre del comercio'}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-white p-2.5 text-xs font-semibold text-[#111827] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="mt-4 w-full rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B]"
            >
              Guardar cambios de configuración
            </button>
          </form>
        </div>

        {/* Sedes y Cajas Físicas (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Card Sedes y Sucursales */}
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
              <div>
                <h2 className="text-base font-bold text-[#111827]">Sedes y Sucursales</h2>
                <p className="text-[10px] text-[#52635A]">Puntos de venta operativos de la empresa</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewBranchForm(!showNewBranchForm)}
                className="rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-1 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
              >
                + Nueva sede
              </button>
            </div>

            {showNewBranchForm && (
              <form onSubmit={handleCreateBranch} className="mt-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-4 text-xs space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Código (Ej: CCS-02, VAL-02)"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-white p-2"
                />
                <input
                  type="text"
                  required
                  placeholder="Nombre de la sede (Ej: Sucursal Chacao)"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-white p-2"
                />
                <input
                  type="text"
                  placeholder="Dirección fiscal"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-white p-2"
                />
                <input
                  type="text"
                  placeholder="Teléfono de contacto"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-white p-2"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#1E6B4E] py-2 text-xs font-bold text-white hover:bg-[#16523B]"
                >
                  Confirmar creación de sede
                </button>
              </form>
            )}

            <div className="mt-4 space-y-2">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-2xl border border-[#E5E9E7] bg-[#FDFDFD] p-3 text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-[#111827] block truncate">{b.name}</span>
                    <span className="text-[10px] text-[#52635A] block truncate">{b.fiscal_address}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-[#52635A]">{b.code}</span>
                    {b.id === activeBranch.id && (
                      <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[9px] font-bold text-[#14532D]">
                        Activa
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Cajas Físicas */}
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
              <div>
                <h2 className="text-base font-bold text-[#111827]">Cajas físicas registradas</h2>
                <p className="text-[10px] text-[#52635A]">Terminales de punto de venta</p>
              </div>
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
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-white p-2 font-semibold text-[#111827]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Sede: {b.name} ({b.code})
                    </option>
                  ))}
                </select>
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
                  placeholder="Nombre de la caja (Ej: Caja 03 - Mostrador)"
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
              {registers.map((r) => {
                const branchObj = branches.find((b) => b.id === r.branch_id);
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-2xl border border-[#E5E9E7] bg-[#FDFDFD] p-3 text-xs">
                    <div>
                      <span className="font-bold text-[#111827] block">{r.name}</span>
                      <span className="text-[10px] text-[#52635A]">
                        Código: {r.code} {branchObj ? `• ${branchObj.name}` : ''}
                      </span>
                    </div>
                    <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[10px] font-bold text-[#14532D]">
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Supervisión: PIN personal y personal real de la empresa */}
      {isFuncActive('pos_supervisor_panel') && (
        <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9E7] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#1E6B4E]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111827]">Supervisión de caja</h2>
                <p className="text-xs text-[#52635A]">
                  Cada supervisor autoriza con su PIN personal, validado en el servidor. Los usuarios y roles se
                  administran desde el gestor de VORA.
                </p>
              </div>
            </div>
            {isFuncActive('pos_supervisor_users_crud') && (
              <button
                type="button"
                onClick={() => navigateTo('POS-19')}
                className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-3.5 py-1.5 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition"
              >
                Ver personal
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Columna 1: Mi PIN y políticas */}
            <div className="space-y-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">Mi PIN de supervisor</h3>
              {me?.can_approve ? (
                <form onSubmit={handleSavePin} className="space-y-3">
                  <p className="text-[11px] text-[#52635A]">
                    {me.has_pin
                      ? 'Ya tienes un PIN configurado. Para cambiarlo, ingresa el actual.'
                      : 'Aún no tienes PIN: configúralo para poder autorizar descuentos, devoluciones y retiros en la caja de un cajero.'}
                  </p>
                  {me.has_pin && (
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      required
                      placeholder="PIN actual"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      className="w-full rounded-xl border border-[#DCE3DF] bg-white p-3 text-xs font-mono font-bold tracking-widest"
                    />
                  )}
                  <div className="relative">
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      required
                      placeholder="Nuevo PIN (4 a 8 dígitos)"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full rounded-xl border border-[#DCE3DF] bg-white p-3 pr-10 text-xs font-mono font-bold tracking-widest"
                    />
                    <KeyRound className="absolute right-3 top-3 h-4 w-4 text-[#52635A]" />
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={8}
                    required
                    placeholder="Repite el nuevo PIN"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="w-full rounded-xl border border-[#DCE3DF] bg-white p-3 text-xs font-mono font-bold tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={savingPin}
                    className="w-full rounded-xl bg-[#1E6B4E] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#16523B] disabled:opacity-60"
                  >
                    {me.has_pin ? 'Cambiar mi PIN' : 'Guardar mi PIN'}
                  </button>
                </form>
              ) : (
                <p className="text-[11px] text-[#52635A]">
                  Tu rol no autoriza operaciones de supervisor, por lo que no necesita PIN.
                </p>
              )}

              <div className="space-y-2.5 pt-3 border-t border-[#DCE3DF]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">Políticas</h3>
                <p className="text-[11px] text-[#52635A]">
                  Las devoluciones y los descuentos por encima del máximo del cajero siempre requieren supervisor.
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#111827]">
                  <input
                    type="checkbox"
                    disabled={!can('pos.settings.manage')}
                    checked={requirePinWithdrawals}
                    onChange={(e) => setRequirePinWithdrawals(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1E6B4E]"
                  />
                  <span>Exigir PIN de supervisor para retiros de efectivo</span>
                </label>
                <button
                  type="button"
                  onClick={handleSavePolicies}
                  disabled={!can('pos.settings.manage')}
                  className="w-full rounded-xl border border-[#1E6B4E] bg-white py-2 text-xs font-bold text-[#1E6B4E] hover:bg-[#DCFCE7] disabled:opacity-50"
                >
                  Guardar políticas
                </button>
              </div>
            </div>

            {/* Columna 2: Personal real de la empresa */}
            <div className="space-y-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">Personal de la empresa</h3>
                <p className="text-[11px] text-[#52635A]">
                  {staffUsers.length} usuarios. Altas, roles y bajas: gestor de VORA → empresa → Usuarios.
                </p>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {staffUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-xl border border-[#E5E9E7] bg-white p-3 text-xs shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-[#111827]">{user.name}</span>
                      <p className="mt-0.5 text-[10px] text-[#52635A]">
                        {user.email || 'Sin correo'} · {ROLE_LABELS[user.role] ?? user.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.has_pin && (
                        <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[9px] font-bold text-[#92400E]">PIN</span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          user.is_active ? 'bg-[#DCFCE7] text-[#14532D]' : 'bg-[#FEE2E2] text-[#991B1B]'
                        }`}
                      >
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
