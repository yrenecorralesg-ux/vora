'use client';

export interface OfflinePinBundle {
  version: 1;
  salt: string;
  iterations: number;
  verifier_hash: string;
  iv: string;
  encrypted_key: string;
}

export interface OfflineOperatorInfo {
  id: string;
  name: string;
  role: string;
  can_approve: boolean;
  permissions: Record<string, boolean>;
  has_pin: boolean;
  offline_pin_ready: boolean;
  offline_bundle: OfflinePinBundle | null;
}

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60_000;

function lockKey(slug: string, userId: string): string {
  return `vora_pos_pin_lock_${slug.toLowerCase()}_${userId}`;
}

interface LockState {
  attempts: number;
  lockedUntil: number | null;
}

function readLock(slug: string, userId: string): LockState {
  if (typeof window === 'undefined') return { attempts: 0, lockedUntil: null };
  try {
    const raw = localStorage.getItem(lockKey(slug, userId));
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw) as LockState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function writeLock(slug: string, userId: string, state: LockState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(lockKey(slug, userId), JSON.stringify(state));
  } catch {
    // Ignorar error de almacenamiento
  }
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out.buffer;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPinAndUnlockKey(params: {
  slug: string;
  userId: string;
  bundle: OfflinePinBundle | null | undefined;
  pin: string;
}): Promise<{ ok: true; signingKey: CryptoKey } | { ok: false; error: string }> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return { ok: false, error: 'Este navegador no soporta verificación criptográfica local sin conexión.' };
  }
  const { slug, userId, bundle, pin } = params;
  if (!bundle) {
    return {
      ok: false,
      error: 'Este usuario debe guardar o validar su PIN una vez con conexión para habilitar el modo sin conexión.',
    };
  }

  const lock = readLock(slug, userId);
  if (lock.lockedUntil && lock.lockedUntil > Date.now()) {
    const mins = Math.max(1, Math.ceil((lock.lockedUntil - Date.now()) / 60_000));
    return {
      ok: false,
      error: `PIN bloqueado localmente por intentos fallidos. Intenta en ${mins} min.`,
    };
  }

  const cleanPin = pin.trim();
  if (!cleanPin) {
    return { ok: false, error: 'Ingresa el PIN.' };
  }

  try {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(cleanPin),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: toArrayBuffer(fromBase64(bundle.salt)),
        iterations: bundle.iterations || 100_000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256,
    );
    const verifierHex = toHex(await window.crypto.subtle.digest('SHA-256', derivedBits));

    if (!constantTimeEqualHex(verifierHex, bundle.verifier_hash.toLowerCase())) {
      const nextAttempts = (lock.attempts || 0) + 1;
      const locked = nextAttempts >= PIN_MAX_ATTEMPTS;
      writeLock(slug, userId, {
        attempts: locked ? 0 : nextAttempts,
        lockedUntil: locked ? Date.now() + PIN_LOCK_MS : null,
      });
      return {
        ok: false,
        error: locked
          ? 'PIN bloqueado temporalmente por 5 intentos fallidos (15 minutos).'
          : 'PIN inválido.',
      };
    }

    writeLock(slug, userId, { attempts: 0, lockedUntil: null });

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const signingKeyRaw = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(bundle.iv)) },
      aesKey,
      toArrayBuffer(fromBase64(bundle.encrypted_key)),
    );
    const signingKey = await window.crypto.subtle.importKey(
      'raw',
      signingKeyRaw,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    return { ok: true, signingKey };
  } catch {
    return { ok: false, error: 'No se pudo validar el PIN localmente.' };
  }
}

export async function signOfflineMessage(signingKey: CryptoKey, message: string): Promise<string> {
  const sig = await window.crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(message));
  return toHex(sig);
}

export async function verifyAndSignOfflineProof(params: {
  slug: string;
  userId: string;
  bundle: OfflinePinBundle | null | undefined;
  pin: string;
  message: string;
}): Promise<{ ok: true; proof: string } | { ok: false; error: string }> {
  const unlocked = await verifyPinAndUnlockKey(params);
  if (!unlocked.ok) return unlocked;
  const proof = await signOfflineMessage(unlocked.signingKey, params.message);
  return { ok: true, proof };
}
