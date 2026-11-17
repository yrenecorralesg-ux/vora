'use client';

import { useEffect, useRef, useState } from 'react';
import { whGet } from '@/lib/warehouse/client';

export interface PickedItem {
  id: string;
  sku: string;
  name: string;
  unit_id: string;
  track_stock: boolean;
  status: string;
  warehouse_units: { code: string; symbol: string } | null;
}

/** Busca por SKU, nombre o código de barras exacto. */
export function ItemPicker({
  slug,
  onSelect,
  stockOnly = true,
  placeholder = 'Buscar SKU, nombre o código…',
}: {
  slug: string;
  onSelect: (item: PickedItem) => void;
  stockOnly?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PickedItem[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      const res = await whGet<{ items: PickedItem[] }>(slug, `items?q=${encodeURIComponent(q.trim())}${stockOnly ? '&stock=1' : ''}`);
      if (id !== seq.current) return;
      setError(res.ok ? null : res.error ?? null);
      setItems(res.data?.items ?? []);
      setOpen(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [q, slug, stockOnly]);

  return (
    <div className="relative w-full">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        aria-label="Buscar artículo"
        className="h-9 w-full rounded-lg border border-[#DCE3DF] px-3 text-[13px]"
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#DCE3DF] bg-white shadow-lg">
          {error && <li className="px-3 py-2 text-[12px] text-rose-700">{error}</li>}
          {!error && items.length === 0 && <li className="px-3 py-2 text-[12px] text-slate-500">Sin resultados.</li>}
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(item);
                  setQ('');
                  setItems([]);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-[#F4F7F5]"
              >
                <span className="truncate">
                  <span className="font-mono text-[11px] text-slate-500">{item.sku}</span> {item.name}
                </span>
                {item.status !== 'active' && <span className="text-[11px] text-amber-700">inactivo</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
