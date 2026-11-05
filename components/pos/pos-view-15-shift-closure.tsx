'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Printer,
  Eye,
  EyeOff,
  FileSpreadsheet,
  X,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';
import { MOCK_USERS } from '@/lib/pos-demo-data';

export function PosView15ShiftClosure() {
  const {
    activeShift,
    activeBranch,
    activeUser,
    refreshActiveShift,
    showNotification,
    navigateTo,
    isFuncActive,
    parkedSales,
    staffUsers,
    validateSupervisorPin,
  } = usePos();

  // Movimiento Manual
  const [movType, setMovType] = useState<'ingreso_efectivo' | 'retiro_efectivo' | 'ajuste_caja' | 'cambio_saldo_inicial'>('ingreso_efectivo');
  const [movCurrency, setMovCurrency] = useState<'USD' | 'VES'>('USD');
  const [movAmount, setMovAmount] = useState<string>('20.00');
  const [movReason, setMovReason] = useState<string>('Dotación de cambio para caja [mock]');

  // Autorización de Supervisor para movimientos (Diagrama §5)
  const supervisors = staffUsers.filter(
    (u) => (u.role === 'pos_supervisor' || u.role === 'pos_store_admin') && u.is_active !== false,
  );
  const [authSupervisorId, setAuthSupervisorId] = useState<string>(supervisors[0]?.id || '');
  const [authSupervisorPin, setAuthSupervisorPin] = useState<string>('');
  const [movementError, setMovementError] = useState<string | null>(null);

  // Cierre y Arqueo Ciego
  const [isBlindMode, setIsBlindMode] = useState<boolean>(isFuncActive('pos_blind_reconciliation'));
  const [revealed, setRevealed] = useState<boolean>(false);
  const [declaredUsd, setDeclaredUsd] = useState<string>('110.00');
  const [declaredVes, setDeclaredVes] = useState<string>('1230.00');
  const [declaredPm, setDeclaredPm] = useState<string>('1825.00');
  const [declaredCard, setDeclaredCard] = useState<string>('2007.50');
  const [declaredCashea, setDeclaredCashea] = useState<string>('35.00');
  const [justification, setJustification] = useState<string>('');
  const [closureError, setClosureError] = useState<string | null>(null);

  // Modal Reporte X / Z (ESC/POS)
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportType, setReportType] = useState<'X' | 'Z'>('X');

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

  // Registrar Movimiento Manual con control de permisos (Diagrama §5)
  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    setMovementError(null);
    const amt = parseFloat(movAmount);
    if (isNaN(amt) || amt <= 0 || !movReason.trim()) return;

    // Retiros, ajustes y cambio de saldo inicial requieren autorización de Supervisor/Admin (Diagrama §5)
    const requiresSupervisorAuth =
      movType === 'retiro_efectivo' ||
      movType === 'ajuste_caja' ||
      movType === 'cambio_saldo_inicial' ||
      activeUser.role === 'pos_cashier';

    let authorizedById: string | null = null;
    if (requiresSupervisorAuth && activeUser.role === 'pos_cashier') {
      const supervisor = supervisors.find((u) => u.id === authSupervisorId);
      const isPinValid =
        (supervisor && supervisor.pin === authSupervisorPin.trim()) ||
        validateSupervisorPin(authSupervisorPin);

      if (!isPinValid) {
        setMovementError('Autorización denegada: PIN de supervisor incorrecto (Diagrama §5 - Modelo de permisos).');
        return;
      }
      authorizedById = supervisor?.id || authSupervisorId;
    }

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

    setAuthSupervisorPin('');
    refreshActiveShift();
    showNotification(
      'Movimiento registrado',
      `${movType}: ${amt} ${movCurrency}${authorizedById ? ' (Autorizado por supervisor)' : ''} [mock].`,
      'success',
    );
  };

  // Cierre Definitivo de Turno (Regla #5: Bloqueo si hay ventas en espera)
  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    setClosureError(null);

    // Regla de Negocio #5 (Diagrama): No se puede cerrar un turno con ventas pendientes de cobro
    if (parkedSales.length > 0) {
      setClosureError(
        `Cierre bloqueado: Existen ${parkedSales.length} ventas en espera (pausadas) en mostrador. Debe reanudarlas, cobrarlas o cancelarlas antes de conciliar la caja (Regla de Caja #5).`,
      );
      return;
    }

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
              onClick={() => {
                setReportType('X');
                setShowReportModal(true);
              }}
              className="flex items-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-3.5 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
            >
              <Printer className="h-4 w-4 text-[#52635A]" />
              <span>Corte X (Parcial)</span>
            </button>
            {isFuncActive('pos_fiscal_reports') && (
              <button
                type="button"
                onClick={() => {
                  setReportType('Z');
                  setShowReportModal(true);
                }}
                className="flex items-center gap-1.5 rounded-2xl border border-[#1E6B4E] bg-[#DCFCE7] px-3.5 py-2 text-xs font-bold text-[#14532D] hover:bg-[#BBF7D0]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Corte Z (Fiscal)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateTo('POS-13')}
              className="rounded-2xl bg-[#1E6B4E] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#16523B]"
            >
              Detalle ventas
            </button>
            <button
              type="button"
              onClick={() => navigateTo('POS-01')}
              className="rounded-2xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#F6F5F0]"
            >
              Inicio
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

              {/* Autorización con PIN Supervisor si es retiro o ajuste (Diagrama §5) */}
              {activeUser.role === 'pos_cashier' && (movType === 'retiro_efectivo' || movType === 'ajuste_caja') && (
                <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7]/60 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#92400E]">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Autorización de Supervisor Requerida (Diagrama §5)</span>
                  </div>
                  <p className="text-[10px] text-[#92400E]">
                    Los cajeros no pueden realizar retiros ni ajustes sin autorización de un supervisor en turno.
                  </p>
                  <div>
                    <label className="block text-[10px] font-bold text-[#52635A]">Supervisor en turno</label>
                    <select
                      value={authSupervisorId}
                      onChange={(e) => setAuthSupervisorId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs font-medium"
                    >
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#52635A]">PIN del supervisor</label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="PIN (ej: 9999)"
                      value={authSupervisorPin}
                      onChange={(e) => setAuthSupervisorPin(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs font-bold"
                    />
                  </div>
                </div>
              )}

              {movementError && (
                <div role="alert" className="rounded-2xl border border-[#C83E3B] bg-[#FEF2F2] p-2.5 text-[11px] font-semibold text-[#B91C1C]">
                  {movementError}
                </div>
              )}

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#111827]">
                  Arqueo ciego de valores y cierre de turno
                </h2>
                <p className="mt-0.5 text-xs text-[#52635A]">
                  El cajero declara físicamente lo contado sin ver el saldo esperado hasta el cotejo final.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRevealed(!revealed)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  revealed
                    ? 'border-[#86EFAC] bg-[#DCFCE7] text-[#14532D]'
                    : 'border-[#DCE3DF] bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]'
                }`}
              >
                {revealed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span>{revealed ? 'Valores Revelados' : 'Arqueo Ciego Activo'}</span>
              </button>
            </div>

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
                    <span className="w-24 text-right text-[11px] font-bold">
                      {revealed ? (
                        <span className={Math.abs(diffUsd) < 0.01 ? 'text-[#15803D]' : 'text-[#B91C1C]'}>
                          {diffUsd >= 0 ? `+${diffUsd.toFixed(2)}` : diffUsd.toFixed(2)}
                        </span>
                      ) : (
                        <span className="font-mono text-[#52635A]">*** (Ciego)</span>
                      )}
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
                    <span className="w-24 text-right text-[11px] font-bold">
                      {revealed ? (
                        <span className={Math.abs(diffVes) < 0.01 ? 'text-[#15803D]' : 'text-[#B91C1C]'}>
                          {diffVes >= 0 ? `+${diffVes.toFixed(2)}` : diffVes.toFixed(2)}
                        </span>
                      ) : (
                        <span className="font-mono text-[#52635A]">*** (Ciego)</span>
                      )}
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
                    <span className="w-24 text-right text-[11px] font-bold">
                      {revealed ? (
                        <span className={Math.abs(diffPm) < 0.01 ? 'text-[#15803D]' : 'text-[#B91C1C]'}>
                          {diffPm >= 0 ? `+${diffPm.toFixed(2)}` : diffPm.toFixed(2)}
                        </span>
                      ) : (
                        <span className="font-mono text-[#52635A]">*** (Ciego)</span>
                      )}
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
                    <span className="w-24 text-right text-[11px] font-bold">
                      {revealed ? (
                        <span className={Math.abs(diffCard) < 0.01 ? 'text-[#15803D]' : 'text-[#B91C1C]'}>
                          {diffCard >= 0 ? `+${diffCard.toFixed(2)}` : diffCard.toFixed(2)}
                        </span>
                      ) : (
                        <span className="font-mono text-[#52635A]">*** (Ciego)</span>
                      )}
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
                    <span className="w-24 text-right text-[11px] font-bold">
                      {revealed ? (
                        <span className={Math.abs(diffCashea) < 0.01 ? 'text-[#15803D]' : 'text-[#B91C1C]'}>
                          {diffCashea >= 0 ? `+${diffCashea.toFixed(2)}` : diffCashea.toFixed(2)}
                        </span>
                      ) : (
                        <span className="font-mono text-[#52635A]">*** (Ciego)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {!revealed && (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="w-full rounded-2xl border border-[#1E6B4E] bg-[#F0FDF4] py-3 text-xs font-bold text-[#1E6B4E] hover:bg-[#DCFCE7] transition"
                >
                  Revelar y comparar arqueo con valores del sistema
                </button>
              )}

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

              {/* Regla de Negocio #5: Bloqueo si hay ventas en espera */}
              {parkedSales.length > 0 && (
                <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-4 text-xs text-[#92400E] space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4 text-[#B45309]" />
                    <span>Cierre Bloqueado: {parkedSales.length} ventas en espera</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Según la <strong>Regla de negocio #5 de Caja</strong>, no se permite cerrar el turno con ventas pendientes de cobro o pausadas en mostrador. Resuelva o descarte las ventas pausadas para habilitar el arqueo.
                  </p>
                </div>
              )}

              {/* Botón de Cierre */}
              <button
                type="submit"
                disabled={isClosed || parkedSales.length > 0}
                className="w-full rounded-2xl bg-[#B91C1C] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md hover:bg-[#991B1B] disabled:opacity-40"
              >
                {isClosed
                  ? 'Turno actualmente cerrado'
                  : parkedSales.length > 0
                  ? `Bloqueado por ${parkedSales.length} ventas en espera (Regla #5)`
                  : 'Ejecutar arqueo y cierre definitivo de turno'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de Impresión Térmica ESC/POS (Corte X / Corte Z) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-[#1E6B4E]" />
                <h3 className="text-base font-bold text-[#111827]">
                  {reportType === 'X' ? 'Reporte Corte X (Parcial)' : 'Reporte Corte Z (Fiscal SENIAT)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1 text-[#52635A] hover:text-[#111827]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Simulación de Ticket Térmico 80mm */}
            <div className="rounded-2xl border border-[#DCE3DF] bg-[#FAF9F5] p-4 font-mono text-[11px] text-[#111827] space-y-2 shadow-inner">
              <div className="text-center space-y-0.5 border-b border-dashed border-[#B5C2BA] pb-2">
                <p className="font-extrabold text-xs">VORA RETAIL PILOTO C.A.</p>
                <p className="text-[10px]">RIF: J-502258027</p>
                <p className="text-[9px] text-[#52635A]">{activeBranch.name}</p>
                <p className="font-bold text-[11px] pt-1 text-[#1E6B4E]">
                  *** REPORTE CORTE {reportType} ***
                </p>
                <p className="text-[9px]">
                  {reportType === 'X' ? 'CORTE DE AUDITORÍA SIN REINICIO' : 'CIERRE FISCAL DIARIO OBLIGATORIO'}
                </p>
              </div>

              <div className="space-y-1 text-[10px] border-b border-dashed border-[#B5C2BA] pb-2">
                <div className="flex justify-between">
                  <span>CAJA:</span>
                  <span className="font-bold">{activeShift.register_id.slice(-4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CAJERO:</span>
                  <span>{activeShift.cashier_name_snapshot}</span>
                </div>
                <div className="flex justify-between">
                  <span>FECHA:</span>
                  <span>{new Date().toLocaleDateString('es-VE')}</span>
                </div>
                <div className="flex justify-between">
                  <span>HORA:</span>
                  <span>{new Date().toLocaleTimeString('es-VE')}</span>
                </div>
                <div className="flex justify-between">
                  <span>DOCS EMITIDOS:</span>
                  <span className="font-bold">{posStore.sales.length}</span>
                </div>
              </div>

              {/* Desglose de Ventas por Método */}
              <div className="space-y-1 text-[10px] border-b border-dashed border-[#B5C2BA] pb-2">
                <p className="font-bold">TOTALES POR MEDIO DE COBRO:</p>
                <div className="flex justify-between">
                  <span>EFECTIVO USD:</span>
                  <span>${(expected['efectivo_usd'] ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>EFECTIVO VES:</span>
                  <span>{(expected['efectivo_ves'] ?? 0).toFixed(2)} Bs</span>
                </div>
                <div className="flex justify-between">
                  <span>PAGO MÓVIL (P2P/C2P):</span>
                  <span>{(expected['pago_movil_ves'] ?? 0).toFixed(2)} Bs</span>
                </div>
                <div className="flex justify-between">
                  <span>PUNTO TARJETA:</span>
                  <span>{(expected['tarjeta_ves'] ?? 0).toFixed(2)} Bs</span>
                </div>
                <div className="flex justify-between">
                  <span>CASHEA (BNPL):</span>
                  <span>${(expected['cashea_usd'] ?? 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Resumen Impositivo SENIAT */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between font-bold">
                  <span>VENTAS GRAVADAS (G 16%):</span>
                  <span>${(expected['efectivo_usd'] ?? 0 + 150).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>TOTAL IVA RECIBIDO:</span>
                  <span>${((expected['efectivo_usd'] ?? 0 + 150) * 0.16).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px] text-[#52635A] pt-1">
                  <span>HKA SERIAL:</span>
                  <span>HKA-SBX-VORA-2026</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="flex-1 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] py-2.5 text-xs font-bold text-[#111827]"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  showNotification(`Reporte ${reportType} Impreso`, `Ticket enviado a cola de impresión térmica ESC/POS.`, 'success');
                }}
                className="flex-1 rounded-2xl bg-[#1E6B4E] py-2.5 text-xs font-bold text-white hover:bg-[#16523B]"
              >
                Imprimir ESC/POS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
