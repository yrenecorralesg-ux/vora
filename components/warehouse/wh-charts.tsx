'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/*
 * Paleta validada (dataviz/validate_palette.js, modo claro): verde #1E7A55 y
 * terracota #C97857. La separación para daltonismo (protan ΔE 6.4) exige
 * codificación secundaria: leyenda con nombres, 2px entre barras y tooltip.
 */
const SERIES = [
  { key: 'entradas', label: 'Entradas', color: '#1E7A55' },
  { key: 'salidas', label: 'Salidas', color: '#C97857' },
] as const;

const qty = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 });

type Point = { label: string; entradas: number; salidas: number };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E7E2D7] bg-white px-3 py-2 text-[12px] shadow-lg">
      <p className="mb-1 font-semibold text-[#1B3D2F]">{label}</p>
      {SERIES.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <p key={s.key} className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}: <span className="font-semibold tabular-nums text-[#1B3D2F]">{qty.format(v)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Unidades que entran y salen del stock vendible por día (últimos 14 días). */
export function MovementsChart({ data }: { data: Point[] }) {
  const empty = data.every((d) => !d.entradas && !d.salidas);
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[12px] text-slate-600" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {empty ? (
        <p className="flex h-52 items-center justify-center rounded-xl bg-[#F8F6F1] text-[12px] text-slate-500">
          Sin movimientos en los últimos 14 días.
        </p>
      ) : (
        <div className="h-52" role="img" aria-label="Entradas y salidas de unidades por día en los últimos 14 días">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="#EFEBE2" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#285C49', fillOpacity: 0.06 }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
