'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
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

/**
 * Buscador de artículos para agregar líneas. Al enfocar muestra el catálogo; filtra por SKU,
 * nombre o código de barras exacto. Enter agrega el resultado exacto (lector de códigos) o el
 * primero; ↑/↓ recorren la lista. Si no existe, ofrece crearlo en el catálogo.
 */
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
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      const res = await whGet<{ items: PickedItem[] }>(
        slug,
        `items?q=${encodeURIComponent(term)}${stockOnly ? '&stock=1' : ''}`,
      );
      if (id !== seq.current) return;
      setError(res.ok ? null : res.error ?? null);
      setItems(res.data?.items ?? []);
      setActive(0);
      setLoaded(true);
    }, term ? 200 : 0);
    return () => clearTimeout(timer);
  }, [q, slug, stockOnly, open]);

  const pick = (item: PickedItem) => {
    onSelect(item);
    setQ('');
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const term = q.trim().toLowerCase();
      const exact = items.find((i) => i.sku.toLowerCase() === term);
      const target = exact ?? items[active];
      if (target && term) pick(target);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Buscar artículo"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        className="h-9 w-full rounded-xl border border-[#E7E2D7] pl-9 pr-3 text-[13px] focus:border-[#285C49] focus:outline-none focus:ring-2 focus:ring-[#285C49]/15"
      />
      {open && loaded && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-[#E7E2D7] bg-white py-1 shadow-lg"
        >
          {error && <li className="px-3 py-2 text-[12px] text-rose-700">{error}</li>}
          {!error && items.length === 0 && (
            <li className="px-3 py-2 text-[12px] text-slate-500">
              {q.trim() ? `No hay artículos que coincidan con «${q.trim()}».` : 'El catálogo está vacío.'}
            </li>
          )}
          {!error && !q.trim() && items.length > 0 && (
            <li className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Catálogo · escribe para filtrar
            </li>
          )}
          {items.map((item, idx) => (
            <li key={item.id} role="option" aria-selected={idx === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(item)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] ${
                  idx === active ? 'bg-[#F1F5EF]' : ''
                }`}
              >
                <span className="truncate">
                  <span className="font-mono text-[11px] text-slate-500">{item.sku}</span> {item.name}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                  {item.status !== 'active' && <span className="text-amber-700">inactivo</span>}
                  {item.warehouse_units?.code}
                </span>
              </button>
            </li>
          ))}
          <li className="mt-1 border-t border-[#F1EDE5]">
            <a
              href={`/t/${slug}/warehouse/catalog/new`}
              target="_blank"
              rel="noopener"
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#285C49] hover:bg-[#F8F6F1]"
            >
              <Plus className="h-3.5 w-3.5" /> Crear un artículo nuevo
              <span className="font-normal text-slate-400">(se abre en otra pestaña; luego búscalo aquí)</span>
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}
