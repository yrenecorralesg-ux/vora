'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart2,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Package,
  Receipt,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Undo2,
  UserCheck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavLink = { label: string; href: string; icon: typeof Package; exact?: boolean };

export interface WarehouseSidebarBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string | null;
}

const WAREHOUSE_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard, exact: true },
  { label: 'Catálogo', href: '/catalog', icon: Package },
  { label: 'Stock y alertas', href: '/stock', icon: Boxes },
  { label: 'Entradas', href: '/receipts', icon: ArrowDownToLine },
  { label: 'Salidas', href: '/issues', icon: ArrowUpFromLine },
  { label: 'Ajustes', href: '/adjustments', icon: ClipboardCheck },
  { label: 'Devoluciones', href: '/returns', icon: Undo2 },
  { label: 'Transferencias', href: '/transfers', icon: ArrowLeftRight },
  { label: 'Kardex', href: '/kardex', icon: History },
  { label: 'Escaneo', href: '/scan', icon: ScanBarcode },
  { label: 'Almacenes', href: '/warehouses', icon: Warehouse },
  { label: 'Importaciones', href: '/imports', icon: FileSpreadsheet },
  { label: 'Proveedores', href: '/suppliers', icon: Truck },
  { label: 'Reportes', href: '/reports', icon: BarChart2 },
  { label: 'Integración POS', href: '/pos', icon: ShoppingCart },
  { label: 'Configuración', href: '/settings', icon: Settings },
];

const POS_SUBMODULES = [
  { label: 'Caja y Terminal', href: '/pos', icon: Store },
  { label: 'Ventas', href: '/pos', icon: Receipt },
  { label: 'Productos', href: '/pos', icon: Package },
  { label: 'Clientes', href: '/pos', icon: Users },
  { label: 'Reportes', href: '/pos', icon: BarChart2 },
  { label: 'Personal & Roles', href: '/pos', icon: UserCheck },
  { label: 'Configuración', href: '/pos', icon: Settings },
];

