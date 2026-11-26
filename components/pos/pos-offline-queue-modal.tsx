'use client';

import React, { useState } from 'react';
import { X, RefreshCw, Trash2, CloudUpload, AlertTriangle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { usePos } from './pos-context';

const OP_LABELS: Record<string, string> = {
  customer_create: 'Nuevo cliente',
  shift_open: 'Apertura de turno',
  cash_movement: 'Movimiento de caja',
  sale: 'Venta',
  debt_payment: 'Abono CxC',
  dispatch: 'Comanda KDS',
  sale_return: 'Devolución / Anulación',
  shift_close: 'Cierre de turno',
  settings_update: 'Configuración POS',
};

export function PosOfflineQueueModal() {
  const {
    isQueueModalOpen,
    setIsQueueModalOpen,
    offlineQueue,
    isOnline,
    lastSyncedAt,
    triggerSyncOfflineSales,
    retryOfflineOperation,
    discardOfflineOperation,
  } = usePos();

  const [syncing, setSyncing] = useState(false);

  if (!isQueueModalOpen) return null;

  const pending = offlineQueue.filter((q) => !q.rejected);
  const rejected = offlineQueue.filter((q) => q.rejected);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await triggerSyncOfflineSales();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl space-y-5 max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#111827]">Cola de Sincronización Offline</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  isOnline ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF2F2] text-[#B91C1C]'
                }`}
              >
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? 'En línea' : 'Sin conexión'}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#52635A]">
              {lastSyncedAt
                ? `Última sincronización: ${new Date(lastSyncedAt).toLocaleString('es-VE')}`
                : 'Datos cacheados localmente en este dispositivo.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsQueueModalOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {offlineQueue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCE3DF] p-8 text-center text-xs text-[#52635A] space-y-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[#1E6B4E]" />
              <p className="font-bold text-[#111827]">Todo sincronizado</p>
              <p>No hay operaciones pendientes ni rechazadas en este equipo.</p>
            </div>
          ) : (
            <>
              {rejected.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#B91C1C]">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Rechazadas por el servidor ({rejected.length}) — requieren revisión</span>
                  </div>
                  <div className="space-y-2">
                    {rejected.map((op) => (
                      <div
                        key={op.id}
                        className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-[#991B1B] border border-[#FECACA]">
                              {OP_LABELS[op.type] ?? op.type}
                            </span>
                            <p className="mt-1 font-bold text-[#111827]">{op.summary}</p>
                            <p className="text-[10px] text-[#52635A]">
                              {new Date(op.createdAt).toLocaleString('es-VE')} · Intentos: {op.retryCount}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => void retryOfflineOperation(op.id)}
                              disabled={!isOnline}
                              className="flex items-center gap-1 rounded-xl border border-[#1E6B4E] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#1E6B4E] hover:bg-[#DCFCE7] disabled:opacity-40"
                            >
                              <RefreshCw className="h-3 w-3" /> Reintentar
                            </button>
                            <button
                              type="button"
                              onClick={() => discardOfflineOperation(op.id)}
                              className="flex items-center gap-1 rounded-xl border border-[#FCA5A5] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#B91C1C] hover:bg-[#FEE2E2]"
                            >
                              <Trash2 className="h-3 w-3" /> Descartar
                            </button>
                          </div>
                        </div>
                        {op.lastError && (
                          <p className="rounded-xl bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-[#991B1B]">
                            Motivo: {op.lastError}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pending.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#92400E]">
                    <CloudUpload className="h-4 w-4" />
                    <span>Pendientes de envío ({pending.length}) — orden FIFO</span>
                  </div>
                  <div className="space-y-2">
                    {pending.map((op, idx) => (
                      <div
                        key={op.id}
                        className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5 text-xs flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-[#92400E]">#{idx + 1}</span>
                            <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-[#92400E] border border-[#FDE68A]">
                              {OP_LABELS[op.type] ?? op.type}
                            </span>
                          </div>
                          <p className="mt-1 font-bold text-[#111827]">{op.summary}</p>
                          <p className="text-[10px] text-[#52635A]">
                            {new Date(op.createdAt).toLocaleString('es-VE')}
                            {op.retryCount > 0 ? ` · Reintentos: ${op.retryCount}` : ''}
                          </p>
                          {op.lastError && (
                            <p className="mt-1 text-[10px] font-semibold text-[#B45309]">{op.lastError}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => discardOfflineOperation(op.id)}
                          title="Descartar operación pendiente"
                          className="rounded-xl border border-[#FDE68A] bg-white p-1.5 text-[#B91C1C] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E5E9E7] pt-3">
          <button
            type="button"
            onClick={() => setIsQueueModalOpen(false)}
            className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827]"
          >
            Cerrar
          </button>
          {pending.length > 0 && (
            <button
              type="button"
              disabled={!isOnline || syncing}
              onClick={handleSyncNow}
              className="flex items-center gap-1.5 rounded-2xl bg-[#1E6B4E] px-4 py-2 text-xs font-bold text-white hover:bg-[#16523B] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
