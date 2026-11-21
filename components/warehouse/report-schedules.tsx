'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarClock, Pause, Play, Trash2 } from 'lucide-react';
import { whPost } from '@/lib/warehouse/client';
import { EmptyState, FieldLabel, Pill, btn, field } from '@/components/warehouse/wh-ui';

interface Option {
  id: string;
  label: string;
}
export interface ScheduleRow {
  id: string;
  report: string;
  frequency: string;
  when: string;
  recipients: string;
  active: boolean;
  last: string;
  canEdit: boolean;
}

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Programar el envío de reportes por correo (WH-11). */
export function ReportScheduleForm({
  slug,
  reports,
  members,
  warehouses,
}: {
  slug: string;
  reports: Option[];
  members: Option[];
  warehouses: Option[];
}) {
  const router = useRouter();
  const [report, setReport] = useState(reports[0]?.id ?? 'stock');
  const [frequency, setFrequency] = useState('weekly');
  const [weekday, setWeekday] = useState('1');
  const [monthDay, setMonthDay] = useState('1');
  const [warehouseId, setWarehouseId] = useState('');
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await whPost(slug, 'report-schedules', {
      action: 'create',
      report,
      frequency,
      weekday,
      month_day: monthDay,
      warehouse_id: warehouseId || null,
      recipients: Array.from(recipients),
    });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error ?? 'No se pudo guardar.' });
    setMsg({ ok: true, text: 'Programación guardada. El envío sale a las 7:00 a. m. (hora de Caracas).' });
    setRecipients(new Set());
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Reporte">
          <select value={report} onChange={(e) => setReport(e.target.value)} className={field}>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Frecuencia">
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={field}>
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </FieldLabel>
        {frequency === 'weekly' && (
          <FieldLabel label="Día de la semana">
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className={field}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i + 1}>{d}</option>
              ))}
            </select>
          </FieldLabel>
        )}
        {frequency === 'monthly' && (
          <FieldLabel label="Día del mes">
            <select value={monthDay} onChange={(e) => setMonthDay(e.target.value)} className={field}>
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </FieldLabel>
        )}
        <FieldLabel label="Almacén">
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={field}>
            <option value="">Todos</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </FieldLabel>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[12px] font-medium text-slate-600">Destinatarios (usuarios que pueden ver reportes)</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 rounded-lg border border-[#E7E2D7] bg-white px-2.5 py-1.5 text-[12px]">
              <input
                type="checkbox"
                checked={recipients.has(m.id)}
                onChange={(e) =>
                  setRecipients((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    return next;
                  })
                }
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={submit} disabled={busy || recipients.size === 0} className={btn.primary}>
          <CalendarClock className="h-4 w-4" /> {busy ? 'Guardando…' : 'Programar envío'}
        </button>
        {msg && <p className={`text-[12px] ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

/** Lista de envíos programados con pausar / reanudar / eliminar. */
export function ScheduleList({ slug, rows }: { slug: string; rows: ScheduleRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, action: 'toggle' | 'delete') => {
    if (action === 'delete' && !confirm('¿Eliminar esta programación?')) return;
    setBusy(id);
    await whPost(slug, 'report-schedules', { action, id });
    setBusy(null);
    router.refresh();
  };
  if (!rows.length)
    return <EmptyState icon={CalendarClock} title="Sin envíos programados" description="Programa un reporte para recibir un resumen por correo." />;
  return (
    <ul className="-mx-5 divide-y divide-[#F1EDE5]">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#1B3D2F]">
              {r.report} <span className="ml-1">{r.active ? <Pill tone="green">Activo</Pill> : <Pill>Pausado</Pill>}</span>
            </p>
            <p className="text-[12px] text-slate-500">{r.frequency} · {r.when} · {r.recipients}</p>
            <p className="text-[11px] text-slate-400">Último envío: {r.last}</p>
          </div>
          {r.canEdit && (
            <div className="flex gap-1">
              <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'toggle')} className={btn.ghost}>
                {r.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {r.active ? 'Pausar' : 'Reanudar'}
              </button>
              <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'delete')} className={`${btn.ghost} text-rose-700 hover:bg-rose-50`}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
