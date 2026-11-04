'use client';

import React, { useState } from 'react';
import {
  Banknote,
  Smartphone,
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';

function CasheaIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="6" fill="#FFD200" />
      <path
        d="M16 8.5C15.1 7.5 13.7 7 12.2 7C9.3 7 7 9.2 7 12C7 14.8 9.3 17 12.2 17C13.7 17 15.1 16.5 16 15.5"
        stroke="#111827"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PosView06Checkout() {
  const {
    cart,
    cartNotes,
    selectedCustomer,
    discountAuthorizedBy,
    activeBranch,
    activeUser,
    activeRegister,
    activeShift,
    exchangeRate,
    navigateTo,
    clearCart,
    setLastConfirmedSale,
    showNotification,
    isFuncActive,
  } = usePos();

  // Pagos aplicados a esta operación
  const [appliedPayments, setAppliedPayments] = useState<Array<{
    method: 'efectivo' | 'pago_movil' | 'tarjeta' | 'cashea';
    currency: 'USD' | 'VES';
    amountReceived: number;
    amountApplied: number;
    changeAmount: number;
    changeCurrency?: 'USD' | 'VES';
    referenceNumber?: string;
    bankCode?: string;
    bankName?: string;
    payerPhone?: string;
    payerDocument?: string;
    terminalId?: string;
    cardLast4?: string;
    approvalCode?: string;
    casheaOperationId?: string;
    casheaMerchantAmount?: number;
    providerStatus: 'registrado' | 'pendiente_verificacion' | 'verificado';
  }>>([]);

  const [activeTab, setActiveTab] = useState<'efectivo' | 'pago_movil' | 'tarjeta' | 'cashea'>('efectivo');

  // Total de la Venta
  const totalUsd = cart.reduce((sum, item) => sum + item.lineTotalUsd, 0);
  const totalVes = Number((totalUsd * exchangeRate).toFixed(2));

  // Totales Abonados
  const totalPaidUsd = appliedPayments.reduce((sum, p) => {
    return sum + (p.currency === 'USD' ? p.amountApplied : p.amountApplied / exchangeRate);
  }, 0);
  const totalPaidVes = Number((totalPaidUsd * exchangeRate).toFixed(2));

  const totalChangeUsd = appliedPayments.reduce((sum, p) => {
    return sum + (p.changeCurrency === 'USD' ? p.changeAmount : p.changeAmount / exchangeRate);
  }, 0);

  const balanceDueUsd = Math.max(0, Number((totalUsd - totalPaidUsd).toFixed(2)));
  const balanceDueVes = Math.max(0, Number((balanceDueUsd * exchangeRate).toFixed(2)));

  // Inputs Efectivo
  const [cashCurrency, setCashCurrency] = useState<'USD' | 'VES'>('USD');
  const [cashReceived, setCashReceived] = useState<string>(balanceDueUsd.toFixed(2));
  const [cashChangeCurrency, setCashChangeCurrency] = useState<'USD' | 'VES'>('USD');

  // Inputs Pago Móvil
  const [pmBank, setPmBank] = useState('0102 - Banco de Venezuela');
  const [pmAmountVes, setPmAmountVes] = useState<string>(balanceDueVes.toFixed(2));
  const [pmReference, setPmReference] = useState('');
  const [pmPayerPhone, setPmPayerPhone] = useState(selectedCustomer?.phone ?? '0414-1234567');
  const [pmPayerDoc, setPmPayerDoc] = useState(selectedCustomer?.document_number ?? '12345678');
  const [pmStatus, setPmStatus] = useState<'registrado' | 'pendiente_verificacion' | 'verificado'>('verificado');
  const [pmSubMode, setPmSubMode] = useState<'p2p' | 'c2p'>('p2p');
  const [c2pToken, setC2pToken] = useState('');
  const [c2pLoading, setC2pLoading] = useState(false);

  // Inputs Tarjeta
  const [cardTerminal, setCardTerminal] = useState('POS-Banesco-01 [mock]');
  const [cardAmountVes, setCardAmountVes] = useState<string>(balanceDueVes.toFixed(2));
  const [cardLast4, setCardLast4] = useState('');
  const [cardApproval, setCardApproval] = useState('');

  // Inputs Cashea
  const [casheaAmountUsd, setCasheaAmountUsd] = useState<string>(balanceDueUsd.toFixed(2));
  const [casheaMerchantAmountUsd, setCasheaMerchantAmountUsd] = useState<string>((balanceDueUsd * 0.95).toFixed(2));
  const [casheaOpId, setCasheaOpId] = useState(`CSH-${Date.now().toString().slice(-6)}`);
  const [casheaCustomerDoc, setCasheaCustomerDoc] = useState<string>(selectedCustomer?.document_number || '');
  const [casheaIntent, setCasheaIntent] = useState<any | null>(null);
  const [generatingCashea, setGeneratingCashea] = useState(false);

  const handleGenerateCasheaIntent = async () => {
    const amount = parseFloat(casheaAmountUsd);
    if (isNaN(amount) || amount < 25) {
      showNotification('Monto inválido', 'Cashea exige un monto mínimo de $25.00 USD.', 'critical');
      return;
    }
    if (!casheaCustomerDoc.trim()) {
      showNotification('Cédula requerida', 'Ingrese la cédula del cliente para generar la orden en Cashea.', 'critical');
      return;
    }

    setGeneratingCashea(true);
    try {
      const res = await fetch('/api/t/test1/pos/cashea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_intent',
          amountUsd: amount,
          customerDocument: casheaCustomerDoc.trim(),
          saleId: `sale-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.ok && data.intent) {
        setCasheaIntent(data.intent);
        setCasheaOpId(data.intent.operationId);
        setCasheaMerchantAmountUsd(data.intent.merchantPayoutUsd.toString());
        showNotification('Orden Cashea creada', data.message, 'success');
      } else {
        showNotification('Error Cashea', data.message || 'No se pudo crear orden', 'critical');
      }
    } catch (err: any) {
      showNotification('Error Cashea', err.message, 'critical');
    } finally {
      setGeneratingCashea(false);
    }
  };

  // Agregar Efectivo
  const handleAddCash = (e: React.FormEvent) => {
    e.preventDefault();
    const received = parseFloat(cashReceived);
    if (isNaN(received) || received <= 0) return;

    let applied = 0;
    let change = 0;

    if (cashCurrency === 'USD') {
      applied = Math.min(received, balanceDueUsd);
      const excess = received - applied;
      if (excess > 0) {
        change = cashChangeCurrency === 'USD' ? excess : excess * exchangeRate;
      }
    } else {
      applied = Math.min(received, balanceDueVes);
      const excess = received - applied;
      if (excess > 0) {
        change = cashChangeCurrency === 'VES' ? excess : excess / exchangeRate;
      }
    }

    setAppliedPayments([
      ...appliedPayments,
      {
        method: 'efectivo',
        currency: cashCurrency,
        amountReceived: received,
        amountApplied: Number(applied.toFixed(2)),
        changeAmount: Number(change.toFixed(2)),
        changeCurrency: cashChangeCurrency,
        providerStatus: 'verificado',
      },
    ]);
  };

  // Agregar Pago Móvil
  const handleAddPagoMovil = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(pmAmountVes);
    if (isNaN(amount) || amount <= 0 || !pmReference.trim()) return;

    setAppliedPayments([
      ...appliedPayments,
      {
        method: 'pago_movil',
        currency: 'VES',
        amountReceived: amount,
        amountApplied: amount,
        changeAmount: 0,
        referenceNumber: pmReference.trim(),
        bankName: pmBank,
        payerPhone: pmPayerPhone.trim(),
        payerDocument: pmPayerDoc.trim(),
        providerStatus: pmStatus,
      },
    ]);
    setPmReference('');
  };

  // Cobro C2P (Comercio a Personas - Débito Inmediato)
  const handleChargeC2P = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(pmAmountVes);
    if (isNaN(amount) || amount <= 0) return;
    if (!c2pToken.trim() || c2pToken.trim().length < 6) {
      showNotification('Token inválido', 'Ingrese la clave dinámica de 6 a 8 dígitos provista por el cliente.', 'critical');
      return;
    }

    setC2pLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const ref = `C2P-${Math.floor(100000 + Math.random() * 900000)}`;
    setAppliedPayments([
      ...appliedPayments,
      {
        method: 'pago_movil',
        currency: 'VES',
        amountReceived: amount,
        amountApplied: amount,
        changeAmount: 0,
        referenceNumber: ref,
        bankName: `${pmBank} (C2P Inmediato)`,
        payerPhone: pmPayerPhone.trim(),
        payerDocument: pmPayerDoc.trim(),
        providerStatus: 'verificado',
      },
    ]);
    setC2pToken('');
    setC2pLoading(false);
    showNotification('Cobro C2P Aprobado', `Débito inmediato exitoso con referencia ${ref}.`, 'success');
  };

  // Agregar Tarjeta
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cardAmountVes);
    if (isNaN(amount) || amount <= 0 || !cardApproval.trim()) return;

    setAppliedPayments([
      ...appliedPayments,
      {
        method: 'tarjeta',
        currency: 'VES',
        amountReceived: amount,
        amountApplied: amount,
        changeAmount: 0,
        terminalId: cardTerminal,
        cardLast4: cardLast4.trim() || '1234',
        approvalCode: cardApproval.trim(),
        providerStatus: 'verificado',
      },
    ]);
    setCardApproval('');
  };

  // Agregar Cashea
  const handleAddCashea = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(casheaAmountUsd);
    if (isNaN(amount) || amount <= 0 || !casheaOpId.trim()) return;

    setAppliedPayments([
      ...appliedPayments,
      {
        method: 'cashea',
        currency: 'USD',
        amountReceived: amount,
        amountApplied: amount,
        changeAmount: 0,
        casheaOperationId: casheaOpId.trim(),
        casheaMerchantAmount: parseFloat(casheaMerchantAmountUsd) || amount * 0.95,
        providerStatus: 'pendiente_verificacion',
      },
    ]);
  };

  const handleRemovePayment = (idx: number) => {
    setAppliedPayments(appliedPayments.filter((_, i) => i !== idx));
  };

  // Confirmación Atómica
  const handleConfirmSale = () => {
    if (!activeShift || activeShift.status !== 'abierto') {
      showNotification('Turno cerrado', 'Debe existir un turno abierto para confirmar la venta.', 'critical');
      navigateTo('POS-02');
      return;
    }

    if (cart.length === 0) {
      showNotification('Carrito vacío', 'No hay productos en el carrito.', 'alert');
      navigateTo('POS-03-04');
      return;
    }

    if (balanceDueUsd > 0.05) {
      showNotification(
        'Saldo pendiente',
        `Resta por cobrar $${balanceDueUsd.toFixed(2)} USD para completar el total de la venta.`,
        'alert',
      );
      return;
    }

    const idempotencyKey = `sale-${activeRegister.id}-${Date.now()}`;

    const saleResult = posStore.confirmSale({
      branchId: activeBranch.id,
      shiftId: activeShift.id,
      registerId: activeRegister.id,
      cashierUserId: activeUser.id,
      customerId: selectedCustomer?.id,
      idempotencyKey,
      correlationId: `corr-${Date.now()}`,
      lines: cart.map((c) => ({
        productId: c.productId,
        name: c.name,
        sku: c.sku,
        quantity: c.quantity,
        unitPriceUsd: c.unitPriceUsd,
        discountPercent: c.discountPercent,
        discountAmountUsd: (c.unitPriceUsd * (c.discountPercent / 100)) * c.quantity,
        taxRatePercent: c.taxRatePercent,
        taxAmountUsd: (c.unitPriceUsd * (1 - c.discountPercent / 100)) * (c.taxRatePercent / 100) * c.quantity,
        lineSubtotalUsd: c.unitPriceUsd * c.quantity,
        lineTotalUsd: c.lineTotalUsd,
        isService: c.isService,
      })),
      payments: appliedPayments.map((p) => ({
        method: p.method,
        currency: p.currency,
        amountReceived: p.amountReceived,
        amountApplied: p.amountApplied,
        changeAmount: p.changeAmount,
        changeCurrency: p.changeCurrency,
        referenceNumber: p.referenceNumber,
        bankName: p.bankName,
        cardLast4: p.cardLast4,
        approvalCode: p.approvalCode,
        casheaOperationId: p.casheaOperationId,
        providerStatus: p.providerStatus,
      })),
      notes: cartNotes || undefined,
      discountAuthorizationId: discountAuthorizedBy ?? undefined,
    });

    if (!saleResult.ok || !saleResult.sale) {
      showNotification('Error en confirmación', saleResult.error ?? 'Fallo al confirmar la venta.', 'critical');
      return;
    }

    setLastConfirmedSale(saleResult.sale);
    clearCart();
    showNotification('Venta confirmada', `Operación ${saleResult.sale.sale_number} procesada con éxito.`, 'success');
    navigateTo('POS-11');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera del Checkout con Bordes Redondeados Suaves */}
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E9E7]">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Cobro y pagos mixtos</h1>
            <p className="mt-0.5 text-xs text-[#52635A]">
              Cliente: <strong className="text-[#111827]">{selectedCustomer?.legal_name ?? 'Consumidor Final'}</strong> · Tasa: 36,50 VES/USD
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('POS-03-04')}
            className="flex items-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al carrito</span>
          </button>
        </div>

        {/* 4 Métricas de Balance con Bordes Curvos */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-4">
            <span className="text-[10px] font-bold uppercase text-[#52635A]">Total general</span>
            <p className="mt-1 text-lg font-black text-[#111827]">${totalUsd.toFixed(2)} USD</p>
            <p className="text-[10px] text-[#52635A]">{totalVes.toLocaleString('es-VE')} VES</p>
          </div>

          <div className="rounded-2xl border border-[#86EFAC] bg-[#DCFCE7] p-4">
            <span className="text-[10px] font-bold uppercase text-[#14532D]">Abonado</span>
            <p className="mt-1 text-lg font-black text-[#14532D]">${totalPaidUsd.toFixed(2)} USD</p>
            <p className="text-[10px] text-[#14532D]">{totalPaidVes.toLocaleString('es-VE')} VES</p>
          </div>

          <div
            className={`rounded-2xl border p-4 ${balanceDueUsd > 0 ? 'border-[#FDE68A] bg-[#FEF3C7]' : 'border-[#86EFAC] bg-[#DCFCE7]'
              }`}
          >
            <span className="text-[10px] font-bold uppercase text-[#92400E]">Pendiente</span>
            <p className="mt-1 text-lg font-black text-[#92400E]">${balanceDueUsd.toFixed(2)} USD</p>
            <p className="text-[10px] text-[#92400E]">{balanceDueVes.toLocaleString('es-VE')} VES</p>
          </div>

          <div className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-4">
            <span className="text-[10px] font-bold uppercase text-[#52635A]">Vuelto</span>
            <p className="mt-1 text-lg font-black text-[#111827]">${totalChangeUsd.toFixed(2)} USD</p>
            <p className="text-[10px] text-[#52635A]">
              {(totalChangeUsd * exchangeRate).toLocaleString('es-VE')} VES
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Formularios de Pago y Desglose */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Formularios de Métodos (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            {/* Pestañas Redondeadas de Métodos */}
            <div className="flex gap-2 border-b border-[#E5E9E7] pb-3 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('efectivo')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-bold transition ${activeTab === 'efectivo'
                  ? 'bg-[#1E6B4E] text-white shadow-xs'
                  : 'bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]'
                  }`}
              >
                <Banknote className="h-4 w-4" />
                <span>Efectivo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pago_movil')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-bold transition ${activeTab === 'pago_movil'
                  ? 'bg-[#1E6B4E] text-white shadow-xs'
                  : 'bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]'
                  }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>Pago Móvil</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tarjeta')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-bold transition ${activeTab === 'tarjeta'
                  ? 'bg-[#1E6B4E] text-white shadow-xs'
                  : 'bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]'
                  }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>Tarjeta</span>
              </button>
              {isFuncActive('pos_cashea') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('cashea')}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 font-bold transition ${
                    activeTab === 'cashea'
                      ? 'bg-[#1E6B4E] text-white shadow-xs'
                      : 'bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]'
                  }`}
                >
                  <CasheaIcon className="h-4 w-4 shrink-0" />
                  <span>Cashea</span>
                </button>
              )}
            </div>

            {/* Panel: Efectivo */}
            {activeTab === 'efectivo' && (
              <form onSubmit={handleAddCash} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Moneda recibida
                    </label>
                    <select
                      value={cashCurrency}
                      onChange={(e) => {
                        const cur = e.target.value as 'USD' | 'VES';
                        setCashCurrency(cur);
                        setCashReceived(cur === 'USD' ? balanceDueUsd.toFixed(2) : balanceDueVes.toFixed(2));
                      }}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-bold text-[#111827]"
                    >
                      <option value="USD">Dólares Estadounidenses (USD)</option>
                      <option value="VES">Bolívares Digitales (VES)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Monto físico recibido
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                    Moneda para entrega del vuelto
                  </label>
                  <select
                    value={cashChangeCurrency}
                    onChange={(e) => setCashChangeCurrency(e.target.value as any)}
                    className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-bold text-[#111827]"
                  >
                    <option value="USD">Entregar vuelto en Dólares (USD)</option>
                    <option value="VES">Entregar vuelto en Bolívares (VES)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B]"
                >
                  Confirmar recepción de efectivo y vuelto
                </button>
              </form>
            )}

            {/* Panel: Pago Móvil */}
            {activeTab === 'pago_movil' && (
              <div className="mt-5 space-y-4">
                {/* Selector de Modalidad P2P / C2P */}
                <div className="flex rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPmSubMode('p2p')}
                    className={`flex-1 rounded-xl py-2 font-bold transition ${
                      pmSubMode === 'p2p'
                        ? 'bg-white text-[#111827] shadow-xs'
                        : 'text-[#52635A] hover:text-[#111827]'
                    }`}
                  >
                    P2P Tradicional (Comprobante)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPmSubMode('c2p')}
                    className={`flex-1 rounded-xl py-2 font-bold transition ${
                      pmSubMode === 'c2p'
                        ? 'bg-[#1E6B4E] text-white shadow-xs'
                        : 'text-[#52635A] hover:text-[#111827]'
                    }`}
                  >
                    C2P Débito Inmediato (Token OTP)
                  </button>
                </div>

                {pmSubMode === 'p2p' ? (
                  <form onSubmit={handleAddPagoMovil} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Banco receptor
                        </label>
                        <select
                          value={pmBank}
                          onChange={(e) => setPmBank(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold text-[#111827]"
                        >
                          <option value="0102 - Banco de Venezuela">0102 - Banco de Venezuela</option>
                          <option value="0134 - Banesco">0134 - Banesco</option>
                          <option value="0108 - Banco Provincial">0108 - Banco Provincial</option>
                          <option value="0105 - Mercantil">0105 - Mercantil</option>
                          <option value="0172 - Bancamiga">0172 - Bancamiga</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Monto en Bolívares (VES)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={pmAmountVes}
                          onChange={(e) => setPmAmountVes(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Número de referencia
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Últimos 4 a 8 dígitos"
                          value={pmReference}
                          onChange={(e) => setPmReference(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Teléfono pagador
                        </label>
                        <input
                          type="text"
                          required
                          value={pmPayerPhone}
                          onChange={(e) => setPmPayerPhone(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B]"
                    >
                      Incorporar declaración de Pago Móvil P2P
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleChargeC2P} className="space-y-4">
                    <div className="rounded-2xl border border-[#DCFCE7] bg-[#F0FDF4] p-3 text-xs text-[#15803D]">
                      💡 El comercio debita directamente la cuenta del cliente solicitándole el <strong>Token OTP SMS</strong> generado en su banco.
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Banco del cliente
                        </label>
                        <select
                          value={pmBank}
                          onChange={(e) => setPmBank(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold text-[#111827]"
                        >
                          <option value="0102 - Banco de Venezuela">0102 - Banco de Venezuela</option>
                          <option value="0134 - Banesco">0134 - Banesco</option>
                          <option value="0108 - Banco Provincial">0108 - Banco Provincial</option>
                          <option value="0105 - Mercantil">0105 - Mercantil</option>
                          <option value="0172 - Bancamiga">0172 - Bancamiga</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Monto a debitar (VES)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={pmAmountVes}
                          onChange={(e) => setPmAmountVes(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Cédula del cliente
                        </label>
                        <input
                          type="text"
                          required
                          value={pmPayerDoc}
                          onChange={(e) => setPmPayerDoc(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                          Teléfono afiliado
                        </label>
                        <input
                          type="text"
                          required
                          value={pmPayerPhone}
                          onChange={(e) => setPmPayerPhone(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#1E6B4E]">
                          Token OTP / Clave SMS
                        </label>
                        <input
                          type="password"
                          maxLength={8}
                          required
                          placeholder="6 a 8 dígitos"
                          value={c2pToken}
                          onChange={(e) => setC2pToken(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[#1E6B4E] p-3 text-xs font-bold text-[#111827]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={c2pLoading}
                      className="w-full rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B] disabled:opacity-50"
                    >
                      {c2pLoading ? 'Procesando débito interbancario...' : 'Ejecutar débito C2P Inmediato'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Panel: Tarjeta */}
            {activeTab === 'tarjeta' && (
              <form onSubmit={handleAddCard} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Terminal punto de venta
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={cardTerminal}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Monto cobrado en VES
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={cardAmountVes}
                      onChange={(e) => setCardAmountVes(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Código de aprobación
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 054231"
                      value={cardApproval}
                      onChange={(e) => setCardApproval(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Últimos 4 dígitos de tarjeta
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="****"
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B]"
                >
                  Registrar cobro con tarjeta
                </button>
              </form>
            )}

            {/* Panel: Cashea */}
            {activeTab === 'cashea' && (
              <div className="mt-5 space-y-4">
                {/* Badge de Terminal Oficial */}
                <div className="flex items-center justify-between rounded-2xl border border-[#FEF3C7] bg-[#FFFBEB] p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CasheaIcon className="h-4 w-4 shrink-0" />
                    <div>
                      <span className="font-bold text-[#92400E]">Stunt Riders Av Principal Dalla Costa 1</span>
                      <p className="text-[10px] text-[#B45309] font-mono">UUID: e9f8cc2a-1458-4f19-bf22-27462a5b6fe4</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#10B981] px-2 py-0.5 text-[10px] font-bold text-white">
                    Caja Activa
                  </span>
                </div>

                {parseFloat(casheaAmountUsd) < 25 && (
                  <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-3 text-xs text-[#92400E]">
                    ⚠️ El monto mínimo financiable con Cashea es de <strong>$25.00 USD</strong>.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Cédula / Documento del Cliente
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 18492041"
                      value={casheaCustomerDoc}
                      onChange={(e) => setCasheaCustomerDoc(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                      Monto a Financiar (USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="25"
                      required
                      value={casheaAmountUsd}
                      onChange={(e) => {
                        setCasheaAmountUsd(e.target.value);
                        setCasheaMerchantAmountUsd((parseFloat(e.target.value || '0') * 0.95).toFixed(2));
                      }}
                      className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={generatingCashea || parseFloat(casheaAmountUsd) < 25 || !casheaCustomerDoc.trim()}
                    onClick={handleGenerateCasheaIntent}
                    className="flex-1 rounded-2xl border border-[#111827] bg-[#111827] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1E293B] disabled:opacity-40"
                  >
                    {generatingCashea ? 'Generando orden...' : '1. Generar Cobro QR Cashea'}
                  </button>
                </div>

                {/* Si se generó la intención QR */}
                {casheaIntent && (
                  <div className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] p-4 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#14532D]">
                        Orden generada: {casheaIntent.operationId}
                      </span>
                      <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[10px] font-bold text-[#15803D]">
                        Escaneo de cliente
                      </span>
                    </div>

                    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-[#DCFCE7]">
                      <div className="h-20 w-20 bg-[#111827] rounded-lg flex flex-col items-center justify-center text-white text-[10px] text-center p-1 shrink-0">
                        <QrCode className="h-10 w-10 text-[#FFD200]" />
                        <span>Escaneo App</span>
                      </div>
                      <div className="text-[11px] space-y-1">
                        <p className="text-[#111827] font-semibold">Cliente: {casheaIntent.customerDocument}</p>
                        <p className="text-[#111827] font-bold">Total financiado: ${casheaIntent.amountUsd.toFixed(2)} USD</p>
                        <p className="text-[#52635A]">Liquidación a comercio (95%): ${casheaIntent.merchantPayoutUsd.toFixed(2)} USD</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const amount = parseFloat(casheaAmountUsd);
                        setAppliedPayments([
                          ...appliedPayments,
                          {
                            method: 'cashea',
                            currency: 'USD',
                            amountReceived: amount,
                            amountApplied: amount,
                            changeAmount: 0,
                            casheaOperationId: casheaIntent.operationId,
                            casheaMerchantAmount: casheaIntent.merchantPayoutUsd,
                            providerStatus: 'verificado',
                          },
                        ]);
                        setCasheaIntent(null);
                        showNotification('Pago Cashea Verificado', `Operación ${casheaIntent.operationId} confirmada en mostrador.`, 'success');
                      }}
                      className="w-full rounded-xl bg-[#1E6B4E] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B]"
                    >
                      2. Confirmar Aprobación del Cliente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pagos Aplicados y Confirmación (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#111827]">
              Pagos registrados en la venta
            </h2>

            <div className="mt-4 space-y-2.5">
              {appliedPayments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCE3DF] p-6 text-center text-xs text-[#52635A]">
                  Aún no se han incorporado pagos a esta venta.
                </div>
              ) : (
                appliedPayments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-3.5 text-xs shadow-2xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold uppercase text-[#111827]">{p.method}</span>
                        <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[9px] font-bold uppercase text-[#14532D]">
                          {p.providerStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#52635A]">
                        {p.referenceNumber ? `Ref: ${p.referenceNumber}` : 'Sin ref'}
                        {p.cardLast4 ? ` · ****${p.cardLast4}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-extrabold text-[#111827]">
                          {p.amountApplied.toFixed(2)} {p.currency}
                        </span>
                        {p.changeAmount > 0 && (
                          <p className="text-[10px] font-semibold text-[#92400E]">
                            Vuelto: {p.changeAmount.toFixed(2)} {p.changeCurrency}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePayment(idx)}
                        className="p-1 text-[#52635A] hover:text-[#B91C1C]"
                        title="Eliminar pago"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Botón de Confirmación Definitiva */}
            <div className="mt-6 border-t border-[#E5E9E7] pt-4 space-y-2">
              <button
                type="button"
                onClick={handleConfirmSale}
                className="w-full rounded-2xl bg-[#1E6B4E] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-[#16523B]"
              >
                Confirmar venta definitiva
              </button>

              <button
                type="button"
                onClick={() => navigateTo('POS-03-04')}
                className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] py-2.5 text-xs font-bold uppercase tracking-wider text-[#52635A] hover:bg-[#DCE3DF]"
              >
                Volver a edición de carrito
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
