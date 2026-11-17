'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FieldLabel } from '@/components/warehouse/wh-ui';
import { whPost } from '@/lib/warehouse/client';
import { ITEM_TYPES, NON_STOCK_TYPES, type ItemType } from '@/lib/warehouse/catalog';

interface AttributeDef {
  key: string;
  label: string;
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options: string[];
  required: boolean;
  category_id: string | null;
}
export interface ItemFormValues {
  id?: string;
  sku: string;
  name: string;
  description: string;
  item_type: ItemType;
  category_id: string;
  unit_id: string;
  price_usd: string;
  tax_rate: string;
  min_stock: string;
  status: 'active' | 'inactive';
  barcodes: string;
  attributes: Record<string, string>;
}

const input = 'h-9 rounded-lg border border-[#DCE3DF] bg-white px-3 text-[13px]';

/** WH-03 · Ficha de producto: datos, atributos dinámicos, precio y códigos. */
export function ItemForm({
  slug,
  initial,
  units,
  categories,
  attributes,
  canEdit,
  canCreateCategory,
}: {
  slug: string;
  initial: ItemFormValues;
  units: { id: string; code: string; name: string }[];
  categories: { id: string; name: string }[];
  attributes: AttributeDef[];
  canEdit: boolean;
  canCreateCategory: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [cats, setCats] = useState(categories);
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<ItemFormValues>) => setV((cur) => ({ ...cur, ...patch }));
  const applicable = useMemo(
    () => attributes.filter((a) => !a.category_id || a.category_id === v.category_id),
    [attributes, v.category_id],
  );

  const addCategory = async () => {
    const res = await whPost<{ id: string }>(slug, 'config', { entity: 'category', data: { name: newCat } });
    if (!res.ok || !res.data) return setMsg({ ok: false, text: res.error ?? 'No se pudo crear la categoría.' });
    setCats((c) => [...c, { id: res.data!.id, name: newCat.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
    set({ category_id: res.data.id });
    setNewCat('');
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setFieldErrors({});
    const body = {
      ...v,
      category_id: v.category_id || null,
      barcodes: v.barcodes.split(/[\n,|]/).map((c) => c.trim()).filter(Boolean),
      attributes: Object.fromEntries(applicable.map((a) => [a.key, v.attributes[a.key] ?? ''])),
    };
    const res = v.id ? await whPost(slug, `items/${v.id}`, body, 'PATCH') : await whPost<{ id: string }>(slug, 'items', body);
    setBusy(false);
    if (!res.ok) {
      setFieldErrors(Object.fromEntries((res.fields ?? []).map((f) => [f.field, f.message])));
      return setMsg({ ok: false, text: res.error ?? 'No se pudo guardar.' });
    }
    if (!v.id) return router.push(`/t/${slug}/warehouse/catalog/${(res.data as { id: string }).id}`);
    setMsg({ ok: true, text: 'Cambios guardados.' });
    router.refresh();
  };

  const err = (f: string) => fieldErrors[f] && <span className="text-[11px] text-rose-700">{fieldErrors[f]}</span>;
  const nonStock = NON_STOCK_TYPES.includes(v.item_type);

  return (
    <fieldset disabled={!canEdit || busy} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FieldLabel label="SKU *">
          <input value={v.sku} maxLength={64} onChange={(e) => set({ sku: e.target.value })} className={`${input} font-mono`} />
          {err('sku')}
        </FieldLabel>
        <FieldLabel label="Nombre *" className="lg:col-span-2">
          <input value={v.name} maxLength={200} onChange={(e) => set({ name: e.target.value })} className={input} />
          {err('name')}
        </FieldLabel>
        <FieldLabel label="Tipo *">
          <select value={v.item_type} onChange={(e) => set({ item_type: e.target.value as ItemType })} className={input}>
            {Object.entries(ITEM_TYPES).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          {nonStock && <span className="text-[11px] text-slate-500">No maneja existencias: sus materiales sí generan movimientos.</span>}
          {err('item_type')}
        </FieldLabel>
        <FieldLabel label="Unidad *">
          <select value={v.unit_id} onChange={(e) => set({ unit_id: e.target.value })} className={input}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.code} · {u.name}</option>
            ))}
          </select>
          {err('unit_id')}
        </FieldLabel>
        <FieldLabel label="Categoría">
          <select value={v.category_id} onChange={(e) => set({ category_id: e.target.value })} className={input}>
            <option value="">Sin categoría</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {canCreateCategory && (
            <span className="flex gap-1">
              <input value={newCat} maxLength={80} placeholder="Nueva categoría" onChange={(e) => setNewCat(e.target.value)} className={`${input} h-8 flex-1`} />
              <button type="button" disabled={!newCat.trim()} onClick={addCategory} className="rounded-lg border border-[#DCE3DF] px-2 text-[12px] disabled:opacity-50">Crear</button>
            </span>
          )}
        </FieldLabel>
        <FieldLabel label="Precio USD">
          <input inputMode="decimal" value={v.price_usd} onChange={(e) => set({ price_usd: e.target.value })} className={input} />
          {err('price_usd')}
        </FieldLabel>
        <FieldLabel label="IVA %">
          <input inputMode="decimal" value={v.tax_rate} onChange={(e) => set({ tax_rate: e.target.value })} className={input} />
          {err('tax_rate')}
        </FieldLabel>
        <FieldLabel label="Stock mínimo">
          <input inputMode="decimal" value={v.min_stock} disabled={nonStock} onChange={(e) => set({ min_stock: e.target.value })} className={input} />
          {err('min_stock')}
        </FieldLabel>
        <FieldLabel label="Códigos de barras (uno por línea)">
          <textarea rows={2} value={v.barcodes} onChange={(e) => set({ barcodes: e.target.value })} className="rounded-lg border border-[#DCE3DF] px-3 py-2 font-mono text-[12px]" />
          {err('barcodes')}
        </FieldLabel>
        <FieldLabel label="Estado">
          <select value={v.status} onChange={(e) => set({ status: e.target.value as 'active' | 'inactive' })} className={input}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </FieldLabel>
        <FieldLabel label="Descripción" className="sm:col-span-2 lg:col-span-3">
          <textarea rows={2} maxLength={2000} value={v.description} onChange={(e) => set({ description: e.target.value })} className="rounded-lg border border-[#DCE3DF] px-3 py-2 text-[13px]" />
        </FieldLabel>
      </div>

      {applicable.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-semibold text-[#1B3D2F]">Atributos</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {applicable.map((a) => {
              const value = v.attributes[a.key] ?? '';
              const setAttr = (val: string) => set({ attributes: { ...v.attributes, [a.key]: val } });
              return (
                <FieldLabel key={a.key} label={`${a.label}${a.required ? ' *' : ''}`}>
                  {a.data_type === 'select' || a.data_type === 'boolean' ? (
                    <select value={value} onChange={(e) => setAttr(e.target.value)} className={input}>
                      <option value="">—</option>
                      {(a.data_type === 'boolean' ? ['sí', 'no'] : a.options).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={a.data_type === 'date' ? 'date' : 'text'}
                      inputMode={a.data_type === 'number' ? 'decimal' : undefined}
                      value={value}
                      onChange={(e) => setAttr(e.target.value)}
                      className={input}
                    />
                  )}
                  {err(`attr:${a.key}`)}
                </FieldLabel>
              );
            })}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} className="h-9 rounded-lg bg-[#285C49] px-5 text-[13px] font-semibold text-white hover:bg-[#1F4A3A] disabled:opacity-50">
            {busy ? 'Guardando…' : v.id ? 'Guardar cambios' : 'Crear artículo'}
          </button>
          {msg && <p role="status" className={`text-[13px] ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
        </div>
      )}
    </fieldset>
  );
}
