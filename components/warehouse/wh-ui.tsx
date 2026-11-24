import Link from 'next/link';
import type { ReactNode } from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Piezas visuales comunes de Warehouse. Siguen los wireframes del documento
 * (barra lateral verde, fondo crema, título con acción principal a la derecha,
 * tarjeta blanca con tabla) con acabado "SaaS limpio": iconos, más aire,
 * bordes sutiles, filas con hover y estados vacíos que invitan a actuar.
 */

export const WH = {
  primary: 'var(--crm-primary, #285C49)',
  primaryHover: 'color-mix(in srgb, var(--crm-primary, #285C49) 85%, black)',
  ink: '#1B3D2F',
  border: '#E7E2D7',
  soft: '#F8F6F1',
} as const;

/** Clases de botón reutilizables (también en formularios cliente). */
export const btn = {
  primary:
    'inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--crm-primary,#285C49)] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-primary,#285C49)]/40 disabled:opacity-50',
  secondary:
    'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#E7E2D7] bg-white px-4 text-[13px] font-medium text-[#1B3D2F] shadow-sm transition hover:border-[var(--crm-primary,#285C49)]/40 hover:bg-[#F8F6F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-primary,#285C49)]/30 disabled:opacity-50',
  ghost:
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-[var(--crm-primary,#285C49)] transition hover:bg-[var(--crm-primary,#285C49)]/10',
  danger:
    'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-[13px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50',
} as const;

/** Campo de formulario con el mismo acabado en todas las vistas. */
export const field =
  'h-9 w-full rounded-xl border border-[#E7E2D7] bg-white px-3 text-[13px] text-[#1B3D2F] shadow-sm transition placeholder:text-slate-400 focus:border-[var(--crm-primary,#285C49)] focus:outline-none focus:ring-2 focus:ring-[var(--crm-primary,#285C49)]/15 disabled:bg-slate-50';

export function WhHeader({
  code,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  code: string;
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--crm-primary,#285C49)] text-white shadow-sm sm:flex">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-[#1B3D2F] sm:text-2xl">{title}</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {subtitle}
            <span className="ml-2 align-middle font-mono text-[10px] text-slate-400" title="Código de vista del documento de especificación">
              {code}
            </span>
          </p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

const TONES = {
  default: { value: 'text-[#1B3D2F]', icon: 'bg-[var(--crm-primary,#285C49)]/10 text-[var(--crm-primary,#285C49)]' },
  warn: { value: 'text-amber-700', icon: 'bg-amber-100 text-amber-700' },
  danger: { value: 'text-rose-700', icon: 'bg-rose-100 text-rose-700' },
  good: { value: 'text-emerald-700', icon: 'bg-emerald-100 text-emerald-700' },
} as const;

export function Kpi({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONES;
  icon?: LucideIcon;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        'h-full rounded-2xl border border-[#E7E2D7] bg-white p-4 shadow-[0_1px_2px_rgba(27,61,47,0.04)] transition',
        href && 'hover:-translate-y-0.5 hover:border-[var(--crm-primary,#285C49)]/30 hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', TONES[tone].icon)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums tracking-tight', TONES[tone].value)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-primary,#285C49)]/30 rounded-2xl">{body}</Link> : body;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sin relleno interior (tablas que llegan al borde). */
  flush?: boolean;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-[#E7E2D7] bg-white shadow-[0_1px_2px_rgba(27,61,47,0.04)]', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFEBE2] px-5 py-3.5">
          <div>
            {title && <h2 className="text-[14px] font-semibold text-[#1B3D2F]">{title}</h2>}
            {description && <p className="text-[12px] text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

/** Estado vacío con icono, explicación y acción sugerida. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--crm-primary,#285C49)]/10 text-[var(--crm-primary,#285C49)]">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="text-[14px] font-semibold text-[#1B3D2F]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12px] text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Tabla con cabecera suave, filas con hover y desplazamiento horizontal propio. */
export function DataTable({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.flat().filter(Boolean).length > 0 : Boolean(children);
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[13px]">
        <thead>
          <tr className="border-y border-[#EFEBE2] bg-[#F8F6F1] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-5 py-2.5 first:pl-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1EDE5] text-[#1B3D2F] [&>tr]:transition-colors [&>tr:hover]:bg-[#F8F6F1]/70 [&>tr>td]:px-5 [&>tr>td]:py-3">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="!py-0">
                {typeof empty === 'string' || empty === undefined ? (
                  <EmptyState title={(empty as string) ?? 'Sin registros.'} />
                ) : (
                  empty
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const PILL = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
} as const;

const DOT = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500', slate: 'bg-slate-400', blue: 'bg-sky-500' } as const;

export function Pill({ tone = 'slate', children }: { tone?: keyof typeof PILL; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', PILL[tone])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[tone])} />
      {children}
    </span>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={btn.primary}>
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={btn.secondary}>
      {children}
    </Link>
  );
}

/** Descarga CSV desde una ruta API (enlace normal: sin prefetch ni navegación del router). */
export function DownloadLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={btn.secondary}>
      {children}
    </a>
  );
}

/** Formulario GET para filtros: no necesita JavaScript y deja la URL compartible. */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref?: string }) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-center gap-2 [&_input]:h-9 [&_input]:rounded-xl [&_input]:border [&_input]:border-[#E7E2D7] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[13px] [&_input]:shadow-sm [&_input:focus]:border-[var(--crm-primary,#285C49)] [&_input:focus]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-[var(--crm-primary,#285C49)]/15 [&_select]:h-9 [&_select]:rounded-xl [&_select]:border [&_select]:border-[#E7E2D7] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[13px] [&_select]:shadow-sm [&_select:focus]:border-[var(--crm-primary,#285C49)] [&_select:focus]:outline-none"
    >
      {children}
      <button type="submit" className={btn.secondary}>
        Filtrar
      </button>
      {resetHref && (
        <Link href={resetHref} className={btn.ghost}>
          Limpiar
        </Link>
      )}
    </form>
  );
}

/** Campo de búsqueda con icono para usar dentro de FilterBar. */
export function SearchInput({ name = 'q', defaultValue, placeholder }: { name?: string; defaultValue?: string; placeholder: string }) {
  return (
    <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className="w-full !pl-9" />
    </div>
  );
}

export function FieldLabel({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-[12px] font-medium text-slate-600', className)}>
      {label}
      {children}
    </label>
  );
}

/** Enlace de texto con el color de la marca. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[var(--crm-primary,#285C49)] hover:underline">
      {children}
    </Link>
  );
}
