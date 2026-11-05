'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
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
    isFuncActive,
    staffUsers,
    updateSupervisorConfig,
    addStaffUser,
    toggleStaffUser,
    updateStaffPin,
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

  // Políticas y Configuración del Supervisor (pos_supervisor_panel)
  const [supervisorPin, setSupervisorPin] = useState<string>(settings.supervisor_pin || '9999');
  const [requirePinReturns, setRequirePinReturns] = useState<boolean>(settings.require_pin_for_returns !== false);
  const [requirePinWithdrawals, setRequirePinWithdrawals] = useState<boolean>(settings.require_pin_for_withdrawals !== false);
  const [requirePinCancel, setRequirePinCancel] = useState<boolean>(settings.require_pin_for_cancel !== false);
  const [enforceBlindCount, setEnforceBlindCount] = useState<boolean>(settings.enforce_blind_count !== false);

  // Nuevo Miembro del Personal (Cajero / Asesor / Supervisor)
  const [showNewStaffModal, setShowNewStaffModal] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'pos_cashier' | 'pos_supervisor' | 'pos_sales_rep'>('pos_cashier');
  const [newStaffPin, setNewStaffPin] = useState('1111');
  const [newStaffCommission, setNewStaffCommission] = useState('3.0');

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

  const handleSaveSupervisorPolicies = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorPin.trim() || supervisorPin.trim().length < 4) {
      showNotification('PIN inválido', 'El PIN de supervisor debe contener al menos 4 dígitos.', 'critical');
      return;
    }

    updateSupervisorConfig({
      supervisorPin: supervisorPin.trim(),
      maxCashierDiscountPercent: maxDiscount,
      requirePinForReturns: requirePinReturns,
      requirePinForWithdrawals: requirePinWithdrawals,
      requirePinForCancel: requirePinCancel,
      enforceBlindCount: enforceBlindCount,
    });
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPin.trim()) return;

    addStaffUser({
      name: newStaffName.trim(),
      email: newStaffEmail.trim() || undefined,
      role: newStaffRole,
      pin: newStaffPin.trim(),
      assignedBranchId: activeBranch.id,
      commission_rate_percent: newStaffRole === 'pos_sales_rep' ? parseFloat(newStaffCommission) || 3.0 : undefined,
    });

    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffPin('1111');
    setShowNewStaffModal(false);
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

      {/* Panel de Supervisión y Control de Roles (pos_supervisor_panel) */}
      {isFuncActive('pos_supervisor_panel') && (
        <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9E7] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#1E6B4E]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111827]">
                  Panel de Control y Supervisión de Caja (Supervisor de Sede)
                </h2>
                <p className="text-xs text-[#52635A]">
                  Configuración de PIN de autorización, políticas de arqueo/retiros y gestión de cajeros y asesores.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isFuncActive('pos_supervisor_users_crud') && (
                <button
                  type="button"
                  onClick={() => navigateTo('POS-19')}
                  className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-3.5 py-1.5 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition"
                >
                  Abrir Módulo de Personal (CRUD)
                </button>
              )}
              <span className="rounded-full bg-[#1E6B4E] px-3 py-1 text-xs font-bold text-white shadow-2xs">
                Módulo Supervisor Activo
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveSupervisorPolicies} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Columna 1: Clave PIN y Políticas */}
            <div className="space-y-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Políticas de Autorización y PIN Supervisor
              </h3>

              <div>
                <label className="block text-xs font-bold text-[#111827]">
                  Clave PIN Maestra de Supervisor
                </label>
                <div className="relative mt-1">
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    className="w-full rounded-xl border border-[#DCE3DF] bg-white p-3 pr-10 text-xs font-mono font-bold tracking-widest text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                    placeholder="Mínimo 4 dígitos"
                  />
                  <KeyRound className="absolute right-3 top-3 h-4 w-4 text-[#52635A]" />
                </div>
                <p className="mt-1 text-[11px] text-[#52635A]">
                  Utilizada para autorizar excepciones en caja, retiros y anulaciones.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#DCE3DF]">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={requirePinReturns}
                    onChange={(e) => setRequirePinReturns(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1E6B4E]"
                  />
                  <span>Exigir PIN de supervisor para procesar devoluciones y notas de crédito</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={requirePinWithdrawals}
                    onChange={(e) => setRequirePinWithdrawals(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1E6B4E]"
                  />
                  <span>Exigir PIN de supervisor para retiros o egresos de caja</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={requirePinCancel}
                    onChange={(e) => setRequirePinCancel(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1E6B4E]"
                  />
                  <span>Exigir PIN de supervisor para cancelar ventas en curso</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={enforceBlindCount}
                    onChange={(e) => setEnforceBlindCount(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1E6B4E]"
                  />
                  <span>Obligatoriedad de arqueo a ciegas en el cierre de turno</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#1E6B4E] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#16523B]"
              >
                Actualizar políticas de supervisión
              </button>
            </div>

            {/* Columna 2: Gestión de Personal (Cajeros, Supervisores, Asesores) */}
            <div className="space-y-4 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                    Personal de Caja y Venta de la Sede
                  </h3>
                  <p className="text-[11px] text-[#52635A]">
                    {staffUsers.length} usuarios registrados en la sede
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewStaffModal(!showNewStaffModal)}
                  className="rounded-xl border border-[#DCE3DF] bg-white px-3 py-1.5 text-xs font-bold text-[#111827] shadow-2xs hover:bg-[#DCE3DF]"
                >
                  {showNewStaffModal ? 'Cerrar formulario' : '+ Nuevo personal'}
                </button>
              </div>

              {showNewStaffModal && (
                <div className="rounded-2xl border border-[#86EFAC] bg-white p-4 text-xs space-y-3 shadow-xs">
                  <span className="font-bold text-[#14532D]">Alta de Cajero, Supervisor o Asesor</span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#52635A]">Nombre completo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Pedro Ramos"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#52635A]">Correo / Usuario</label>
                      <input
                        type="email"
                        placeholder="pedro.cajero@ejemplo.com"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div>
                      <label className="text-[10px] font-bold text-[#52635A]">Rol asignado</label>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as any)}
                        className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2 text-xs font-semibold"
                      >
                        <option value="pos_cashier">Cajero(a)</option>
                        <option value="pos_sales_rep">Asesor(a) de Venta</option>
                        <option value="pos_supervisor">Supervisor(a)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#52635A]">Clave PIN (4 dígitos)</label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={newStaffPin}
                        onChange={(e) => setNewStaffPin(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2 text-xs font-mono font-bold"
                      />
                    </div>
                    {newStaffRole === 'pos_sales_rep' && (
                      <div>
                        <label className="text-[10px] font-bold text-[#52635A]">Comisión (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newStaffCommission}
                          onChange={(e) => setNewStaffCommission(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2 text-xs font-bold"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateStaff}
                    className="w-full rounded-xl bg-[#1E6B4E] py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#16523B]"
                  >
                    Registrar en el equipo
                  </button>
                </div>
              )}

              {/* Lista de personal con estado y PIN */}
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {staffUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-xl border border-[#E5E9E7] bg-white p-3 text-xs shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#111827]">{user.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                            user.role === 'pos_supervisor'
                              ? 'bg-[#FEF3C7] text-[#92400E]'
                              : user.role === 'pos_sales_rep'
                              ? 'bg-[#EDE9FE] text-[#6D28D9]'
                              : user.role === 'pos_store_admin'
                              ? 'bg-[#E0E7FF] text-[#3730A3]'
                              : 'bg-[#DCFCE7] text-[#14532D]'
                          }`}
                        >
                          {user.role === 'pos_supervisor'
                            ? 'Supervisor'
                            : user.role === 'pos_sales_rep'
                            ? `Asesor (${user.commission_rate_percent ?? 3}%)`
                            : user.role === 'pos_store_admin'
                            ? 'Admin Tienda'
                            : 'Cajero'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-[#52635A]">
                        {user.email || 'Sin correo asociado'} · PIN: <span className="font-mono font-bold">****</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newPin = prompt(`Ingrese nuevo PIN (4 dígitos) para ${user.name}:`, user.pin);
                          if (newPin && newPin.trim().length >= 4) {
                            updateStaffPin(user.id, newPin.trim());
                          }
                        }}
                        className="rounded-lg border border-[#DCE3DF] bg-[#F6F5F0] px-2 py-1 text-[10px] font-bold text-[#52635A] hover:bg-[#DCE3DF]"
                      >
                        Cambiar PIN
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleStaffUser(user.id)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                          user.is_active !== false
                            ? 'bg-[#DCFCE7] text-[#14532D] hover:bg-[#FEE2E2] hover:text-[#991B1B]'
                            : 'bg-[#FEE2E2] text-[#991B1B] hover:bg-[#DCFCE7] hover:text-[#14532D]'
                        }`}
                        title="Clic para activar o desactivar usuario"
                      >
                        {user.is_active !== false ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
