'use client';

import React from 'react';
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
} from 'lucide-react';
import { usePos } from './pos-context';

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
  } = usePos();

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
  ].includes(currentView);

  const submodules = [
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
      isActive: false,
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

  const primaryBg = tenantBranding?.primaryColor || 'var(--crm-primary, #144D37)';
  const secondaryColor = tenantBranding?.secondaryColor || 'var(--crm-secondary, #1E6B4E)';
  const accentColor = tenantBranding?.accentColor || 'var(--crm-accent, #A9BEA5)';
  const displayName = tenantName || (activeTenantSlug === 'test1' ? 'test1' : activeTenantSlug);

  return (
    <aside
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col justify-between border-r border-[#1E6B4E]/30 bg-[#144D37] p-4 text-white shadow-lg print:hidden"
      style={{
        backgroundColor: primaryBg,
        borderColor: `color-mix(in srgb, ${secondaryColor} 30%, transparent)`,
      }}
    >
      <div className="flex flex-col gap-6">
        {/* Identidad de Marca VORA / Tenant */}
        <div className="flex items-center gap-3 px-2 pt-2">
          {/* Logo del tenant o monograma con color secundario */}
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
            <span
              className="text-[10px] font-semibold uppercase tracking-wider truncate"
              style={{ color: accentColor }}
            >
              Punto de Venta
            </span>
          </div>
        </div>

        {/* Separador sutil */}
        <div
          className="h-px w-full"
          style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 40%, transparent)` }}
        />

        {/* 1. Módulo Principal en Primer Orden */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigateTo('POS-01')}
            className={`flex items-center gap-3 rounded-2xl p-3 text-left transition-all border shadow-sm ${
              isPosModuleActive
                ? 'border-white/40 text-white'
                : 'border-white/10 hover:border-white/25 text-white/90 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: isPosModuleActive
                ? secondaryColor
                : 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
              style={{
                backgroundColor: isPosModuleActive
                  ? 'rgba(255, 255, 255, 0.2)'
                  : secondaryColor,
              }}
            >
              <Store className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-black tracking-wide text-white uppercase">
                  Módulo POS
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    color: '#FFFFFF',
                  }}
                >
                  Principal
                </span>
              </div>
              <span
                className="text-[10px] font-medium truncate"
                style={{ color: accentColor }}
              >
                Caja y Terminal de Venta
              </span>
            </div>
          </button>

          {/* 2. Submódulos y Funciones en Orden Jerárquico */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 px-3 py-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Funciones del Módulo
              </span>
            </div>

            <nav
              className="ml-4 pl-3 border-l-2 flex flex-col gap-1"
              style={{ borderColor: `color-mix(in srgb, ${secondaryColor} 50%, transparent)` }}
              aria-label="Submódulos de POS"
            >
              {submodules.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all ${
                      item.isActive
                        ? 'text-white shadow-xs'
                        : 'hover:text-white hover:bg-white/10'
                    }`}
                    style={
                      item.isActive
                        ? { backgroundColor: secondaryColor }
                        : { color: accentColor }
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Pie de Barra Lateral: Operador y Salida */}
      <div
        className="flex flex-col gap-2 pt-4 border-t"
        style={{ borderColor: `color-mix(in srgb, ${secondaryColor} 40%, transparent)` }}
      >
        {/* Resumen del Operador en Sesión */}
        <div
          className="flex items-center gap-3 rounded-2xl p-3 text-xs"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)' }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white text-[11px]"
            style={{ backgroundColor: secondaryColor }}
          >
            {activeUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate font-bold text-white">{activeUser.name}</span>
            <span
              className="truncate text-[10px] uppercase tracking-wide"
              style={{ color: accentColor }}
            >
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
          className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2 text-xs font-semibold text-[#F87171] transition hover:bg-[#B91C1C]/20 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
