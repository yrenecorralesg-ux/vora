/**
 * ============================================================================
 * MOTOR OFFLINE Y COLA DE SINCRONIZACIÓN FIFO POS (commerce.pos)
 * ============================================================================
 * Permite continuar operando sin internet: clientes nuevos, apertura/cierre de
 * turnos, movimientos de caja, ventas, abonos CxC, devoluciones, comandas KDS y
 * ajustes manuales. Cada operación se almacena en orden FIFO y se sincroniza
 * resolviendo IDs temporales -> IDs reales del servidor con idempotencia.
 * ============================================================================
 */

export type OfflineOpType =
  | 'customer_create'
  | 'shift_open'
  | 'cash_movement'
  | 'sale'
  | 'debt_payment'
  | 'dispatch'
  | 'sale_return'
  | 'shift_close'
  | 'settings_update';

export interface OfflineOperation {
  id: string;
  type: OfflineOpType;
  createdAt: string;
  summary: string;
  tempId?: string;
  targetId?: string;
  payload: any;
  retryCount: number;
  lastError?: string;
  /** El servidor la rechazó de forma definitiva (queda visible para revisión/reintento manual). */
  rejected?: boolean;
}

/** Alias de compatibilidad para código legado. */
export type QueuedOfflineSale = OfflineOperation;

