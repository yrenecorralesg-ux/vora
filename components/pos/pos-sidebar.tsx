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
  ArrowLeft,
} from 'lucide-react';
import { usePos } from './pos-context';
import { getSupabaseClient } from '@/lib/supabase-client';

export function PosSidebar() {
  const router = useRouter();
  const {
    activeTenantSlug,
    activeUser,
    currentView,
    navigateTo,
    isFuncActive,
  } = usePos();

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // Ignorar error de red en logout local
    }
    router.push('/login');
  };

  const navItems = [
    {
      id: 'pos',
      label: 'POS',
      icon: Store,
      isActive: [
        'POS-01',
        'POS-02',
        'POS-03-04',
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
      isActive: false,
      onClick: () => navigateTo('POS-03-04'),
    },
    {
      id: 'inventory',
      label: 'Inventario',
      icon: Boxes,
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

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col justify-between border-r border-[#1E6B4E]/30 bg-[#144D37] p-4 text-white shadow-lg print:hidden">
      <div className="flex flex-col gap-6">
        {/* Identidad de Marca VORA / Tenant */}
        <div className="flex items-center gap-3 px-2 pt-2">
          {/* Logo estilo hoja del PDF */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1E6B4E] text-white shadow-sm">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 20A7 7 0 0 1 4 13c0-4 3-7 8-9 5 2 8 5 8 9a7 7 0 0 1-7 7Z" />
              <path d="M12 4v16" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white leading-tight">
              {activeTenantSlug === 'test1' ? 'test1' : activeTenantSlug}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A9BEA5]">
              Punto de Venta
            </span>
          </div>
        </div>

        {/* Separador sutil */}
        <div className="h-px w-full bg-[#1E6B4E]/40" />

        {/* Módulos Principales de Navegación del PDF */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  item.isActive
                    ? 'bg-[#1E6B4E] text-white shadow-sm'
                    : 'text-[#A9BEA5] hover:bg-[#1E6B4E]/40 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Pie de Barra Lateral: Operador y Salida */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#1E6B4E]/40">
        {/* Resumen del Operador en Sesión */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#0E3B2A] p-3 text-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E6B4E] font-bold text-white text-[11px]">
            {activeUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate font-bold text-white">{activeUser.name}</span>
            <span className="truncate text-[10px] uppercase tracking-wide text-[#A9BEA5]">
              {activeUser.role === 'pos_cashier'
                ? 'Cajera'
                : activeUser.role === 'pos_supervisor'
                ? 'Supervisor'
                : 'Admin Tienda'}
            </span>
          </div>
        </div>

        {/* Enlace Volver al Gestor */}
        <Link
          href="/admin/tenants"
          className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2 text-xs font-semibold text-[#A9BEA5] transition hover:bg-[#1E6B4E]/30 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Volver al Gestor</span>
        </Link>

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
