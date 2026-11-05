'use client';

import React, { useState } from 'react';
import { CheckCircle2, FileText, ArrowRight, RefreshCw, Send, Tag, Wallet, UserCheck } from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';

export function PosView11ConfirmedSale() {
  const { lastConfirmedSale, navigateTo, showNotification, isFuncActive } = usePos();
  const [replayNotice, setReplayNotice] = useState<string | null>(null);

  if (!lastConfirmedSale) {
    return (
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-12 text-center text-xs text-[#52635A]">
        No hay ninguna venta confirmada recientemente en la sesión actual.
      </div>
    );
  }

  // Prueba Técnica de Idempotencia: Simular doble clic concurrente
  const handleSimulateIdempotentReplay = () => {
    const res = posStore.confirmSale({
      branchId: lastConfirmedSale.branch_id,
      shiftId: lastConfirmedSale.shift_id,
      registerId: lastConfirmedSale.register_id,
      cashierUserId: lastConfirmedSale.cashier_user_id,
      customerId: lastConfirmedSale.customer_id ?? undefined,
      correlationId: `recheck-${Date.now()}`,
      idempotencyKey: lastConfirmedSale.idempotency_key,
      lines: [],
      payments: [],
      notes: lastConfirmedSale.notes ?? undefined,
    });

    if (res.ok && res.idempotentReplay) {
      setReplayNotice(
        `Idempotencia exitosa comprobada: El backend reconoció la llave "${lastConfirmedSale.idempotency_key}" y devolvió la venta ${lastConfirmedSale.sale_number} sin duplicar cobros ni existencias [mock].`,
      );
      showNotification(
        'Idempotencia verificada',
        `Reintento bloqueado. Retornó la misma venta ${lastConfirmedSale.sale_number} [mock].`,
        'success',
      );
    }
  };

  const handleSendWhatsAppReceipt = () => {
    if (!lastConfirmedSale) return;
    const phone = lastConfirmedSale.customer?.phone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.startsWith('58')
      ? cleanPhone
      : cleanPhone.length === 10 || cleanPhone.length === 11
        ? `58${cleanPhone.replace(/^0/, '')}`
        : cleanPhone;

    let text = `*COMPROBANTE DE COMPRA - VORA POS*\n`;
    text += `*Venta Nº:* ${lastConfirmedSale.sale_number}\n`;
    text += `*Fecha:* ${new Date(lastConfirmedSale.confirmed_at ?? lastConfirmedSale.created_at).toLocaleString('es-VE')}\n`;
    text += `*Cliente:* ${lastConfirmedSale.customer?.legal_name ?? 'Consumidor Final'}\n`;
    if (lastConfirmedSale.sales_rep_name) {
      text += `*Asesor de Venta:* ${lastConfirmedSale.sales_rep_name}\n`;
    }
    if (lastConfirmedSale.applied_promotion_title) {
      text += `*Promoción:* ${lastConfirmedSale.applied_promotion_title}\n`;
    }
    text += `--------------------------------\n`;
    (lastConfirmedSale.lines ?? []).forEach((l) => {
      text += `• ${l.name_snapshot} x${l.quantity} = $${l.line_total_usd.toFixed(2)} USD\n`;
    });
    text += `--------------------------------\n`;
    text += `*TOTAL:* $${lastConfirmedSale.total_usd.toFixed(2)} USD (${lastConfirmedSale.total_ves.toLocaleString('es-VE')} VES)\n`;
    if (lastConfirmedSale.wallet_change_deposited_usd && lastConfirmedSale.wallet_change_deposited_usd > 0) {
      text += `*Vuelto en Billetera Digital:* $${lastConfirmedSale.wallet_change_deposited_usd.toFixed(2)} USD\n`;
    }
    if (lastConfirmedSale.wallet_used_usd && lastConfirmedSale.wallet_used_usd > 0) {
      text += `*Saldo a Favor aplicado:* -$${lastConfirmedSale.wallet_used_usd.toFixed(2)} USD\n`;
    }
    if (lastConfirmedSale.balance_due_usd > 0) {
      text += `*Saldo pendiente (Crédito):* $${lastConfirmedSale.balance_due_usd.toFixed(2)} USD\n`;
    }
    text += `\n_¡Gracias por su preferencia en VORA!_`;

    const url = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-8 text-center shadow-xl">
        {/* Ícono de Éxito Suave */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] text-[#1E6B4E]">
          <CheckCircle2 className="h-10 w-10 text-[#1E6B4E]" />
        </div>

        <h1 className="mt-4 text-2xl font-black text-[#111827]">
          ¡Venta registrada!
        </h1>
        <p className="mt-1 text-xs text-[#52635A]">
          La venta se ha procesado e imputado en el turno actual con éxito.
        </p>

        {/* Datos Principales de la Venta */}
        <div className="mt-6 rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-5 text-left text-xs space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-[#DCE3DF]">
            <span className="font-bold text-[#52635A]">Número de venta</span>
            <span className="text-base font-extrabold text-[#111827]">
              {lastConfirmedSale.sale_number}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#52635A]">Fecha y hora</span>
            <span className="font-semibold text-[#111827]">
              {new Date(lastConfirmedSale.confirmed_at ?? lastConfirmedSale.created_at).toLocaleString('es-VE')}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#52635A]">Cliente asociado</span>
            <span className="font-semibold text-[#111827]">
              {lastConfirmedSale.customer?.legal_name ?? 'Consumidor Final'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#52635A]">Cajero responsable</span>
            <span className="font-semibold text-[#111827]">
              María C. [mock]
            </span>
          </div>

          {lastConfirmedSale.sales_rep_name && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1 text-[#52635A]">
                <UserCheck className="h-3.5 w-3.5 text-[#1E6B4E]" />
                <span>Asesor comisionable</span>
              </span>
              <span className="font-bold text-[#1E6B4E]">
                {lastConfirmedSale.sales_rep_name}
              </span>
            </div>
          )}

          {lastConfirmedSale.applied_promotion_title && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1 text-[#52635A]">
                <Tag className="h-3.5 w-3.5 text-[#7C3AED]" />
                <span>Promoción aplicada</span>
              </span>
              <span className="font-bold text-[#7C3AED]">
                {lastConfirmedSale.applied_promotion_title}
              </span>
            </div>
          )}

          {lastConfirmedSale.wallet_used_usd && lastConfirmedSale.wallet_used_usd > 0 && (
            <div className="flex justify-between items-center text-[#065F46]">
              <span className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                <span>Saldo Billetera Digital usado</span>
              </span>
              <span className="font-bold">
                -${lastConfirmedSale.wallet_used_usd.toFixed(2)} USD
              </span>
            </div>
          )}

          {lastConfirmedSale.wallet_change_deposited_usd && lastConfirmedSale.wallet_change_deposited_usd > 0 && (
            <div className="flex justify-between items-center text-[#1D4ED8]">
              <span className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                <span>Vuelto acreditado a Billetera</span>
              </span>
              <span className="font-bold">
                +${lastConfirmedSale.wallet_change_deposited_usd.toFixed(2)} USD
              </span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-2 border-t border-[#DCE3DF]">
            <span className="font-bold text-[#111827]">Total liquidado</span>
            <div className="text-right">
              <span className="text-xl font-black text-[#111827]">
                ${lastConfirmedSale.total_usd.toFixed(2)} USD
              </span>
              <p className="text-[10px] text-[#52635A]">
                {lastConfirmedSale.total_ves.toLocaleString('es-VE')} VES
              </p>
            </div>
          </div>
        </div>

        {/* Aviso de Idempotencia */}
        {replayNotice && (
          <div className="mt-4 rounded-2xl border border-[#86EFAC] bg-[#DCFCE7] p-3 text-left text-xs text-[#14532D]">
            {replayNotice}
          </div>
        )}

        {/* Botones de Acción */}
        <div className="mt-6 space-y-2.5">
          {isFuncActive('pos_whatsapp_receipt') && (
            <button
              type="button"
              onClick={handleSendWhatsAppReceipt}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#1EBE5D] transition"
            >
              <Send className="h-4 w-4" />
              <span>Enviar comprobante digital por WhatsApp (1-Clic)</span>
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigateTo('POS-12')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-white py-3 text-xs font-bold text-[#111827] shadow-xs hover:bg-[#F6F5F0]"
            >
              <FileText className="h-4 w-4 text-[#52635A]" />
              <span>Ver comprobante PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateIdempotentReplay}
              title="Probar que no se duplica la venta al reenviar"
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-white px-4 py-3 text-xs font-bold text-[#52635A] hover:bg-[#F6F5F0]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Probar idempotencia</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('POS-03-04')}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#16523B]"
          >
            <span>Iniciar nueva venta</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
