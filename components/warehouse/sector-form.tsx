'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FieldLabel } from '@/components/warehouse/wh-ui';
import { whPost } from '@/lib/warehouse/client';
import type { BusinessTemplate } from '@/lib/warehouse/catalog';

/** WH-15: sector → especialidad → plantilla con vista previa de atributos antes de aplicar. */
export function SectorForm({
  slug,
  sectors,
  templates,
  current,
}: {
  slug: string;
  sectors: { sector: string; specialties: string[]; template: string }[];
  templates: BusinessTemplate[];
  current: { sector: string; specialty: string; template_key: string } | null;
}) {
  const router = useRouter();
  const [sector, setSector] = useState(current?.sector ?? '');
  const [specialty, setSpecialty] = useState(current?.specialty ?? '');
  const [templateKey, setTemplateKey] = useState(current?.template_key ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const s = sectors.find((x) => x.sector === sector);
  const template = templates.find((t) => t.key === (templateKey || s?.template));
  const input = 'h-9 rounded-xl border border-[#E7E2D7] bg-white px-2 text-[13px]';

  const apply = async () => {
    setBusy(true);
    setMsg(null);
    const res = await whPost<{ added: string[] }>(slug, 'config', { entity: 'sector', data: { sector, specialty, template_key: template?.key } });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error ?? 'No se pudo aplicar.' });
    setMsg({ ok: true, text: 'Plantilla aplicada.' });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldLabel label="Sector">
          <select
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setSpecialty('');
              setTemplateKey('');
            }}
            className={input}
          >
            <option value="">Selecciona…</option>
            {sectors.map((x) => (
              <option key={x.sector}>{x.sector}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Especialidad">
          <select value={specialty} disabled={!s} onChange={(e) => setSpecialty(e.target.value)} className={input}>
            <option value="">—</option>
            {s?.specialties.map((sp) => (
              <option key={sp}>{sp}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Plantilla">
          <select value={template?.key ?? ''} disabled={!s} onChange={(e) => setTemplateKey(e.target.value)} className={input}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>{t.name}{t.key === s?.template ? ' (sugerida)' : ''}</option>
            ))}
          </select>
        </FieldLabel>
      </div>
      {template && s && (
        <div className="rounded-xl border border-[#E7E2D7] p-3">
          <p className="mb-2 text-[12px] font-semibold text-[#1B3D2F]">Vista previa: atributos de “{template.name}” v{template.version}</p>
          <div className="flex flex-wrap gap-1.5">
            {template.attributes.map((a) => (
              <span key={a.key} className="rounded-full bg-[#EEF3EF] px-2 py-0.5 text-[12px] text-[#285C49]">
                {a.label} <span className="text-slate-500">({a.data_type})</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!s || busy} onClick={apply} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#285C49] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1F4A3A] disabled:opacity-50">
          {busy ? 'Aplicando…' : 'Aplicar plantilla'}
        </button>
        <Link href={`/t/${slug}/warehouse/attributes`} className="text-[13px] text-[#285C49] underline">Personalizar atributos</Link>
        {msg && <p role="status" className={`text-[13px] ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
