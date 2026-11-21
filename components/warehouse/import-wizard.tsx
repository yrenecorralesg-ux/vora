'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FieldLabel } from '@/components/warehouse/wh-ui';
import { whPost } from '@/lib/warehouse/client';
import { IMPORT_COLUMN_LABELS, IMPORT_OPERATIONS, type ImportOperation } from '@/lib/warehouse/catalog';
import { parseCsv } from '@/lib/warehouse/csv';

const MAX_BYTES = 2 * 1024 * 1024;

/** WH-19: subir → inspeccionar encabezados → mapear columnas → validar en servidor. */
export function ImportWizard({ slug, initialOperation }: { slug: string; initialOperation?: ImportOperation }) {
  const router = useRouter();
  const [operation, setOperation] = useState<ImportOperation>(initialOperation ?? 'items');
  const [file, setFile] = useState<{ name: string; content: string; headers: string[]; rows: number } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = IMPORT_OPERATIONS[operation];

  const autoMap = (headers: string[], op: ImportOperation) => {
    const lower = new Map(headers.map((h) => [h.toLowerCase().trim(), h]));
    setMapping(Object.fromEntries(IMPORT_OPERATIONS[op].columns.map((c) => [c, lower.get(c) ?? ''])));
  };

  const onFile = async (f: File | undefined) => {
    setError(null);
    setFile(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setError('Selecciona un archivo .csv (desde Excel: Guardar como → CSV UTF-8).');
    if (f.size > MAX_BYTES) return setError('El archivo supera 2 MB. Divídelo en varias importaciones.');
    const content = await f.text();
    const table = parseCsv(content);
    if (table.length < 2) return setError('El archivo no tiene filas de datos.');
    const headers = table[0].map((h) => h.trim());
    setFile({ name: f.name, content, headers, rows: table.length - 1 });
    autoMap(headers, operation);
  };

  const validate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const res = await whPost<{ id: string }>(slug, 'imports', { operation, file_name: file.name, content: file.content, mapping });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? 'No se pudo validar.');
    router.push(`/t/${slug}/warehouse/imports/${res.data.id}`);
  };

  const missing = spec.required.filter((c) => !mapping[c]);
  const select = 'h-9 rounded-xl border border-[#E7E2D7] bg-white px-2 text-[13px]';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="1. Operación">
          <select
            value={operation}
            onChange={(e) => {
              const op = e.target.value as ImportOperation;
              setOperation(op);
              if (file) autoMap(file.headers, op);
            }}
            className={select}
          >
            {Object.entries(IMPORT_OPERATIONS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="2. Archivo CSV (máx. 2 MB)">
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-[13px] file:mr-3 file:rounded-xl file:border-0 file:bg-[#EEF3EF] file:px-3 file:py-2 file:text-[#285C49]" />
        </FieldLabel>
      </div>

      {file && (
        <div className="space-y-3 rounded-xl border border-[#E7E2D7] p-3">
          <p className="text-[12px] text-slate-600">
            <strong>{file.name}</strong>: {file.rows} filas, {file.headers.length} columnas detectadas.
          </p>
          <p className="text-[12px] font-semibold text-[#1B3D2F]">3. Mapear columnas</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {spec.columns.map((c) => (
              <FieldLabel key={c} label={`${IMPORT_COLUMN_LABELS[c] ?? c}${(spec.required as readonly string[]).includes(c) ? ' *' : ''}`}>
                <select value={mapping[c] ?? ''} onChange={(e) => setMapping({ ...mapping, [c]: e.target.value })} className={select}>
                  <option value="">— No importar —</option>
                  {file.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </FieldLabel>
            ))}
          </div>
          {operation === 'items' && file.headers.some((h) => h.startsWith('attr:')) && (
            <p className="text-[12px] text-slate-500">Columnas de atributos detectadas: {file.headers.filter((h) => h.startsWith('attr:')).join(', ')}.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!file || missing.length > 0 || busy} onClick={validate} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#285C49] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1F4A3A] disabled:opacity-50">
          {busy ? 'Validando…' : '4. Validar en servidor'}
        </button>
        {file && missing.length > 0 && <span className="text-[12px] text-amber-700">Falta mapear: {missing.join(', ')}</span>}
        {error && <span role="alert" className="text-[13px] text-rose-700">{error}</span>}
      </div>
      <p className="text-[12px] text-slate-500">Validar no modifica nada. Verás los errores por fila y una vista previa antes de confirmar.</p>
    </div>
  );
}

/** WH-22: confirmar (todo o nada, o parcial con aceptación explícita) o cancelar. */
export function ImportConfirm({ slug, jobId, hasErrors, validRows, canApply }: { slug: string; jobId: string; hasErrors: boolean; validRows: number; canApply: boolean }) {
  const router = useRouter();
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (action: 'apply' | 'cancel') => {
    setBusy(true);
    setMsg(null);
    const res = await whPost<{ result?: { created: number; updated: number; movements: number } }>(slug, `imports/${jobId}`, { action, partial });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error ?? 'No se pudo completar.' });
    if (action === 'cancel') return router.push(`/t/${slug}/warehouse/imports/history`);
    const r = res.data?.result;
    setMsg({ ok: true, text: `Importación aplicada: ${r?.created ?? 0} altas, ${r?.updated ?? 0} actualizaciones, ${r?.movements ?? 0} movimientos.` });
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {hasErrors && (
        <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900">
          <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="mt-0.5" />
          <span>
            Acepto aplicar solo las {validRows} filas válidas. Las filas con error quedan registradas como rechazadas y no se aplican.
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {canApply && (
          <button type="button" disabled={busy || validRows === 0 || (hasErrors && !partial)} onClick={() => act('apply')} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#285C49] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1F4A3A] disabled:opacity-50">
            {busy ? 'Aplicando…' : 'Confirmar importación'}
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => act('cancel')} className="h-9 rounded-xl border border-[#E7E2D7] px-4 text-[13px]">Cancelar</button>
        {msg && <p role="status" className={`text-[13px] ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      </div>
      {!canApply && <p className="text-[12px] text-slate-500">Tu rol puede validar pero no aplicar importaciones; pide a un administrador de almacén que la confirme.</p>}
    </div>
  );
}
