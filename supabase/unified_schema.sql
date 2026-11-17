-- ============================================================================
-- VORA Platform — Esquema Unificado Consolidado
-- Compatible con PostgreSQL 15+ y Supabase
-- Incluye: Extensiones, ENUMs, Tablas, Índices, Funciones, Triggers, RLS, Grants y Seeds
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ENUMS
-- ============================================================================

DO $$ BEGIN CREATE TYPE commercial_status AS ENUM ('trial', 'active', 'suspended', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE technical_status AS ENUM ('pending_setup', 'ready', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE connection_status AS ENUM ('not_configured', 'checking', 'connected', 'error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE implementation_status AS ENUM ('implemented', 'planned', 'unavailable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE feature_config_state AS ENUM ('enabled', 'pending_config', 'configured', 'operational'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE domain_type AS ENUM ('subdomain', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE domain_verification AS ENUM ('pending', 'verified', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE migration_status AS ENUM ('pending', 'running', 'completed', 'failed', 'rolled_back'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE db_scope AS ENUM ('platform', 'tenant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE release_status AS ENUM ('planned', 'in_development', 'released_for_testing', 'accepted', 'accepted_with_pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- Plantillas de negocio
CREATE TABLE IF NOT EXISTS business_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  suggested_features text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Catálogo de módulos y funcionalidades
CREATE TABLE IF NOT EXISTS features (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'crm',
  dependencies text[] DEFAULT '{}',
  implementation_status implementation_status NOT NULL DEFAULT 'planned',
  sort_order int NOT NULL DEFAULT 0,
  available_functions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Planes de suscripción
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  limits jsonb DEFAULT '{}',
  monthly_price_usd numeric(14,2) CHECK (monthly_price_usd >= 0),
  infrastructure_mode text NOT NULL DEFAULT 'shared' CHECK (infrastructure_mode IN ('shared', 'dedicated')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Empresas / Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name text NOT NULL,
  legal_name text,
  tax_id text,
  slug text UNIQUE NOT NULL,
  infrastructure_mode text NOT NULL DEFAULT 'dedicated' CHECK (infrastructure_mode IN ('shared', 'dedicated')),
  commercial_status commercial_status NOT NULL DEFAULT 'trial',
  technical_status technical_status NOT NULL DEFAULT 'pending_setup',
  country text DEFAULT 'VE',
  currency text DEFAULT 'USD',
  language text DEFAULT 'es',
  timezone text DEFAULT 'America/Caracas',
  business_type text,
  business_template_id uuid REFERENCES business_templates(id),
  plan_id uuid REFERENCES plans(id),
  wizard_step int DEFAULT 1,
  wizard_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Conexiones de base de datos de tenants
CREATE TABLE IF NOT EXISTS tenant_databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'supabase',
  project_ref text,
  supabase_url text,
  secret_ref text,
  connection_status connection_status NOT NULL DEFAULT 'not_configured',
  schema_version text,
  expected_tenant_id uuid,
  last_checked_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Dominios de tenants
CREATE TABLE IF NOT EXISTS tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname text UNIQUE NOT NULL,
  domain_type domain_type NOT NULL DEFAULT 'subdomain',
  verification_status domain_verification NOT NULL DEFAULT 'pending',
  verification_token uuid NOT NULL DEFAULT gen_random_uuid(),
  last_checked_at timestamptz,
  verification_error text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Identidad visual / Branding de tenants
CREATE TABLE IF NOT EXISTS tenant_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#285C49',
  secondary_color text DEFAULT '#A9BEA5',
  accent_color text DEFAULT '#C97857',
  font_family text DEFAULT 'Inter',
  login_background_color text DEFAULT '#F6F2E9',
  banner_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Módulos contratados y habilitados por tenant
CREATE TABLE IF NOT EXISTS tenant_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  contracted boolean NOT NULL DEFAULT false,
  config jsonb DEFAULT '{"functions": {}}'::jsonb,
  config_state feature_config_state NOT NULL DEFAULT 'enabled',
  release_status release_status NOT NULL DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

-- Suscripciones activas de tenants
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workspaces dedicados de tenants
CREATE TABLE IF NOT EXISTS tenant_workspaces (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  schema_version text NOT NULL DEFAULT 'core-1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Roles de la plataforma
CREATE TABLE IF NOT EXISTS platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'platform',
  created_at timestamptz DEFAULT now()
);

-- Asignación de roles de plataforma a usuarios
CREATE TABLE IF NOT EXISTS platform_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Membresías de usuarios en tenants
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'tenant_admin',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, auth_user_id)
);

-- Permisos por rol
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  permission text NOT NULL,
  scope text NOT NULL DEFAULT 'platform',
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_key, permission)
);

-- Invitaciones a administradores de tenants
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'tenant_admin',
  status invitation_status NOT NULL DEFAULT 'pending',
  token_hash text NOT NULL,
  invited_by uuid,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid,
  email_status text NOT NULL DEFAULT 'not_sent' CHECK (email_status IN ('not_sent','accepted','failed','not_configured')),
  email_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Versiones de esquemas aplicados
CREATE TABLE IF NOT EXISTS schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope db_scope NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  description text,
  applied_at timestamptz DEFAULT now(),
  UNIQUE(scope, version)
);

-- Registro de ejecuciones de migración
CREATE TABLE IF NOT EXISTS migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope db_scope NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  version text NOT NULL,
  status migration_status NOT NULL DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Logs de auditoría de la plataforma
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  resource_id text,
  details jsonb DEFAULT '{}',
  correlation_id text,
  created_at timestamptz DEFAULT now()
);

-- Solicitudes de demo
CREATE TABLE IF NOT EXISTS demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  company text,
  phone text,
  interest text,
  consent boolean NOT NULL DEFAULT true,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

-- Configuración de facturación y cobro de la plataforma
CREATE TABLE IF NOT EXISTS platform_billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  bank_code text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  tax_id text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tasas de cambio de la plataforma (BCV / Oficial)
CREATE TABLE IF NOT EXISTS platform_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL UNIQUE,
  ves_per_usd numeric(18,6) NOT NULL CHECK (ves_per_usd > 0),
  source text NOT NULL CHECK (length(trim(source)) > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Facturas / Cargos de la plataforma a los tenants
CREATE TABLE IF NOT EXISTS platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end > period_start),
  amount_usd numeric(14,2) NOT NULL CHECK (amount_usd > 0),
  exchange_rate_id uuid NOT NULL REFERENCES platform_exchange_rates(id),
  ves_per_usd numeric(18,6) NOT NULL CHECK (ves_per_usd > 0),
  amount_ves numeric(18,2) NOT NULL CHECK (amount_ves > 0),
  recipient jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start),
  UNIQUE (id, tenant_id)
);

-- Reportes de pago recibidos por parte de tenants
CREATE TABLE IF NOT EXISTS platform_payment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  reference text NOT NULL CHECK (length(trim(reference)) BETWEEN 4 AND 100),
  bank_code text NOT NULL CHECK (bank_code ~ '^[0-9]{4}$'),
  phone text NOT NULL CHECK (phone ~ '^04[0-9]{9}$'),
  paid_on date NOT NULL,
  amount_ves numeric(18,2) NOT NULL CHECK (amount_ves > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reported_by uuid NOT NULL,
  reviewed_by uuid,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, tenant_id) REFERENCES platform_invoices(id, tenant_id) ON DELETE CASCADE,
  UNIQUE (bank_code, reference, paid_on)
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(commercial_status);
CREATE INDEX IF NOT EXISTS idx_tenants_template ON tenants(business_template_id);
CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_features_key ON tenant_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_user_roles_user ON platform_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON platform_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON platform_audit_logs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS one_approved_payment_per_invoice ON platform_payment_reports(invoice_id) WHERE status = 'approved';
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_payment_per_invoice ON platform_payment_reports(invoice_id) WHERE status = 'pending';

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Trigger genérico para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Helper para verificar rol de super_admin
CREATE OR REPLACE FUNCTION public.vora_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_user_roles ur
    JOIN platform_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.key = 'super_admin'
  );
$$;
REVOKE ALL ON FUNCTION public.vora_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vora_is_super_admin() TO authenticated, service_role;

-- Creación atómica de tenant con subdominio y branding
CREATE OR REPLACE FUNCTION public.vora_create_tenant(
  p_name text,
  p_slug text,
  p_mode text,
  p_legal text DEFAULT NULL,
  p_tax_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.tenants;
BEGIN
  IF NOT public.vora_is_super_admin() THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  IF length(trim(p_name)) NOT BETWEEN 1 AND 200
     OR p_slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
     OR p_slug IN ('www','admin','api','auth','login','app','mail','support','billing','status','t') THEN
    RAISE EXCEPTION 'Nombre o subdominio inválido';
  END IF;

  INSERT INTO tenants (commercial_name, legal_name, tax_id, slug, infrastructure_mode, country, currency, timezone)
  VALUES (trim(p_name), nullif(trim(p_legal),''), nullif(trim(p_tax_id),''), p_slug, p_mode, 'VE', 'USD', 'America/Caracas')
  RETURNING * INTO t;

  INSERT INTO tenant_domains (tenant_id, hostname, domain_type, is_primary)
  VALUES (t.id, p_slug || '.vora.venesoftca.com', 'subdomain', true);

  INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, login_background_color, font_family)
  VALUES (t.id, '#285C49', '#A9BEA5', '#C97857', '#F6F2E9', 'Inter');

  INSERT INTO platform_audit_logs (actor_id, tenant_id, action, resource, resource_id, details)
  VALUES (auth.uid(), t.id, 'tenant.create', 'tenants', t.id::text, jsonb_build_object('slug', p_slug, 'mode', p_mode));

  RETURN to_jsonb(t);
END;
$$;

-- Asignación controlada de plan a un tenant
CREATE OR REPLACE FUNCTION public.vora_assign_plan(p_tenant uuid, p_plan uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p public.plans;
BEGIN
  IF NOT public.vora_is_super_admin() THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  SELECT * INTO STRICT p FROM plans WHERE id = p_plan AND is_active;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant AND infrastructure_mode = p.infrastructure_mode) THEN
    RAISE EXCEPTION 'El plan no coincide con la modalidad de la empresa';
  END IF;

  UPDATE tenants SET plan_id = p_plan WHERE id = p_tenant;

  INSERT INTO tenant_subscriptions (tenant_id, plan_id, status)
  VALUES (p_tenant, p_plan, 'trial')
  ON CONFLICT (tenant_id) DO UPDATE SET plan_id = EXCLUDED.plan_id;

  INSERT INTO platform_audit_logs (actor_id, tenant_id, action, resource, resource_id, details)
  VALUES (auth.uid(), p_tenant, 'tenant.plan.assign', 'plans', p_plan::text, '{}');
END;
$$;

-- Emisión de facturas / cargos mensuales
CREATE OR REPLACE FUNCTION public.vora_issue_invoice(p_tenant uuid, p_period date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.tenant_subscriptions;
  p public.plans;
  r public.platform_exchange_rates;
  b public.platform_billing_settings;
  i public.platform_invoices;
BEGIN
  IF NOT public.vora_is_super_admin() THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  SELECT * INTO STRICT s FROM tenant_subscriptions WHERE tenant_id = p_tenant FOR UPDATE;
  SELECT * INTO STRICT p FROM plans WHERE id = s.plan_id AND is_active AND monthly_price_usd > 0;

  IF EXISTS (
    SELECT 1 FROM platform_invoices
    WHERE tenant_id = p_tenant
      AND status <> 'cancelled'
      AND period_start < (p_period + interval '1 month')::date
      AND period_end > p_period
  ) THEN
    RAISE EXCEPTION 'El período se superpone con otro cargo';
  END IF;

  SELECT * INTO STRICT r FROM platform_exchange_rates WHERE effective_date = (now() AT TIME ZONE 'America/Caracas')::date;
  SELECT * INTO STRICT b FROM platform_billing_settings WHERE id AND bank_code ~ '^[0-9]{4}$' AND phone ~ '^04[0-9]{9}$' AND length(tax_id) > 3;

  INSERT INTO platform_invoices (tenant_id, subscription_id, period_start, period_end, amount_usd, exchange_rate_id, ves_per_usd, amount_ves, recipient, created_by)
  VALUES (
    p_tenant,
    s.id,
    p_period,
    (p_period + interval '1 month')::date,
    p.monthly_price_usd,
    r.id,
    r.ves_per_usd,
    round(p.monthly_price_usd * r.ves_per_usd, 2),
    jsonb_build_object('bank_code', b.bank_code, 'phone', b.phone, 'tax_id', b.tax_id),
    auth.uid()
  )
  RETURNING * INTO i;

  INSERT INTO platform_audit_logs (actor_id, tenant_id, action, resource, resource_id, details)
  VALUES (auth.uid(), p_tenant, 'billing.invoice.issue', 'platform_invoices', i.id::text, jsonb_build_object('amount_usd', i.amount_usd, 'rate', r.ves_per_usd));

  RETURN to_jsonb(i);
END;
$$;

-- Revisión y aprobación / rechazo de reportes de pago
CREATE OR REPLACE FUNCTION public.vora_review_payment(p_payment uuid, p_approve boolean, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  report public.platform_payment_reports;
  invoice public.platform_invoices;
BEGIN
  IF NOT public.vora_is_super_admin() THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  SELECT * INTO STRICT report FROM platform_payment_reports WHERE id = p_payment;
  SELECT * INTO STRICT invoice FROM platform_invoices WHERE id = report.invoice_id FOR UPDATE;
  SELECT * INTO STRICT report FROM platform_payment_reports WHERE id = p_payment FOR UPDATE;

  IF report.status <> 'pending' OR invoice.status <> 'pending' THEN
    RAISE EXCEPTION 'El pago o cargo ya fue procesado';
  END IF;

  IF length(trim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Indica la nota de revisión';
  END IF;

  IF p_approve AND report.amount_ves <> invoice.amount_ves THEN
    RAISE EXCEPTION 'El monto debe coincidir con el cargo';
  END IF;

  UPDATE platform_payment_reports
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = trim(p_note)
  WHERE id = p_payment;

  IF p_approve THEN
    UPDATE platform_invoices SET status = 'paid' WHERE id = invoice.id;
    UPDATE tenant_subscriptions
    SET status = 'active',
        ended_at = greatest(coalesce(ended_at, invoice.period_end::timestamptz), invoice.period_end::timestamptz)
    WHERE id = invoice.subscription_id;
  END IF;

  INSERT INTO platform_audit_logs (actor_id, tenant_id, action, resource, resource_id, details)
  VALUES (auth.uid(), report.tenant_id, 'billing.payment.review', 'platform_payment_reports', p_payment::text, jsonb_build_object('approved', p_approve, 'note', p_note));
END;
$$;

-- Validación del estado técnico (readiness) del tenant
CREATE OR REPLACE FUNCTION public.vora_validate_readiness(p_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ready boolean;
BEGIN
  IF NOT public.vora_is_super_admin() THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  SELECT t.plan_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM tenant_databases d WHERE d.tenant_id = t.id AND d.connection_status = 'connected')
     AND EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = t.id AND m.status = 'active' AND m.role IN ('tenant_admin', 'admin'))
  INTO ready
  FROM tenants t
  WHERE t.id = p_tenant;

  IF ready IS NULL THEN
    RAISE EXCEPTION 'Empresa inexistente';
  END IF;

  UPDATE tenants
  SET technical_status = CASE WHEN ready THEN 'ready'::technical_status ELSE 'pending_setup'::technical_status END
  WHERE id = p_tenant;

  INSERT INTO platform_audit_logs (actor_id, tenant_id, action, resource, resource_id, details)
  VALUES (auth.uid(), p_tenant, 'tenant.readiness.check', 'tenants', p_tenant::text, jsonb_build_object('ready', ready));

  RETURN ready;
END;
$$;

-- Control de límite de usuarios de acuerdo al plan
CREATE OR REPLACE FUNCTION public.vora_membership_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cap integer;
  used integer;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM tenants WHERE id = NEW.tenant_id FOR UPDATE;
  SELECT (p.limits->>'max_users')::integer INTO cap FROM tenants t JOIN plans p ON p.id = t.plan_id WHERE t.id = NEW.tenant_id;

  IF cap IS NOT NULL THEN
    SELECT count(*) INTO used FROM tenant_memberships WHERE tenant_id = NEW.tenant_id AND status = 'active' AND id <> NEW.id;
    IF used >= cap THEN
      RAISE EXCEPTION 'Límite de usuarios del plan alcanzado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Impedir degradación de plan por debajo del número de usuarios actuales
CREATE OR REPLACE FUNCTION public.vora_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cap integer;
BEGIN
  IF NEW.plan_id IS NOT DISTINCT FROM OLD.plan_id THEN
    RETURN NEW;
  END IF;

  SELECT (limits->>'max_users')::integer INTO cap FROM plans WHERE id = NEW.plan_id;
  IF cap IS NOT NULL AND (SELECT count(*) FROM tenant_memberships WHERE tenant_id = NEW.id AND status = 'active') > cap THEN
    RAISE EXCEPTION 'El plan no admite los usuarios activos actuales';
  END IF;

  RETURN NEW;
END;
$$;

-- Preparar invitación segura para administrador de tenant
CREATE OR REPLACE FUNCTION public.vora_prepare_admin_invitation(p_tenant uuid, p_email text, p_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i tenant_invitations;
  cap integer;
  used integer;
BEGIN
  IF NOT public.vora_is_super_admin() THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  PERFORM 1 FROM tenants WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa inexistente';
  END IF;

  IF length(p_email) > 254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(p_hash) < 32 THEN
    RAISE EXCEPTION 'Invitación inválida';
  END IF;

  SELECT * INTO i FROM tenant_invitations WHERE tenant_id = p_tenant AND email = lower(trim(p_email)) FOR UPDATE;
  IF i.email_sent_at > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Espera un minuto para reenviar';
  END IF;

  SELECT (p.limits->>'max_users')::integer INTO cap FROM tenants t JOIN plans p ON p.id = t.plan_id WHERE t.id = p_tenant;
  SELECT count(*) INTO used FROM tenant_memberships WHERE tenant_id = p_tenant AND status = 'active';

  IF cap IS NOT NULL AND used >= cap AND NOT EXISTS(
    SELECT 1 FROM tenant_memberships m JOIN auth.users u ON u.id = m.auth_user_id
    WHERE m.tenant_id = p_tenant AND m.status = 'active' AND lower(u.email) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Límite de usuarios del plan alcanzado';
  END IF;

  INSERT INTO tenant_invitations (tenant_id, email, role, status, token_hash, invited_by, expires_at, email_status)
  VALUES (p_tenant, lower(trim(p_email)), 'tenant_admin', 'pending', p_hash, auth.uid(), now() + interval '1 hour', 'not_sent')
  ON CONFLICT (tenant_id, email) DO UPDATE SET
    role = 'tenant_admin',
    status = 'pending',
    token_hash = p_hash,
    invited_by = auth.uid(),
    expires_at = now() + interval '1 hour',
    accepted_by = NULL,
    accepted_at = NULL,
    email_status = 'not_sent'
  RETURNING * INTO i;

  INSERT INTO platform_audit_logs (actor_id, tenant_id, action, resource, resource_id)
  VALUES (auth.uid(), p_tenant, 'tenant.invitation.prepare', 'tenant_invitations', i.id::text);

  RETURN jsonb_build_object('id', i.id, 'email', i.email, 'status', i.status, 'expires_at', i.expires_at);
END;
$$;

-- Aceptar invitación y activar membresía
CREATE OR REPLACE FUNCTION public.vora_accept_admin_invitation(p_invitation uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i tenant_invitations;
  u auth.users;
  target_slug text;
  target_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  IF u.id IS NULL OR u.email IS NULL OR u.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirma tu correo';
  END IF;

  SELECT tenant_id INTO target_tenant FROM tenant_invitations WHERE id = p_invitation;
  PERFORM 1 FROM tenants WHERE id = target_tenant FOR UPDATE;
  SELECT * INTO i FROM tenant_invitations WHERE id = p_invitation FOR UPDATE;

  IF i.id IS NULL OR lower(i.email) <> lower(u.email) OR i.role <> 'tenant_admin' THEN
    RAISE EXCEPTION 'Invitación inválida';
  END IF;

  IF i.status = 'accepted' AND i.accepted_by = u.id THEN
    IF NOT EXISTS (SELECT 1 FROM tenant_memberships WHERE tenant_id = i.tenant_id AND auth_user_id = u.id AND status = 'active') THEN
      RAISE EXCEPTION 'Acceso desactivado';
    END IF;
  ELSIF i.status = 'pending' AND i.expires_at > now() THEN
    INSERT INTO tenant_memberships (tenant_id, auth_user_id, role, status)
    VALUES (i.tenant_id, u.id, 'tenant_admin', 'active')
    ON CONFLICT (tenant_id, auth_user_id) DO UPDATE SET role = 'tenant_admin', status = 'active';

    UPDATE tenant_invitations SET status = 'accepted', accepted_by = u.id, accepted_at = now() WHERE id = i.id;

    INSERT INTO platform_audit_logs (actor_id, tenant_id, action, resource, resource_id)
    VALUES (u.id, i.tenant_id, 'tenant.invitation.accept', 'tenant_memberships', u.id::text);
  ELSE
    RAISE EXCEPTION 'Invitación vencida o revocada';
  END IF;

  SELECT slug INTO target_slug FROM tenants WHERE id = i.tenant_id;
  RETURN target_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.vora_create_tenant(text,text,text,text,text), public.vora_assign_plan(uuid,uuid), public.vora_issue_invoice(uuid,date), public.vora_review_payment(uuid,boolean,text), public.vora_validate_readiness(uuid), public.vora_prepare_admin_invitation(uuid,text,text), public.vora_accept_admin_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vora_create_tenant(text,text,text,text,text), public.vora_assign_plan(uuid,uuid), public.vora_issue_invoice(uuid,date), public.vora_review_payment(uuid,boolean,text), public.vora_validate_readiness(uuid), public.vora_prepare_admin_invitation(uuid,text,text), public.vora_accept_admin_invitation(uuid) TO authenticated;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

DO $$ BEGIN CREATE TRIGGER set_updated_at_tenants BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_tenant_databases BEFORE UPDATE ON tenant_databases FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_tenant_domains BEFORE UPDATE ON tenant_domains FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_tenant_branding BEFORE UPDATE ON tenant_branding FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_tenant_features BEFORE UPDATE ON tenant_features FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_tenant_subscriptions BEFORE UPDATE ON tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_tenant_memberships BEFORE UPDATE ON tenant_memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_features BEFORE UPDATE ON features FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_plans BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at_business_templates BEFORE UPDATE ON business_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS vora_membership_quota ON public.tenant_memberships;
CREATE TRIGGER vora_membership_quota BEFORE INSERT OR UPDATE ON public.tenant_memberships FOR EACH ROW EXECUTE FUNCTION public.vora_membership_quota();

DROP TRIGGER IF EXISTS vora_plan_quota ON public.tenants;
CREATE TRIGGER vora_plan_quota BEFORE UPDATE OF plan_id ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.vora_plan_quota();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================

ALTER TABLE business_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_payment_reports ENABLE ROW LEVEL SECURITY;

-- Catálogos públicos
DROP POLICY IF EXISTS "bt_read_all" ON business_templates;
CREATE POLICY "bt_read_all" ON business_templates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "feat_read_all" ON features;
CREATE POLICY "feat_read_all" ON features FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "plans_read_all" ON plans;
CREATE POLICY "plans_read_all" ON plans FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pr_select_all" ON platform_roles;
CREATE POLICY "pr_select_all" ON platform_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rp_select_all" ON role_permissions;
CREATE POLICY "rp_select_all" ON role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sv_select_all" ON schema_versions;
CREATE POLICY "sv_select_all" ON schema_versions FOR SELECT TO authenticated USING (true);

-- Tenants
DROP POLICY IF EXISTS "tenants_select_platform_or_member" ON tenants;
CREATE POLICY "tenants_select_platform_or_member" ON tenants FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tenant_memberships WHERE tenant_id = tenants.id AND auth_user_id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS "tenants_insert_platform" ON tenants;
CREATE POLICY "tenants_insert_platform" ON tenants FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tenants_update_platform" ON tenants;
CREATE POLICY "tenants_update_platform" ON tenants FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));

-- Tenant Databases
DROP POLICY IF EXISTS "tdb_select_platform_or_member" ON tenant_databases;
CREATE POLICY "tdb_select_platform_or_member" ON tenant_databases FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = tenant_databases.tenant_id AND tm.auth_user_id = auth.uid() AND tm.status = 'active')
);
DROP POLICY IF EXISTS "tdb_insert_platform" ON tenant_databases;
CREATE POLICY "tdb_insert_platform" ON tenant_databases FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tdb_update_platform" ON tenant_databases;
CREATE POLICY "tdb_update_platform" ON tenant_databases FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));

