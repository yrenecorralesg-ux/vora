import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Piezas de la plantilla visual común de las vistas WH (encabezado, indicadores, tabla, acciones). */

export function WhHeader({ code, title, subtitle, children }: { code: string; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#E4E0D6] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#285C49]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#285C49]">{code}</span>
          <h1 className="truncate text-lg font-bold text-[#1B3D2F] sm:text-xl">{title}</h1>
        </div>
        <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

const TONES = {
  default: 'text-[#1B3D2F]',
  warn: 'text-amber-700',
  danger: 'text-rose-700',
  good: 'text-emerald-700',
} as const;

export function Kpi({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className="rounded-2xl border border-[#E4E0D6] bg-white px-4 py-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', TONES[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-[#E4E0D6] bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE4] px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-[#1B3D2F]">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Tabla con desplazamiento horizontal propio para pantallas angostas. */
export function DataTable({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.flat().filter(Boolean).length > 0 : Boolean(children);
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#DCE3DF] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-2 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(odd)]:bg-[#F4F7F5] [&>tr>td]:px-2 [&>tr>td]:py-2">
          {hasRows ? children : (
            <tr>
              <td colSpan={head.length} className="py-10 text-center text-slate-500">{empty ?? 'Sin registros.'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const PILL = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  slate: 'bg-slate-50 text-slate-600 border-slate-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
} as const;

export function Pill({ tone = 'slate', children }: { tone?: keyof typeof PILL; children: ReactNode }) {
  return <span className={cn('inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', PILL[tone])}>{children}</span>;
}

export function ActionsBar({ items }: { items: string[] }) {
  return (
    <p className="rounded-xl bg-[#EEF3EF] px-4 py-2 text-[11px] text-[#285C49]">
      Acciones: {items.join('  |  ')}
    </p>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-9 items-center rounded-lg bg-[#285C49] px-4 text-[13px] font-semibold text-white hover:bg-[#1F4A3A]">
      {children}
    </Link>
  );
}

const SECONDARY =
  'inline-flex h-9 items-center rounded-lg border border-[#DCE3DF] bg-white px-4 text-[13px] font-medium text-[#1B3D2F] hover:bg-[#F4F7F5]';

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={SECONDARY}>{children}</Link>;
}

/** Descarga CSV desde una ruta API (enlace normal: sin prefetch ni navegación del router). */
export function DownloadLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className={SECONDARY}>{children}</a>;
}

/** Formulario GET para filtros: no necesita JavaScript y deja la URL compartible. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2 [&_input]:h-9 [&_input]:rounded-lg [&_input]:border [&_input]:border-[#DCE3DF] [&_input]:px-3 [&_input]:text-[13px] [&_select]:h-9 [&_select]:rounded-lg [&_select]:border [&_select]:border-[#DCE3DF] [&_select]:bg-white [&_select]:px-2 [&_select]:text-[13px]">
      {children}
      <button type="submit" className="h-9 rounded-lg border border-[#285C49] px-4 text-[13px] font-medium text-[#285C49] hover:bg-[#285C49]/5">
        Filtrar
      </button>
    </form>
  );
}

export function FieldLabel({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-[11px] font-medium text-slate-600', className)}>
      {label}
      {children}
    </label>
  );
}
