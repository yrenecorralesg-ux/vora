'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ItemPicker, type PickedItem } from '@/components/warehouse/item-picker';
import { FieldLabel } from '@/components/warehouse/wh-ui';
import { whGet, whPost } from '@/lib/warehouse/client';
import type { DocType } from '@/lib/warehouse/catalog';
import { fmtQty } from '@/lib/warehouse/format';

export interface UnitOption {
  id: string;
  code: string;
  symbol: string;
  base_unit_id: string | null;
}
interface Option {
  id: string;
  label: string;
}
export interface DocLine {
  key: string;
  item: PickedItem;
  quantity: string;
  unit_id: string;
  unit_cost: string;
  counted_qty: string;
  condition: 'sellable' | 'damaged' | '';
  reason: string;
  system?: number | null;
}

const newKey = () => crypto.randomUUID();
export const lineFor = (item: PickedItem, quantity = ''): DocLine => ({
  key: newKey(),
  item,
  quantity,
  unit_id: item.unit_id,
  unit_cost: '',
  counted_qty: '',
  condition: '',
  reason: '',
});

const SUBMIT_LABEL: Record<DocType, string> = {
  receipt: 'Registrar entrada',
  issue: 'Registrar salida',
  adjustment: 'Solicitar aprobación',
  return: 'Registrar devolución',
};

