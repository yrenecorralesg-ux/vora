'use client';

import React, { useState } from 'react';
import { Search, RotateCcw, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';
import { MOCK_USERS } from '@/lib/pos-demo-data';

export function PosView14Returns() {
  const { sales, lastConfirmedSale, activeBranch, activeShift, activeUser, showNotification, navigateTo } = usePos();

  const [saleSearch, setSaleSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState(lastConfirmedSale ?? sales[0]);

  // Selección de devolución
  const [returnType, setReturnType] = useState<'devolucion_parcial' | 'anulacion_total'>('devolucion_parcial');
  const [quantitiesToReturn, setQuantitiesToReturn] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('Cambio por defecto o solicitud de cliente en mostrador [mock]');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState<'efectivo_usd' | 'efectivo_ves' | 'reverso_electronico' | 'nota_credito_interna'>('efectivo_usd');

  // Supervisor PIN
  const [supervisorId, setSupervisorId] = useState(MOCK_USERS[2].id);
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

  const handleProcessReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSale) return;

    if (selectedSale.commercial_status === 'anulada' || selectedSale.commercial_status === 'devuelta') {
      setErrorMsg('La venta ya se encuentra totalmente anulada o devuelta.');
      return;
    }

    // Validar PIN de supervisor
    const supervisor = MOCK_USERS.find((u) => u.id === supervisorId);
    if (!supervisor || supervisor.pin !== supervisorPin) {
      setErrorMsg('Credencial o PIN de supervisor inválido. Operación no autorizada.');
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

    const res = posStore.processReturn({
      originalSaleId: selectedSale.id,
      branchId: activeBranch.id,
      shiftId: activeShift ? activeShift.id : selectedSale.shift_id,
      returnType,
      lines: itemsToReturn.map((item) => ({
        saleLineId: item.lineId,
        quantityReturned: item.quantity,
      })),
      reason,
      notes: notes.trim() || undefined,
      refundMethod,
      requestedBy: activeUser.name,
      approvedBy: supervisor.name,
    });

    if (!res.ok) {
      setErrorMsg(res.error ?? 'Error al procesar devolución.');
      return;
    }

    showNotification(
      'Devolución ejecutada',
      `Reverso ${res.returnRecord?.return_number} procesado por $${res.returnRecord?.total_refunded_usd.toFixed(2)} USD. Existencias restituidas [mock].`,
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
                    {MOCK_USERS.filter((u) => u.role === 'pos_supervisor' || u.role === 'pos_store_admin').map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
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
                    maxLength={6}
                    required
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    placeholder="PIN de 4 a 6 dígitos"
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
                className="mt-6 w-full rounded-2xl bg-[#B91C1C] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#991B1B]"
              >
                Ejecutar devolución y restituir existencias
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