-- Tenant Domains
DROP POLICY IF EXISTS "tdom_select_platform_or_member" ON tenant_domains;
CREATE POLICY "tdom_select_platform_or_member" ON tenant_domains FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = tenant_domains.tenant_id AND tm.auth_user_id = auth.uid() AND tm.status = 'active')
);
DROP POLICY IF EXISTS "tdom_insert_platform" ON tenant_domains;
CREATE POLICY "tdom_insert_platform" ON tenant_domains FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tdom_update_platform" ON tenant_domains;
CREATE POLICY "tdom_update_platform" ON tenant_domains FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "tdom_delete_platform" ON tenant_domains;
CREATE POLICY "tdom_delete_platform" ON tenant_domains FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- Tenant Branding
DROP POLICY IF EXISTS "tb_select_platform_or_member" ON tenant_branding;
CREATE POLICY "tb_select_platform_or_member" ON tenant_branding FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = tenant_branding.tenant_id AND tm.auth_user_id = auth.uid() AND tm.status = 'active')
);
DROP POLICY IF EXISTS "tb_insert_platform" ON tenant_branding;
CREATE POLICY "tb_insert_platform" ON tenant_branding FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tb_update_platform" ON tenant_branding;
CREATE POLICY "tb_update_platform" ON tenant_branding FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));

