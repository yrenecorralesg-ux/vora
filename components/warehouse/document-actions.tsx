'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { whPost } from '@/lib/warehouse/client';

/** Aprobar / rechazar ajustes (WH-07) y reversar documentos contabilizados. */
export function DocumentActions({
  slug,
  documentId,
  mode,
  compact = false,
}: {
  slug: string;
  documentId: string;
  mode: 'decide' | 'reverse';
  compact?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'approve' | 'reject' | 'reverse' | null>(null);

  const run = async (action: 'approve' | 'reject' | 'reverse') => {
    setBusy(true);
    setError(null);
    const res = await whPost(slug, `documents/${documentId}`, { action, note });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'No se pudo completar.');
    setConfirming(null);
    router.refresh();
  };

  const btn = 'h-8 rounded-lg px-3 text-[12px] font-semibold disabled:opacity-50';
  if (confirming) {
    const needsNote = confirming !== 'approve';
    return (
      <div className="flex flex-wrap items-center gap-2">
        {needsNote && (
          <input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder={confirming === 'reverse' ? 'Motivo del reverso (obligatorio)' : 'Motivo del rechazo'}
            className="h-8 min-w-[180px] flex-1 rounded-lg border border-[#DCE3DF] px-2 text-[12px]"
          />
        )}
        <button
          type="button"
          disabled={busy || (confirming === 'reverse' && !note.trim())}
          onClick={() => run(confirming)}
          className={`${btn} ${confirming === 'approve' ? 'bg-[#285C49] text-white' : 'bg-rose-600 text-white'}`}
        >
          {busy ? '…' : confirming === 'approve' ? 'Confirmar aprobación' : confirming === 'reject' ? 'Confirmar rechazo' : 'Confirmar reverso'}
        </button>
        <button type="button" onClick={() => setConfirming(null)} className={`${btn} border border-[#DCE3DF]`}>Cancelar</button>
        {error && <span role="alert" className="text-[12px] text-rose-700">{error}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === 'decide' ? (
        <>
          <button type="button" onClick={() => setConfirming('approve')} className={`${btn} bg-[#285C49] text-white`}>Aprobar</button>
          <button type="button" onClick={() => setConfirming('reject')} className={`${btn} border border-rose-200 text-rose-700`}>{compact ? 'Rechazar' : 'Rechazar solicitud'}</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming('reverse')} className={`${btn} border border-rose-200 text-rose-700`}>Reversar documento</button>
      )}
      {error && <span role="alert" className="text-[12px] text-rose-700">{error}</span>}
    </div>
  );
}
