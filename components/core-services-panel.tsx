'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
interface Catalog {
  key: string;
  name: string;
  implementation_status: string;
  dependencies: string[];
  available_functions: {
    key: string;
    name: string;
    default_enabled?: boolean;
  }[];
}
interface Assignment {
  feature_key: string;
  enabled: boolean;
  contracted: boolean;
  config: { functions?: Record<string, boolean> };
}
export function CoreServicesPanel({ tenantId }: { tenantId: string }) {
  const [catalog, setCatalog] = useState<Catalog[]>([]),
    [rows, setRows] = useState<Assignment[]>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/tenants/${tenantId}/features`, {
      cache: 'no-store',
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setCatalog(b.catalog);
    setRows(
      b.catalog.map(
        (f: Catalog) =>
          b.tenantFeatures.find((a: Assignment) => a.feature_key === f.key) ?? {
            feature_key: f.key,
            enabled: false,
            contracted: false,
            config: {},
          },
      ),
    );
  }, [tenantId]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  function change(key: string, patch: Partial<Assignment>) {
    setRows((current) =>
      current.map((r) => (r.feature_key === key ? { ...r, ...patch } : r)),
    );
  }

  // Selección masiva a nivel global de módulos
  function selectAllModules() {
    setRows((current) =>
      current.map((r) => {
        const cat = catalog.find((c) => c.key === r.feature_key);
        const isImplemented = cat?.implementation_status === 'implemented';
        return {
          ...r,
          contracted: true,
          enabled: isImplemented ? true : r.enabled,
        };
      }),
    );
  }

  function deselectAllModules() {
    setRows((current) =>
      current.map((r) => ({
        ...r,
        contracted: false,
        enabled: false,
      })),
    );
  }

  // Selección masiva global de funciones de todos los módulos
  function selectAllFunctionsGlobal() {
    setRows((current) =>
      current.map((r) => {
        const cat = catalog.find((c) => c.key === r.feature_key);
        if (!cat || !cat.available_functions?.length) return r;
        const nextFuncs: Record<string, boolean> = {};
        for (const fn of cat.available_functions) {
          nextFuncs[fn.key] = true;
        }
        return {
          ...r,
          contracted: true,
          config: {
            ...r.config,
            functions: {
              ...(r.config?.functions ?? {}),
              ...nextFuncs,
            },
          },
        };
      }),
    );
  }

  function deselectAllFunctionsGlobal() {
    setRows((current) =>
      current.map((r) => {
        const cat = catalog.find((c) => c.key === r.feature_key);
        if (!cat || !cat.available_functions?.length) return r;
        const nextFuncs: Record<string, boolean> = {};
        for (const fn of cat.available_functions) {
          nextFuncs[fn.key] = false;
        }
        return {
          ...r,
          config: {
            ...r.config,
            functions: {
              ...(r.config?.functions ?? {}),
              ...nextFuncs,
            },
          },
        };
      }),
    );
  }

  // Selección masiva para un módulo específico
  function selectAllFunctionsForModule(
    featureKey: string,
    functions: Catalog['available_functions'],
  ) {
    const nextFuncs: Record<string, boolean> = {};
    for (const fn of functions) {
      nextFuncs[fn.key] = true;
    }
    setRows((current) =>
      current.map((r) =>
        r.feature_key === featureKey
          ? {
              ...r,
              contracted: true,
              config: {
                ...r.config,
                functions: {
                  ...(r.config?.functions ?? {}),
                  ...nextFuncs,
                },
              },
            }
          : r,
      ),
    );
  }

  function deselectAllFunctionsForModule(
    featureKey: string,
    functions: Catalog['available_functions'],
  ) {
    const nextFuncs: Record<string, boolean> = {};
    for (const fn of functions) {
      nextFuncs[fn.key] = false;
    }
    setRows((current) =>
      current.map((r) =>
        r.feature_key === featureKey
          ? {
              ...r,
              config: {
                ...r.config,
                functions: {
                  ...(r.config?.functions ?? {}),
                  ...nextFuncs,
                },
              },
            }
          : r,
      ),
    );
  }
  async function save() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch(`/api/admin/tenants/${tenantId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: rows }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage('Servicios y funciones guardados.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="font-semibold text-lg text-slate-900">Servicios contratados y funciones</h3>
          <p className="text-sm text-muted-foreground">
            Un servicio puede contratarse y quedar pendiente. Solo los implementados
            pueden activarse; su estado de implementación no reemplaza las pruebas
            funcionales.
          </p>
        </div>
        {/* Acciones masivas globales */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllModules}
            className="text-xs font-semibold text-slate-700 hover:bg-slate-50"
            title="Contrata y activa todos los módulos implementados"
          >
            ✓ Seleccionar todos los módulos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deselectAllModules}
            className="text-xs font-semibold text-slate-700 hover:bg-slate-50"
            title="Desactiva y descontrata todos los módulos"
          >
            ✕ Deseleccionar módulos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllFunctionsGlobal}
            className="text-xs font-semibold text-[#1E6B4E] border-[#1E6B4E]/30 bg-[#1E6B4E]/5 hover:bg-[#1E6B4E]/10"
            title="Activa todas las funciones de todos los módulos"
          >
            ✓ Seleccionar todas las funciones
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deselectAllFunctionsGlobal}
            className="text-xs font-semibold text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100"
            title="Desactiva todas las funciones de todos los módulos"
          >
            ✕ Deseleccionar funciones
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {catalog.map((f) => {
        const a = rows.find((r) => r.feature_key === f.key);
        if (!a) return null;
        const totalFuncs = f.available_functions?.length ?? 0;
        const activeFuncsCount = (f.available_functions ?? []).filter(
          (fn) => a.config.functions?.[fn.key] ?? fn.default_enabled ?? false,
        ).length;

        return (
          <div className="space-y-2 border-b pb-4" key={f.key}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.implementation_status}
                  {f.dependencies?.length
                    ? ` · Depende de ${f.dependencies.join(', ')}`
                    : ''}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={a.contracted}
                    onChange={(e) =>
                      change(f.key, {
                        contracted: e.target.checked,
                        enabled: e.target.checked ? a.enabled : false,
                      })
                    }
                  />
                  Contratado
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={
                      !a.contracted || f.implementation_status !== 'implemented'
                    }
                    checked={a.enabled}
                    onChange={(e) =>
                      change(f.key, { enabled: e.target.checked })
                    }
                  />
                  Activo
                </label>
              </div>
            </div>
            {a.contracted && totalFuncs > 0 && (
              <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Funciones de {f.name} ({activeFuncsCount} de {totalFuncs} activas)
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => selectAllFunctionsForModule(f.key, f.available_functions)}
                      className="text-xs font-semibold text-[#1E6B4E] hover:underline cursor-pointer"
                    >
                      ✓ Seleccionar todas
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => deselectAllFunctionsForModule(f.key, f.available_functions)}
                      className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      ✕ Deseleccionar todas
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {(f.available_functions ?? []).map((fn) => (
                    <label
                      key={fn.key}
                      className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer hover:text-black"
                    >
                      <input
                        type="checkbox"
                        checked={
                          a.config.functions?.[fn.key] ??
                          fn.default_enabled ??
                          false
                        }
                        onChange={(e) =>
                          change(f.key, {
                            config: {
                              ...a.config,
                              functions: {
                                ...a.config.functions,
                                [fn.key]: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span>{fn.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-2 flex items-center justify-between">
        <Button disabled={busy || !catalog.length} onClick={() => void save()}>
          {busy ? 'Guardando…' : 'Guardar servicios'}
        </Button>
      </div>
    </section>
  );
}
