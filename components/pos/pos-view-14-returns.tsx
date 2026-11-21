'use client';

import React, { useState } from 'react';
import { Search, RotateCcw, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { usePos } from './pos-context';

export function PosView14Returns() {
  const {
    sales,
    lastConfirmedSale,
    activeBranch,
    activeShift,
    activeUser,
    showNotification,
    navigateTo,
    supervisors: allSupervisors,
    can,
    activeTenantSlug,
    reloadProducts,
    reloadSales,
    reloadReturns,
    refreshActiveShift,
  } = usePos();
  const isSupervisorSession = can('pos.refunds.approve');
  const [submitting, setSubmitting] = useState(false);
  const [damagedLines, setDamagedLines] = useState<Record<string, boolean>>({});

  const [saleSearch, setSaleSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState(lastConfirmedSale ?? sales[0]);

  // Selección de devolución
  const [returnType, setReturnType] = useState<'devolucion_parcial' | 'anulacion_total'>('devolucion_parcial');
  const [quantitiesToReturn, setQuantitiesToReturn] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState<'efectivo_usd' | 'efectivo_ves' | 'reverso_electronico' | 'nota_credito_interna'>('efectivo_usd');

  // Supervisor PIN
  const supervisors = allSupervisors.filter((u) => u.permissions.includes('pos.refunds.approve'));
  const [supervisorId, setSupervisorId] = useState(supervisors[0]?.id ?? '');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearchSale = (e: React.FormEvent) => {
    e.preventDefault();
    const found = sales.find((s) => s.sale_number.toLowerCase() === saleSearch.trim().toLowerCase());
    if (found) {
      setSelectedSale(found);
      setQuantitiesToReturn({});
      setErrorMsg(null);
    } else {
      setErrorMsg(`No se encontró ninguna venta con el número ${saleSearch}`);
    }
  };

  const handleQuantityChange = (lineId: string, maxQty: number, val: number) => {
    const clamped = Math.min(maxQty, Math.max(0, val));
    setQuantitiesToReturn((prev) => ({ ...prev, [lineId]: clamped }));
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSale) return;
    if (!activeShift) {
      setErrorMsg('Abra un turno de caja para registrar devoluciones.');
      return;
    }
    if (selectedSale.commercial_status === 'anulada' || selectedSale.commercial_status === 'devuelta') {
      setErrorMsg('La venta ya se encuentra totalmente anulada o devuelta.');
      return;
    }

    const itemsToReturn: Array<{ lineId: string; quantity: number }> = [];
    if (returnType === 'anulacion_total') {
      (selectedSale.lines ?? []).forEach((l) => {
        const remaining = l.quantity - l.returned_quantity;
        if (remaining > 0) itemsToReturn.push({ lineId: l.id, quantity: remaining });
      });
    } else {
      Object.entries(quantitiesToReturn).forEach(([lineId, qty]) => {
        if (qty > 0) itemsToReturn.push({ lineId, quantity: qty });
      });
    }
    if (itemsToReturn.length === 0) {
      setErrorMsg('Debe seleccionar al menos un producto y cantidad para devolver.');
      return;
    }
    if (!isSupervisorSession && (!supervisorId || !supervisorPin.trim())) {
      setErrorMsg('Seleccione el supervisor e ingrese su PIN.');
      return;
    }

    // El servidor valida el PIN (o el permiso de la sesión) y registra quién aprobó.
    setSubmitting(true);
    let data: { ok?: boolean; error?: string; return_record?: { return_number: string; total_refunded_usd: number } } | null = null;
    try {
      const resp = await fetch(`/api/t/${activeTenantSlug}/pos/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: `ret-${selectedSale.id}-${Date.now()}`,
          original_sale_id: selectedSale.id,
          shift_id: activeShift.id,
          return_type: returnType,
          lines: itemsToReturn.map((item) => ({
            sale_line_id: item.lineId,
            quantity_returned: item.quantity,
            condition: damagedLines[item.lineId] ? 'damaged' : 'sellable',
          })),
          reason,
          notes: notes.trim() || undefined,
          refund_method: refundMethod,
          supervisor_id: isSupervisorSession ? undefined : supervisorId,
          supervisor_pin: isSupervisorSession ? undefined : supervisorPin.trim(),
        }),
      });
      data = await resp.json().catch(() => null);
    } catch {
      data = { ok: false, error: 'Sin conexión con el servidor. Las devoluciones requieren conexión.' };
    } finally {
      setSubmitting(false);
      setSupervisorPin('');
    }

    if (!data?.ok || !data.return_record) {
      setErrorMsg(data?.error ?? 'El servidor rechazó la devolución.');
      return;
    }

    await Promise.all([reloadProducts(), reloadSales(), reloadReturns(), refreshActiveShift()]).catch(() => {});
    showNotification(
      'Devolución registrada',
      `Reverso ${data.return_record.return_number} por $${Number(data.return_record.total_refunded_usd || 0).toFixed(2)} USD.`,
      'success',
    );
    navigateTo('POS-13');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera con Bordes Redondeados */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">
            Anulaciones y Devoluciones Trazables
          </h1>
          <p className="mt-1 text-xs text-[#52635A]">
            Restitución de inventario en kardex y reverso de cobros con autorización de supervisor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('POS-13')}
          className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
        >
          Volver al historial
        </button>
      </div>

      {/* Buscador de Venta */}
      <div className="rounded-2xl border border-[#DCE3DF] bg-white p-5 shadow-sm">
        <form onSubmit={handleSearchSale} className="flex gap-2">
          <input
            type="text"
            value={saleSearch}
            onChange={(e) => setSaleSearch(e.target.value)}
            placeholder="Ingrese número de venta (Ej: VTA-000001)..."
            className="flex-1 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs text-[#111827] outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl bg-[#1E6B4E] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#16523B]"
          >
            Buscar venta
          </button>
        </form>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-2xl border border-[#C83E3B] bg-[#FEF2F2] p-4 text-xs font-semibold text-[#B91C1C]">
          {errorMsg}
        </div>
      )}

      {selectedSale && (
        <form onSubmit={handleProcessReturn} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Líneas a Devolver (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
                <h3 className="text-sm font-bold text-[#111827]">
                  Líneas de la venta {selectedSale.sale_number}
                </h3>
                <span className="text-xs text-[#52635A]">
                  Cliente: <strong className="text-[#111827]">{selectedSale.customer?.legal_name ?? 'Consumidor Final'}</strong>
                </span>
              </div>

              {/* Selección de Tipo de Devolución */}
              <div className="mt-4 flex gap-4 text-xs font-semibold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="returnType"
                    checked={returnType === 'devolucion_parcial'}
                    onChange={() => setReturnType('devolucion_parcial')}
                    className="accent-[#1E6B4E]"
                  />
                  <span>Devolución parcial de productos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="returnType"
                    checked={returnType === 'anulacion_total'}
                    onChange={() => setReturnType('anulacion_total')}
                    className="accent-[#B91C1C]"
                  />
                  <span>Anulación total de la venta</span>
                </label>
              </div>

              {/* Lista de Productos Comprados */}
              <div className="mt-4 divide-y divide-[#E5E9E7] rounded-2xl border border-[#E5E9E7]">
                {(selectedSale.lines ?? []).map((line) => {
                  const remaining = line.quantity - line.returned_quantity;
                  const currentInput = quantitiesToReturn[line.id] ?? 0;

                  return (
                    <div key={line.id} className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <span className="font-bold text-[#111827]">{line.name_snapshot}</span>
                        <p className="text-[10px] text-[#52635A]">
                          SKU: {line.sku_snapshot} · ${line.unit_price_usd.toFixed(2)} USD c/u
                        </p>
                        <p className="text-[10px] text-[#52635A]">
                          Comprado: {line.quantity} · Previamente devuelto: {line.returned_quantity} ·{' '}
                          <strong className="text-[#111827]">Disponible: {remaining}</strong>
                        </p>
                      </div>

                      <div>
                        {returnType === 'anulacion_total' ? (
                          <span className="font-bold text-[#B91C1C]">{remaining} und.</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            disabled={remaining <= 0}
                            value={currentInput}
                            onChange={(e) => handleQuantityChange(line.id, remaining, parseInt(e.target.value) || 0)}
                            className="w-20 rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-2 text-center text-xs font-bold text-[#111827]"
                          />
                        )}
                        {!line.is_service && remaining > 0 && (
                          <label className="mt-1 flex items-center gap-1 text-[10px] text-[#52635A]">
                            <input
                              type="checkbox"
                              checked={Boolean(damagedLines[line.id])}
                              onChange={(e) => setDamagedLines((prev) => ({ ...prev, [line.id]: e.target.checked }))}
                            />
                            Llega dañado (no vuelve al stock vendible)
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Autorización de Supervisor (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#111827]">
                Aprobación obligatoria de supervisor
              </h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#52635A]">
                    Supervisor autorizante
                  </label>
                  <select
                    value={supervisorId}
                    onChange={(e) => setSupervisorId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2.5 text-xs font-semibold"
                  >
                    {supervisors.length === 0 && <option value="">No hay supervisores con PIN configurado</option>}
                    {supervisors.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52635A]">
                    PIN de seguridad del supervisor
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    required={!isSupervisorSession}
                    disabled={isSupervisorSession}
                    inputMode="numeric"
                    autoComplete="off"
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    placeholder={isSupervisorSession ? 'Tu sesión de supervisor aprueba la devolución' : 'PIN personal del supervisor'}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52635A]">
                    Método de reintegro de fondos
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as any)}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2.5 text-xs font-semibold"
                  >
                    <option value="efectivo_usd">Efectivo Dólares (USD)</option>
                    <option value="efectivo_ves">Efectivo Bolívares (VES)</option>
                    <option value="reverso_electronico">Reverso electrónico Pago Móvil</option>
                    <option value="nota_credito_interna">Nota de crédito interna para compras futuras</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52635A]">
                    Motivo formal
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-2.5 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full rounded-2xl bg-[#B91C1C] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#991B1B] disabled:opacity-60"
              >
                {submitting ? 'Procesando…' : 'Ejecutar devolución y restituir existencias'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
