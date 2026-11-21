'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { FieldLabel } from '@/components/warehouse/wh-ui';
import { whGet, whPost } from '@/lib/warehouse/client';
import { fmtQty } from '@/lib/warehouse/format';
import type { PickedItem } from '@/components/warehouse/item-picker';
import { CameraScanner } from '@/components/warehouse/camera-scanner';

interface ScanLine {
  item: PickedItem;
  code: string;
  quantity: number;
}

/**
 * WH-23 · Escaneo: un lector USB/Bluetooth escribe el código y envía Enter, igual que teclearlo.
 * Ambos pasan por la misma validación del servidor (items/lookup) y guardan con la misma ruta de entradas.
 */
export function Scanner({ slug, warehouses, defaultWarehouseId }: { slug: string; warehouses: { id: string; label: string }[]; defaultWarehouseId: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? warehouses[0]?.id ?? '');
  const [last, setLast] = useState<{ ok: boolean; text: string; create?: string } | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);

  const scan = useCallback(async (raw: string) => {
    const value = raw.trim();
    setCode('');
    if (!value) return;
    const res = await whGet<{ item: PickedItem }>(slug, `items/lookup?code=${encodeURIComponent(value)}`);
    if (!res.ok || !res.data) {
      const canCreate = res.error === 'Código desconocido.';
      setLast({ ok: false, text: `${value}: ${res.error ?? 'error'}`, create: canCreate ? value : undefined });
      return;
    }
    const item = res.data.item;
    if (!item.track_stock) return setLast({ ok: false, text: `${item.sku} no maneja existencias (servicio o activo).` });
    setLines((ls) => {
      const found = ls.find((l) => l.item.id === item.id);
      return found ? ls.map((l) => (l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l)) : [{ item, code: value, quantity: 1 }, ...ls];
    });
    setLast({ ok: true, text: `${item.sku} · ${item.name} (+1)` });
  }, [slug]);

  const save = async () => {
    setBusy(true);
    const res = await whPost<{ document: { id: string; number: string } }>(slug, 'documents', {
      doc_type: 'receipt',
      idempotency_key: key,
      warehouse_id: warehouseId,
      reason: 'Entrada por escaneo',
      cost_mode: 'average',
      lines: lines.map((l) => ({ item_id: l.item.id, quantity: l.quantity })),
    });
    setBusy(false);
    if (!res.ok || !res.data) return setLast({ ok: false, text: res.error ?? 'No se pudo guardar.' });
    setLast({ ok: true, text: `${res.data.document.number} registrado.` });
    setLines([]);
    setKey(crypto.randomUUID());
    router.refresh();
    input.current?.focus();
  };

  const total = lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldLabel label="Código leído (escáner o teclado + Enter)" className="sm:col-span-2">
          <input
            ref={input}
            autoFocus
            value={code}
            maxLength={64}
            autoComplete="off"
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                scan(code);
              }
            }}
            placeholder="Escanea o escribe el código y presiona Enter"
            className="h-12 rounded-xl border-2 border-[#285C49] px-4 font-mono text-[15px]"
          />
        </FieldLabel>
        <FieldLabel label="Almacén">
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-12 rounded-xl border border-[#E7E2D7] bg-white px-2 text-[13px]">
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </FieldLabel>
      </div>

      <CameraScanner onCode={scan} />

      {last && (
        <p role="status" className={`rounded-xl px-3 py-2 text-[13px] ${last.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {last.text}{' '}
          {last.create && (
            <Link href={`/t/${slug}/warehouse/catalog/new?barcode=${encodeURIComponent(last.create)}`} className="underline">Dar de alta o vincular</Link>
          )}
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="border-b border-[#E7E2D7] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5">Código leído</th>
              <th className="px-3 py-2.5">Producto</th>
              <th className="px-3 py-2.5">Cantidad</th>
              <th className="px-3 py-2.5">Acción</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">Escanea un código para empezar. Cada lectura suma una unidad.</td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.item.id} className="border-b border-[#EFECE4]">
                <td className="px-2 py-1.5 font-mono text-[11px]">{l.code}</td>
                <td className="px-3 py-2"><span className="font-mono text-[11px] text-slate-500">{l.item.sku}</span> {l.item.name}</td>
                <td className="px-3 py-2">
                  <input
                    inputMode="decimal"
                    aria-label="Cantidad"
                    value={l.quantity}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(',', '.'));
                      if (Number.isFinite(n) && n >= 0) setLines((ls) => ls.map((x) => (x.item.id === l.item.id ? { ...x, quantity: n } : x)));
                    }}
                    className="h-8 w-24 rounded-md border border-[#E7E2D7] px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <button type="button" aria-label="Quitar" onClick={() => setLines((ls) => ls.filter((x) => x.item.id !== l.item.id))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !lines.length || lines.some((l) => l.quantity <= 0)} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#285C49] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1F4A3A] disabled:opacity-50">
          {busy ? 'Guardando…' : `Guardar entrada (${fmtQty(total)} uds.)`}
        </button>
        <span className="text-[12px] text-slate-500">Se valora al costo promedio vigente. Para registrar costos de compra usa Entradas.</span>
      </div>
    </div>
  );
}
