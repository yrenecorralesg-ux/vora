import { z } from 'zod';
import type { CommercialStatus, InfrastructureMode, TechnicalStatus } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Catalogs (shared by API validation and admin UI)                           */
/* -------------------------------------------------------------------------- */

export const TENANT_COUNTRIES = [
  { value: 'VE', label: 'Venezuela', timezone: 'America/Caracas', currency: 'VES' },
  { value: 'CO', label: 'Colombia', timezone: 'America/Bogota', currency: 'COP' },
  { value: 'PA', label: 'Panamá', timezone: 'America/Panama', currency: 'USD' },
  { value: 'DO', label: 'República Dominicana', timezone: 'America/Santo_Domingo', currency: 'DOP' },
  { value: 'MX', label: 'México', timezone: 'America/Mexico_City', currency: 'MXN' },
  { value: 'US', label: 'Estados Unidos', timezone: 'America/New_York', currency: 'USD' },
  { value: 'ES', label: 'España', timezone: 'Europe/Madrid', currency: 'EUR' },
  { value: 'OTHER', label: 'Otro', timezone: 'America/Caracas', currency: 'USD' },
] as const;

export const TENANT_CURRENCIES = [
  { value: 'VES', label: 'Bolívar (VES)' },
  { value: 'USD', label: 'Dólar estadounidense (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'COP', label: 'Peso colombiano (COP)' },
  { value: 'DOP', label: 'Peso dominicano (DOP)' },
  { value: 'MXN', label: 'Peso mexicano (MXN)' },
] as const;

export const TENANT_BUSINESS_TYPES = [
  { value: 'commerce', label: 'Comercio' },
  { value: 'distributor', label: 'Distribuidora' },
  { value: 'supermarket', label: 'Supermercado' },
  { value: 'services', label: 'Servicios' },
  { value: 'other', label: 'Otro' },
] as const;

/** Labels for business types stored before VORA (kept for existing companies). */
const LEGACY_BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: 'Retail / Comercio',
  ecommerce: 'Ecommerce',
  manufacturing: 'Manufactura',
  technology: 'Tecnología',
  consulting: 'Consultoría',
};

export const INFRASTRUCTURE_MODES: { value: InfrastructureMode; label: string; description: string }[] = [
  {
    value: 'shared',
    label: 'Shared',
    description: 'Infraestructura compartida con otras empresas, aislada por tenant_id y políticas RLS.',
  },
  {
    value: 'dedicated',
    label: 'Dedicated',
    description: 'Infraestructura individual (proyecto Supabase propio) para la empresa.',
  },
];

export const ADMIN_STATUS_LABEL: Record<CommercialStatus, string> = {
  pending: 'Pendiente',
  trial: 'Prueba',
  active: 'Activa',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export const TECHNICAL_STATUS_LABEL: Record<TechnicalStatus, string> = {
  pending_setup: 'Aprovisionamiento pendiente',
  ready: 'Infraestructura lista',
  error: 'Error de aprovisionamiento',
};

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente de activación',
  active: 'Activa',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

export function countryLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return TENANT_COUNTRIES.find((c) => c.value === code)?.label ?? code;
}

export function businessTypeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return TENANT_BUSINESS_TYPES.find((b) => b.value === value)?.label ?? LEGACY_BUSINESS_TYPE_LABELS[value] ?? value;
}

export function infrastructureLabel(mode: InfrastructureMode | null | undefined): string {
  return INFRASTRUCTURE_MODES.find((m) => m.value === mode)?.label ?? 'Shared';
}

/** A company is operational only when it is administratively active AND its infrastructure is verified. */
export function isOperational(status: CommercialStatus, technical: TechnicalStatus): boolean {
  return status === 'active' && technical === 'ready';
}

/* -------------------------------------------------------------------------- */
/*  Administrative status transitions                                          */
/* -------------------------------------------------------------------------- */

export type TenantStatusAction = 'activate' | 'suspend' | 'reactivate';

export const STATUS_ACTIONS: Record<TenantStatusAction, { from: CommercialStatus[]; to: CommercialStatus; label: string }> = {
  activate: { from: ['pending', 'trial'], to: 'active', label: 'Activar' },
  suspend: { from: ['pending', 'trial', 'active'], to: 'suspended', label: 'Suspender' },
  reactivate: { from: ['suspended'], to: 'active', label: 'Reactivar' },
};

