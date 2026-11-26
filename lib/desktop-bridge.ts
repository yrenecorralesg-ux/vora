'use client';

export interface CustomerDisplaySyncPayload {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  primaryColor: string;
  branchName: string;
  registerName: string;
  exchangeRate: number;
  customerName: string | null;
  customerTier: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceUsd: number;
    discountPercent: number;
    lineTotalUsd: number;
  }>;
  totalUsd: number;
  totalVes: number;
  isPagoMovilEnabled: boolean;
  pagoMovilConfig: {
    bank_code: string;
    bank_name: string;
    phone: string;
    tax_id: string;
    holder_name?: string;
  } | null;
  qrPayload: string | null;
  updatedAt: number;
}

export interface VoraDesktopBridge {
  isDesktop: true;
  platform: string;
  printSilent: (options?: {
    silent?: boolean;
    deviceName?: string;
    pageWidthMicrons?: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  getPrinters: () => Promise<Array<{ name: string; displayName: string; isDefault: boolean }>>;
  getDisplaysInfo: () => Promise<{ count: number; hasExternal: boolean }>;
  openCustomerDisplay: (url: string) => Promise<{ ok: boolean; onExternalDisplay: boolean }>;
  closeCustomerDisplay: () => Promise<void>;
  syncCustomerDisplay: (payload: CustomerDisplaySyncPayload) => void;
  onCustomerDisplayState: (callback: (payload: CustomerDisplaySyncPayload) => void) => () => void;
}

declare global {
  interface Window {
    voraDesktop?: VoraDesktopBridge;
  }
}

export const CUSTOMER_DISPLAY_CHANNEL = 'vora_customer_display';

export function customerDisplayStorageKey(slug: string): string {
  return `vora_customer_display_state:${slug.toLowerCase()}`;
}

export function isVoraDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.voraDesktop?.isDesktop);
}

export async function voraPrint(options?: {
  silent?: boolean;
  thermal80mm?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.voraDesktop?.printSilent) {
    const res = await window.voraDesktop.printSilent({
      silent: options?.silent !== false,
      ...(options?.thermal80mm ? { pageWidthMicrons: 80000 } : {}),
    });
    if (res.ok) return;
  }
  window.print();
}

export function publishCustomerDisplayState(payload: CustomerDisplaySyncPayload): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(customerDisplayStorageKey(payload.tenantSlug), JSON.stringify(payload));
  } catch {
    // Ignorar cuota de almacenamiento local
  }
  if (window.voraDesktop?.syncCustomerDisplay) {
    window.voraDesktop.syncCustomerDisplay(payload);
  }
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      ch.postMessage(payload);
      ch.close();
    } catch {
      // Ignorar navegadores sin BroadcastChannel
    }
  }
}

export async function openExternalCustomerDisplay(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.voraDesktop?.openCustomerDisplay) {
    const res = await window.voraDesktop.openCustomerDisplay(url);
    return res.ok;
  }
  const win = window.open(
    url,
    'VoraCustomerDisplay',
    'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no',
  );
  return Boolean(win);
}
