'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { btn } from '@/components/warehouse/wh-ui';

/* Tipos mínimos de BarcodeDetector (aún no están en lib.dom de TypeScript). */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'];

/**
 * Escaneo con la cámara (WH-23, "cámara web si es compatible"). Usa la API
 * BarcodeDetector del navegador (Chrome, Edge, Android). Cada código leído va
 * a la misma validación del servidor que el lector USB.
 */
export function CameraScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastHit = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Detector({ formats: FORMATS });

    (async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream.current;
        await video.current.play();
      } catch {
        setError('No se pudo acceder a la cámara. Revisa el permiso del navegador.');
        setActive(false);
        return;
      }
      const tick = async () => {
        if (stopped || !video.current) return;
        try {
          const found = await detector.detect(video.current);
          const code = found[0]?.rawValue?.trim();
          // Evita contar varias veces el mismo código mientras sigue frente a la cámara.
          if (code && (code !== lastHit.current.code || Date.now() - lastHit.current.at > 1500)) {
            lastHit.current = { code, at: Date.now() };
            onCode(code);
          }
        } catch {
          /* fotograma no legible: se reintenta */
        }
        timer = setTimeout(tick, 250);
      };
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [active, onCode]);

  if (supported === null) return null;
  if (!supported)
    return (
      <p className="rounded-xl bg-[#F8F6F1] px-3 py-2 text-[12px] text-slate-500">
        Este navegador no permite leer códigos con la cámara. Usa un lector USB/Bluetooth o escribe el código; en Chrome o Edge (también en Android) sí está disponible.
      </p>
    );

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => { setError(null); setActive((a) => !a); }} className={active ? btn.secondary : btn.primary}>
        {active ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {active ? 'Apagar cámara' : 'Escanear con la cámara'}
      </button>
      {error && <p className="text-[12px] text-rose-700">{error}</p>}
      {active && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E2D7] bg-black">
          <video ref={video} muted playsInline className="aspect-video w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          <p className="absolute inset-x-0 bottom-2 text-center text-[11px] text-white/90">Centra el código en el recuadro</p>
        </div>
      )}
    </div>
  );
}
