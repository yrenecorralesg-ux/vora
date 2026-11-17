'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FieldLabel } from '@/components/warehouse/wh-ui';
import { whPost } from '@/lib/warehouse/client';

export interface ConfigField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  disabled?: boolean;
}

/** Formulario de configuración (POST /config): almacenes, unidades, atributos, ajustes, sector. */
export function ConfigForm({
  slug,
  entity,
  fields,
  initial = {},
  submitLabel = 'Guardar',
  resetOnSuccess = false,
}: {
  slug: string;
  entity: 'warehouse' | 'unit' | 'attribute' | 'settings' | 'sector' | 'category';
  fields: ConfigField[];
  initial?: Record<string, string | boolean | null | undefined>;
  submitLabel?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErrors({});
    const res = await whPost(slug, 'config', { entity, data: values });
    setBusy(false);
    if (!res.ok) {
      setErrors(Object.fromEntries((res.fields ?? []).map((f) => [f.field, f.message])));
      return setMsg({ ok: false, text: res.error ?? 'No se pudo guardar.' });
    }
    setMsg({ ok: true, text: 'Guardado.' });
    if (resetOnSuccess) setValues(initial);
    router.refresh();
  };

  const input = 'h-9 rounded-lg border border-[#DCE3DF] bg-white px-3 text-[13px] disabled:bg-slate-50';
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => {
          const value = values[f.name];
          const set = (v: string | boolean) => setValues((cur) => ({ ...cur, [f.name]: v }));
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className="flex items-center gap-2 self-end pb-2 text-[13px]">
                <input type="checkbox" checked={value === true} disabled={f.disabled} onChange={(e) => set(e.target.checked)} />
                {f.label}
              </label>
            );
          return (
            <FieldLabel key={f.name} label={f.label}>
              {f.type === 'select' ? (
                <select value={String(value ?? '')} disabled={f.disabled} onChange={(e) => set(e.target.value)} className={input}>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={String(value ?? '')}
                  disabled={f.disabled}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  placeholder={f.placeholder}
                  onChange={(e) => set(e.target.value)}
                  className={input}
                />
              )}
              {f.help && <span className="text-[11px] font-normal text-slate-500">{f.help}</span>}
              {errors[f.name] && <span className="text-[11px] text-rose-700">{errors[f.name]}</span>}
            </FieldLabel>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="h-9 rounded-lg bg-[#285C49] px-5 text-[13px] font-semibold text-white hover:bg-[#1F4A3A] disabled:opacity-50">
          {busy ? 'Guardando…' : submitLabel}
        </button>
        {msg && <p role="status" className={`text-[13px] ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
