'use client';

import React, { useState } from 'react';
import { ShieldAlert, ArrowLeft, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';

export function PosView15ShiftClosure() {
  const { activeShift, activeBranch, activeUser, refreshActiveShift, showNotification, navigateTo } = usePos();

  // Movimiento Manual
  const [movType, setMovType] = useState<'ingreso_efectivo' | 'retiro_efectivo' | 'ajuste_caja' | 'cambio_saldo_inicial'>('ingreso_efectivo');
  const [movCurrency, setMovCurrency] = useState<'USD' | 'VES'>('USD');
  const [movAmount, setMovAmount] = useState<string>('20.00');
  const [movReason, setMovReason] = useState<string>('Dotación de cambio para caja [mock]');

  // Cierre y Arqueo
  const [declaredUsd, setDeclaredUsd] = useState<string>('110.00');
  const [declaredVes, setDeclaredVes] = useState<string>('1230.00');
  const [declaredPm, setDeclaredPm] = useState<string>('1825.00');
  const [declaredCard, setDeclaredCard] = useState<string>('2007.50');
  const [declaredCashea, setDeclaredCashea] = useState<string>('35.00');
  const [justification, setJustification] = useState<string>('');
  const [closureError, setClosureError] = useState<string | null>(null);

  if (!activeShift) {
    return (
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-8 text-center text-xs text-[#52635A]">
        No hay ningún turno abierto actualmente en la caja seleccionada.
      </div>
    );
  }

  const isClosed = activeShift.status === 'cerrado';
  const expected = activeShift.expected_totals ?? {};

  // Cálculo en vivo de diferencias
  const diffUsd = parseFloat(declaredUsd || '0') - (expected['efectivo_usd'] ?? 0);
  const diffVes = parseFloat(declaredVes || '0') - (expected['efectivo_ves'] ?? 0);
  const diffPm = parseFloat(declaredPm || '0') - (expected['pago_movil_ves'] ?? 0);
  const diffCard = parseFloat(declaredCard || '0') - (expected['tarjeta_ves'] ?? 0);
  const diffCashea = parseFloat(declaredCashea || '0') - (expected['cashea_usd'] ?? 0);

  const hasAnyDiscrepancy =
    Math.abs(diffUsd) > 0.01 ||
    Math.abs(diffVes) > 0.01 ||
    Math.abs(diffPm) > 0.01 ||
    Math.abs(diffCard) > 0.01 ||
    Math.abs(diffCashea) > 0.01;

  // Registrar Movimiento Manual
  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(movAmount);
    if (isNaN(amt) || amt <= 0 || !movReason.trim()) return;

    const res = posStore.addCashMovement({
      branchId: activeBranch.id,
      shiftId: activeShift.id,
      movementType: movType,
      currency: movCurrency,
      amount: amt,
      reason: movReason.trim(),
      performedBy: activeUser.id,
    });

    if (!res.ok) {
      showNotification('Error de movimiento', res.error ?? 'Fallo', 'critical');
      return;
    }

    refreshActiveShift();
    showNotification('Movimiento de caja registrado', `${movType}: ${amt} ${movCurrency} [mock].`, 'success');
  };

  // Cierre Definitivo de Turno
  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    setClosureError(null);

    if (hasAnyDiscrepancy && !justification.trim()) {
      setClosureError('Existe una discrepancia entre el conteo ciego declarado y lo esperado por sistema. La justificación de auditoría es obligatoria.');
      return;
    }

    const res = posStore.closeShift({
      shiftId: activeShift.id,
      closedBy: activeUser.id,
      justification: justification.trim() || undefined,
      declared: {
        efectivo_usd: parseFloat(declaredUsd) || 0,
        efectivo_ves: parseFloat(declaredVes) || 0,
        pago_movil_ves: parseFloat(declaredPm) || 0,
        tarjeta_ves: parseFloat(declaredCard) || 0,
        cashea_usd: parseFloat(declaredCashea) || 0,
      },
    });

    if (!res.ok) {
      setClosureError(res.error ?? 'Error en cierre de turno.');
      return;
    }

    refreshActiveShift();
    showNotification('Turno cerrado', 'Cierre inmutable de turno ejecutado con éxito [mock].', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Turno con Bordes Redondeados */}
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#52635A]">
                Caja - {activeBranch.name}
              </span>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-bold ${isClosed
                    ? 'border border-[#C83E3B] bg-[#FEF2F2] text-[#B91C1C]'
                    : 'border border-[#86EFAC] bg-[#DCFCE7] text-[#14532D]'
                  }`}
              >
                {isClosed ? 'Turno Cerrado' : 'Abierta'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-[#111827]">
              Arqueo y Cierre Definitivo de Turno
            </h1>
            <p className="mt-1 text-xs text-[#52635A]">
              Operador: <strong className="text-[#111827]">{activeShift.cashier_name_snapshot}</strong> · Apertura:{' '}
              {new Date(activeShift.opened_at).toLocaleTimeString('es-VE')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('POS-13')}
              className="rounded-2xl bg-[#1E6B4E] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#16523B]"
            >
              Ver detalle de ventas
            </button>
            <button
              type="button"
              onClick={() => navigateTo('POS-01')}
              className="rounded-2xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#F6F5F0]"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Movimientos Manuales de Caja (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#111827]">
              Movimientos manuales de efectivo
            </h2>
            <p className="mt-1 text-xs text-[#52635A]">
              Ingreso de cambio o retiro hacia bóveda.
            </p>

            <form onSubmit={handleAddMovement} className="mt-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">
                  Tipo de movimiento
                </label>
                <select
                  disabled={isClosed}
                  value={movType}
                  onChange={(e) => setMovType(e.target.value as any)}
                  className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2.5 text-xs font-semibold"
                >
                  <option value="ingreso_efectivo">Ingreso de efectivo (+)</option>
                  <option value="retiro_efectivo">Retiro de efectivo a bóveda (-)</option>
                  <option value="ajuste_caja">Ajuste de caja</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#52635A]">
                    Moneda
                  </label>
                  <select
                    disabled={isClosed}
                    value={movCurrency}
                    onChange={(e) => setMovCurrency(e.target.value as any)}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2.5 text-xs font-semibold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs.)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52635A]">
                    Importe
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    disabled={isClosed}
                    value={movAmount}
                    onChange={(e) => setMovAmount(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-2.5 text-xs font-bold text-[#111827]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">
                  Concepto / Justificación
                </label>
                <input
                  type="text"
                  required
                  disabled={isClosed}
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-2.5 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isClosed}
                className="w-full rounded-2xl bg-[#1E6B4E] py-3 text-xs font-bold text-white hover:bg-[#16523B] disabled:opacity-40"
              >
                Registrar movimiento
              </button>
            </form>
          </div>
        </div>

        {/* Arqueo Ciego y Cierre Definitivo (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#111827]">
              Arqueo ciego de valores y cierre de turno
            </h2>
            <p className="mt-1 text-xs text-[#52635A]">
              El cajero declara físicamente lo contado sin ver el esperado hasta el cotejo final.
            </p>

            {closureError && (
              <div role="alert" className="mt-4 rounded-2xl border border-[#C83E3B] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C]">
                {closureError}
              </div>
            )}

            <form onSubmit={handleCloseShift} className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-4 text-xs space-y-3">
                {/* Efectivo USD */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827]">Efectivo USD ($)</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isClosed}
                      value={declaredUsd}
                      onChange={(e) => setDeclaredUsd(e.target.value)}
                      className="w-24 rounded-xl border border-[#DCE3DF] bg-white p-2 text-right text-xs font-bold"
                    />
                    <span className="w-20 text-right text-[11px] font-bold">
                      Diff: {diffUsd.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Efectivo VES */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827]">Efectivo VES (Bs.)</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isClosed}
                      value={declaredVes}
                      onChange={(e) => setDeclaredVes(e.target.value)}
                      className="w-24 rounded-xl border border-[#DCE3DF] bg-white p-2 text-right text-xs font-bold"
                    />
                    <span className="w-20 text-right text-[11px] font-bold">
                      Diff: {diffVes.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Pago Móvil VES */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827]">Pago Móvil VES</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isClosed}
                      value={declaredPm}
                      onChange={(e) => setDeclaredPm(e.target.value)}
                      className="w-24 rounded-xl border border-[#DCE3DF] bg-white p-2 text-right text-xs font-bold"
                    />
                    <span className="w-20 text-right text-[11px] font-bold">
                      Diff: {diffPm.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Tarjeta Terminal VES */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827]">Tarjeta Terminal VES</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isClosed}
                      value={declaredCard}
                      onChange={(e) => setDeclaredCard(e.target.value)}
                      className="w-24 rounded-xl border border-[#DCE3DF] bg-white p-2 text-right text-xs font-bold"
                    />
                    <span className="w-20 text-right text-[11px] font-bold">
                      Diff: {diffCard.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Cashea USD */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111827]">Cashea USD</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isClosed}
                      value={declaredCashea}
                      onChange={(e) => setDeclaredCashea(e.target.value)}
                      className="w-24 rounded-xl border border-[#DCE3DF] bg-white p-2 text-right text-xs font-bold"
                    />
                    <span className="w-20 text-right text-[11px] font-bold">
                      Diff: {diffCashea.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Justificación de Discrepancia Obligatoria */}
              {hasAnyDiscrepancy && (
                <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-4 text-xs">
                  <span className="font-bold text-[#92400E]">
                    Discrepancia detectada: Justificación requerida
                  </span>
                  <textarea
                    rows={2}
                    required
                    disabled={isClosed}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Detalle el motivo del sobrante o faltante verificado..."
                    className="mt-2 w-full rounded-xl border border-[#FDE68A] bg-white p-2.5 text-xs text-[#111827]"
                  />
                </div>
              )}

              {/* Botón de Cierre */}
              <button
                type="submit"
                disabled={isClosed}
                className="w-full rounded-2xl bg-[#B91C1C] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md hover:bg-[#991B1B] disabled:opacity-40"
              >
                {isClosed ? 'Turno actualmente cerrado' : 'Ejecutar arqueo y cierre definitivo de turno'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
