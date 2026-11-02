'use client';

import React, { useState } from 'react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';

export function PosView02OpenShift() {
  const {
    activeBranch,
    activeUser,
    activeRegisterId,
    setActiveRegisterId,
    registers,
    activeShift,
    refreshActiveShift,
    navigateTo,
    showNotification,
  } = usePos();

  const [openingUsd, setOpeningUsd] = useState<string>('50.00');
  const [openingVes, setOpeningVes] = useState<string>('500.00');
  const [notes, setNotes] = useState<string>('Apertura regular de turno matutino [mock].');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCurrentRegisterOpen = Boolean(activeShift && activeShift.status === 'abierto');

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const usdVal = parseFloat(openingUsd);
    const vesVal = parseFloat(openingVes);

    if (isNaN(usdVal) || usdVal < 0 || isNaN(vesVal) || vesVal < 0) {
      setErrorMessage('Los montos de fondo inicial deben ser numéricos iguales o mayores a 0,00.');
      return;
    }

    const result = posStore.openShift({
      branchId: activeBranch.id,
      registerId: activeRegisterId,
      cashierUserId: activeUser.id,
      cashierName: activeUser.name,
      openingUsd: usdVal,
      openingVes: vesVal,
      notes,
    });

    if (!result.ok) {
      setErrorMessage(result.error ?? 'Error en apertura de turno.');
      showNotification('Bloqueo de concurrencia', result.error ?? 'Caja ocupada', 'critical');
      return;
    }

    refreshActiveShift();
    showNotification(
      'Turno aperturado exitosamente',
      `Turno abierto en ${registers.find((r) => r.id === activeRegisterId)?.name} con fondo de $${usdVal} USD y ${vesVal} VES [mock].`,
      'success',
    );
    navigateTo('POS-03-04');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div className="border-b border-[#E5E9E7] pb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1E6B4E]">
            GESTIÓN DE CAJA Y FONDOS
          </span>
          <h1 className="mt-1 text-xl font-bold text-[#111827]">
            Apertura y control de turno de caja
          </h1>
          <p className="mt-1 text-xs text-[#52635A]">
            Registro formal del fondo de cambio y asignación de responsabilidad operativa.
          </p>
        </div>

        {/* Alerta de Turno Existente */}
        {activeShift && activeShift.status === 'abierto' && (
          <div className="mt-4 rounded-2xl border border-[#86EFAC] bg-[#DCFCE7] p-4 text-xs text-[#14532D]">
            <span className="font-bold uppercase tracking-wider">Turno actualmente activo:</span>
            <p className="mt-1">
              La caja seleccionada ya posee un turno abierto por <strong>{activeShift.cashier_name_snapshot}</strong> desde las{' '}
              {new Date(activeShift.opened_at).toLocaleTimeString('es-VE')}.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => navigateTo('POS-03-04')}
                className="rounded-xl border border-[#14532D] bg-[#14532D] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
              >
                Ir a terminal de venta
              </button>
              <button
                type="button"
                onClick={() => navigateTo('POS-15')}
                className="rounded-xl border border-[#14532D] bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#14532D] hover:bg-[#DCFCE7]"
              >
                Ir a movimientos y arqueo de caja
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mt-4 rounded-2xl border border-[#C83E3B] bg-[#FEF2F2] p-4 text-xs font-semibold text-[#B91C1C]">
            <span className="font-bold uppercase tracking-wider">Aviso de concurrencia:</span>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleOpenShift} className="mt-6 space-y-4">
          {/* Caja Asignada */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
              Caja física asignada en sede
            </label>
            <select
              value={activeRegisterId}
              onChange={(e) => setActiveRegisterId(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold text-[#111827] outline-none"
            >
              {registers
                .filter((r) => r.branch_id === activeBranch.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Operador y Fecha */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#52635A]">
                Cajero responsable en sesión
              </label>
              <input
                type="text"
                disabled
                value={activeUser.name}
                className="mt-1.5 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold text-[#52635A]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#52635A]">
                Fecha y hora oficial de apertura
              </label>
              <input
                type="text"
                disabled
                value={new Date().toLocaleString('es-VE')}
                className="mt-1.5 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold text-[#52635A]"
              />
            </div>
          </div>

          {/* Fondos Iniciales */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                Monto inicial en Efectivo USD
              </label>
              <div className="mt-1.5 flex rounded-2xl border border-[#DCE3DF] overflow-hidden bg-white">
                <span className="flex items-center bg-[#F6F5F0] px-3.5 text-xs font-bold text-[#52635A]">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingUsd}
                  onChange={(e) => setOpeningUsd(e.target.value)}
                  className="w-full p-3 text-xs font-bold text-[#111827] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                Monto inicial en Efectivo VES
              </label>
              <div className="mt-1.5 flex rounded-2xl border border-[#DCE3DF] overflow-hidden bg-white">
                <span className="flex items-center bg-[#F6F5F0] px-3.5 text-xs font-bold text-[#52635A]">
                  Bs.
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={openingVes}
                  onChange={(e) => setOpeningVes(e.target.value)}
                  className="w-full p-3 text-xs font-bold text-[#111827] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
              Observaciones de apertura de turno
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-[#DCE3DF] bg-white p-3 text-xs text-[#111827] outline-none"
              placeholder="Detalle cualquier observación relevante sobre billetes o entrega de caja..."
            />
          </div>

          {/* Botón de Confirmación */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isCurrentRegisterOpen}
              className={`w-full rounded-2xl py-4 text-xs font-bold uppercase tracking-widest transition-colors ${
                isCurrentRegisterOpen
                  ? 'border border-[#DCE3DF] bg-[#F6F5F0] text-[#52635A] cursor-not-allowed'
                  : 'bg-[#1E6B4E] text-white hover:bg-[#16523B] shadow-md'
              }`}
            >
              Confirmar apertura de turno en caja
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
