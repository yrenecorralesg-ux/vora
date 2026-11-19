/**
 * ============================================================================
 * MOTOR OFFLINE Y COLA DE SINCRONIZACIÓN POS (commerce.pos)
 * ============================================================================
 * Permite continuar operando ventas en mostrador ante caídas de internet.
 * Las ventas se almacenan de forma segura e inmutable en el almacenamiento local
 * y se reintentan automáticamente en segundo plano cuando la red se restablece.
 * ============================================================================
 */

export interface QueuedOfflineSale {
  id: string;
  createdAt: string;
  payload: any;
  retryCount: number;
  lastError?: string;
}

const STORAGE_KEY_PREFIX = 'vora_pos_offline_queue_';

function getStorageKey(slug: string): string {
  return `${STORAGE_KEY_PREFIX}${slug}`;
}

export function getOfflineQueue(slug: string): QueuedOfflineSale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(slug));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[pos-offline] Error al leer cola offline:', err);
    return [];
  }
}

export function enqueueOfflineSale(slug: string, payload: any): QueuedOfflineSale {
  const queue = getOfflineQueue(slug);
  const queuedItem: QueuedOfflineSale = {
    id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    payload,
    retryCount: 0,
  };

  queue.push(queuedItem);
  try {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(queue));
  } catch (err) {
    console.error('[pos-offline] Error al encolar venta offline:', err);
  }

  return queuedItem;
}

export function removeOfflineSale(slug: string, id: string): void {
  const queue = getOfflineQueue(slug).filter((item) => item.id !== id);
  try {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(queue));
  } catch (err) {
    console.error('[pos-offline] Error al remover venta offline:', err);
  }
}

export async function syncOfflineSales(slug: string): Promise<{
  syncedCount: number;
  errorsCount: number;
  remainingCount: number;
}> {
  const queue = getOfflineQueue(slug);
  if (queue.length === 0) {
    return { syncedCount: 0, errorsCount: 0, remainingCount: 0 };
  }

  let syncedCount = 0;
  let errorsCount = 0;
  const remaining: QueuedOfflineSale[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(`/api/t/${slug}/pos/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          syncedCount++;
          continue; // Venta sincronizada con éxito
        }
      }

      item.retryCount++;
      item.lastError = `HTTP ${res.status}`;
      errorsCount++;
      remaining.push(item);
    } catch (err: any) {
      item.retryCount++;
      item.lastError = err.message || 'Error de red';
      errorsCount++;
      remaining.push(item);
    }
  }

  try {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(remaining));
  } catch (err) {
    console.error('[pos-offline] Error al persistir cola restante:', err);
  }

  return {
    syncedCount,
    errorsCount,
    remainingCount: remaining.length,
  };
}