-- Tenant Features
DROP POLICY IF EXISTS "tf_select_platform_or_member" ON tenant_features;
CREATE POLICY "tf_select_platform_or_member" ON tenant_features FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = tenant_features.tenant_id AND tm.auth_user_id = auth.uid() AND tm.status = 'active')
);
DROP POLICY IF EXISTS "tf_insert_platform" ON tenant_features;
CREATE POLICY "tf_insert_platform" ON tenant_features FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tf_update_platform" ON tenant_features;
CREATE POLICY "tf_update_platform" ON tenant_features FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "tf_delete_platform" ON tenant_features;
CREATE POLICY "tf_delete_platform" ON tenant_features FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- Tenant Subscriptions
DROP POLICY IF EXISTS "tsub_select_platform" ON tenant_subscriptions;
CREATE POLICY "tsub_select_platform" ON tenant_subscriptions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = tenant_subscriptions.tenant_id AND tm.auth_user_id = auth.uid() AND tm.status = 'active')
);
DROP POLICY IF EXISTS "tsub_insert_platform" ON tenant_subscriptions;
CREATE POLICY "tsub_insert_platform" ON tenant_subscriptions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tsub_update_platform" ON tenant_subscriptions;
CREATE POLICY "tsub_update_platform" ON tenant_subscriptions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));

