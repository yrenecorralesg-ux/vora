'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, RotateCcw, Save } from 'lucide-react';
import { whPost } from '@/lib/warehouse/client';
import { btn, Pill } from '@/components/warehouse/wh-ui';
import { cn } from '@/lib/utils';

export interface RoleColumn {
  key: string;
  label: string;
  permissions: string[];
  customized: boolean;
  users: number;
}

/** Matriz de permisos editable por empresa (WH-12). */
export function RolesMatrixEditor({
  slug,
  roles,
  permissions,
  labels,
  editable,
}: {
  slug: string;
  roles: RoleColumn[];
  permissions: string[];
  labels: Record<string, string>;
  editable: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(() => Object.fromEntries(roles.map((r) => [r.key, new Set(r.permissions)])));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = (key: string) => {
    const original = roles.find((r) => r.key === key)!.permissions;
    const now = state[key];
    return original.length !== now.size || original.some((p) => !now.has(p));
  };

  const toggle = (role: string, perm: string) => {
    if (!editable) return;
    setState((prev) => {
      const next = new Set(prev[role]);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return { ...prev, [role]: next };
    });
  };

  const save = async (role: string, reset = false) => {
    setBusy(role);
    setMsg(null);
    const res = await whPost(slug, 'roles', reset ? { action: 'reset_role', role_key: role } : { action: 'set_role', role_key: role, permissions: Array.from(state[role]) });
    setBusy(null);
    if (!res.ok) return setMsg({ ok: false, text: res.error ?? 'No se pudo guardar.' });
    setMsg({ ok: true, text: reset ? 'Permisos restablecidos a los valores por defecto.' : 'Permisos guardados.' });
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-y border-[#EFEBE2] bg-[#F8F6F1] text-left align-bottom text-[11px] font-semibold text-slate-500">
              <th className="sticky left-0 z-10 bg-[#F8F6F1] px-5 py-2.5 uppercase tracking-wide">Permiso</th>
              {roles.map((r) => (
                <th key={r.key} className="px-2 py-2.5 text-center">
                  <span className="block text-[#1B3D2F]">{r.label}</span>
                  <span className="font-normal">{r.users} usuario{r.users === 1 ? '' : 's'}</span>
                  {r.customized && <span className="mt-1 block"><Pill tone="blue">Personalizado</Pill></span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1EDE5]">
            {permissions.map((p) => (
              <tr key={p} className="hover:bg-[#F8F6F1]/70">
                <td className="sticky left-0 z-10 bg-white px-5 py-2.5">
                  <span className="font-medium text-[#1B3D2F]">{labels[p] ?? p}</span>
                  <span className="block font-mono text-[10px] text-slate-400">{p}</span>
                </td>
                {roles.map((r) => {
                  const on = state[r.key].has(p);
                  return (
                    <td key={r.key} className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${labels[p] ?? p} para ${r.label}`}
                        disabled={!editable}
                        onClick={() => toggle(r.key, p)}
                        className={cn(
                          'mx-auto flex h-6 w-6 items-center justify-center rounded-lg border transition',
                          on ? 'border-[#285C49] bg-[#285C49] text-white' : 'border-[#E7E2D7] bg-white text-transparent',
                          editable ? 'hover:border-[#285C49]' : 'cursor-default opacity-80',
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {editable && (
              <tr className="bg-[#F8F6F1]/60">
                <td className="sticky left-0 z-10 bg-[#F8F6F1] px-5 py-3 text-[12px] text-slate-500">Guardar por rol</td>
                {roles.map((r) => (
                  <td key={r.key} className="px-2 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <button type="button" onClick={() => save(r.key)} disabled={!dirty(r.key) || busy !== null} className={cn(btn.ghost, 'disabled:opacity-40')}>
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </button>
                      {r.customized && (
                        <button type="button" onClick={() => save(r.key, true)} disabled={busy !== null} className={cn(btn.ghost, 'text-slate-500')}>
                          <RotateCcw className="h-3.5 w-3.5" /> Por defecto
                        </button>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {msg && <p className={cn('text-[12px]', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</p>}
    </div>
  );
}

export interface ScopeUser {
  id: string;
  name: string;
  role: string;
  warehouse_ids: string[];
}

/** Almacenes en los que puede operar cada usuario (vacío = todos). */
export function UserScopesEditor({
  slug,
  users,
  warehouses,
  roleLabels,
}: {
  slug: string;
  users: ScopeUser[];
  warehouses: { id: string; label: string }[];
  roleLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = (ids: string[]) =>
    ids.length ? ids.map((id) => warehouses.find((w) => w.id === id)?.label ?? '—').join(', ') : 'Todos los almacenes';

  const save = async (userId: string) => {
    setBusy(true);
    setError(null);
    const res = await whPost(slug, 'roles', { action: 'set_scope', auth_user_id: userId, warehouse_ids: Array.from(selection) });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'No se pudo guardar.');
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="-mx-5 divide-y divide-[#F1EDE5]">
      {users.map((u) => (
        <div key={u.id} className="px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#1B3D2F]">{u.name}</p>
              <p className="text-[12px] text-slate-500">
                {roleLabels[u.role] ?? u.role} · {label(u.warehouse_ids)}
              </p>
            </div>
            {editing !== u.id && (
              <button
                type="button"
                className={btn.ghost}
                onClick={() => {
                  setEditing(u.id);
                  setSelection(new Set(u.warehouse_ids));
                  setError(null);
                }}
              >
                Cambiar alcance
              </button>
            )}
          </div>
          {editing === u.id && (
            <div className="mt-3 rounded-xl bg-[#F8F6F1] p-3">
              <p className="mb-2 text-[12px] text-slate-600">Marca los almacenes permitidos. Sin ninguno marcado, opera en todos.</p>
              <div className="flex flex-wrap gap-2">
                {warehouses.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 rounded-lg border border-[#E7E2D7] bg-white px-2.5 py-1.5 text-[12px]">
                    <input
                      type="checkbox"
                      checked={selection.has(w.id)}
                      onChange={(e) =>
                        setSelection((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(w.id);
                          else next.delete(w.id);
                          return next;
                        })
                      }
                    />
                    {w.label}
                  </label>
                ))}
              </div>
              {error && <p className="mt-2 text-[12px] text-rose-700">{error}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => save(u.id)} disabled={busy} className={btn.primary}>Guardar alcance</button>
                <button type="button" onClick={() => setEditing(null)} className={btn.secondary}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
