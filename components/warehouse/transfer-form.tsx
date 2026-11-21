'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Send, Trash2, Truck } from 'lucide-react';
import { ItemPicker, type PickedItem } from '@/components/warehouse/item-picker';
import { EmptyState, FieldLabel, btn, field } from '@/components/warehouse/wh-ui';
import { whPost } from '@/lib/warehouse/client';

interface Option {
  id: string;
  label: string;
}

/** Nueva transferencia entre almacenes (WH-04). */
export function TransferForm({ slug, warehouses }: { slug: string; warehouses: Option[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(warehouses[0]?.id ?? '');
  const [to, setTo] = useState(warehouses[1]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ item: PickedItem; quantity: string }[]>([]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const add = (item: PickedItem) => {
    if (!item.track_stock) return setMsg({ ok: false, text: `${item.sku} no maneja existencias.` });
    setLines((ls) =>
      ls.some((l) => l.item.id === item.id)
        ? ls.map((l) => (l.item.id === item.id ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l))
        : [...ls, { item, quantity: '1' }],
    );
  };

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await whPost<{ transfer: { number: string } }>(slug, 'transfers', {
      idempotency_key: key,
      from_warehouse_id: from,
      to_warehouse_id: to,
      notes,
      lines: lines.map((l) => ({ item_id: l.item.id, quantity: l.quantity })),
    });
    setBusy(false);
    if (!res.ok || !res.data) return setMsg({ ok: false, text: res.error ?? 'No se pudo enviar.' });
    setMsg({ ok: true, text: `Transferencia ${res.data.transfer.number} enviada: queda en tránsito hasta que el destino la reciba.` });
    setLines([]);
    setNotes('');
    setKey(crypto.randomUUID());
    router.refresh();
  };

  if (warehouses.length < 2)
    return (
      <EmptyState
        icon={Truck}
        title="Necesitas al menos dos almacenes"
        description="Crea otro almacén en Almacenes y ubicaciones para poder transferir mercancía entre ellos."
      />
    );

  return (
    <div className="space-y-4">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <FieldLabel label="Desde">
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </FieldLabel>
        <ArrowRight className="mx-auto mb-2 hidden h-5 w-5 text-slate-400 sm:block" />
        <FieldLabel label="Hacia">
          <select value={to} onChange={(e) => setTo(e.target.value)} className={field}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </FieldLabel>
      </div>
      {from === to && <p className="text-[12px] text-rose-700">El origen y el destino deben ser distintos.</p>}

      <ItemPicker slug={slug} onSelect={add} placeholder="Agregar artículo por SKU, nombre o código…" />

      {lines.length > 0 && (
        <ul className="divide-y divide-[#F1EDE5] rounded-xl border border-[#E7E2D7]">
          {lines.map((l) => (
            <li key={l.item.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#1B3D2F]">{l.item.name}</p>
                <p className="font-mono text-[11px] text-slate-500">{l.item.sku}</p>
              </div>
              <input
                inputMode="decimal"
                aria-label={`Cantidad de ${l.item.sku}`}
                value={l.quantity}
                onChange={(e) => setLines((ls) => ls.map((x) => (x.item.id === l.item.id ? { ...x, quantity: e.target.value } : x)))}
                className={`${field} w-24 text-right`}
              />
              <span className="w-10 text-[12px] text-slate-500">{l.item.warehouse_units?.symbol ?? ''}</span>
              <button type="button" aria-label={`Quitar ${l.item.sku}`} onClick={() => setLines((ls) => ls.filter((x) => x.item.id !== l.item.id))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <FieldLabel label="Notas (opcional)">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo, transportista, guía…" className={field} />
      </FieldLabel>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={submit} disabled={busy || !lines.length || from === to} className={btn.primary}>
          <Send className="h-4 w-4" /> {busy ? 'Enviando…' : 'Enviar transferencia'}
        </button>
        {msg && <p className={`text-[12px] ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

/** Botones Recibir / Cancelar de una transferencia en tránsito. */
export function TransferActions({ slug, id, canCancel }: { slug: string; id: string; canCancel: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: 'receive' | 'cancel') => {
    if (action === 'cancel' && !confirm('¿Cancelar la transferencia? La mercancía vuelve al almacén de origen.')) return;
    setBusy(true);
    setError(null);
    const res = await whPost(slug, `transfers/${id}`, { action });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'No se pudo completar.');
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <button type="button" disabled={busy} onClick={() => run('receive')} className={btn.ghost}>Recibir</button>
      {canCancel && (
        <button type="button" disabled={busy} onClick={() => run('cancel')} className={`${btn.ghost} text-slate-500`}>Cancelar</button>
      )}
      {error && <span className="w-full text-right text-[11px] text-rose-700">{error}</span>}
    </div>
  );
}
