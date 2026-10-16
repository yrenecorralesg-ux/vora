/*
# EKOSCRM Platform Core Schema

## Overview
Creates the central Platform DB for EKOSCRM — the SaaS administration layer that manages
tenants (companies), their configurations, branding, feature flags, memberships, roles,
database connections, plans, audit logs, and demo request form submissions.

This is NOT a shared commercial database. Each tenant has its own dedicated Supabase project
for CRM data. The Platform DB only stores administration and identity metadata.

## New Tables (18 total)
1. business_templates — Predefined templates (retail_ecommerce, services, general_crm)
2. features — Catalog of all available CRM modules and integrations
3. plans — Subscription plans with metadata and limits
4. tenants — Company/tenant records with commercial and technical states
5. tenant_databases — Dedicated Supabase project connection per tenant
6. tenant_domains — Custom/subdomain registrations per tenant
7. tenant_branding — Visual identity configuration per tenant
8. tenant_features — Feature flag assignments per tenant
9. tenant_subscriptions — Plan assignment per tenant
10. platform_roles — Global roles (super_admin, etc.)
11. platform_user_roles — Assignment of platform roles to auth users
12. tenant_memberships — Tenant-level role assignments for auth users
13. role_permissions — Permission matrix for roles
14. tenant_invitations — Pending invitations to join a tenant
15. schema_versions — Schema version tracking
16. migration_runs — Migration execution log
17. platform_audit_logs — Audit trail for platform actions
18. demo_requests — Public demo request form submissions

## Security
- RLS enabled on all tables
- demo_requests allows anon inserts (public form), admin-only reads
- Platform-level tables require platform_user_roles membership
- Tenant-level tables require tenant_memberships membership or platform admin

## Important Notes
1. First Super Admin assigned via server-side script, NOT public signup
2. tenant_databases stores secret_ref (opaque identifier), never the actual secret
3. All commercial data lives in separate per-tenant Supabase projects
4. Tables created first, then RLS enabled and policies applied
*/

-- ============================================================================
-- ENUMS
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
-- TABLES (all created first, policies applied after)
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  suggested_features text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS features (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'crm',
  dependencies text[] DEFAULT '{}',
  implementation_status implementation_status NOT NULL DEFAULT 'planned',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  limits jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'platform',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name text NOT NULL,
  legal_name text,
  slug text UNIQUE NOT NULL,
  commercial_status commercial_status NOT NULL DEFAULT 'trial',
  technical_status technical_status NOT NULL DEFAULT 'pending_setup',
  country text,
  currency text DEFAULT 'COP',
  language text DEFAULT 'es',
  timezone text DEFAULT 'America/Bogota',
  business_template_id uuid REFERENCES business_templates(id),
  plan_id uuid REFERENCES plans(id),
  wizard_step int DEFAULT 1,
  wizard_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname text UNIQUE NOT NULL,
  domain_type domain_type NOT NULL DEFAULT 'subdomain',
  verification_status domain_verification NOT NULL DEFAULT 'pending',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#042071',
  secondary_color text DEFAULT '#63DCE5',
  accent_color text DEFAULT '#00AFEF',
  font_family text DEFAULT 'Inter',
  login_background_color text DEFAULT '#042071',
  banner_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES features(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb DEFAULT '{}',
  config_state feature_config_state NOT NULL DEFAULT 'enabled',
  release_status release_status NOT NULL DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

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

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  permission text NOT NULL,
  scope text NOT NULL DEFAULT 'platform',
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_key, permission)
);

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
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope db_scope NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  description text,
  applied_at timestamptz DEFAULT now(),
  UNIQUE(scope, version)
);

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

-- ============================================================================
-- INDEXES
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

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

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

-- ============================================================================
-- RLS AND POLICIES
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
ALTER TABLE platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

-- business_templates: public read
DROP POLICY IF EXISTS "bt_read_all" ON business_templates;
CREATE POLICY "bt_read_all" ON business_templates FOR SELECT TO anon, authenticated USING (true);

-- features: public read
DROP POLICY IF EXISTS "feat_read_all" ON features;
CREATE POLICY "feat_read_all" ON features FOR SELECT TO anon, authenticated USING (true);

-- plans: public read
DROP POLICY IF EXISTS "plans_read_all" ON plans;
CREATE POLICY "plans_read_all" ON plans FOR SELECT TO anon, authenticated USING (true);

-- platform_roles: authenticated read
DROP POLICY IF EXISTS "pr_select_all" ON platform_roles;
CREATE POLICY "pr_select_all" ON platform_roles FOR SELECT TO authenticated USING (true);

-- role_permissions: authenticated read
DROP POLICY IF EXISTS "rp_select_all" ON role_permissions;
CREATE POLICY "rp_select_all" ON role_permissions FOR SELECT TO authenticated USING (true);

-- schema_versions: authenticated read
DROP POLICY IF EXISTS "sv_select_all" ON schema_versions;
CREATE POLICY "sv_select_all" ON schema_versions FOR SELECT TO authenticated USING (true);

-- tenants: platform admin or tenant member
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

-- tenant_databases: platform admin or tenant member
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

-- tenant_domains
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

-- tenant_branding
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

-- tenant_features
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

-- tenant_subscriptions
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

-- platform_user_roles: own or super_admin
DROP POLICY IF EXISTS "pur_select_own_or_admin" ON platform_user_roles;
CREATE POLICY "pur_select_own_or_admin" ON platform_user_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM platform_user_roles pur2 JOIN platform_roles pr ON pur2.role_id = pr.id WHERE pur2.user_id = auth.uid() AND pr.key = 'super_admin')
);
DROP POLICY IF EXISTS "pur_insert_admin" ON platform_user_roles;
CREATE POLICY "pur_insert_admin" ON platform_user_roles FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles pur2 JOIN platform_roles pr ON pur2.role_id = pr.id WHERE pur2.user_id = auth.uid() AND pr.key = 'super_admin')
);
DROP POLICY IF EXISTS "pur_delete_admin" ON platform_user_roles;
CREATE POLICY "pur_delete_admin" ON platform_user_roles FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles pur2 JOIN platform_roles pr ON pur2.role_id = pr.id WHERE pur2.user_id = auth.uid() AND pr.key = 'super_admin')
);

-- tenant_memberships: own or platform admin
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

-- tenant_invitations
DROP POLICY IF EXISTS "ti_select_admin_or_member" ON tenant_invitations;
CREATE POLICY "ti_select_admin_or_member" ON tenant_invitations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tenant_memberships tm WHERE tm.tenant_id = tenant_invitations.tenant_id AND tm.auth_user_id = auth.uid() AND tm.status = 'active')
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

-- migration_runs: platform admin only
DROP POLICY IF EXISTS "mr_select_admin" ON migration_runs;
CREATE POLICY "mr_select_admin" ON migration_runs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- platform_audit_logs: platform admin only
DROP POLICY IF EXISTS "pal_select_admin" ON platform_audit_logs;
CREATE POLICY "pal_select_admin" ON platform_audit_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "pal_insert_admin" ON platform_audit_logs;
CREATE POLICY "pal_insert_admin" ON platform_audit_logs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- demo_requests: anon insert, admin read
DROP POLICY IF EXISTS "dr_insert_anon" ON demo_requests;
CREATE POLICY "dr_insert_anon" ON demo_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dr_select_admin" ON demo_requests;
CREATE POLICY "dr_select_admin" ON demo_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);