-- Tenant Workspaces
DROP POLICY IF EXISTS "workspace_read" ON tenant_workspaces;
CREATE POLICY "workspace_read" ON tenant_workspaces FOR SELECT TO authenticated USING (
  public.vora_is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = tenant_workspaces.tenant_id AND m.auth_user_id = auth.uid() AND m.status = 'active')
);

-- Platform User Roles
DROP POLICY IF EXISTS "pur_select_own_or_admin" ON platform_user_roles;
DROP POLICY IF EXISTS "pur_select_own" ON platform_user_roles;
CREATE POLICY "pur_select_own" ON platform_user_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid()
);
DROP POLICY IF EXISTS "pur_insert_admin" ON platform_user_roles;
CREATE POLICY "pur_insert_admin" ON platform_user_roles FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles pur2 JOIN platform_roles pr ON pur2.role_id = pr.id WHERE pur2.user_id = auth.uid() AND pr.key = 'super_admin')
);
DROP POLICY IF EXISTS "pur_delete_admin" ON platform_user_roles;
CREATE POLICY "pur_delete_admin" ON platform_user_roles FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles pur2 JOIN platform_roles pr ON pur2.role_id = pr.id WHERE pur2.user_id = auth.uid() AND pr.key = 'super_admin')
);

-- Tenant Memberships
DROP POLICY IF EXISTS "tm_select_own_or_admin" ON tenant_memberships;
CREATE POLICY "tm_select_own_or_admin" ON tenant_memberships FOR SELECT TO authenticated USING (
  auth_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tm_insert_admin" ON tenant_memberships;
CREATE POLICY "tm_insert_admin" ON tenant_memberships FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "tm_update_admin_or_tenant_admin" ON tenant_memberships;
CREATE POLICY "tm_update_admin_or_tenant_admin" ON tenant_memberships FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR auth_user_id = auth.uid()
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "tm_delete_admin" ON tenant_memberships;
CREATE POLICY "tm_delete_admin" ON tenant_memberships FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- Tenant Invitations (Acceso seguro restringido a Super Admin)
DROP POLICY IF EXISTS "ti_select_admin_or_member" ON tenant_invitations;
DROP POLICY IF EXISTS "ti_select_admin_only" ON tenant_invitations;
CREATE POLICY "ti_select_admin_only" ON tenant_invitations FOR SELECT TO authenticated USING (
  public.vora_is_super_admin()
);
DROP POLICY IF EXISTS "ti_insert_admin" ON tenant_invitations;
CREATE POLICY "ti_insert_admin" ON tenant_invitations FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "ti_update_admin" ON tenant_invitations;
CREATE POLICY "ti_update_admin" ON tenant_invitations FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
) WITH CHECK (EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "ti_delete_admin" ON tenant_invitations;
CREATE POLICY "ti_delete_admin" ON tenant_invitations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- Tablas de migración y auditoría
DROP POLICY IF EXISTS "mr_select_admin" ON migration_runs;
CREATE POLICY "mr_select_admin" ON migration_runs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "pal_select_admin" ON platform_audit_logs;
CREATE POLICY "pal_select_admin" ON platform_audit_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "pal_insert_admin" ON platform_audit_logs;
CREATE POLICY "pal_insert_admin" ON platform_audit_logs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "dr_insert_anon" ON demo_requests;
DROP POLICY IF EXISTS "dr_select_admin" ON demo_requests;
CREATE POLICY "dr_select_admin" ON demo_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- Facturación y Finanzas VORA
DROP POLICY IF EXISTS "billing_settings_read" ON platform_billing_settings;
CREATE POLICY "billing_settings_read" ON platform_billing_settings FOR SELECT TO authenticated USING (
  public.vora_is_super_admin()
);

DROP POLICY IF EXISTS "rates_read" ON platform_exchange_rates;
CREATE POLICY "rates_read" ON platform_exchange_rates FOR SELECT TO authenticated USING (
  public.vora_is_super_admin()
);

DROP POLICY IF EXISTS "invoices_read" ON platform_invoices;
CREATE POLICY "invoices_read" ON platform_invoices FOR SELECT TO authenticated USING (
  public.vora_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = platform_invoices.tenant_id
      AND m.auth_user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('tenant_admin', 'admin')
  )
);