export function availableStatusActions(status: CommercialStatus): TenantStatusAction[] {
  return (Object.keys(STATUS_ACTIONS) as TenantStatusAction[]).filter((action) => STATUS_ACTIONS[action].from.includes(status));
}

/** Subscription status that mirrors the administrative status of the company. */
export function subscriptionStatusFor(status: CommercialStatus): string {
  if (status === 'active' || status === 'trial') return 'active';
  if (status === 'suspended') return 'suspended';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const RIF_RE = /^([VEJPGC])-?(\d{8})-?(\d)$/;
const GENERIC_TAX_ID_RE = /^[A-Z0-9][A-Z0-9.\- ]{2,29}$/;

/** Normalizes a tax ID. Venezuelan RIF becomes `J-12345678-9`; returns null when the format is invalid. */
export function normalizeTaxId(raw: string, country: string): string | null {
  const value = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (country === 'VE') {
    const match = value.replace(/[\s.]/g, '').match(RIF_RE);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  }
  return GENERIC_TAX_ID_RE.test(value) ? value : null;
}

const countryCodes = TENANT_COUNTRIES.map((c) => c.value) as [string, ...string[]];
const currencyCodes = TENANT_CURRENCIES.map((c) => c.value) as [string, ...string[]];
const businessTypeValues = TENANT_BUSINESS_TYPES.map((b) => b.value) as [string, ...string[]];

const optionalPhone = z
  .string()
  .trim()
  .max(20, 'Máximo 20 caracteres.')
  .refine((v) => v === '' || PHONE_RE.test(v), 'Teléfono inválido. Usa solo números, espacios, guiones y + inicial.')
  .optional();

const baseFields = {
  commercial_name: z.string().trim().min(2, 'El nombre comercial es obligatorio.').max(120, 'Máximo 120 caracteres.'),
  legal_name: z.string().trim().min(2, 'La razón social es obligatoria.').max(200, 'Máximo 200 caracteres.'),
  tax_id: z.string().trim().min(3, 'El RIF o identificación fiscal es obligatorio.').max(30, 'Máximo 30 caracteres.'),
  contact_email: z.string().trim().toLowerCase().email('Correo de contacto inválido.').max(254),
  contact_phone: optionalPhone,
  country: z.enum(countryCodes, { errorMap: () => ({ message: 'Selecciona un país válido.' }) }),
  currency: z.enum(currencyCodes, { errorMap: () => ({ message: 'Selecciona una moneda válida.' }) }),
  business_type: z.enum(businessTypeValues, { errorMap: () => ({ message: 'Selecciona un tipo de negocio válido.' }) }),
  infrastructure_mode: z.enum(['shared', 'dedicated'], { errorMap: () => ({ message: 'Selecciona la modalidad Shared o Dedicated.' }) }),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, 'Slug inválido: solo minúsculas, números y guiones (inicio y fin alfanumérico).'),
  language: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().min(3).max(60).optional(),
};

function refineTaxId(value: { tax_id?: string; country?: string }, ctx: z.RefinementCtx) {
  if (value.tax_id === undefined || value.country === undefined) return;
  if (!normalizeTaxId(value.tax_id, value.country)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tax_id'],
      message: value.country === 'VE' ? 'RIF inválido. Formato: J-12345678-9 (letra V, E, J, P, G o C).' : 'Identificación fiscal inválida.',
    });
  }
}

export const tenantCreateSchema = z
  .object({
    ...baseFields,
    plan_id: z.string().uuid('Selecciona un plan válido.'),
    business_template_id: z.string().uuid().optional().or(z.literal('')),
  })
  .superRefine(refineTaxId);

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;

/** Editable fields. Plan and statuses have their own endpoints. */
export const tenantUpdateSchema = z
  .object({
    ...baseFields,
    business_template_id: z.string().uuid().nullable().optional(),
    wizard_step: z.number().int().min(1).max(20).optional(),
    wizard_completed: z.boolean().optional(),
  })
  .partial()
  .strict()
  .superRefine(refineTaxId);

export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;

export const planChangeSchema = z.object({ plan_id: z.string().uuid('Selecciona un plan válido.') }).strict();

export const statusChangeSchema = z
  .object({
    action: z.enum(['activate', 'suspend', 'reactivate']).optional(),
    commercial_status: z.enum(['active', 'suspended']).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.action || v.commercial_status, { message: 'Indica la acción: activar, suspender o reactivar.' });

/** Flattens zod issues into `{ field: message }` for API responses. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
