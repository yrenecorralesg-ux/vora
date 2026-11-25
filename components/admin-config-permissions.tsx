'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sliders, CheckCircle2, AlertCircle, Lock, Save, Loader2 } from 'lucide-react';
import {
  CONFIG_PRESETS,
  CONFIGURABLE_ROLES,
  DEFAULT_CONFIG_ALLOWED_ROLES,
} from '@/lib/config-permissions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface TenantConfigRoleOption {
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  allowedRoles: string[];
  isCustom?: boolean;
}

const GROUP_LABELS: Record<'empresa' | 'pos' | 'warehouse', string> = {
  empresa: 'Empresa / CRM',
  pos: 'Punto de Venta (POS)',
  warehouse: 'Inventario (Warehouse)',
};

export function AdminConfigPermissionsCard({
  tenants,
}: {
  tenants: TenantConfigRoleOption[];
}) {
  const router = useRouter();
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenants[0]?.tenantId ?? '');
  const [rolesByTenant, setRolesByTenant] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const t of tenants) {
      map[t.tenantId] = t.allowedRoles.length ? t.allowedRoles : [...DEFAULT_CONFIG_ALLOWED_ROLES];
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  if (!tenants.length) return null;

  const currentTenant = tenants.find((t) => t.tenantId === selectedTenantId) ?? tenants[0];
  const activeRoles = rolesByTenant[currentTenant.tenantId] ?? DEFAULT_CONFIG_ALLOWED_ROLES;

  const setTenantRoles = (next: string[]) => {
    const withAdmin = Array.from(new Set(['tenant_admin', ...next]));
    setRolesByTenant((prev) => ({ ...prev, [currentTenant.tenantId]: withAdmin }));
    setFeedback(null);
  };

  const toggleRole = (roleKey: string) => {
    if (roleKey === 'tenant_admin') return;
    if (activeRoles.includes(roleKey)) {
      setTenantRoles(activeRoles.filter((r) => r !== roleKey));
    } else {
      setTenantRoles([...activeRoles, roleKey]);
    }
  };

  const matchesPreset = (presetRoles: readonly string[]) => {
    const a = new Set(activeRoles);
    const b = new Set(presetRoles);
    return a.size === b.size && Array.from(a).every((r) => b.has(r));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/tenants/${currentTenant.tenantId}/config-permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_roles: activeRoles }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'No se pudieron guardar los permisos.');
      }
      setTenantRoles(data.allowed_roles);
      setFeedback({
        ok: true,
        message: `Permisos de configuración actualizados para ${currentTenant.tenantName}.`,
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ ok: false, message: err?.message || 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sliders className="h-4 w-4 text-primary" />
            Permisos de Configuración por Rol
          </CardTitle>
          <CardDescription className="text-xs">
            Decide qué roles pueden ver y usar el botón y las pantallas de configuración en todos los módulos (POS, Warehouse y CRM). Los roles sin permiso no verán ningún acceso de configuración.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {tenants.length > 1 && (
            <select
              aria-label="Seleccionar empresa"
              value={currentTenant.tenantId}
              onChange={(e) => {
                setSelectedTenantId(e.target.value);
                setFeedback(null);
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold text-foreground"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.tenantName}
                </option>
              ))}
            </select>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Guardar permisos</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              feedback.ok
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Presets rápidos */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Perfiles rápidos</p>
          <div className="flex flex-wrap gap-2">
            {CONFIG_PRESETS.map((preset) => {
              const active = matchesPreset(preset.roles);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTenantRoles([...preset.roles])}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de roles agrupados */}
        <div className="grid gap-4 md:grid-cols-3">
          {(['empresa', 'pos', 'warehouse'] as const).map((group) => {
            const items = CONFIGURABLE_ROLES.filter((r) => r.group === group);
            return (
              <div key={group} className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {GROUP_LABELS[group]}
                </p>
                <div className="space-y-2">
                  {items.map((role) => {
                    const checked = activeRoles.includes(role.key);
                    return (
                      <label
                        key={role.key}
                        className={`flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-xs ${
                          role.locked ? 'opacity-90 cursor-default' : 'cursor-pointer hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={role.locked}
                            onChange={() => toggleRole(role.key)}
                            className="h-4 w-4 rounded accent-primary"
                          />
                          <span className="truncate font-medium text-foreground">{role.label}</span>
                        </div>
                        {role.locked && (
                          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                            <Lock className="h-2.5 w-2.5" />
                            Fijo
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
