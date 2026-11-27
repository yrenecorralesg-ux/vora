'use client';

import React, { useState } from 'react';
import { Users, Search, KeyRound, ShieldCheck } from 'lucide-react';
import { usePos } from './pos-context';
import { isPosOperatorRole } from '@/lib/role-modules';

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Administrador de empresa',
  pos_store_admin: 'Administrador de tienda',
  pos_supervisor: 'Supervisor',
  pos_cashier: 'Cajero',
  pos_sales_rep: 'Asesor de venta',
  pos_auditor: 'Auditor',
  wh_manager: 'Administrador de almacén',
  wh_supervisor: 'Supervisor de almacén',
  wh_clerk: 'Almacenista',
  wh_scanner: 'Operador de escaneo',
  wh_auditor: 'Auditor de almacén',
};

/**
 * POS-19 · Personal. Muestra los usuarios reales de la empresa (Supabase Auth +
 * tenant_memberships). Las altas, roles y bajas se gestionan en el gestor de
 * VORA; cada supervisor define su PIN personal en Configuración.
 */
export function PosView19Users() {
  const { staffUsers, supervisors, activeUser, setIsOperatorModalOpen } = usePos();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const posStaff = staffUsers.filter((u) => isPosOperatorRole(u.role));
  const q = query.trim().toLowerCase();
  const filtered = posStaff.filter(
    (u) =>
      (roleFilter === 'all' || u.role === roleFilter) &&
      (!q || u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)),
  );
  const roles = Array.from(new Set(posStaff.map((u) => u.role)));
  const supervisorIds = new Set(supervisors.map((s) => s.id));

  const stats = [
    { label: 'Total personal POS', value: posStaff.length, hint: 'Operadores POS y administradores' },
    { label: 'Activos', value: posStaff.filter((u) => u.is_active).length, hint: 'Con acceso vigente' },
    { label: 'Cajeros', value: posStaff.filter((u) => u.role === 'pos_cashier' && u.is_active).length, hint: 'Rol cajero' },
    { label: 'Autorizan con PIN', value: supervisors.length, hint: 'Supervisores con PIN' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#1E6B4E]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">Personal de la empresa</h1>
            <p className="mt-0.5 text-xs text-[#52635A]">
              Usuarios con acceso al POS. Altas, roles y bajas se administran en el gestor de VORA.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOperatorModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2.5 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition"
        >
          <KeyRound className="h-4 w-4" />
          Configurar mi PIN / Cambiar operador
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#DCE3DF] bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">{s.label}</span>
            <p className="mt-1 text-2xl font-black text-[#111827]">{s.value}</p>
            <p className="text-[10px] text-[#52635A]">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#52635A]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o correo"
              className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] py-2 pl-9 pr-3 text-xs"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-2 text-xs font-semibold"
          >
            <option value="all">Todos los roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#52635A]">No hay usuarios que coincidan con el filtro.</p>
        ) : (
          <div className="divide-y divide-[#E5E9E7]">
            {filtered.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                <div>
                  <p className="font-bold text-[#111827]">
                    {u.name}
                    {u.id === activeUser.id && <span className="ml-2 text-[10px] font-semibold text-[#52635A]">(tú)</span>}
                  </p>
                  <p className="text-[11px] text-[#52635A]">
                    {u.email ?? 'Sin correo'} · {ROLE_LABELS[u.role] ?? u.role}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {supervisorIds.has(u.id) && (
                    <span className="flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-bold text-[#92400E]">
                      <ShieldCheck className="h-3 w-3" /> Autoriza con PIN
                    </span>
                  )}
                  {u.offline_pin_ready && (
                    <span className="rounded-full bg-[#E0F2FE] px-2.5 py-1 text-[10px] font-bold text-[#0369A1]">
                      PIN Offline
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      u.is_active ? 'bg-[#DCFCE7] text-[#14532D]' : 'bg-[#FEE2E2] text-[#991B1B]'
                    }`}
                  >
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