/** Errores HTTP que pueden resolverse reintentando (sesión, timeout, rate limit, servidor). */
function isRetryable(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

const LEGACY_QUEUE_PREFIX = 'vora_pos_offline_queue_';
const QUEUE_KEY_PREFIX = 'vora_pos_offline_queue_v2_';
const IDMAP_KEY_PREFIX = 'vora_pos_offline_idmap_';
const PARKED_KEY_PREFIX = 'vora_pos_parked_';

function queueKey(slug: string): string {
  return `${QUEUE_KEY_PREFIX}${slug}`;
}
function legacyQueueKey(slug: string): string {
  return `${LEGACY_QUEUE_PREFIX}${slug}`;
}
function idMapKey(slug: string): string {
  return `${IDMAP_KEY_PREFIX}${slug}`;
}
function parkedKey(slug: string): string {
  return `${PARKED_KEY_PREFIX}${slug}`;
}

export function loadParkedSalesLocal<T = any>(slug: string): T[] {
  if (typeof window === 'undefined' || !slug) return [];
  try {
    const raw = localStorage.getItem(parkedKey(slug));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function saveParkedSalesLocal(slug: string, items: any[]): void {
  if (typeof window === 'undefined' || !slug) return;
  try {
    localStorage.setItem(parkedKey(slug), JSON.stringify(items));
  } catch {
    // Ignorar cuota de almacenamiento
  }
}

export function getOfflineIdMap(slug: string): Record<string, string> {
  if (typeof window === 'undefined' || !slug) return {};
  try {
    const raw = localStorage.getItem(idMapKey(slug));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveOfflineIdMap(slug: string, map: Record<string, string>): void {
  if (typeof window === 'undefined' || !slug) return;
  try {
    localStorage.setItem(idMapKey(slug), JSON.stringify(map));
  } catch {
    // Ignorar
  }
}

export function isTempOfflineId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith('off-');
}

export function resolveOfflineId(idMap: Record<string, string>, id: unknown): string | undefined {
  if (typeof id !== 'string' || !id) return undefined;
  return idMap[id] ?? id;
}

export function getOfflineQueue(slug: string): OfflineOperation[] {
  if (typeof window === 'undefined' || !slug) return [];
  try {
    const v2Raw = localStorage.getItem(queueKey(slug));
    const v2List: OfflineOperation[] = v2Raw ? JSON.parse(v2Raw) : [];
    const legacyRaw = localStorage.getItem(legacyQueueKey(slug));
    if (legacyRaw) {
      const legacyItems = JSON.parse(legacyRaw) as Array<any>;
      if (Array.isArray(legacyItems) && legacyItems.length > 0) {
        const migrated: OfflineOperation[] = legacyItems.map((it) =>
          it.type
            ? (it as OfflineOperation)
            : {
                id: it.id || `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                type: 'sale',
                createdAt: it.createdAt || new Date().toISOString(),
                summary: `Venta pendiente ($${Number(it.payload?.total_usd ?? 0).toFixed(2)})`,
                payload: it.payload,
                retryCount: Number(it.retryCount ?? 0),
                lastError: it.lastError,
                rejected: Boolean(it.rejected),
              },
        );
        const combined = [...v2List, ...migrated];
        localStorage.setItem(queueKey(slug), JSON.stringify(combined));
        localStorage.removeItem(legacyQueueKey(slug));
        return combined;
      }
    }
    return v2List;
  } catch (err) {
    console.warn('[pos-offline] Error al leer cola offline:', err);
    return [];
  }
}

export function saveOfflineQueue(slug: string, queue: OfflineOperation[]): void {
  if (typeof window === 'undefined' || !slug) return;
  try {
    localStorage.setItem(queueKey(slug), JSON.stringify(queue));
  } catch (err) {
    console.error('[pos-offline] Error al persistir cola offline:', err);
  }
}

export function enqueueOfflineOp(
  slug: string,
  op: Omit<OfflineOperation, 'id' | 'createdAt' | 'retryCount'> & { id?: string; createdAt?: string },
): OfflineOperation {
  const queue = getOfflineQueue(slug);
  const item: OfflineOperation = {
    id: op.id || `op-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type: op.type,
    createdAt: op.createdAt || new Date().toISOString(),
    summary: op.summary,
    tempId: op.tempId,
    targetId: op.targetId,
    payload: op.payload,
    retryCount: 0,
  };
  queue.push(item);
  saveOfflineQueue(slug, queue);
  return item;
}

export function enqueueOfflineSale(slug: string, payload: any, tempId?: string): OfflineOperation {
  return enqueueOfflineOp(slug, {
    type: 'sale',
    tempId,
    summary: `Venta $${Number(payload?.total_usd ?? 0).toFixed(2)} USD (${Array.isArray(payload?.lines) ? payload.lines.length : 0} ítem(s))`,
    payload,
  });
}

export function removeOfflineSale(slug: string, id: string): void {
  const queue = getOfflineQueue(slug).filter((item) => item.id !== id);
  saveOfflineQueue(slug, queue);
}

export function retryRejectedOfflineOp(slug: string, id: string): void {
  const queue = getOfflineQueue(slug).map((item) =>
    item.id === id ? { ...item, rejected: false, lastError: undefined } : item,
  );
  saveOfflineQueue(slug, queue);
}

const inflightSync = new Map<string, Promise<SyncOfflineResult>>();

export interface SyncOfflineResult {
  syncedCount: number;
  errorsCount: number;
  remainingCount: number;
  rejectedCount: number;
  newlyRejected: number;
  idMap: Record<string, string>;
}

async function postSync(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok && Boolean(data?.ok), status: res.status, data };
}

export async function syncOfflineOperations(slug: string): Promise<SyncOfflineResult> {
  const existing = inflightSync.get(slug);
  if (existing) return existing;

  const task = (async (): Promise<SyncOfflineResult> => {
    const queue = getOfflineQueue(slug);
    const idMap = getOfflineIdMap(slug);
    const saleLinesMap = new Map<string, Array<{ id: string; sku_snapshot: string; product_id: string | null }>>();
    let syncedCount = 0;
    let errorsCount = 0;
    let newlyRejected = 0;
    const kept: OfflineOperation[] = [];

    for (const item of queue) {
      if (item.rejected) {
        kept.push(item);
        continue;
      }

      const waitPredecessor = (msg: string) => {
        item.lastError = msg;
        kept.push(item);
      };

      try {
        if (item.type === 'customer_create') {
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/customers`, item.payload);
          if (ok && data?.customer?.id) {
            if (item.tempId) idMap[item.tempId] = data.customer.id;
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'shift_open') {
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/shifts`, item.payload);
          if (ok && data?.shift?.id) {
            if (item.tempId) idMap[item.tempId] = data.shift.id;
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'cash_movement') {
          const resolvedShift = resolveOfflineId(idMap, item.payload?.shift_id);
          if (isTempOfflineId(resolvedShift)) {
            waitPredecessor('Esperando sincronización de apertura de turno.');
            continue;
          }
          const payload = { ...item.payload, shift_id: resolvedShift };
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/shifts`, payload);
          if (ok) {
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'sale') {
          const resolvedShift = resolveOfflineId(idMap, item.payload?.shift_id);
          const resolvedCust = item.payload?.customer_id
            ? resolveOfflineId(idMap, item.payload.customer_id)
            : undefined;
          if (isTempOfflineId(resolvedShift)) {
            waitPredecessor('Esperando sincronización del turno de caja.');
            continue;
          }
          if (resolvedCust && isTempOfflineId(resolvedCust)) {
            waitPredecessor('Esperando sincronización del cliente nuevo.');
            continue;
          }
          const payload = {
            ...item.payload,
            shift_id: resolvedShift,
            ...(resolvedCust ? { customer_id: resolvedCust } : {}),
          };
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/sales`, payload);
          if (ok && data?.sale?.id) {
            if (item.tempId) {
              idMap[item.tempId] = data.sale.id;
              if (Array.isArray(data.sale.lines)) {
                saleLinesMap.set(item.tempId, data.sale.lines);
                idMap[`lines:${item.tempId}`] = JSON.stringify(
                  data.sale.lines.map((l: any) => ({
                    id: l.id,
                    sku_snapshot: l.sku_snapshot,
                    product_id: l.product_id ?? null,
                  })),
                );
              }
            }
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'debt_payment') {
          const resolvedSale = resolveOfflineId(idMap, item.targetId ?? item.payload?.sale_id);
          const resolvedShift = resolveOfflineId(idMap, item.payload?.shift_id);
          if (isTempOfflineId(resolvedSale) || isTempOfflineId(resolvedShift)) {
            waitPredecessor('Esperando sincronización de venta/turno previos.');
            continue;
          }
          const payload = { ...item.payload, shift_id: resolvedShift };
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/sales/${resolvedSale}`, payload);
          if (ok) {
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'dispatch') {
          const resolvedSale = resolveOfflineId(idMap, item.targetId ?? item.payload?.sale_id);
          if (isTempOfflineId(resolvedSale)) {
            waitPredecessor('Esperando sincronización de la venta.');
            continue;
          }
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/sales/${resolvedSale}`, item.payload);
          if (ok) {
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'sale_return') {
          const origSaleRaw = item.payload?.original_sale_id;
          const resolvedSale = resolveOfflineId(idMap, origSaleRaw);
          const resolvedShift = resolveOfflineId(idMap, item.payload?.shift_id);
          if (isTempOfflineId(resolvedSale) || isTempOfflineId(resolvedShift)) {
            waitPredecessor('Esperando sincronización de la venta/turno originales.');
            continue;
          }
          let lines = Array.isArray(item.payload?.lines) ? item.payload.lines : [];
          if (origSaleRaw && isTempOfflineId(origSaleRaw)) {
            let serverLines = saleLinesMap.get(origSaleRaw);
            if (!serverLines && idMap[`lines:${origSaleRaw}`]) {
              try {
                serverLines = JSON.parse(idMap[`lines:${origSaleRaw}`]);
              } catch {
                // Ignorar
              }
            }
            if (serverLines) {
              lines = lines.map((l: any) => {
                if (l.sale_line_id && !isTempOfflineId(l.sale_line_id)) return l;
                const byIdx = typeof l.line_index === 'number' ? serverLines![l.line_index] : undefined;
                const bySku = l.sku ? serverLines!.find((sl) => sl.sku_snapshot === l.sku) : undefined;
                const resolvedLineId = byIdx?.id ?? bySku?.id ?? l.sale_line_id;
                return { ...l, sale_line_id: resolvedLineId };
              });
            }
          }
          const payload = {
            ...item.payload,
            original_sale_id: resolvedSale,
            shift_id: resolvedShift,
            lines,
          };
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/returns`, payload);
          if (ok) {
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'shift_close') {
          const resolvedShift = resolveOfflineId(idMap, item.targetId ?? item.payload?.shift_id);
          if (isTempOfflineId(resolvedShift)) {
            waitPredecessor('Esperando sincronización de apertura de turno.');
            continue;
          }
          // Esperar si aún hay ventas/movimientos/devoluciones/abonos de ese turno sin sincronizar
          const hasPendingShiftWork = kept.some(
            (prev) =>
              !prev.rejected &&
              prev.id !== item.id &&
              (prev.payload?.shift_id === (item.targetId ?? item.payload?.shift_id) ||
                prev.payload?.shift_id === resolvedShift),
          );
          if (hasPendingShiftWork) {
            waitPredecessor('Esperando sincronización de operaciones del turno antes de cerrarlo.');
            continue;
          }
          const payload = { ...item.payload, shift_id: resolvedShift };
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/shifts`, payload);
          if (ok) {
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }

        if (item.type === 'settings_update') {
          const { ok, status, data } = await postSync(`/api/t/${slug}/pos/settings`, item.payload);
          if (ok) {
            syncedCount++;
            continue;
          }
          item.retryCount++;
          item.lastError = data?.error || `HTTP ${status}`;
          if (!isRetryable(status)) {
            item.rejected = true;
            newlyRejected++;
          }
          errorsCount++;
          kept.push(item);
          continue;
        }
      } catch (err: any) {
        item.retryCount++;
        item.lastError = err?.message || 'Error de red';
        errorsCount++;
        kept.push(item);
      }
    }

    saveOfflineIdMap(slug, idMap);
    saveOfflineQueue(slug, kept);

    return {
      syncedCount,
      errorsCount,
      remainingCount: kept.filter((q) => !q.rejected).length,
      rejectedCount: kept.filter((q) => q.rejected).length,
      newlyRejected,
      idMap,
    };
  })();

  inflightSync.set(slug, task);
  try {
    return await task;
  } finally {
    inflightSync.delete(slug);
  }
}

export const syncOfflineSales = syncOfflineOperations;
