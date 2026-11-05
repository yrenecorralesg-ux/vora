'use client';

import React, { useState } from 'react';
import { Search, FileText, RotateCcw, ArrowLeft, Filter, DollarSign, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';
import type { PosSale } from '@/lib/types';

export function PosView13History() {
  const { sales, activeUser, activeBranch, registers, setLastConfirmedSale, navigateTo, shifts, activeShift, showNotification } = usePos();

  const [selectedRegister, setSelectedRegister] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedCashier, setSelectedCashier] = useState<string>(activeUser.role === 'pos_cashier' ? activeUser.id : 'all');
  const [commercialStatus, setCommercialStatus] = useState<string>('all');
  const [paymentStatus, setPaymentStatus] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal de Abono de Cuenta por Cobrar (CxC)
  const [debtSale, setDebtSale] = useState<PosSale | null>(null);
  const [paymentAmountUsd, setPaymentAmountUsd] = useState<string>('');
  const [debtPayMethod, setDebtPayMethod] = useState<'efectivo' | 'pago_movil' | 'tarjeta'>('efectivo');
  const [debtRef, setDebtRef] = useState<string>('');
  const [debtNotes, setDebtNotes] = useState<string>('Abono en mostrador [mock]');

  const filteredSales = sales.filter((s) => {
    if (selectedRegister !== 'all' && s.register_id !== selectedRegister) return false;
    if (selectedShift !== 'all' && s.shift_id !== selectedShift) return false;
    if (selectedCashier !== 'all' && s.cashier_user_id !== selectedCashier) return false;
    if (commercialStatus !== 'all' && s.commercial_status !== commercialStatus) return false;
    if (paymentStatus !== 'all' && s.payment_status !== paymentStatus) return false;
    if (paymentMethod !== 'all') {
      const hasMethod = s.payments?.some((p) => p.method === paymentMethod);
      if (!hasMethod) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = s.sale_number.toLowerCase().includes(q);
      const matchCust = s.customer?.legal_name.toLowerCase().includes(q);
      const matchDoc = s.customer?.document_number.includes(q);
      if (!matchNum && !matchCust && !matchDoc) return false;
    }
    return true;
  });

  const handleOpenDocument = (sale: PosSale) => {
    setLastConfirmedSale(sale);
    navigateTo('POS-12');
  };

  const handleStartReturn = (sale: PosSale) => {
    setLastConfirmedSale(sale);
    navigateTo('POS-14');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera con Bordes Redondeados */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">
            Historial de Ventas y Comprobantes
          </h1>
          <p className="mt-1 text-xs text-[#52635A]">
            Trazabilidad completa por caja, cajero y métodos de cobro en {activeBranch.name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <span className="font-bold text-[#111827]">{filteredSales.length} operaciones</span>
            <p className="text-[10px] text-[#52635A]">registradas</p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('POS-01')}
            className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
          >
            Volver a inicio
          </button>
        </div>
      </div>

      {/* Barra de Filtros Combinables */}
      <div className="rounded-2xl border border-[#DCE3DF] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 text-xs">
          {/* Buscador */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-[#52635A]">
              Buscar operación o cliente
            </label>
            <div className="mt-1 flex items-center rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-2.5 py-1.5">
              <Search className="h-4 w-4 text-[#52635A] mr-1.5" />
              <input
                type="text"
                placeholder="VTA-..., cliente o RIF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-[#111827] outline-none"
              />
            </div>
          </div>

          {/* Caja */}
          <div>
            <label className="block text-[10px] font-bold text-[#52635A]">
              Caja
            </label>
            <select
              value={selectedRegister}
              onChange={(e) => setSelectedRegister(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-2 text-xs font-semibold text-[#111827]"
            >
              <option value="all">Todas las cajas</option>
              {registers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Turno */}
          <div>
            <label className="block text-[10px] font-bold text-[#52635A]">
              Turno de Caja
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-2 text-xs font-semibold text-[#111827]"
            >
              <option value="all">Todos los turnos</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id.slice(0, 8)}... ({s.cashier_name_snapshot?.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>

          {/* Estado Comercial */}
          <div>
            <label className="block text-[10px] font-bold text-[#52635A]">
              Estado Comercial
            </label>
            <select
              value={commercialStatus}
              onChange={(e) => setCommercialStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-2 text-xs font-semibold text-[#111827]"
            >
              <option value="all">Todos los estados</option>
              <option value="confirmada">Confirmada</option>
              <option value="parcialmente_devuelta">Parcialmente devuelta</option>
              <option value="devuelta">Devuelta</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>

          {/* Estado de Cobro */}
          <div>
            <label className="block text-[10px] font-bold text-[#52635A]">
              Estado de Cobro / CxC
            </label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-2 text-xs font-semibold text-[#111827]"
            >
              <option value="all">Todos los cobros</option>
              <option value="pagada">Pagada completa</option>
              <option value="parcial">Parcial (Saldo CxC)</option>
              <option value="pendiente">Pendiente (A crédito)</option>
            </select>
          </div>

          {/* Método de Pago */}
          <div>
            <label className="block text-[10px] font-bold text-[#52635A]">
              Método de Pago
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] p-2 text-xs font-semibold text-[#111827]"
            >
              <option value="all">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="pago_movil">Pago Móvil</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="cashea">Cashea</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla Detallada con Bordes Redondeados */}
      <div className="overflow-x-auto rounded-3xl border border-[#DCE3DF] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E5E9E7] bg-[#F6F5F0] text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
              <th className="py-3.5 px-4">Número de Venta</th>
              <th className="py-3.5 px-4">Fecha y Hora</th>
              <th className="py-3.5 px-4">Cliente</th>
              <th className="py-3.5 px-4 text-right">Total USD</th>
              <th className="py-3.5 px-4 text-right">Total VES</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-center">Cobro / CxC</th>
              <th className="py-3.5 px-4 text-center">Fiscal</th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E9E7]">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#52635A]">
                  No se encontraron ventas que coincidan con los criterios seleccionados.
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-[#F6F5F0]/60 transition">
                  <td className="py-3 px-4 font-bold text-[#111827]">
                    {sale.sale_number}
                  </td>
                  <td className="py-3 px-4 text-[#52635A]">
                    {new Date(sale.confirmed_at ?? sale.created_at).toLocaleString('es-VE')}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-[#111827]">
                      {sale.customer ? sale.customer.legal_name : 'Consumidor Final'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-[#111827]">
                    ${sale.total_usd.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[#92400E]">
                    {sale.total_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        sale.commercial_status === 'confirmada'
                          ? 'bg-[#DCFCE7] text-[#14532D]'
                          : sale.commercial_status === 'anulada'
                          ? 'bg-[#FEF2F2] text-[#B91C1C]'
                          : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}
                    >
                      {sale.commercial_status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {sale.balance_due_usd > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                        CxC: ${sale.balance_due_usd.toFixed(2)} USD
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> Pagada
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        sale.fiscal_request?.status === 'emitido'
                          ? 'bg-[#DCFCE7] text-[#14532D]'
                          : sale.fiscal_request?.status === 'por_revisar'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : 'bg-[#F6F5F0] text-[#52635A]'
                      }`}
                    >
                      {sale.fiscal_request?.status ?? 'No emitido'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDocument(sale)}
                        className="rounded-xl border border-[#1E6B4E] bg-white px-3 py-1 text-[10px] font-bold text-[#1E6B4E] hover:bg-[#DCFCE7]"
                      >
                        Ver PDF
                      </button>

                      {sale.balance_due_usd > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDebtSale(sale);
                            setPaymentAmountUsd(sale.balance_due_usd.toFixed(2));
                          }}
                          className="rounded-xl border border-[#D97706] bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-bold text-[#92400E] hover:bg-[#FDE68A]"
                        >
                          Abonar CxC
                        </button>
                      )}

                      {sale.commercial_status !== 'anulada' && sale.commercial_status !== 'devuelta' && (
                        <button
                          type="button"
                          onClick={() => handleStartReturn(sale)}
                          className="rounded-xl border border-[#C83E3B] bg-white px-3 py-1 text-[10px] font-bold text-[#B91C1C] hover:bg-[#FEF2F2]"
                        >
                          Devolver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Abono a Cuenta por Cobrar (CxC) */}
      {debtSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Abono a Cuenta por Cobrar (CxC)
                </h3>
                <p className="text-[11px] text-[#52635A]">
                  Venta: {debtSale.sale_number} | Cliente: {debtSale.customer?.legal_name ?? 'Consumidor'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDebtSale(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-[#FEF3C7] p-3 text-xs text-[#92400E] space-y-1">
              <div className="flex justify-between">
                <span>Total de la venta:</span>
                <span className="font-bold">${debtSale.total_usd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span>Total pagado hasta ahora:</span>
                <span className="font-bold">${debtSale.paid_total_usd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between border-t border-[#FDE68A] pt-1 text-sm font-black">
                <span>Saldo pendiente:</span>
                <span>${debtSale.balance_due_usd.toFixed(2)} USD</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amount = Number(paymentAmountUsd);
                if (isNaN(amount) || amount <= 0) {
                  showNotification('Monto inválido', 'Ingrese un monto mayor a cero.', 'alert');
                  return;
                }
                const currentShiftId = activeShift?.id ?? debtSale.shift_id;
                const res = posStore.recordDebtPayment({
                  saleId: debtSale.id,
                  shiftId: currentShiftId,
                  amountUsd: amount,
                  amountVes: Number((amount * debtSale.exchange_rate_snapshot).toFixed(2)),
                  paymentMethod: debtPayMethod,
                  reference: debtRef || undefined,
                  notes: debtNotes,
                  performedBy: activeUser.id,
                });
                if (res.ok) {
                  showNotification(
                    'Abono Registrado',
                    `Abono de $${amount.toFixed(2)} USD procesado con éxito [mock]. Saldo restante: $${res.sale?.balance_due_usd.toFixed(2)} USD.`,
                    'success',
                  );
                  setDebtSale(null);
                  setPaymentAmountUsd('');
                } else {
                  showNotification('Error', res.error || 'Error al procesar abono.', 'critical');
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">
                  Monto a Abonar (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={debtSale.balance_due_usd}
                  required
                  value={paymentAmountUsd}
                  onChange={(e) => setPaymentAmountUsd(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2.5 text-sm font-bold text-[#111827]"
                />
                <span className="mt-0.5 block text-[10px] text-[#52635A]">
                  Equivalente: ~{(Number(paymentAmountUsd || 0) * debtSale.exchange_rate_snapshot).toLocaleString('es-VE')} VES
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">
                  Método de Cobro
                </label>
                <select
                  value={debtPayMethod}
                  onChange={(e) => setDebtPayMethod(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs font-semibold"
                >
                  <option value="efectivo">Efectivo (Ingresa a gaveta de caja)</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="tarjeta">Tarjeta de Débito / POS</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">
                  Referencia bancaria / recibo (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: REF-987654"
                  value={debtRef}
                  onChange={(e) => setDebtRef(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">
                  Notas de cobranza
                </label>
                <input
                  type="text"
                  value={debtNotes}
                  onChange={(e) => setDebtNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-[#E5E9E7] pt-4">
                <button
                  type="button"
                  onClick={() => setDebtSale(null)}
                  className="rounded-xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#144D37] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E6B4E]"
                >
                  Registrar abono de CxC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