DROP POLICY IF EXISTS "payments_read" ON platform_payment_reports;
CREATE POLICY "payments_read" ON platform_payment_reports FOR SELECT TO authenticated USING (
  public.vora_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = platform_payment_reports.tenant_id
      AND m.auth_user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('tenant_admin', 'admin')
  )
);

-- ============================================================================
-- 8. PRIVILEGES & LOCKDOWN
-- ============================================================================

REVOKE ALL ON TABLE
  business_templates, demo_requests, features, migration_runs, plans, platform_audit_logs,
  platform_roles, platform_user_roles, role_permissions, schema_versions, tenant_branding,
  tenant_databases, tenant_domains, tenant_features, tenant_invitations, tenant_memberships,
  tenant_subscriptions, tenants, tenant_workspaces, platform_billing_settings,
  platform_exchange_rates, platform_invoices, platform_payment_reports
FROM anon, authenticated;

-- Acceso público anónimo de solo lectura a catálogos
GRANT SELECT ON TABLE business_templates, features, plans TO anon;

-- Permisos authenticated regulados por RLS
GRANT SELECT ON TABLE
  business_templates, features, plans, platform_roles, role_permissions, schema_versions,
  tenants, tenant_databases, tenant_domains, tenant_branding, tenant_features,
  tenant_subscriptions, tenant_workspaces, platform_user_roles, tenant_memberships,
  tenant_invitations, migration_runs, platform_audit_logs, demo_requests,
  platform_billing_settings, platform_exchange_rates, platform_invoices, platform_payment_reports
TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  tenants, tenant_databases, tenant_domains, tenant_branding, tenant_features,
  tenant_subscriptions, platform_user_roles, tenant_memberships, tenant_invitations,
  platform_audit_logs
TO authenticated;

-- Control total para service_role (backend de Next.js)
GRANT ALL ON TABLE
  business_templates, demo_requests, features, migration_runs, plans, platform_audit_logs,
  platform_roles, platform_user_roles, role_permissions, schema_versions, tenant_branding,
  tenant_databases, tenant_domains, tenant_features, tenant_invitations, tenant_memberships,
  tenant_subscriptions, tenants, tenant_workspaces, platform_billing_settings,
  platform_exchange_rates, platform_invoices, platform_payment_reports
TO service_role;

-- ============================================================================
-- 9. REFERENCE DATA SEEDS
-- ============================================================================

