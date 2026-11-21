'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import { usePos, type PosToast } from './pos-context';

/** Duración en pantalla por tipo; los errores se quedan hasta que se cierran. */
const DURATION_MS: Record<PosToast['type'], number | null> = {
  success: 5000,
  alert: 8000,
  critical: null,
};

const STYLES: Record<PosToast['type'], { accent: string; icon: React.ReactNode; label: string }> = {
  success: {
    accent: '#1E6B4E',
    icon: <CheckCircle2 className="h-5 w-5 text-[#1E6B4E]" />,
    label: 'Éxito',
  },
  alert: {
    accent: '#D97706',
    icon: <AlertTriangle className="h-5 w-5 text-[#D97706]" />,
    label: 'Advertencia',
  },
  critical: {
    accent: '#C83E3B',
    icon: <XCircle className="h-5 w-5 text-[#C83E3B]" />,
    label: 'Error',
  },
};

function ToastCard({ toast, onClose }: { toast: PosToast; onClose: () => void }) {
  const duration = DURATION_MS[toast.type];
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(duration ?? 0);
  const style = STYLES[toast.type];

  // Cuenta regresiva que se detiene mientras el cursor está encima.
  useEffect(() => {
    if (duration === null || paused) return;
    if (remaining <= 0) {
      onClose();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 100), 100);
    return () => clearTimeout(t);
  }, [duration, paused, remaining, onClose]);

  return (
    <div
      role={toast.type === 'critical' ? 'alert' : 'status'}
      aria-live={toast.type === 'critical' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-[#DCE3DF] bg-white shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-right-8 fade-in duration-300"
      style={{ borderLeft: `6px solid ${style.accent}` }}
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <div className="mt-0.5 shrink-0">{style.icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111827]">{toast.title}</p>
          {toast.detail && <p className="mt-0.5 text-xs leading-relaxed text-[#52635A]">{toast.detail}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={`Cerrar aviso: ${toast.title}`}
        className="absolute right-2.5 top-2.5 rounded-lg p-1 text-[#52635A] transition hover:bg-[#F6F5F0] hover:text-[#111827]"
      >
        <X className="h-4 w-4" />
      </button>
      {duration !== null && (
        <div className="h-1 w-full bg-[#F6F5F0]">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={{ width: `${(remaining / duration) * 100}%`, backgroundColor: style.accent }}
          />
        </div>
      )}
    </div>
  );
}

/** Notificaciones flotantes del POS (esquina superior derecha, apiladas). */
export function PosToaster() {
  const { toasts, dismissToast } = usePos();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 print:hidden">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
