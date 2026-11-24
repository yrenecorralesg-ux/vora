'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Layers,
  Menu,
  Package,
  Ruler,
  ScanBarcode,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Undo2,
  Warehouse,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavLink = { label: string; href: string; icon: typeof Package; exact?: boolean };

// Secciones de la barra lateral de los wireframes (WH-01..WH-27).
const NAV: { group: string; links: NavLink[] }[] = [
  {
    group: 'General',
    links: [
      { label: 'Dashboard', href: '', icon: LayoutDashboard, exact: true },
      { label: 'Catálogo', href: '/catalog', icon: Package },
    ],
  },
  {
    group: 'Inventario',
    links: [
      { label: 'Stock y alertas', href: '/stock', icon: Boxes },
      { label: 'Entradas', href: '/receipts', icon: ArrowDownToLine },
      { label: 'Salidas', href: '/issues', icon: ArrowUpFromLine },
      { label: 'Ajustes', href: '/adjustments', icon: ClipboardCheck },
      { label: 'Devoluciones', href: '/returns', icon: Undo2 },
      { label: 'Transferencias', href: '/transfers', icon: ArrowLeftRight },
      { label: 'Kardex', href: '/kardex', icon: History },
      { label: 'Escaneo', href: '/scan', icon: ScanBarcode },
    ],
  },
  {
    group: 'Datos',
    links: [
      { label: 'Almacenes', href: '/warehouses', icon: Warehouse },
      { label: 'Importaciones', href: '/imports', icon: FileSpreadsheet },
      { label: 'Proveedores', href: '/suppliers', icon: Truck },
    ],
  },
  {
    group: 'Análisis',
    links: [
      { label: 'Reportes', href: '/reports', icon: BarChart3 },
      { label: 'Integración POS', href: '/pos', icon: ShoppingCart },
    ],
  },
  {
    group: 'Configuración',
    links: [
      { label: 'General', href: '/settings', icon: Settings },
      { label: 'Sector', href: '/sector', icon: Store },
      { label: 'Atributos', href: '/attributes', icon: Tags },
      { label: 'Unidades', href: '/units', icon: Ruler },
      { label: 'Roles', href: '/roles', icon: ShieldCheck },
    ],
  },
];

function NavList({ base, pathname, hidden, onNavigate }: { base: string; pathname: string; hidden: string[]; onNavigate?: () => void }) {
  const isModuleActive = pathname === base || pathname === `${base}/`;
  const groups = NAV.map((g) => ({ ...g, links: g.links.filter((l) => !hidden.includes(l.href)) })).filter((g) => g.links.length);
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* 1. Módulo Principal en Primer Orden */}
      <Link
        href={base}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 rounded-2xl p-3 text-left transition-all border shadow-sm',
          isModuleActive
            ? 'bg-[#1E6B4E] border-white/40 text-white shadow-md'
            : 'bg-black/20 border-white/10 hover:border-white/25 text-white/90 hover:bg-white/5',
        )}
      >
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs',
            isModuleActive ? 'bg-white/20' : 'bg-[#1E6B4E]',
          )}
        >
          <Warehouse className="h-5 w-5" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-black tracking-wide text-white uppercase">
              Módulo Warehouse
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-white/15 border-white/25 text-white">
              Principal
            </span>
          </div>
          <span className="text-[10px] font-medium text-[#A9BEA5] truncate">
            Almacén e Inventario
          </span>
        </div>
      </Link>

      {/* 2. Submódulos y Funciones en Orden Jerárquico */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A9BEA5]/80">
            Funciones del Módulo
          </span>
        </div>

        <nav
          aria-label="Submódulos de Warehouse"
          className="ml-4 pl-3 border-l-2 border-[#1E6B4E]/60 flex-1 space-y-3.5 overflow-y-auto pr-1"
        >
          {groups.map(({ group, links }) => (
            <div key={group}>
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-[#A9BEA5]/70">
                {group}
              </p>
              <ul className="space-y-0.5">
                {links.map(({ label, href, icon: Icon, exact }) => {
                  const full = `${base}${href}`;
                  const active = exact ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
                  return (
                    <li key={href}>
                      <Link
                        href={full}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold transition',
                          active
                            ? 'bg-[#1E6B4E] text-white shadow-xs font-bold'
                            : 'text-[#D7E3DC] hover:bg-[#1E6B4E]/40 hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Brand({ tenantName }: { tenantName: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1E6B4E]">
        <Layers className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold leading-tight">{tenantName}</p>
        <p className="text-[10px] uppercase tracking-wider text-[#A9BEA5]">Warehouse</p>
      </div>
    </div>
  );
}

/**
 * Barra lateral de Warehouse con el mismo estilo que la del POS. En móvil se abre como cajón.
 * hidden: rutas que no aplican (módulo no contratado, función desactivada o sin permiso).
 */
export function WarehouseSidebar({ slug, tenantName, hidden = [] }: { slug: string; tenantName: string; hidden?: string[] }) {
  const pathname = usePathname();
  const base = `/t/${slug}/warehouse`;
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-4 border-r border-[#1E6B4E]/30 bg-[#144D37] p-4 text-white shadow-lg md:flex print:hidden">
        <Brand tenantName={tenantName} />
        <NavList base={base} pathname={pathname} hidden={hidden} />
        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch(`/api/t/${slug}/logout`, { method: 'POST' });
              } catch {}
              window.location.href = `/t/${slug}/login`;
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-[#F87171] transition hover:bg-[#B91C1C]/20 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-30 flex items-center gap-3 bg-[#144D37] px-4 py-3 text-white md:hidden print:hidden">
        <button type="button" aria-label="Abrir menú de Warehouse" onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
        <span className="truncate font-bold">{tenantName}</span>
        <span className="text-[10px] uppercase tracking-wider text-[#A9BEA5]">Warehouse</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-4 bg-[#144D37] p-4 text-white shadow-xl">
            <div className="flex items-start justify-between">
              <Brand tenantName={tenantName} />
              <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList base={base} pathname={pathname} hidden={hidden} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
