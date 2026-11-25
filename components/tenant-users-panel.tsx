'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  Mail,
  User,
  X,
} from 'lucide-react';
import type { TenantUserDisplay } from '@/lib/tenant-users';
import { AdminConfigPermissionsCard } from '@/components/admin-config-permissions';
import { DEFAULT_CONFIG_ALLOWED_ROLES } from '@/lib/config-permissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PREDEFINED_ROLES = [
  { value: 'tenant_admin', label: 'Administrador de Empresa (Acceso Total)', badge: 'Admin' },
  { value: 'pos_store_admin', label: 'Administrador de Tienda (POS)', badge: 'POS Admin' },
  { value: 'pos_supervisor', label: 'Supervisor de Caja (POS)', badge: 'POS Super' },
  { value: 'pos_cashier', label: 'Cajero(a) (POS)', badge: 'POS Cajero' },
  { value: 'pos_sales_rep', label: 'Asesor de Ventas / Comercial (POS)', badge: 'Ventas' },
  { value: 'pos_auditor', label: 'Auditor / Contador (POS)', badge: 'POS Auditor' },
  { value: 'wh_manager', label: 'Administrador de Almacén (Warehouse)', badge: 'Almacén Admin' },
  { value: 'wh_supervisor', label: 'Supervisor de Almacén (Warehouse)', badge: 'Almacén Super' },
  { value: 'wh_clerk', label: 'Almacenista (Warehouse)', badge: 'Almacenista' },
  { value: 'wh_scanner', label: 'Operador de Escaneo (Warehouse)', badge: 'Escaneo' },
  { value: 'wh_auditor', label: 'Auditor de Almacén (Warehouse)', badge: 'Almacén Auditor' },
  { value: 'member', label: 'Miembro estándar CRM', badge: 'CRM' },
];

export function TenantUsersPanel({
  users: initialUsers,
  error,
  tenantId,
  tenantName,
  initialConfigRoles,
}: {
  users: TenantUserDisplay[];
  error?: string;
  tenantId?: string;
  tenantName?: string;
  initialConfigRoles?: string[] | null;
}) {
  const router = useRouter();
  const [usersList, setUsersList] = useState<TenantUserDisplay[]>(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('pos_cashier');

  const labels: Record<string, string> = {
    active: 'Activo',
    inactive: 'Inactivo',
    pending: 'Pendiente de aceptación',
    expired: 'Invitación vencida',
  };

  const roleLabels: Record<string, string> = {
    tenant_admin: 'Administrador de Empresa',
    admin: 'Administrador',
    pos_store_admin: 'Admin Tienda POS',
    pos_supervisor: 'Supervisor de Caja POS',
    pos_cashier: 'Cajero(a) POS',
    pos_sales_rep: 'Asesor Comercial POS',
    pos_auditor: 'Auditor POS',
    wh_manager: 'Administrador de Almacén',
    wh_supervisor: 'Supervisor de Almacén',
    wh_clerk: 'Almacenista',
    wh_scanner: 'Operador de Escaneo',
    wh_auditor: 'Auditor de Almacén',
    member: 'Miembro CRM',
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setFeedback({ ok: false, message: 'ID de empresa no disponible.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Fallo al registrar usuario');
      }

      setFeedback({ ok: true, message: data.message || 'Usuario creado exitosamente.' });

      // Agregar a la tabla de usuarios en vivo
      const newUserDisplay: TenantUserDisplay = {
        id: data.user.id,
        kind: 'membership',
        status: 'active',
        created_at: data.user.created_at,
        auth_user_id: data.user.auth_user_id,
        email: data.user.email,
        role: data.user.role,
      };

      setUsersList((prev) => [newUserDisplay, ...prev.filter((u) => u.email !== data.user.email)]);
      setName('');
      setEmail('');
      setPassword('');
      setIsModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setFeedback({ ok: false, message: err.message || 'Error al crear usuario' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {tenantId && (
        <AdminConfigPermissionsCard
          tenants={[
            {
              tenantId,
              tenantName: tenantName || 'Empresa',
              allowedRoles: initialConfigRoles ?? DEFAULT_CONFIG_ALLOWED_ROLES,
              isCustom: initialConfigRoles !== null && initialConfigRoles !== undefined,
            },
          ]}
        />
      )}
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div>
          <CardTitle className="text-base">Usuarios y Personal de la Empresa</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crea cuentas de acceso directo para cajeros, supervisores, encargados de almacén y administradores.
          </p>
        </div>
        {tenantId && (
          <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            <span>Crear usuario</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              feedback.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {!usersList.length ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Esta empresa aún no tiene usuarios ni personal asignado.
            </p>
            {tenantId && (
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)} className="mt-4 gap-2">
                <UserPlus className="h-4 w-4" />
                <span>Registrar primer usuario</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="text-xs">Correo del usuario</TableHead>
                  <TableHead className="text-xs">Rol Asignado</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Fecha Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersList.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <p className="font-semibold text-slate-900 text-xs">
                        {user.email ?? 'Correo no disponible temporalmente'}
                      </p>
                      {user.kind === 'invitation' ? (
                        <p className="mt-0.5 text-[11px] text-amber-600">
                          Acceso pendiente de aceptación por correo.
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-slate-500 font-mono">
                          ID: {user.auth_user_id?.slice(0, 8)}…
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        <Shield className="h-3 w-3 text-slate-500" />
                        {roleLabels[user.role] ?? user.role.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status === 'active' ? 'default' : 'secondary'}
                        className={user.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : ''}
                      >
                        {labels[user.status] ?? user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(user.created_at).toLocaleDateString('es-VE', {
                        timeZone: 'America/Caracas',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Modal / Dialog de Creación de Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Crear Nuevo Usuario</h3>
                  <p className="text-[11px] text-slate-500">Acceso inmediato con credenciales directas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Nombre Completo</Label>
                <div className="relative mt-1">
                  <Input
                    required
                    placeholder="Ej: María Pérez (Cajera)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Correo Electrónico (Login)</Label>
                <div className="relative mt-1">
                  <Input
                    type="email"
                    required
                    placeholder="ej: maria@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Contraseña Inicial o PIN</Label>
                <div className="relative mt-1">
                  <Input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres o PIN numérico"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8 text-xs font-mono h-9"
                  />
                  <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-1 text-[10.5px] text-slate-500">
                  El usuario podrá usar esta clave para ingresar en <code className="bg-slate-100 px-1 py-0.5 rounded">/t/[slug]/login</code>.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Rol en la Empresa</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs focus:border-slate-900 focus:outline-none"
                >
                  {PREDEFINED_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="gap-2">
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar y Asignar</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
    </div>
  );
}
