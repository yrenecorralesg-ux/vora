'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
  Boxes,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CRM_MODULES_CATALOG } from '@/lib/modules-config';
import { cn } from '@/lib/utils';

export function TenantModulesConfig({
  slug,
  initialFeatures,
}: {
  slug: string;
  initialFeatures: Array<{ feature_key: string; enabled: boolean; config?: any }>;
}) {
  const router = useRouter();

  const [featuresList, setFeaturesList] = useState(() => {
    const catalogKeys = Object.keys(CRM_MODULES_CATALOG);
    const existingMap = new Map(initialFeatures.map((f) => [f.feature_key, f]));

    return catalogKeys.map((key) => {
      const existing = existingMap.get(key);
      const catalogItem = CRM_MODULES_CATALOG[key];
      const cfg = existing?.config ?? { functions: {} };

      return {
        key,
        name: catalogItem?.name ?? key,
        category: catalogItem?.category ?? 'crm',
        description: catalogItem?.description ?? '',
        enabled: existing?.enabled ?? false,
        config: cfg,
        functions: catalogItem?.functions ?? [],
      };
    });
  });

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleToggleModule(moduleKey: string, newEnabled: boolean) {
    setSavingKey(moduleKey);
    setFeedback(null);

    // Optimistic update
    setFeaturesList((prev) =>
      prev.map((f) => (f.key === moduleKey ? { ...f, enabled: newEnabled } : f)),
    );

    try {
      const target = featuresList.find((f) => f.key === moduleKey);
      const res = await fetch(`/api/t/${slug}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_key: moduleKey,
          enabled: newEnabled,
          config: target?.config ?? { functions: {} },
        }),
      });

      if (!res.ok) {
        throw new Error('Error al actualizar módulo');
      }

      setFeedback({ ok: true, message: `Módulo "${target?.name}" ${newEnabled ? 'activado' : 'desactivado'} con éxito.` });
      router.refresh();
    } catch (err: any) {
      setFeedback({ ok: false, message: err.message || 'Error al guardar estado' });
      // Revert optimistic
      setFeaturesList((prev) =>
        prev.map((f) => (f.key === moduleKey ? { ...f, enabled: !newEnabled } : f)),
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function handleToggleFunction(moduleKey: string, funcKey: string, funcEnabled: boolean) {
    const target = featuresList.find((f) => f.key === moduleKey);
    if (!target) return;

    const newFunctions = {
      ...(target.config?.functions ?? {}),
      [funcKey]: funcEnabled,
    };
    const newConfig = { ...target.config, functions: newFunctions };

    setFeaturesList((prev) =>
      prev.map((f) => (f.key === moduleKey ? { ...f, config: newConfig } : f)),
    );

    try {
      await fetch(`/api/t/${slug}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_key: moduleKey,
          enabled: target.enabled,
          config: newConfig,
        }),
      });
    } catch {
      // Background save
    }
  }

  const enabledCount = featuresList.filter((f) => f.enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Módulos y Funciones Disponibles</CardTitle>
            <CardDescription className="text-xs">
              Activa o desactiva módulos para este CRM según el modelo de negocio.
            </CardDescription>
          </div>
        </div>
        <Badge className="bg-purple-100 text-[#5136db] border-purple-200 text-xs font-semibold">
          {enabledCount} de {featuresList.length} activos
        </Badge>
      </CardHeader>

      {feedback && (
        <div
          className={cn(
            'mx-6 mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-medium',
            feedback.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200',
          )}
        >
          {feedback.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <CardContent className="p-0 divide-y divide-slate-100">
        {featuresList.map((f) => {
          const isExpanded = expandedKey === f.key;
          const funcs = f.functions;
          const enabledFuncsCount = funcs.filter(
            (fn) => f.config?.functions?.[fn.key] ?? fn.defaultEnabled,
          ).length;

          return (
            <div key={f.key} className="p-4 transition-colors hover:bg-slate-50/50">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{f.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">
                      {f.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{f.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {funcs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : f.key)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#5136db]"
                    >
                      <span>{enabledFuncsCount}/{funcs.length} funciones</span>
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  )}
                  {savingKey === f.key ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#5136db]" />
                  ) : (
                    <Switch
                      checked={f.enabled}
                      onCheckedChange={(checked) => handleToggleModule(f.key, checked)}
                    />
                  )}
                </div>
              </div>

              {/* Sub-functions dropdown */}
              {isExpanded && funcs.length > 0 && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Funciones específicas de {f.name}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {funcs.map((fn) => {
                      const isActive = f.config?.functions?.[fn.key] ?? fn.defaultEnabled;
                      return (
                        <div
                          key={fn.key}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-slate-100 shadow-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-slate-800">{fn.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{fn.description}</p>
                          </div>
                          <Switch
                            disabled={!f.enabled}
                            checked={f.enabled && isActive}
                            onCheckedChange={(checked) => handleToggleFunction(f.key, fn.key, checked)}
                            className="scale-75 shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