-- Business Templates
INSERT INTO business_templates (key, name, description, suggested_features) VALUES
  ('retail_ecommerce', 'Retail / Ecommerce', 'Plantilla para empresas de retail con ventas online y físicas. Incluye clientes, productos, ventas, pedidos e integración de tienda.', ARRAY['crm.dashboard','crm.customers','crm.products','crm.sales','crm.orders','crm.tasks','integration.shopify']),
  ('services', 'Servicios', 'Plantilla para empresas de servicios. Enfocada en clientes, seguimiento comercial y gestión de oportunidades.', ARRAY['crm.dashboard','crm.customers','crm.sales','crm.tasks','crm.segments']),
  ('general_crm', 'CRM General', 'Plantilla CRM genérica adaptable a cualquier tipo de empresa. Módulos básicos de clientes, ventas y seguimiento.', ARRAY['crm.dashboard','crm.customers','crm.sales','crm.tasks'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  suggested_features = EXCLUDED.suggested_features,
  updated_at = now();

-- Features Catalog (con subfunciones granulares y módulos opcionales VORA)
INSERT INTO features (key, name, description, category, dependencies, implementation_status, sort_order, available_functions) VALUES
  ('crm.dashboard', 'Resumen y Reportes', 'Panel principal con métricas clave y reportes base del CRM.', 'crm', '{}', 'implemented', 1, jsonb_build_array(
    jsonb_build_object('key', 'sales_kpi', 'name', 'Métricas de ventas en tiempo real', 'description', 'KPIs mensuales y comparativa de facturación.', 'default_enabled', true),
    jsonb_build_object('key', 'channel_distribution', 'name', 'Ventas por canal', 'description', 'Barras comparativas de ventas en ferias, Shopify, WhatsApp y web.', 'default_enabled', true),
    jsonb_build_object('key', 'smart_recommendations', 'name', 'Acciones recomendadas', 'description', 'Sugerencias predictivas de clientes a contactar hoy.', 'default_enabled', true)
  )),
  ('crm.customers', 'Clientes', 'Gestión de fichas de clientes con contactos, notas, tags y consentimientos.', 'crm', '{}', 'implemented', 2, jsonb_build_array(
    jsonb_build_object('key', 'customer_list', 'name', 'Directorio consolidado de clientes', 'description', 'Vista unificada sin duplicar contactos entre canales.', 'default_enabled', true),
    jsonb_build_object('key', 'action_shortcuts', 'name', 'Botones de siguiente acción', 'description', 'Atajos contextuales (Reposición, Contactar, Seguimiento, Bienvenida).', 'default_enabled', true),
    jsonb_build_object('key', 'customer_profile', 'name', 'Ficha 360 del cliente', 'description', 'Historial completo de compras, tickets y origen.', 'default_enabled', true),
    jsonb_build_object('key', 'export_data', 'name', 'Exportación de datos', 'description', 'Exportación de contactos en formato CSV/Excel.', 'default_enabled', false)
  )),
  ('crm.products', 'Productos y Catálogos', 'Administración de productos, categorías y catálogos de venta.', 'crm', '{}', 'implemented', 3, jsonb_build_array(
    jsonb_build_object('key', 'product_catalog', 'name', 'Catálogo maestro de productos', 'description', 'SKU, nombre, categorías y precios de venta.', 'default_enabled', true),
    jsonb_build_object('key', 'stock_badges', 'name', 'Control y alertas de disponibilidad', 'description', 'Estados disponible, agotado y descontinuado.', 'default_enabled', true)
  )),
  ('crm.sales', 'Ventas y Oportunidades', 'Gestión de oportunidades y ventas con items y estados.', 'crm', '{}', 'implemented', 4, jsonb_build_array(
    jsonb_build_object('key', 'pipeline_board', 'name', 'Embudo de ventas y pipeline', 'description', 'Etapas de negociación: prospección, propuesta, negociación, ganada.', 'default_enabled', true),
    jsonb_build_object('key', 'pipeline_metrics', 'name', 'Métricas de valor estimado', 'description', 'Cálculo total de oportunidades abiertas vs ganadas.', 'default_enabled', true)
  )),
  ('crm.orders', 'Pedidos', 'Gestión de pedidos con eventos de seguimiento y estados.', 'crm', '{}', 'implemented', 5, jsonb_build_array(
    jsonb_build_object('key', 'orders_list', 'name', 'Listado maestro de pedidos', 'description', 'Visualización de pedidos ordenados por fecha y canal.', 'default_enabled', true),
    jsonb_build_object('key', 'order_status_tracking', 'name', 'Gestión de estados de despacho', 'description', 'Pendiente, procesando, enviado, entregado y cancelado.', 'default_enabled', true)
  )),
  ('crm.tasks', 'Seguimiento', 'Tareas de seguimiento comercial asignables con fechas y estados.', 'crm', '{}', 'implemented', 6, jsonb_build_array(
    jsonb_build_object('key', 'tasks_list', 'name', 'Gestión de tareas de seguimiento', 'description', 'Tareas asignadas por asesor con fechas límite.', 'default_enabled', true),
    jsonb_build_object('key', 'task_completion', 'name', 'Marcado rápido de cumplimiento', 'description', 'Cambio de estado ágil entre pendiente y completada.', 'default_enabled', true)
  )),
  ('crm.segments', 'Segmentación', 'Segmentación de clientes por criterios y reglas.', 'crm', '{}', 'implemented', 7, jsonb_build_array(
    jsonb_build_object('key', 'rfm_filters', 'name', 'Filtros por valor, canal y producto', 'description', 'Segmentación por monto de compra, canal feria/web y categoría.', 'default_enabled', true),
    jsonb_build_object('key', 'repurchase_kpis', 'name', 'Métricas rápidas del segmento', 'description', 'Indicadores de clientes encontrados, sin contacto y posibles reposiciones.', 'default_enabled', true),
    jsonb_build_object('key', 'repurchase_queue', 'name', 'Oportunidades de recompra priorizadas', 'description', 'Lista con tiempo transcurrido desde la última compra y valor acumulado.', 'default_enabled', true),
    jsonb_build_object('key', 'quick_contact', 'name', 'Disparo directo a WhatsApp / Email', 'description', 'Botón de contacto directo con la asesora asignada.', 'default_enabled', true)
  )),
  ('crm.campaigns', 'Campañas', 'Campañas comerciales dirigidas a segmentos de clientes.', 'crm', ARRAY['crm.segments'], 'implemented', 8, jsonb_build_array(
    jsonb_build_object('key', 'campaign_builder', 'name', 'Diseñador de campañas comerciales', 'description', 'Campañas orientadas a segmentos con metas de conversión.', 'default_enabled', true),
    jsonb_build_object('key', 'multichannel_dispatch', 'name', 'Envío multicanal', 'description', 'Soporte para email, SMS, WhatsApp y banners de feria.', 'default_enabled', true)
  )),
  ('capture.fairs', 'Captura QR / Ferias', 'Captura de contactos por código QR en ferias y eventos.', 'crm', ARRAY['crm.customers'], 'implemented', 9, jsonb_build_array(
    jsonb_build_object('key', 'qr_generator', 'name', 'Código QR dinámico para stands', 'description', 'QR escaneable en ferias para captura directa de clientes.', 'default_enabled', true),
    jsonb_build_object('key', 'pos_quick_sale', 'name', 'Registro express de venta en punto físico', 'description', 'Formulario ágil para vincular producto, monto y medio de pago.', 'default_enabled', true),
    jsonb_build_object('key', 'instant_crm_sync', 'name', 'Alta inmediata en CRM', 'description', 'Creación y vinculación en tiempo real al CRM sin retrasos.', 'default_enabled', true)
  )),
  ('integration.shopify', 'Shopify', 'Integración con tienda Shopify para sincronización de productos y pedidos.', 'integration', '{}', 'planned', 10, jsonb_build_array(
    jsonb_build_object('key', 'storefront_catalog', 'name', 'Catálogo visual de tienda virtual', 'description', 'Showcase de productos y colecciones de la marca.', 'default_enabled', true),
    jsonb_build_object('key', 'category_navigation', 'name', 'Navegación por categorías', 'description', 'Pestañas de colecciones como velas, fragancias, lámparas y sets.', 'default_enabled', true),
    jsonb_build_object('key', 'cart_indicator', 'name', 'Indicador de carrito y checkout', 'description', 'Badge de productos seleccionados e integración de carrito.', 'default_enabled', true)
  )),
  ('channel.email', 'Correo', 'Canal de correo para comunicaciones comerciales y notificaciones.', 'channel', '{}', 'planned', 11, '[]'::jsonb),
  ('chatbot.guided_web', 'Chatbot Web Guiado', 'Bot web guiado para captación por web, QR y Shopify.', 'channel', ARRAY['crm.customers','crm.tasks'], 'planned', 12, jsonb_build_array(
    jsonb_build_object('key', 'conversations_inbox', 'name', 'Bandeja de entrada multicanal', 'description', 'Centralización de chats de web, QR y WhatsApp.', 'default_enabled', true),
    jsonb_build_object('key', 'guided_assistant', 'name', 'Asistente automatizado guiado', 'description', 'Respuestas automáticas sobre disponibilidad y catálogo.', 'default_enabled', true),
    jsonb_build_object('key', 'purchase_intent_detection', 'name', 'Detección de intención de compra', 'description', 'Identificación de interés de compra para alertar al equipo.', 'default_enabled', true),
    jsonb_build_object('key', 'human_handover', 'name', 'Traspaso a asesora humana', 'description', 'Botón para que una asesora tome la conversación en el momento clave.', 'default_enabled', true)
  )),
  ('automation.followups', 'Reglas de Seguimiento', 'Reglas automatizadas de seguimiento y recompra base.', 'automation', ARRAY['crm.tasks'], 'planned', 13, '[]'::jsonb),
  ('integration.siigo', 'Facturación SIIGO', 'Integración con SIIGO para facturación autorizada.', 'integration', ARRAY['crm.sales'], 'planned', 14, jsonb_build_array(
    jsonb_build_object('key', 'electronic_invoicing', 'name', 'Facturación electrónica automática', 'description', 'Emisión autorizada de comprobantes fiscales.', 'default_enabled', true),
    jsonb_build_object('key', 'dian_sync', 'name', 'Sincronización con DIAN y Siigo', 'description', 'Validación de NIT, impuestos y consecutivo fiscal.', 'default_enabled', true)
  )),
  ('analytics.repurchase_pilot', 'Predictivo de Recompra', 'Piloto predictivo de recompra: diagnóstico, reglas y lista priorizada.', 'analytics', ARRAY['crm.orders','automation.followups'], 'planned', 15, jsonb_build_array(
    jsonb_build_object('key', 'predictive_model', 'name', 'Algoritmo de predicción de ciclo', 'description', 'Diagnóstico automático de frecuencia y fecha estimada de recompra.', 'default_enabled', true),
    jsonb_build_object('key', 'prioritized_queue', 'name', 'Cola priorizada de clientes', 'description', 'Listado ordenado de clientes listos para recompra.', 'default_enabled', true)
  )),
  -- Módulos opcionales VORA
  ('commerce.billing', 'VORA Billing', 'Facturación independiente del CRM; documentos y numeración. Requiere implementación y validación fiscal.', 'commerce', '{}', 'planned', 200, '[]'::jsonb),
  ('commerce.storefront', 'VORA Store', 'Tienda web multitenant con catálogo público y pedidos.', 'commerce', '{}', 'planned', 210, '[]'::jsonb),
  ('commerce.network', 'VORA Network', 'Red de asesoras, catálogos, comisiones y distribución.', 'commerce', '{}', 'planned', 220, '[]'::jsonb),
  ('finance.bank', 'VORA Bank', 'Importación y conciliación de movimientos bancarios.', 'finance', '{}', 'planned', 230, '[]'::jsonb),
  ('finance.pay', 'VORA Pay', 'Registro y verificación de cobros y comprobantes.', 'finance', '{}', 'planned', 240, '[]'::jsonb),
  ('fiscal.venezuela', 'VORA Fiscal', 'Configuración tributaria venezolana, libros y reportes.', 'fiscal', '{}', 'planned', 250, '[]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  dependencies = EXCLUDED.dependencies,
  implementation_status = EXCLUDED.implementation_status,
  sort_order = EXCLUDED.sort_order,
  available_functions = COALESCE(EXCLUDED.available_functions, features.available_functions),
  updated_at = now();

-- Platform Roles
INSERT INTO platform_roles (key, name, description, scope) VALUES
  ('super_admin', 'Super Admin VORA', 'Administrador global de la plataforma con acceso total.', 'platform'),
  ('tenant_admin', 'Administrador de Tenant', 'Administrador de una empresa específica con acceso a su configuración.', 'tenant'),
  ('comercial', 'Comercial', 'Rol comercial con acceso a clientes, ventas y seguimiento.', 'tenant'),
  ('atencion', 'Atención', 'Rol de atención al cliente con acceso a clientes y seguimiento.', 'tenant')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  scope = EXCLUDED.scope;

-- Role Permissions
INSERT INTO role_permissions (role_key, permission, scope) VALUES
  ('super_admin', 'tenant.create', 'platform'),
  ('super_admin', 'tenant.update', 'platform'),
  ('super_admin', 'tenant.suspend', 'platform'),
  ('super_admin', 'branding.manage', 'platform'),
  ('super_admin', 'modules.manage', 'platform'),
  ('super_admin', 'database.register', 'platform'),
  ('super_admin', 'database.check', 'platform'),
  ('super_admin', 'admin.invite', 'platform'),
  ('super_admin', 'preview.access', 'platform'),
  ('tenant_admin', 'crm.customers', 'tenant'),
  ('tenant_admin', 'crm.products', 'tenant'),
  ('tenant_admin', 'crm.sales', 'tenant'),
  ('tenant_admin', 'crm.orders', 'tenant'),
  ('tenant_admin', 'crm.tasks', 'tenant'),
  ('tenant_admin', 'crm.segments', 'tenant'),
  ('tenant_admin', 'crm.campaigns', 'tenant'),
  ('tenant_admin', 'capture.fairs', 'tenant'),
  ('tenant_admin', 'branding.manage', 'tenant'),
  ('comercial', 'crm.customers', 'tenant'),
  ('comercial', 'crm.sales', 'tenant'),
  ('comercial', 'crm.tasks', 'tenant'),
  ('atencion', 'crm.customers', 'tenant'),
  ('atencion', 'crm.tasks', 'tenant')
ON CONFLICT (role_key, permission) DO NOTHING;

-- Plans
INSERT INTO plans (name, description, limits, monthly_price_usd, infrastructure_mode, is_active) VALUES
  ('Emprende', 'Plan Shared de entrada. Servicios contratados configurables por Venesoft.', '{"max_users": 2, "max_stores": 1}', 15.00, 'shared', true),
  ('Starter', 'Plan inicial para empresas pequeñas.', '{"max_users": 5, "max_concurrent_users": 3, "max_customers": 10000, "max_orders_month": 1000, "storage_gb": 10, "max_stores": 1, "max_nit": 1}', 29.00, 'shared', true),
  ('Growth', 'Plan para empresas en crecimiento con mayores límites.', '{"max_users": 15, "max_concurrent_users": 8, "max_customers": 50000, "max_orders_month": 5000, "storage_gb": 50, "max_stores": 3, "max_nit": 2}', 79.00, 'dedicated', true)
ON CONFLICT DO NOTHING;

-- Schema version record
INSERT INTO schema_versions (scope, version, name, description) VALUES
  ('platform', '001', 'Platform Core Schema', 'Esquema inicial de Platform DB con tenants, features, memberships, roles, branding, databases, audit y demo requests.')
ON CONFLICT (scope, version) DO NOTHING;

-- ============================================================================
-- 10. DEMO TENANTS (SOLEÉ y Empresa Demo)
-- ============================================================================

DO $$
DECLARE
  v_retail uuid;
  v_services uuid;
  v_starter uuid;
  v_solee_id uuid;
  v_demo_id uuid;
BEGIN
  SELECT id INTO v_retail FROM business_templates WHERE key = 'retail_ecommerce';
  SELECT id INTO v_services FROM business_templates WHERE key = 'services';
  SELECT id INTO v_starter FROM plans WHERE name = 'Starter' LIMIT 1;

  -- SOLEÉ tenant
  INSERT INTO tenants (commercial_name, legal_name, slug, commercial_status, technical_status, country, currency, language, timezone, business_template_id, plan_id, wizard_completed, infrastructure_mode)
  VALUES ('SOLEÉ', 'SOLEÉ S.A.S.', 'solee', 'trial', 'pending_setup', 'Colombia', 'COP', 'es', 'America/Bogota', v_retail, v_starter, true, 'dedicated')
  ON CONFLICT (slug) DO UPDATE SET
    commercial_name = EXCLUDED.commercial_name,
    legal_name = EXCLUDED.legal_name,
    business_template_id = EXCLUDED.business_template_id,
    plan_id = EXCLUDED.plan_id,
    wizard_completed = EXCLUDED.wizard_completed,
    updated_at = now()
  RETURNING id INTO v_solee_id;

  -- Empresa Demo tenant
  INSERT INTO tenants (commercial_name, legal_name, slug, commercial_status, technical_status, country, currency, language, timezone, business_template_id, plan_id, wizard_completed, infrastructure_mode)
  VALUES ('Empresa Demo', 'Empresa Demo S.A.S.', 'empresa-demo', 'trial', 'pending_setup', 'Colombia', 'COP', 'es', 'America/Bogota', v_services, v_starter, true, 'shared')
  ON CONFLICT (slug) DO UPDATE SET
    commercial_name = EXCLUDED.commercial_name,
    legal_name = EXCLUDED.legal_name,
    business_template_id = EXCLUDED.business_template_id,
    plan_id = EXCLUDED.plan_id,
    wizard_completed = EXCLUDED.wizard_completed,
    updated_at = now()
  RETURNING id INTO v_demo_id;

  -- SOLEÉ branding
  INSERT INTO tenant_branding (tenant_id, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family, login_background_color, banner_url)
  VALUES (v_solee_id, null, null, '#4a1d6e', '#63DCE5', '#00AFEF', 'Poppins', '#1a0a2e', null)
  ON CONFLICT (tenant_id) DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    font_family = EXCLUDED.font_family,
    login_background_color = EXCLUDED.login_background_color,
    updated_at = now();

  -- Empresa Demo branding
  INSERT INTO tenant_branding (tenant_id, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family, login_background_color, banner_url)
  VALUES (v_demo_id, null, null, '#0d7a4e', '#a8e6cf', '#00AFEF', 'Roboto', '#0a4d2e', null)
  ON CONFLICT (tenant_id) DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    font_family = EXCLUDED.font_family,
    login_background_color = EXCLUDED.login_background_color,
    updated_at = now();

  -- SOLEÉ features
  INSERT INTO tenant_features (tenant_id, feature_key, enabled, contracted, config, config_state, release_status)
  SELECT v_solee_id, key, true, true, '{"functions": {}}'::jsonb,
    CASE WHEN implementation_status = 'implemented' THEN 'enabled'::feature_config_state ELSE 'pending_config'::feature_config_state END,
    'planned'::release_status
  FROM features
  WHERE key IN ('crm.dashboard','crm.customers','crm.products','crm.sales','crm.orders','crm.tasks','crm.segments','crm.campaigns','capture.fairs','integration.shopify','integration.siigo','analytics.repurchase_pilot','automation.followups','chatbot.guided_web','channel.email')
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    contracted = EXCLUDED.contracted,
    config = EXCLUDED.config,
    config_state = EXCLUDED.config_state,
    updated_at = now();

  -- Empresa Demo features
  INSERT INTO tenant_features (tenant_id, feature_key, enabled, contracted, config, config_state, release_status)
  SELECT v_demo_id, key, true, true, '{"functions": {}}'::jsonb,
    CASE WHEN implementation_status = 'implemented' THEN 'enabled'::feature_config_state ELSE 'pending_config'::feature_config_state END,
    'planned'::release_status
  FROM features
  WHERE key IN ('crm.dashboard','crm.customers','crm.sales','crm.tasks','crm.segments','channel.email')
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    contracted = EXCLUDED.contracted,
    config = EXCLUDED.config,
    config_state = EXCLUDED.config_state,
    updated_at = now();

  -- SOLEÉ database
  INSERT INTO tenant_databases (tenant_id, provider, connection_status)
  VALUES (v_solee_id, 'supabase', 'not_configured')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Empresa Demo database
  INSERT INTO tenant_databases (tenant_id, provider, connection_status)
  VALUES (v_demo_id, 'supabase', 'not_configured')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- SOLEÉ domains
  INSERT INTO tenant_domains (tenant_id, hostname, domain_type, verification_status, is_primary)
  VALUES (v_solee_id, 'solee.vora.venesoftca.com', 'subdomain', 'verified', true)
  ON CONFLICT (hostname) DO NOTHING;

  -- Empresa Demo domains
  INSERT INTO tenant_domains (tenant_id, hostname, domain_type, verification_status, is_primary)
  VALUES (v_demo_id, 'demo.vora.venesoftca.com', 'subdomain', 'verified', true)
  ON CONFLICT (hostname) DO NOTHING;

  -- Tenant workspaces
  INSERT INTO tenant_workspaces (tenant_id, schema_version)
  VALUES (v_solee_id, 'core-1'), (v_demo_id, 'core-1')
  ON CONFLICT (tenant_id) DO NOTHING;
END $$;