function Brand({
  tenantName,
  branding,
}: {
  tenantName: string;
  branding?: WarehouseSidebarBranding;
}) {
  const secondaryColor = branding?.secondaryColor || '#1E6B4E';
  const accentColor = branding?.accentColor || '#A9BEA5';

  return (
    <div className="flex items-center gap-3 px-1 pt-1 pb-3 border-b border-white/10">
      {branding?.logoUrl ? (
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.logoUrl} alt={tenantName} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm font-black text-sm uppercase"
          style={{ backgroundColor: secondaryColor }}
        >
          {tenantName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-base font-bold tracking-tight text-white leading-tight truncate" title={tenantName}>
          {tenantName}
        </span>
        <span className="text-[11px] font-medium truncate" style={{ color: accentColor }}>
          Portal de Gestión
        </span>
      </div>
    </div>
  );
}

function NavContent({
  base,
  slug,
  pathname,
  hidden,
  canConfigurePos,
  canAccessPos,
  branding,
  onNavigate,
}: {
  base: string;
  slug: string;
  pathname: string;
  hidden: string[];
  canConfigurePos: boolean;
  canAccessPos: boolean;
  branding?: WarehouseSidebarBranding;
  onNavigate?: () => void;
}) {
  const [whExpanded, setWhExpanded] = useState(true);
  const [posExpanded, setPosExpanded] = useState(false);

  const secondaryColor = branding?.secondaryColor || '#1E6B4E';
  const accentColor = branding?.accentColor || '#A9BEA5';

  const activeWhLinks = WAREHOUSE_LINKS.filter((l) => !hidden.includes(l.href));
  const activePosLinks = POS_SUBMODULES.filter(
    (item) => canConfigurePos || item.label !== 'Configuración',
  );

  return (
    <nav aria-label="Módulos y Submódulos" className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
      {/* Módulo Principal: Warehouse */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setWhExpanded((prev) => !prev)}
          className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold bg-white/15 text-white shadow-xs transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Warehouse className="h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-105" />
            <span className="truncate">Warehouse</span>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-200 text-white/70',
              whExpanded ? 'rotate-0' : '-rotate-90',
            )}
          />
        </button>

        {/* Desglose de Submódulos Warehouse */}
        {whExpanded && (
          <div
            className="ml-4 mt-1 pl-3 border-l-2 flex flex-col gap-1 max-h-[50vh] overflow-y-auto pr-1"
            style={{ borderColor: `color-mix(in srgb, ${secondaryColor} 50%, transparent)` }}
          >
            {activeWhLinks.map(({ label, href, icon: Icon, exact }) => {
              const full = `${base}${href}`;
              const active = exact ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
              return (
                <Link
                  key={href}
                  href={full}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                    active
                      ? 'text-white shadow-xs font-bold'
                      : 'hover:text-white hover:bg-white/10',
                  )}
                  style={
                    active
                      ? { backgroundColor: secondaryColor }
                      : { color: accentColor }
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Módulo Principal: Punto de Venta (solo para administradores de empresa) */}
      {canAccessPos && (
        <div className="flex flex-col mt-1">
          <button
            type="button"
            onClick={() => setPosExpanded((prev) => !prev)}
            className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Store className="h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-105" />
              <span className="truncate">Punto de Venta</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-200 text-white/70',
                posExpanded ? 'rotate-0' : '-rotate-90',
              )}
            />
          </button>

          {/* Desglose de Submódulos POS */}
          {posExpanded && (
            <div
              className="ml-4 mt-1 pl-3 border-l-2 flex flex-col gap-1"
              style={{ borderColor: `color-mix(in srgb, ${secondaryColor} 50%, transparent)` }}
            >
              {activePosLinks.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={`${item.label}-${idx}`}
                    href={`/t/${slug}${item.href}`}
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

/**
 * Barra lateral de Warehouse con colores de marca y desglose jerárquico por módulos desplegables.
 */
export function WarehouseSidebar({
  slug,
  tenantName,
  hidden = [],
  canConfigurePos = false,
  canAccessPos = false,
  branding,
}: {
  slug: string;
  tenantName: string;
  hidden?: string[];
  canConfigurePos?: boolean;
  canAccessPos?: boolean;
  branding?: WarehouseSidebarBranding;
}) {
  const pathname = usePathname();
  const base = `/t/${slug}/warehouse`;
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const primaryBg = branding?.primaryColor || '#144D37';
  const secondaryColor = branding?.secondaryColor || '#1E6B4E';

  const handleLogout = async () => {
    try {
      await fetch(`/api/t/${slug}/logout`, { method: 'POST' });
    } catch {
      // Ignorar error de red en logout local
    }
    window.location.href = `/t/${slug}/login`;
  };

  return (
    <>
      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-white/10 p-4 text-white shadow-xl md:flex print:hidden z-20"
        style={{
          backgroundColor: primaryBg,
          borderColor: `color-mix(in srgb, ${secondaryColor} 25%, transparent)`,
        }}
      >
        <div className="flex flex-col gap-5 overflow-hidden">
          <Brand tenantName={tenantName} branding={branding} />
          <NavContent
            base={base}
            slug={slug}
            pathname={pathname}
            hidden={hidden}
            canConfigurePos={canConfigurePos}
            canAccessPos={canAccessPos}
            branding={branding}
          />
        </div>

        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#F87171] transition hover:bg-[#B91C1C]/20 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Versión Móvil */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 text-white md:hidden print:hidden border-b border-white/10"
        style={{ backgroundColor: primaryBg }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Abrir menú de navegación"
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate font-bold">{tenantName}</span>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider font-semibold"
          style={{ color: branding?.accentColor || '#A9BEA5' }}
        >
          Warehouse
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 flex-col justify-between p-4 text-white shadow-xl"
            style={{ backgroundColor: primaryBg }}
          >
            <div className="flex flex-col gap-5 overflow-hidden">
              <div className="flex items-center justify-between">
                <Brand tenantName={tenantName} branding={branding} />
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavContent
                base={base}
                slug={slug}
                pathname={pathname}
                hidden={hidden}
                canConfigurePos={canConfigurePos}
                canAccessPos={canAccessPos}
                branding={branding}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <div className="border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#F87171] transition hover:bg-[#B91C1C]/20 hover:text-white"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
