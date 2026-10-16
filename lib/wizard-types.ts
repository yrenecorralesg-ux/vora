import type { ImplementationStatus, InfrastructureMode } from '@/lib/types';

export interface WizardData {
  commercial_name: string;
  legal_name: string;
  tax_id: string;
  contact_email: string;
  contact_phone: string;
  infrastructure_mode: InfrastructureMode;
  plan_id: string;
  slug: string;
  slugTouched: boolean;
  country: string;
  currency: string;
  language: string;
  timezone: string;
  business_type: string;
  business_template_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  login_background_color: string;
  selectedFeatures: Record<string, boolean>;
  project_ref: string;
  supabase_url: string;
  secret_ref: string;
  admin_email: string;
}

export interface StepResult {
  ok: boolean;
  label: string;
  detail?: string;
  pending?: boolean;
}

export interface SubmitResults {
  tenant?: { id: string; slug: string; commercial_name: string };
  steps: StepResult[];
  finalTechnicalStatus: string;
}

export const STEPS = [
  { key: 'empresa', label: 'Empresa', icon: 'Building2' },
  { key: 'plan', label: 'Plan y modalidad', icon: 'CreditCard' },
  { key: 'template', label: 'Plantilla', icon: 'LayoutTemplate' },
  { key: 'branding', label: 'Branding', icon: 'Palette' },
  { key: 'modulos', label: 'Modulos', icon: 'Boxes' },
  { key: 'infraestructura', label: 'Infraestructura', icon: 'Database' },
  { key: 'admin', label: 'Administrador', icon: 'UserPlus' },
  { key: 'resumen', label: 'Resumen', icon: 'ClipboardCheck' },
] as const;

export const ALLOWED_FONTS = ['Inter', 'Poppins', 'Roboto', 'Montserrat', 'Plus Jakarta Sans'] as const;

export const COUNTRIES = [
  { value: 'CO', label: 'Colombia' },
  { value: 'MX', label: 'Mexico' },
  { value: 'AR', label: 'Argentina' },
  { value: 'PE', label: 'Peru' },
  { value: 'CL', label: 'Chile' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'ES', label: 'Espana' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'OTHER', label: 'Otro' },
];

export const CURRENCIES = [
  { value: 'COP', label: 'Peso Colombiano (COP)' },
  { value: 'MXN', label: 'Peso Mexicano (MXN)' },
  { value: 'ARS', label: 'Peso Argentino (ARS)' },
  { value: 'PEN', label: 'Sol Peruano (PEN)' },
  { value: 'CLP', label: 'Peso Chileno (CLP)' },
  { value: 'USD', label: 'Dolar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

export const LANGUAGES = [
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'Ingles' },
  { value: 'pt', label: 'Portugues' },
];

export const TIMEZONES = [
  'America/Bogota', 'America/Mexico_City', 'America/Argentina/Buenos_Aires',
  'America/Lima', 'America/Santiago', 'America/Guayaquil',
  'America/Montevideo', 'Europe/Madrid', 'US/Eastern', 'US/Pacific',
];

export const BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail / Comercio' },
  { value: 'ecommerce', label: 'Ecommerce' },
  { value: 'services', label: 'Servicios' },
  { value: 'manufacturing', label: 'Manufactura' },
  { value: 'technology', label: 'Tecnologia' },
  { value: 'consulting', label: 'Consultoria' },
  { value: 'other', label: 'Otro' },
];

export const IMPL_STATUS_LABELS: Record<ImplementationStatus, string> = {
  implemented: 'Implementado',
  planned: 'Planificado',
  unavailable: 'No disponible',
};

export const IMPL_STATUS_BADGE: Record<ImplementationStatus, string> = {
  implemented: 'border-transparent bg-success/15 text-success',
  planned: 'border-transparent bg-warning/15 text-warning',
  unavailable: 'border-transparent bg-muted text-muted-foreground',
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
