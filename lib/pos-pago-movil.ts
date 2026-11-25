import { encodeQr } from 'decoder-qr-pago-movil';
import type { PosPagoMovilConfig } from '@/lib/types';

export interface VeBank {
  code: string;
  name: string;
}

export const VE_BANKS: VeBank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0134', name: 'Banesco' },
  { code: '0108', name: 'BBVA Provincial' },
  { code: '0105', name: 'Mercantil' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0191', name: 'BNC (Banco Nacional de Crédito)' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Banco Bicentenario' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0156', name: '100% Banco' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0177', name: 'BANFANB' },
  { code: '0146', name: 'Bangente' },
];

export function findVeBankName(code: string): string {
  return VE_BANKS.find((b) => b.code === code)?.name ?? 'Banco Nacional';
}

/** Limpia caracteres de formato de un teléfono venezolano dejando solo dígitos (04XXXXXXXXX). */
export function cleanVePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').trim();
  if (digits.startsWith('58') && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

/** Formatea teléfono venezolano sin guiones (ej. 04266553049). */
export function formatVePhone(raw: string): string {
  const digits = cleanVePhone(raw);
  return /^04\d{9}$/.test(digits) ? digits : raw.replace(/[\s\-()]/g, '').trim();
}

/**
 * Extrae prefijo (V/J/G) y solo dígitos de Cédula o RIF.
 * Si el usuario ingresa solo dígitos (ej. "32130926"), asume prefijo "V".
 */
export function splitVeTaxId(raw: string): { prefix: 'V' | 'J' | 'G'; dni: string } {
  const cleaned = raw.trim().toUpperCase().replace(/[\s.\-]/g, '');
  const m = cleaned.match(/^([VJG])?(\d{5,11})$/);
  if (!m) {
    const onlyDigits = cleaned.replace(/\D/g, '');
    const p = cleaned.startsWith('J') ? 'J' : cleaned.startsWith('G') ? 'G' : 'V';
    return { prefix: p, dni: onlyDigits };
  }
  return {
    prefix: (m[1] as 'V' | 'J' | 'G' | undefined) ?? 'V',
    dni: m[2],
  };
}

/** Normaliza Cédula o RIF sin guiones (ej. 32130926, V32130926 o J401928374). */
export function normalizeVeTaxId(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[\s.\-]/g, '');
  const m = cleaned.match(/^([VJG])?(\d{5,11})$/);
  if (!m) return cleaned;
  return m[1] ? `${m[1]}${m[2]}` : m[2];
}

export function normalizePagoMovilConfig(raw: unknown): PosPagoMovilConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bank_code = String(r.bank_code ?? '').trim();
  const phone = formatVePhone(String(r.phone ?? ''));
  const tax_id = normalizeVeTaxId(String(r.tax_id ?? ''));
  const holder_name = String(r.holder_name ?? '').trim();

  if (!bank_code && !phone && !tax_id) return null;
  const bank_name = String(r.bank_name ?? '').trim() || findVeBankName(bank_code);
  return {
    bank_code,
    bank_name,
    phone,
    tax_id,
    ...(holder_name ? { holder_name } : {}),
  };
}

export function validatePagoMovilConfig(raw: unknown): { ok: true; value: PosPagoMovilConfig | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'object') return { ok: false, error: 'Datos de Pago Móvil inválidos.' };
  const r = raw as Record<string, unknown>;
  const bank_code = String(r.bank_code ?? '').trim();
  const phoneDigits = cleanVePhone(String(r.phone ?? ''));
  const taxCleaned = String(r.tax_id ?? '').trim().toUpperCase().replace(/[\s.\-]/g, '');
  const holder_name = String(r.holder_name ?? '').trim();

  if (!phoneDigits && !taxCleaned && !holder_name) {
    return { ok: true, value: null };
  }
  if (!/^\d{4}$/.test(bank_code)) {
    return { ok: false, error: 'Selecciona un código de banco válido (4 dígitos).' };
  }
  if (!/^04(12|14|16|24|26)\d{7}$/.test(phoneDigits)) {
    return { ok: false, error: 'Ingresa un celular venezolano válido de 11 dígitos sin guiones (ej. 04266553049).' };
  }
  if (!/^(?:[VJG])?\d{5,11}$/.test(taxCleaned)) {
    return { ok: false, error: 'Ingresa una cédula (ej. 32130926) o RIF (ej. J401928374) sin guiones.' };
  }
  if (holder_name.length > 100) {
    return { ok: false, error: 'El nombre del titular no puede superar 100 caracteres.' };
  }

  return {
    ok: true,
    value: {
      bank_code,
      bank_name: String(r.bank_name ?? '').trim() || findVeBankName(bank_code),
      phone: formatVePhone(phoneDigits),
      tax_id: normalizeVeTaxId(taxCleaned),
      ...(holder_name ? { holder_name } : {}),
    },
  };
}

/**
 * Genera el payload oficial estándar Suiche 7B (AES-256-CBC + ?merchantId=XXXX&origin=app)
 * compatible con BDVApp, BanescoMóvil, Mercantil, Bancamiga, BNC y la banca venezolana.
 * - `dni`: solo dígitos (sin V ni -)
 * - `prefix`: V / J / G
 * - `phone`: 58 + 10 dígitos (sin 0 inicial ni -)
 * - `bank`: solo el código de 4 dígitos
 */
export function formatPagoMovilQrPayload(
  cfg: PosPagoMovilConfig,
  amountVes: number,
  tenantName?: string,
): string {
  const { prefix, dni } = splitVeTaxId(cfg.tax_id);
  const phoneDigits = cleanVePhone(cfg.phone);
  const suichePhone = phoneDigits.startsWith('0')
    ? `58${phoneDigits.slice(1)}`
    : phoneDigits.startsWith('58')
      ? phoneDigits
      : `58${phoneDigits}`;
  const holder = (cfg.holder_name || tenantName || '').trim().slice(0, 40);

  return encodeQr({
    dni,
    prefix,
    phone: suichePhone,
    bank: cfg.bank_code.trim() as Parameters<typeof encodeQr>[0]['bank'],
    ...(holder ? { name: holder } : {}),
    ...(amountVes > 0 ? { amount: amountVes.toFixed(2).replace('.', ',') } : {}),
  });
}
