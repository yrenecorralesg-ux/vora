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

/** Limpia caracteres de formato de un teléfono venezolano (guiones/espacios) dejando dígitos. */
export function cleanVePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '').trim();
}

/** Da formato legible 04XX-XXXXXXX a un teléfono de 11 dígitos. */
export function formatVePhone(raw: string): string {
  const digits = cleanVePhone(raw);
  return /^04\d{9}$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4)}` : raw.trim();
}

/** Normaliza RIF o Cédula venezolana (ej. J-401928374). */
export function normalizeVeTaxId(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  const m = cleaned.match(/^([VEJGP])-?(\d{5,11})(?:-?(\d))?$/);
  if (!m) return cleaned;
  return m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
}

export function normalizePagoMovilConfig(raw: unknown): PosPagoMovilConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bank_code = String(r.bank_code ?? '').trim();
  const phone = cleanVePhone(String(r.phone ?? ''));
  const tax_id = normalizeVeTaxId(String(r.tax_id ?? ''));
  const holder_name = String(r.holder_name ?? '').trim();

  if (!bank_code && !phone && !tax_id) return null;
  const bank_name = String(r.bank_name ?? '').trim() || findVeBankName(bank_code);
  return {
    bank_code,
    bank_name,
    phone: formatVePhone(phone),
    tax_id,
    ...(holder_name ? { holder_name } : {}),
  };
}

export function validatePagoMovilConfig(raw: unknown): { ok: true; value: PosPagoMovilConfig | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'object') return { ok: false, error: 'Datos de Pago Móvil inválidos.' };
  const r = raw as Record<string, unknown>;
  const bank_code = String(r.bank_code ?? '').trim();
  const phoneRaw = cleanVePhone(String(r.phone ?? ''));
  const taxRaw = normalizeVeTaxId(String(r.tax_id ?? ''));
  const holder_name = String(r.holder_name ?? '').trim();

  // Todos vacíos (excepto banco por defecto si no escribió teléfono ni RIF) => limpiar configuración
  if (!phoneRaw && !taxRaw && !holder_name) {
    return { ok: true, value: null };
  }
  if (!/^\d{4}$/.test(bank_code)) {
    return { ok: false, error: 'Selecciona un código de banco válido (4 dígitos).' };
  }
  if (!/^04(12|14|16|24|26)\d{7}$/.test(phoneRaw)) {
    return { ok: false, error: 'Ingresa un teléfono Pago Móvil venezolano válido (ej. 0414-1234567).' };
  }
  if (!/^[VEJGP]-\d{5,11}(?:-\d)?$/.test(taxRaw)) {
    return { ok: false, error: 'Ingresa un RIF o Cédula válido (ej. J-401928374 o V-12345678).' };
  }
  if (holder_name.length > 100) {
    return { ok: false, error: 'El nombre del titular no puede superar 100 caracteres.' };
  }

  return {
    ok: true,
    value: {
      bank_code,
      bank_name: String(r.bank_name ?? '').trim() || findVeBankName(bank_code),
      phone: formatVePhone(phoneRaw),
      tax_id: taxRaw,
      ...(holder_name ? { holder_name } : {}),
    },
  };
}

/** Construye el texto estructurado codificado en el código QR de Pago Móvil. */
export function formatPagoMovilQrPayload(
  cfg: PosPagoMovilConfig,
  amountVes: number,
  tenantName?: string,
): string {
  const holder = cfg.holder_name || tenantName || 'Comercio VORA';
  const lines = [
    'PAGO MOVIL',
    `Comercio: ${holder}`,
    `Banco: ${cfg.bank_code} - ${cfg.bank_name}`,
    `RIF/CI: ${cfg.tax_id}`,
    `Telefono: ${cleanVePhone(cfg.phone)}`,
  ];
  if (amountVes > 0) {
    lines.push(`Monto: Bs. ${amountVes.toFixed(2)}`);
  }
  return lines.join('\n');
}
