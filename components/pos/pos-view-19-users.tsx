'use client';

import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Percent,
  Store,
} from 'lucide-react';
import { usePos } from './pos-context';
import type { PosMockUser, PosUserRole } from '@/lib/pos-demo-data';

export function PosView19Users() {
  const {
    staffUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleStaffUser,
    updateStaffPin,
    registers,
    activeBranch,
    navigateTo,
    showNotification,
    isFuncActive,
  } = usePos();

  // Filtros
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PosMockUser | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<PosUserRole>('pos_cashier');
  const [formPin, setFormPin] = useState('1234');
  const [formRegisterId, setFormRegisterId] = useState('');
  const [formCommission, setFormCommission] = useState('3.0');
  const [formActive, setFormActive] = useState(true);

  // Modal Confirmación Eliminar
  const [userToDelete, setUserToDelete] = useState<PosMockUser | null>(null);

  // Visualización de PINs
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  const togglePinReveal = (id: string) => {
    setRevealedPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormRole('pos_cashier');
    setFormPin('1234');
    setFormRegisterId(registers[0]?.id || '');
    setFormCommission('3.0');
    setFormActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: PosMockUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email || '');
    setFormRole(user.role);
    setFormPin(user.pin);
    setFormRegisterId(user.assignedRegisterId || '');
    setFormCommission(user.commission_rate_percent?.toString() || '3.0');
    setFormActive(user.is_active !== false);
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPin.trim()) {
      showNotification('Campos requeridos', 'Ingrese el nombre y PIN del usuario.', 'critical');
      return;
    }

    if (editingUser) {
      updateUser(editingUser.id, {
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        role: formRole,
        pin: formPin.trim(),
        assignedRegisterId: formRegisterId || undefined,
        commission_rate_percent: formRole === 'pos_sales_rep' ? parseFloat(formCommission) || 3.0 : undefined,
        is_active: formActive,
      });
    } else {
      createUser({
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        role: formRole,
        pin: formPin.trim(),
        assignedBranchId: activeBranch.id,
        assignedRegisterId: formRegisterId || undefined,
        commission_rate_percent: formRole === 'pos_sales_rep' ? parseFloat(formCommission) || 3.0 : undefined,
        is_active: formActive,
      });
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    const res = deleteUser(userToDelete.id);
    if (res.ok) {
      setUserToDelete(null);
    }
  };

  // Filtrado de usuarios
  const filteredUsers = staffUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active !== false) ||
      (statusFilter === 'inactive' && u.is_active === false);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Métricas
  const totalCount = staffUsers.length;
  const cashiersCount = staffUsers.filter((u) => u.role === 'pos_cashier' && u.is_active !== false).length;
  const supervisorsCount = staffUsers.filter(
    (u) => (u.role === 'pos_supervisor' || u.role === 'pos_store_admin') && u.is_active !== false,
  ).length;
  const repsCount = staffUsers.filter((u) => u.role === 'pos_sales_rep' && u.is_active !== false).length;

  return (
    <div className="space-y-6">
      {/* Cabecera Principal con Bordes Redondeados */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#1E6B4E]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">
              Gestión de Personal y Control de Roles
            </h1>
            <p className="mt-0.5 text-xs text-[#52635A]">
              CRUD de usuarios para {activeBranch.name}: Cajeros, Supervisores y Asesores comisionables.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-2xl bg-[#1E6B4E] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#16523B] transition"
          >
            <Plus className="h-4 w-4" />
            <span>Crear nuevo usuario</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('POS-17')}
            className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2.5 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition"
          >
            Configuración
          </button>
        </div>
      </div>

      {/* 4 Métricas de Personal */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#DCE3DF] bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">Total personal</span>
          <p className="mt-1 text-2xl font-black text-[#111827]">{totalCount}</p>
          <p className="text-[10px] text-[#52635A]">Usuarios registrados</p>
        </div>

        <div className="rounded-2xl border border-[#86EFAC] bg-[#DCFCE7]/70 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#14532D]">Cajeros activos</span>
          <p className="mt-1 text-2xl font-black text-[#14532D]">{cashiersCount}</p>
          <p className="text-[10px] text-[#14532D]">En mostrador</p>
        </div>

        <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7]/70 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#92400E]">Supervisores</span>
          <p className="mt-1 text-2xl font-black text-[#92400E]">{supervisorsCount}</p>
          <p className="text-[10px] text-[#92400E]">Autorización con PIN</p>
        </div>

        <div className="rounded-2xl border border-[#DDD6FE] bg-[#EDE9FE]/70 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B21B6]">Asesores de venta</span>
          <p className="mt-1 text-2xl font-black text-[#5B21B6]">{repsCount}</p>
          <p className="text-[10px] text-[#5B21B6]">Con comisiones</p>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE3DF] bg-white p-4 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#52635A]" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo electrónico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] py-2 pl-9 pr-3 text-xs font-semibold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-2 text-xs font-semibold text-[#111827] outline-none"
          >
            <option value="all">Todos los roles</option>
            <option value="pos_cashier">Cajeros</option>
            <option value="pos_supervisor">Supervisores</option>
            <option value="pos_sales_rep">Asesores de Venta</option>
            <option value="pos_store_admin">Admin Tienda</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-2 text-xs font-semibold text-[#111827] outline-none"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo Activos</option>
            <option value="inactive">Solo Inactivos</option>
          </select>
        </div>
      </div>

      {/* Tabla Maestro de Personal */}
      <div className="rounded-3xl border border-[#DCE3DF] bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E9E7] bg-[#F6F5F0] text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                <th className="py-3.5 px-4">Usuario / Personal</th>
                <th className="py-3.5 px-4">Rol en Caja</th>
                <th className="py-3.5 px-4">Caja Asignada</th>
                <th className="py-3.5 px-4">Clave PIN</th>
                <th className="py-3.5 px-4">Comisión</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9E7]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#52635A]">
                    No se encontraron usuarios registrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const reg = registers.find((r) => r.id === user.assignedRegisterId);
                  const isRevealed = revealedPins[user.id];

                  return (
                    <tr key={user.id} className="hover:bg-[#F9FAF9] transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6F5F0] text-xs font-black text-[#111827]">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-[#111827] block text-xs">
                              {user.name}
                            </span>
                            <span className="text-[11px] text-[#52635A]">
                              {user.email || 'Sin correo asociado'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            user.role === 'pos_supervisor'
                              ? 'bg-[#FEF3C7] text-[#92400E]'
                              : user.role === 'pos_sales_rep'
                              ? 'bg-[#EDE9FE] text-[#6D28D9]'
                              : user.role === 'pos_store_admin'
                              ? 'bg-[#E0E7FF] text-[#3730A3]'
                              : 'bg-[#DCFCE7] text-[#14532D]'
                          }`}
                        >
                          {user.role === 'pos_supervisor'
                            ? 'Supervisor'
                            : user.role === 'pos_sales_rep'
                            ? 'Asesor Venta'
                            : user.role === 'pos_store_admin'
                            ? 'Admin Tienda'
                            : 'Cajero(a)'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs font-semibold text-[#111827]">
                        {reg ? `${reg.name} (${reg.code})` : 'Cualquier caja'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="font-bold text-[#111827]">
                            {isRevealed ? user.pin : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePinReveal(user.id)}
                            className="p-1 text-[#52635A] hover:text-[#111827]"
                            title={isRevealed ? 'Ocultar PIN' : 'Ver PIN'}
                          >
                            {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs">
                        {user.role === 'pos_sales_rep' ? (
                          <span className="font-bold text-[#6D28D9]">
                            {user.commission_rate_percent ?? 3.0}%
                          </span>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleStaffUser(user.id)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                            user.is_active !== false
                              ? 'bg-[#DCFCE7] text-[#14532D] hover:bg-[#FEE2E2] hover:text-[#991B1B]'
                              : 'bg-[#FEE2E2] text-[#991B1B] hover:bg-[#DCFCE7] hover:text-[#14532D]'
                          }`}
                          title="Clic para cambiar estado activo/inactivo"
                        >
                          {user.is_active !== false ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="rounded-lg p-1.5 text-[#52635A] hover:bg-[#F6F5F0] hover:text-[#111827]"
                            title="Editar usuario"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const newPin = prompt(`Ingrese nuevo PIN (4 dígitos) para ${user.name}:`, user.pin);
                              if (newPin && newPin.trim().length >= 4) {
                                updateStaffPin(user.id, newPin.trim());
                              }
                            }}
                            className="rounded-lg p-1.5 text-[#52635A] hover:bg-[#F6F5F0] hover:text-[#1E6B4E]"
                            title="Cambiar PIN"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            className="rounded-lg p-1.5 text-[#52635A] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Crear o Editar Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[#DCFCE7] p-2 text-[#1E6B4E]">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111827]">
                    {editingUser ? 'Editar Usuario de Sede' : 'Crear Nuevo Usuario de Sede'}
                  </h3>
                  <p className="text-[11px] text-[#52635A]">
                    Gestión de credenciales y roles para {activeBranch.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1 text-[#52635A] hover:bg-[#F6F5F0]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#111827]">Nombre completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pedro Ramos"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2.5 font-semibold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#111827]">Correo / Usuario</label>
                  <input
                    type="email"
                    placeholder="pedro.cajero@ejemplo.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2.5 font-semibold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#111827]">Rol asignado *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as PosUserRole)}
                    className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2.5 font-semibold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                  >
                    <option value="pos_cashier">Cajero(a) de Mostrador</option>
                    <option value="pos_sales_rep">Asesor(a) de Venta Comisionable</option>
                    <option value="pos_supervisor">Supervisor(a) de Sede</option>
                    <option value="pos_store_admin">Administrador(a) de Tienda</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#111827]">Clave PIN de caja (4 dígitos) *</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    placeholder="1234"
                    className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2.5 font-mono font-bold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#111827]">Caja física habitual</label>
                  <select
                    value={formRegisterId}
                    onChange={(e) => setFormRegisterId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2.5 font-semibold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                  >
                    <option value="">Cualquier caja de la sede</option>
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                {formRole === 'pos_sales_rep' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#111827]">Comisión por venta (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formCommission}
                      onChange={(e) => setFormCommission(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#DCE3DF] p-2.5 font-bold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#E5E9E7]">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#111827]">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1E6B4E]"
                  />
                  <span>Usuario habilitado para operar caja y turnos</span>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-[#E5E9E7]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-[#DCE3DF] px-4 py-2 font-bold text-[#52635A] hover:bg-[#F6F5F0]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1E6B4E] px-5 py-2 font-bold text-white shadow-xs hover:bg-[#16523B]"
                >
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmación Eliminar */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-[#FCA5A5] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111827]">¿Eliminar Usuario?</h3>
                <p className="text-xs text-[#52635A]">Esta acción desvinculará al personal de la sede.</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
              Se eliminará a <strong>{userToDelete.name}</strong> ({userToDelete.email || 'Sin correo'}). Si tiene turnos abiertos, la operación será bloqueada.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="rounded-xl border border-[#DCE3DF] px-4 py-2 text-xs font-bold text-[#52635A] hover:bg-[#F6F5F0]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#B91C1C]"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