/** Formulario único de documentos: entradas (WH-05), salidas (WH-06), ajustes (WH-07) y devoluciones (WH-10). */
export function DocumentForm({
  slug,
  docType,
  warehouses,
  defaultWarehouseId,
  units,
  suppliers = [],
  reasons = [],
  canSeeCost = false,
  autoApprove = false,
  initialLines = [],
  onPosted,
}: {
  slug: string;
  docType: DocType;
  warehouses: Option[];
  defaultWarehouseId: string | null;
  units: UnitOption[];
  suppliers?: Option[];
  reasons?: string[];
  canSeeCost?: boolean;
  autoApprove?: boolean;
  initialLines?: DocLine[];
  onPosted?: () => void;
}) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? warehouses[0]?.id ?? '');
  const [lines, setLines] = useState<DocLine[]>(initialLines);
  const [header, setHeader] = useState({ reason: reasons[0] ?? '', reference: '', notes: '', supplier_id: '', evidence_url: '' });
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; docId?: string } | null>(null);

  const family = (unitId: string) => {
    const u = units.find((x) => x.id === unitId);
    return u ? u.base_unit_id ?? u.id : unitId;
  };
  const update = (k: string, patch: Partial<DocLine>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  const refreshSystem = async (line: DocLine, wh: string) => {
    const res = await whGet<{ on_hand: number }>(slug, `stock?item=${line.item.id}&warehouse=${wh}`);
    update(line.key, { system: res.ok ? res.data!.on_hand : null });
  };

  const addItem = (item: PickedItem) => {
    if (!item.track_stock) {
      setResult({ ok: false, text: `${item.sku} es un servicio o activo: no maneja existencias.` });
      return;
    }
    const existing = lines.find((l) => l.item.id === item.id && docType !== 'return');
    if (existing && docType !== 'adjustment') {
      update(existing.key, { quantity: String((Number(existing.quantity) || 0) + 1) });
      return;
    }
    if (existing) return;
    const line = lineFor(item, docType === 'adjustment' ? '' : '1');
    setLines((ls) => [...ls, line]);
    if (docType === 'adjustment' && warehouseId) refreshSystem(line, warehouseId);
  };

  const submit = async () => {
    setBusy(true);
    setResult(null);
    const res = await whPost<{ document: { id: string; number: string; status: string } }>(slug, 'documents', {
      doc_type: docType,
      idempotency_key: key,
      warehouse_id: warehouseId,
      ...header,
      lines: lines.map((l) => ({
        item_id: l.item.id,
        quantity: l.quantity,
        counted_qty: l.counted_qty,
        unit_id: l.unit_id !== l.item.unit_id ? l.unit_id : null,
        unit_cost: l.unit_cost,
        condition: l.condition || null,
        reason: l.reason,
      })),
    });
    setBusy(false);
    if (!res.ok || !res.data) {
      setResult({ ok: false, text: res.error ?? 'No se pudo registrar.' });
      return;
    }
    const doc = res.data.document;
    setResult({
      ok: true,
      docId: doc.id,
      text: doc.status === 'pending_approval' ? `${doc.number} quedó pendiente de aprobación.` : `${doc.number} registrado y contabilizado.`,
    });
    setLines([]);
    setKey(newKey());
    onPosted?.();
    router.refresh();
  };

  const cell = 'h-8 w-full rounded-md border border-[#DCE3DF] px-2 text-[13px]';
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FieldLabel label="Almacén">
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              if (docType === 'adjustment') lines.forEach((l) => refreshSystem(l, e.target.value));
            }}
            className="h-9 rounded-lg border border-[#DCE3DF] bg-white px-2 text-[13px]"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </FieldLabel>
        {docType === 'receipt' && (
          <FieldLabel label="Proveedor (opcional)">
            <select value={header.supplier_id} onChange={(e) => setHeader({ ...header, supplier_id: e.target.value })} className="h-9 rounded-lg border border-[#DCE3DF] bg-white px-2 text-[13px]">
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </FieldLabel>
        )}
        {reasons.length > 0 && (
          <FieldLabel label="Motivo">
            <select value={header.reason} onChange={(e) => setHeader({ ...header, reason: e.target.value })} className="h-9 rounded-lg border border-[#DCE3DF] bg-white px-2 text-[13px]">
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </FieldLabel>
        )}
        <FieldLabel label={docType === 'return' ? 'Venta o documento de origen' : docType === 'receipt' ? 'Factura / guía del proveedor' : 'Referencia'}>
          <input value={header.reference} maxLength={64} onChange={(e) => setHeader({ ...header, reference: e.target.value })} className="h-9 rounded-lg border border-[#DCE3DF] px-3 text-[13px]" />
        </FieldLabel>
        {docType === 'adjustment' && (
          <FieldLabel label="Evidencia (enlace https, opcional)">
            <input value={header.evidence_url} type="url" placeholder="https://…" onChange={(e) => setHeader({ ...header, evidence_url: e.target.value })} className="h-9 rounded-lg border border-[#DCE3DF] px-3 text-[13px]" />
          </FieldLabel>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-96">
          <ItemPicker slug={slug} onSelect={addItem} />
        </div>
        <span className="text-[11px] text-slate-500">Agrega líneas buscando el artículo. Servicios y activos alquilables no mueven stock.</span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-[#DCE3DF] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2">Producto</th>
              {docType === 'adjustment' ? (
                <>
                  <th className="px-2 py-2">Existencia</th>
                  <th className="px-2 py-2">Conteo</th>
                  <th className="px-2 py-2">Diferencia</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-2">Cantidad</th>
                  <th className="px-2 py-2">Unidad</th>
                </>
              )}
              {docType === 'receipt' && canSeeCost && <th className="px-2 py-2">Costo unitario USD</th>}
              {docType === 'return' && <th className="px-2 py-2">Condición</th>}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">Sin líneas. Busca un artículo para agregarlo.</td>
              </tr>
            )}
            {lines.map((l) => {
              const diff = l.counted_qty !== '' && l.system != null ? Number(l.counted_qty) - l.system : null;
              return (
                <tr key={l.key} className="border-b border-[#EFECE4] align-middle">
                  <td className="px-2 py-1.5 font-mono text-[11px]">{l.item.sku}</td>
                  <td className="px-2 py-1.5">{l.item.name}</td>
                  {docType === 'adjustment' ? (
                    <>
                      <td className="px-2 py-1.5 tabular-nums">{l.system == null ? '…' : fmtQty(l.system)}</td>
                      <td className="px-2 py-1.5">
                        <input inputMode="decimal" aria-label="Conteo" value={l.counted_qty} onChange={(e) => update(l.key, { counted_qty: e.target.value })} className={`${cell} w-24`} />
                      </td>
                      <td className={`px-2 py-1.5 tabular-nums ${diff && diff < 0 ? 'text-rose-700' : diff ? 'text-emerald-700' : ''}`}>
                        {diff == null ? '—' : diff > 0 ? `+${fmtQty(diff)}` : fmtQty(diff)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1.5">
                        <input inputMode="decimal" aria-label="Cantidad" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} className={`${cell} w-24`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select aria-label="Unidad" value={l.unit_id} onChange={(e) => update(l.key, { unit_id: e.target.value })} className={`${cell} w-24 bg-white`}>
                          {units
                            .filter((u) => family(u.id) === family(l.item.unit_id))
                            .map((u) => (
                              <option key={u.id} value={u.id}>{u.symbol}</option>
                            ))}
                        </select>
                      </td>
                    </>
                  )}
                  {docType === 'receipt' && canSeeCost && (
                    <td className="px-2 py-1.5">
                      <input inputMode="decimal" aria-label="Costo unitario" value={l.unit_cost} onChange={(e) => update(l.key, { unit_cost: e.target.value })} className={`${cell} w-28`} />
                    </td>
                  )}
                  {docType === 'return' && (
                    <td className="px-2 py-1.5">
                      <select aria-label="Condición" value={l.condition} onChange={(e) => update(l.key, { condition: e.target.value as DocLine['condition'] })} className={`${cell} w-36 bg-white`}>
                        <option value="">Inspeccionar…</option>
                        <option value="sellable">Vendible</option>
                        <option value="damaged">Dañado (no vendible)</option>
                      </select>
                    </td>
                  )}
                  <td className="px-1">
                    <button type="button" aria-label="Quitar línea" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FieldLabel label="Notas">
        <textarea value={header.notes} maxLength={1000} rows={2} onChange={(e) => setHeader({ ...header, notes: e.target.value })} className="rounded-lg border border-[#DCE3DF] px-3 py-2 text-[13px]" />
      </FieldLabel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || lines.length === 0 || !warehouseId}
          onClick={submit}
          className="h-9 rounded-lg bg-[#285C49] px-5 text-[13px] font-semibold text-white hover:bg-[#1F4A3A] disabled:opacity-50"
        >
          {busy ? 'Registrando…' : docType === 'adjustment' && autoApprove ? 'Registrar ajuste' : SUBMIT_LABEL[docType]}
        </button>
        {result && (
          <p role="status" className={`text-[13px] ${result.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            {result.text}{' '}
            {result.docId && (
              <Link href={`/t/${slug}/warehouse/documents/${result.docId}`} className="underline">Ver documento</Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
