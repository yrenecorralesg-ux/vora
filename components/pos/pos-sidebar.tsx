'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  Receipt,
  Package,
  Boxes,
  Users,
  UserCheck,
  BarChart2,
  Settings,
  LogOut,
  ChevronDown,
  Warehouse,
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  Undo2,
  ArrowLeftRight,
  History,
  ScanBarcode,
  Truck,
  FileSpreadsheet,
} from 'lucide-react';
import { usePos } from './pos-context';
import { cn } from '@/lib/utils';

export function PosSidebar() {
  const router = useRouter();
  const {
    activeTenantSlug,
    tenantName,
    tenantBranding,
    activeUser,
    currentView,
    navigateTo,
    isFuncActive,
    isWarehouseEnabled,
  } = usePos();

  const [posExpanded, setPosExpanded] = useState(true);
  const [whExpanded, setWhExpanded] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch(`/api/t/${activeTenantSlug}/logout`, { method: 'POST' });
    } catch {
      // Ignorar error de red en logout local
    }
    router.replace(`/t/${activeTenantSlug}/login`);
  };

  const isPosModuleActive = [
    'POS-01',
    'POS-02',
    'POS-03-04',
    'POS-06',
    'POS-11',
    'POS-12',
    'POS-14',
    'POS-15',
    'POS-13',
    'POS-05',
    'POS-16',
    'POS-17',
    'POS-18',
    'POS-19',
    'POS-20',
  ].includes(currentView);

  const posSubmodules = [
    {
      id: 'pos_main',
      label: 'Caja y Terminal',
      icon: Store,
      isActive: [
        'POS-01',
        'POS-02',
        'POS-06',
        'POS-11',
        'POS-12',
        'POS-14',
        'POS-15',
      ].includes(currentView),
      onClick: () => navigateTo('POS-01'),
    },
    {
      id: 'sales',
      label: 'Ventas',
      icon: Receipt,
      isActive: currentView === 'POS-13',
      onClick: () => navigateTo('POS-13'),
    },
    {
      id: 'products',
      label: 'Productos',
      icon: Package,
      isActive: currentView === 'POS-03-04',
      onClick: () => navigateTo('POS-03-04'),
    },
    {
      id: 'customers',
      label: 'Clientes',
      icon: Users,
      isActive: currentView === 'POS-05',
      onClick: () => navigateTo('POS-05'),
    },
    ...(isFuncActive('pos_reports')
      ? [
        {
          id: 'reports',
          label: 'Reportes',
          icon: BarChart2,
          isActive: currentView === 'POS-16',
          onClick: () => navigateTo('POS-16'),
        },
      ]
      : []),
    ...(isFuncActive('pos_supervisor_users_crud')
      ? [
        {
          id: 'staff_users',
          label: 'Personal & Roles',
          icon: UserCheck,
          isActive: currentView === 'POS-19',
          onClick: () => navigateTo('POS-19'),
        },
      ]
      : []),
    ...(isFuncActive('pos_order_dispatch_kds')
      ? [
        {
          id: 'dispatch_kds',
          label: 'Despacho & KDS',
          icon: Boxes,
          isActive: currentView === 'POS-20',
          onClick: () => navigateTo('POS-20'),
        },
      ]
      : []),
    ...(isFuncActive('pos_settings')
      ? [
        {
          id: 'settings',
          label: 'Configuración',
          icon: Settings,
          isActive: currentView === 'POS-17' || currentView === 'POS-18',
          onClick: () => navigateTo('POS-17'),
        },
      ]
      : []),
  ];

  const warehouseSubmodules = [
    { label: 'Dashboard', href: '', icon: LayoutDashboard },
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
    { label: 'Configuración', href: '/settings', icon: Settings },
  ];

  const primaryBg = tenantBranding?.primaryColor || 'var(--crm-primary, #144D37)';
  const secondaryColor = tenantBranding?.secondaryColor || 'var(--crm-secondary, #1E6B4E)';
  const accentColor = tenantBranding?.accentColor || 'var(--crm-accent, #A9BEA5)';
  const displayName = tenantName || (activeTenantSlug === 'test1' ? 'test1' : activeTenantSlug);

  return (
    <aside
      className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-[#144D37] p-4 text-white shadow-xl print:hidden z-20"
      style={{
        backgroundColor: primaryBg,
        borderColor: `color-mix(in srgb, ${secondaryColor} 25%, transparent)`,
      }}
    >
      <div className="flex flex-col gap-5 overflow-hidden">
        {/* Identidad de Marca / Tenant */}
        <div className="flex items-center gap-3 px-1 pt-1 pb-3 border-b border-white/10">
          {tenantBranding?.logoUrl ? (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenantBranding.logoUrl} alt={displayName} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm font-black text-sm uppercase"
              style={{ backgroundColor: secondaryColor }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-white leading-tight truncate" title={displayName}>
              {displayName}
            </span>
            <span className="text-[11px] font-medium truncate" style={{ color: accentColor }}>
              Portal de Gestión
            </span>
          </div>
        </div>

        {/* Lista de Módulos Principales con Desglose */}
        <nav aria-label="Módulos y Submódulos" className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {/* Módulo Principal 1: Punto de Venta */}
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setPosExpanded((prev) => !prev)}
              className={cn(
                'group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                isPosModuleActive
                  ? 'bg-white/15 text-white shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white',
              )}
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

            {/* Submódulos de POS desplegables */}
            {posExpanded && (
              <div
                className="ml-4 mt-1 pl-3 border-l-2 flex flex-col gap-1"
                style={{ borderColor: `color-mix(in srgb, ${secondaryColor} 50%, transparent)` }}
              >
                {posSubmodules.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all text-left',
                        item.isActive
                          ? 'text-white shadow-xs font-bold'
                          : 'hover:text-white hover:bg-white/10',
                      )}
                      style={
                        item.isActive
                          ? { backgroundColor: secondaryColor }
                          : { color: accentColor }
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Módulo Principal 2: Warehouse (si está contratado o habilitado) */}
          {(isWarehouseEnabled || true) && (
            <div className="flex flex-col mt-1">
              <button
                type="button"
                onClick={() => setWhExpanded((prev) => !prev)}
                className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-all"
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

              {/* Submódulos de Warehouse desplegables */}
              {whExpanded && (
                <div
                  className="ml-4 mt-1 pl-3 border-l-2 flex flex-col gap-1 max-h-[360px] overflow-y-auto pr-1"
                  style={{ borderColor: `color-mix(in srgb, ${secondaryColor} 50%, transparent)` }}
                >
                  {warehouseSubmodules.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={`/t/${activeTenantSlug}/warehouse${item.href}`}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all"
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
      </div>

      {/* Pie de Barra Lateral: Operador y Salida */}
      <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
        {/* Resumen del Operador en Sesión */}
        <div className="flex items-center gap-3 rounded-2xl p-2.5 bg-black/20 text-xs">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white text-[11px]"
            style={{ backgroundColor: secondaryColor }}
          >
            {activeUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate font-bold text-white">{activeUser.name}</span>
            <span className="truncate text-[10px] uppercase tracking-wide" style={{ color: accentColor }}>
              {activeUser.role === 'pos_cashier'
                ? 'Cajera'
                : activeUser.role === 'pos_supervisor'
                  ? 'Supervisor'
                  : activeUser.role === 'pos_sales_rep'
                    ? 'Asesor'
                    : 'Admin Tienda'}
            </span>
          </div>
        </div>

        {/* Botón Cerrar Sesión */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#F87171] transition hover:bg-[#B91C1C]/20 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
