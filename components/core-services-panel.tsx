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
      <h3 className="font-semibold">Servicios contratados y funciones</h3>
      <p className="text-sm text-muted-foreground">
        Un servicio puede contratarse y quedar pendiente. Solo los implementados
        pueden activarse; su estado de implementación no reemplaza las pruebas
        funcionales.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {catalog.map((f) => {
        const a = rows.find((r) => r.feature_key === f.key);
        if (!a) return null;
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
                <label className="flex items-center gap-2">
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
                <label className="flex items-center gap-2">
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
            {a.contracted && (
              <div className="grid gap-2 sm:grid-cols-2">
                {(f.available_functions ?? []).map((fn) => (
                  <label
                    key={fn.key}
                    className="flex items-center gap-2 text-sm"
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
                    {fn.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <Button disabled={busy || !catalog.length} onClick={() => void save()}>
        {busy ? 'Guardando…' : 'Guardar servicios'}
      </Button>
    </section>
  );
}
