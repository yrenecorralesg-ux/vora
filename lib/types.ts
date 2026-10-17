export type CommercialStatus = 'trial' | 'active' | 'suspended' | 'cancelled';
export type TechnicalStatus = 'pending_setup' | 'ready' | 'error';
export type ConnectionStatus =
  'not_configured' | 'checking' | 'connected' | 'error';
export type ImplementationStatus = 'implemented' | 'planned' | 'unavailable';
export type FeatureConfigState =
  'enabled' | 'pending_config' | 'configured' | 'operational';
export type ReleaseStatus =
  | 'planned'
  | 'in_development'
  | 'released_for_testing'
  | 'accepted'
  | 'accepted_with_pending';
export type DomainType = 'subdomain' | 'custom';
export type DomainVerification = 'pending' | 'verified' | 'failed';

export interface BusinessTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  suggested_features: string[];
}

export interface Feature {
  key: string;
  name: string;
  description: string;
  category: string;
  dependencies: string[];
  implementation_status: ImplementationStatus;
  sort_order: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  limits: Record<string, number | string>;
  is_active: boolean;
}

export interface Tenant {
  id: string;
  commercial_name: string;
  legal_name: string | null;
  tax_id?: string | null;
  slug: string;
  commercial_status: CommercialStatus;
  technical_status: TechnicalStatus;
  country: string | null;
  currency: string;
  language: string;
  timezone: string;
  business_template_id: string | null;
  plan_id: string | null;
  wizard_step: number;
  wizard_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantBranding {
  id: string;
  tenant_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  login_background_color: string;
  banner_url: string | null;
}

export interface TenantDatabase {
  id: string;
  tenant_id: string;
  provider: string;
  project_ref: string | null;
  supabase_url: string | null;
  secret_ref: string | null;
  connection_status: ConnectionStatus;
  schema_version: string | null;
  expected_tenant_id: string | null;
  last_checked_at: string | null;
  error_message: string | null;
}

export interface TenantDomain {
  id: string;
  tenant_id: string;
  hostname: string;
  domain_type: DomainType;
  verification_status: DomainVerification;
  is_primary: boolean;
}

export interface TenantFeature {
  id: string;
  tenant_id: string;
  feature_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  config_state: FeatureConfigState;
  release_status: ReleaseStatus;
}

export interface PlatformRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: string;
}

export interface PlatformUserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  auth_user_id: string;
  role: string;
  status: string;
  created_at: string;
}

export interface DemoRequest {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  phone: string | null;
  interest: string | null;
  consent: boolean;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  tenant_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  correlation_id: string | null;
  created_at: string;
}
