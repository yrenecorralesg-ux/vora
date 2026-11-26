'use client';

import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, UserCheck, X, Wifi, WifiOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { usePos } from './pos-context';

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Admin Empresa',
  pos_store_admin: 'Admin Tienda',
  pos_supervisor: 'Supervisor',
  pos_cashier: 'Cajero(a)',
  pos_sales_rep: 'Asesor',
  pos_auditor: 'Auditor',
  wh_manager: 'Admin Almacén',
  wh_supervisor: 'Superv. Almacén',
  wh_clerk: 'Almacenista',
  wh_scanner: 'Escaneo',
  wh_auditor: 'Auditor Almacén',
};

export function PosOperatorModal() {
  const {
    isOperatorModalOpen,
    setIsOperatorModalOpen,
    isTerminalLocked,
    setIsTerminalLocked,
    activeUser,
    me,
    staffUsers,
    offlineOperators,
    isOnline,
    switchOperator,
    reloadStaff,
    activeTenantSlug,
    showNotification,
  } = usePos();

  const [tab, setTab] = useState<'switch' | 'pin'>('switch');
  const eligibleOperators = offlineOperators.length > 0
    ? offlineOperators
    : staffUsers
        .filter((u) => u.is_active)
        .map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          has_pin: u.has_pin,
          offline_pin_ready: Boolean(u.offline_pin_ready),
        }));

  const [selectedOpId, setSelectedOpId] = useState<string>(activeUser.id || eligibleOperators[0]?.id || '');
  const [pinInput, setPinInput] = useState('');
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  // Configurar Mi PIN personal
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    if (isTerminalLocked) setTab('switch');
  }, [isTerminalLocked]);

  useEffect(() => {
    if (!selectedOpId && eligibleOperators.length > 0) {
      setSelectedOpId(eligibleOperators[0].id);
    }
  }, [eligibleOperators, selectedOpId]);

  const showModal = isTerminalLocked || isOperatorModalOpen;
  if (!showModal) return null;

  const selectedOp = eligibleOperators.find((o) => o.id === selectedOpId);

  const handleSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwitchError(null);
    if (!selectedOpId || !pinInput.trim()) {
      setSwitchError('Selecciona un operador e ingresa su PIN.');
      return;
    }
    setSwitching(true);
    const res = await switchOperator({ userId: selectedOpId, pin: pinInput.trim() });
    setSwitching(false);
    if (!res.ok) {
      setSwitchError(res.error ?? 'No se pudo cambiar de operador.');
      return;
    }
    setPinInput('');
    setIsTerminalLocked(false);
    setIsOperatorModalOpen(false);
    showNotification(
      'Operador activo',
      `Terminal operada por ${selectedOp?.name ?? 'operador'} (${isOnline ? 'online' : 'offline'}).`,
      'success',
    );
  };

  const handleSaveMyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!isOnline) {
      setPinError('Necesitas conexión a internet para crear o cambiar tu PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Los PINes nuevos no coinciden.');
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: newPin.trim(),
          current_pin: currentPin.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setPinError(data?.error ?? 'No se pudo guardar el PIN.');
        return;
      }
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      await reloadStaff();
      showNotification('PIN guardado', 'Tu PIN personal quedó listo para cambio rápido y modo sin conexión.', 'success');
    } catch {
      setPinError('Error de red al guardar el PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  const handleActivateOfflineExistingPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!currentPin.trim()) {
      setPinError('Ingresa tu PIN actual para activar el modo sin conexión.');
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate_offline',
          current_pin: currentPin.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setPinError(data?.error ?? 'PIN incorrecto.');
        return;
      }
      setCurrentPin('');
      await reloadStaff();
      showNotification('Modo offline habilitado', 'Tu PIN ya puede verificarse sin conexión en este equipo.', 'success');
    } catch {
      setPinError('Error de red.');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#1E6B4E]">
              {isTerminalLocked ? <Lock className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827]">
                {isTerminalLocked ? 'Terminal Bloqueada' : 'Control de Operador y PIN'}
              </h3>
              <p className="flex items-center gap-1.5 text-[11px] text-[#52635A]">
                {isOnline ? <Wifi className="h-3 w-3 text-[#15803D]" /> : <WifiOff className="h-3 w-3 text-[#B45309]" />}
                <span>{isOnline ? 'En línea' : 'Sin conexión (verificación local)'}</span>
              </p>
            </div>
          </div>
          {!isTerminalLocked && (
            <button
              type="button"
              onClick={() => setIsOperatorModalOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!isTerminalLocked && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F6F5F0] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTab('switch')}
              className={`rounded-xl py-2 transition ${
                tab === 'switch' ? 'bg-white text-[#111827] shadow-xs' : 'text-[#52635A]'
              }`}
            >
              Cambiar / Bloquear
            </button>
            <button
              type="button"
              onClick={() => setTab('pin')}
              className={`rounded-xl py-2 transition ${
                tab === 'pin' ? 'bg-white text-[#111827] shadow-xs' : 'text-[#52635A]'
              }`}
            >
              Mi PIN ({me?.has_pin ? 'Activo' : 'Sin PIN'})
            </button>
          </div>
        )}

        {tab === 'switch' ? (
          <form onSubmit={handleSwitch} className="space-y-4">
            {switchError && (
              <div role="alert" className="flex items-center gap-2 rounded-2xl border border-[#C83E3B] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C]">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{switchError}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                Operador
              </label>
              <select
                value={selectedOpId}
                onChange={(e) => setSelectedOpId(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-bold text-[#111827]"
              >
                {eligibleOperators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} · {ROLE_LABELS[op.role] ?? op.role}
                    {!op.has_pin ? ' (sin PIN)' : !isOnline && !op.offline_pin_ready ? ' (sin PIN offline)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                PIN personal (4 a 8 dígitos)
              </label>
              <div className="relative mt-1">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 pr-10 text-sm font-mono font-bold tracking-widest text-[#111827]"
                />
                <KeyRound className="absolute right-3.5 top-3.5 h-4 w-4 text-[#52635A]" />
              </div>
              {!isOnline && selectedOp && !selectedOp.offline_pin_ready && (
                <p className="mt-1.5 text-[11px] font-semibold text-[#B45309]">
                  Este operador aún no tiene su PIN activado para modo offline.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!isTerminalLocked && (
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setSwitchError(null);
                    setIsTerminalLocked(true);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-3 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Bloquear</span>
                </button>
              )}
              <button
                type="submit"
                disabled={switching}
                className="flex-1 rounded-2xl bg-[#1E6B4E] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#16523B] disabled:opacity-50"
              >
                {switching ? 'Verificando...' : isTerminalLocked ? 'Desbloquear caja' : 'Cambiar operador'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-3 text-xs space-y-1">
              <p className="font-bold text-[#111827]">{activeUser.name}</p>
              <div className="flex items-center gap-2 text-[11px]">
                {me?.offline_pin_ready ? (
                  <span className="inline-flex items-center gap-1 text-[#15803D] font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> PIN listo para cambio rápido y modo sin conexión
                  </span>
                ) : me?.has_pin ? (
                  <span className="text-[#B45309] font-semibold">
                    Tienes PIN online, pero falta activarlo para uso sin conexión.
                  </span>
                ) : (
                  <span className="text-[#52635A]">
                    Configura un PIN de 4–8 dígitos para desbloquear la caja y operar sin conexión.
                  </span>
                )}
              </div>
            </div>

            {pinError && (
              <div role="alert" className="rounded-2xl border border-[#C83E3B] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C]">
                {pinError}
              </div>
            )}

            {me?.has_pin && !me?.offline_pin_ready && isOnline && (
              <form onSubmit={handleActivateOfflineExistingPin} className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5 space-y-2.5">
                <p className="text-[11px] font-bold text-[#92400E]">
                  Activar modo sin conexión con tu PIN actual:
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="PIN actual"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className="flex-1 rounded-xl border border-[#FDE68A] bg-white p-2 text-xs font-mono font-bold tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={savingPin}
                    className="rounded-xl bg-[#B45309] px-3 py-2 text-xs font-bold text-white hover:bg-[#92400E] disabled:opacity-50"
                  >
                    Activar
                  </button>
                </div>
              </form>
            )}

            <form onSubmit={handleSaveMyPin} className="space-y-3">
              {me?.has_pin && (
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  required
                  placeholder="PIN actual"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-mono font-bold tracking-widest"
                />
              )}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                required
                placeholder="Nuevo PIN (4 a 8 dígitos)"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-mono font-bold tracking-widest"
              />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                required
                placeholder="Confirmar nuevo PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-mono font-bold tracking-widest"
              />
              <button
                type="submit"
                disabled={savingPin || !isOnline}
                className="w-full rounded-2xl bg-[#1E6B4E] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#16523B] disabled:opacity-50"
              >
                {savingPin ? 'Guardando...' : me?.has_pin ? 'Actualizar mi PIN' : 'Crear mi PIN'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
