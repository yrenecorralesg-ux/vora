import type {
  PosBranch,
  PosCashMovement,
  PosCustomer,
  PosFiscalIntegration,
  PosProduct,
  PosRegister,
  PosSale,
  PosSaleReturn,
  PosSettings,
  PosShift,
} from '@/lib/types';
import type { PosMe, PosStaffUser, PosSupervisor } from '@/lib/pos/client-utils';
import type { OfflineOperatorInfo } from '@/lib/pos-offline-crypto';

export interface PosOfflineSnapshot {
  slug: string;
  tenantId: string;
  savedAt: string;
  tenantMeta: {
    tenantName: string;
    tenantCurrency: string;
    tenantCountry: string;
    tenantBranding: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      loginBgColor: string;
      fontFamily: string;
      logoUrl: string | null;
      bannerUrl: string | null;
    };
    isModuleEnabled: boolean;
    isWarehouseEnabled: boolean;
    stockPolicy: 'warn_and_allow' | 'strict_block' | 'allow_unrestricted';
    catalogSource: 'warehouse' | 'pos';
    posFeatures: Record<string, boolean>;
  };
  me: PosMe | null;
  staffUsers: PosStaffUser[];
  supervisors: PosSupervisor[];
  offlineOperators: OfflineOperatorInfo[];
  settings: PosSettings;
  exchangeRate: number;
  branches: PosBranch[];
  registers: PosRegister[];
  activeBranchId: string;
  activeRegisterId: string;
  products: PosProduct[];
  customers: PosCustomer[];
  sales: PosSale[];
  returns: PosSaleReturn[];
  shifts: PosShift[];
  cashMovements: PosCashMovement[];
  activeShift: PosShift | null;
  fiscalIntegration: PosFiscalIntegration | null;
}

const DB_NAME = 'vora_pos_offline_v1';
const STORE_NAME = 'kv';
const SNAPSHOT_FALLBACK_PREFIX = 'vora_pos_snapshot_v1_';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function snapshotKey(slug: string): string {
  return `snapshot:${slug.toLowerCase()}`;
}

export async function saveOfflineSnapshot(snapshot: PosOfflineSnapshot): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = snapshotKey(snapshot.slug);
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(snapshot, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch {
      // Continuar al respaldo en localStorage
    } finally {
      db.close();
    }
  }
  try {
    localStorage.setItem(`${SNAPSHOT_FALLBACK_PREFIX}${snapshot.slug.toLowerCase()}`, JSON.stringify(snapshot));
  } catch {
    // Ignorar cuota excedida en almacenamiento local
  }
}

export async function loadOfflineSnapshot(slug: string): Promise<PosOfflineSnapshot | null> {
  if (typeof window === 'undefined') return null;
  const key = snapshotKey(slug);
  const db = await openDb();
  if (db) {
    try {
      const result = await new Promise<PosOfflineSnapshot | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve((req.result as PosOfflineSnapshot | undefined) ?? null);
        req.onerror = () => resolve(null);
      });
      if (result) return result;
    } catch {
      // Continuar al respaldo en localStorage
    } finally {
      db.close();
    }
  }
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_FALLBACK_PREFIX}${slug.toLowerCase()}`);
    return raw ? (JSON.parse(raw) as PosOfflineSnapshot) : null;
  } catch {
    return null;
  }
}

export async function clearOfflineSnapshot(slug: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = snapshotKey(slug);
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Ignorar
    } finally {
      db.close();
    }
  }
  try {
    localStorage.removeItem(`${SNAPSHOT_FALLBACK_PREFIX}${slug.toLowerCase()}`);
  } catch {
    // Ignorar
  }
}
