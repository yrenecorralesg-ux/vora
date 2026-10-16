/*
# EKOSCRM Platform — Esquema Inicial Consolidado

## Resumen
Esquema central completo de Platform DB para EKOSCRM:
- Extensiones requeridas (pgcrypto)
- 11 ENUMs
- 18 tablas con restricciones, claves primarias y foráneas
- Índices de rendimiento
- Función trigger update_updated_at() con search_path seguro
- Row Level Security (RLS) y políticas de seguridad (con corrección de recursión pur_select_own)
- Restricción de permisos Data API (anon bloqueado excepto lectura de catálogos públicos)
- Semillas de datos de referencia (templates, features, roles, permisos, planes, versión)
- Bootstrap del super administrador inicial (admin@ekoscrm.com / EkosAdmin2026!)
- Tenants demo (SOLEÉ y Empresa Demo) con branding, módulos y subdominios
*/

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
  business_type text,
  business_template_id uuid REFERENCES business_templates(id),
  plan_id uuid REFERENCES plans(id),
  wizard_step int DEFAULT 1,
  wizard_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'business_type'
  ) THEN
    ALTER TABLE tenants ADD COLUMN business_type text;
  END IF;
END $$;

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

-- ============================================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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
-- 6. RLS & POLICIES
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

-- tenant_domains: platform admin or tenant member
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

-- tenant_branding: platform admin or tenant member
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

-- tenant_features: platform admin or tenant member
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

-- tenant_subscriptions: platform admin or tenant member
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

-- platform_user_roles: own role lookup or super_admin management
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

-- tenant_invitations: platform admin or tenant member
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

-- demo_requests: platform admin read (writes go exclusively via server service role client)
DROP POLICY IF EXISTS "dr_insert_anon" ON demo_requests;
DROP POLICY IF EXISTS "dr_select_admin" ON demo_requests;
CREATE POLICY "dr_select_admin" ON demo_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM platform_user_roles WHERE user_id = auth.uid())
);

-- ============================================================================
-- 7. PRIVILEGES & LOCKDOWN
-- ============================================================================

REVOKE ALL ON TABLE business_templates, demo_requests, features, migration_runs, plans, platform_audit_logs, platform_roles, platform_user_roles, role_permissions, schema_versions, tenant_branding, tenant_databases, tenant_domains, tenant_features, tenant_invitations, tenant_memberships, tenant_subscriptions, tenants FROM anon;

GRANT SELECT ON TABLE business_templates, features, plans TO anon;

-- ============================================================================
-- 8. REFERENCE DATA SEEDS
-- ============================================================================

-- Business Templates
INSERT INTO business_templates (key, name, description, suggested_features) VALUES
  ('retail_ecommerce', 'Retail / Ecommerce', 'Plantilla para empresas de retail con ventas online y fisicas. Incluye clientes, productos, ventas, pedidos e integracion de tienda.', ARRAY['crm.dashboard','crm.customers','crm.products','crm.sales','crm.orders','crm.tasks','integration.shopify']),
  ('services', 'Servicios', 'Plantilla para empresas de servicios. Enfocada en clientes, seguimiento comercial y gestion de oportunidades.', ARRAY['crm.dashboard','crm.customers','crm.sales','crm.tasks','crm.segments']),
  ('general_crm', 'CRM General', 'Plantilla CRM generica adaptable a cualquier tipo de empresa. Modulos basicos de clientes, ventas y seguimiento.', ARRAY['crm.dashboard','crm.customers','crm.sales','crm.tasks'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  suggested_features = EXCLUDED.suggested_features,
  updated_at = now();

-- Features Catalog
INSERT INTO features (key, name, description, category, dependencies, implementation_status, sort_order) VALUES
  ('crm.dashboard', 'Resumen y Reportes', 'Panel principal con metricas clave y reportes base del CRM.', 'crm', '{}', 'implemented', 1),
  ('crm.customers', 'Clientes', 'Gestion de fichas de clientes con contactos, notas, tags y consentimientos.', 'crm', '{}', 'implemented', 2),
  ('crm.products', 'Productos y Catalogos', 'Administracion de productos, categorias y catalogos de venta.', 'crm', '{}', 'implemented', 3),
  ('crm.sales', 'Ventas y Oportunidades', 'Gestion de oportunidades y ventas con items y estados.', 'crm', '{}', 'implemented', 4),
  ('crm.orders', 'Pedidos', 'Gestion de pedidos con eventos de seguimiento y estados.', 'crm', '{}', 'implemented', 5),
  ('crm.tasks', 'Seguimiento', 'Tareas de seguimiento comercial asignables con fechas y estados.', 'crm', '{}', 'implemented', 6),
  ('crm.segments', 'Segmentacion', 'Segmentacion de clientes por criterios y reglas.', 'crm', '{}', 'implemented', 7),
  ('crm.campaigns', 'Campanas', 'Campanas comerciales dirigidas a segmentos de clientes.', 'crm', ARRAY['crm.segments'], 'implemented', 8),
  ('capture.fairs', 'Captura QR / Ferias', 'Captura de contactos por codigo QR en ferias y eventos.', 'crm', ARRAY['crm.customers'], 'implemented', 9),
  ('integration.shopify', 'Shopify', 'Integracion con tienda Shopify para sincronizacion de productos y pedidos.', 'integration', '{}', 'planned', 10),
  ('channel.email', 'Correo', 'Canal de correo para comunicaciones comerciales y notificaciones.', 'channel', '{}', 'planned', 11),
  ('chatbot.guided_web', 'Chatbot Web Guiado', 'Bot web guiado para captacion por web, QR y Shopify. Hasta 30 respuestas y 20 productos.', 'channel', ARRAY['crm.customers','crm.tasks'], 'planned', 12),
  ('automation.followups', 'Reglas de Seguimiento', 'Reglas automatizadas de seguimiento y recompra base.', 'automation', ARRAY['crm.tasks'], 'planned', 13),
  ('integration.siigo', 'Facturacion SIIGO', 'Integracion con SIIGO para facturacion de ventas directas autorizadas. Cliente, productos, impuestos, NIT y numeracion.', 'integration', ARRAY['crm.sales'], 'planned', 14),
  ('analytics.repurchase_pilot', 'Predictivo de Recompra', 'Piloto predictivo de recompra: diagnostico, reglas, modelo validado y lista priorizada. Hasta 50.000 pedidos / 12 meses.', 'analytics', ARRAY['crm.orders','automation.followups'], 'planned', 15)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  dependencies = EXCLUDED.dependencies,
  implementation_status = EXCLUDED.implementation_status,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Platform Roles
INSERT INTO platform_roles (key, name, description, scope) VALUES
  ('super_admin', 'Super Admin EKOSCRM', 'Administrador global de la plataforma EKOSCRM con acceso total al Super Admin.', 'platform'),
  ('tenant_admin', 'Administrador de Tenant', 'Administrador de una empresa especifica con acceso a su shell CRM y configuracion.', 'tenant'),
  ('comercial', 'Comercial', 'Rol comercial con acceso a clientes, ventas y seguimiento. Permiso base para sprints posteriores.', 'tenant'),
  ('atencion', 'Atencion', 'Rol de atencion al cliente con acceso a clientes y seguimiento. Permiso base para sprints posteriores.', 'tenant')
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
INSERT INTO plans (name, description, limits, is_active) VALUES
  ('Starter', 'Plan inicial para empresas pequenas.', '{"max_users":5,"max_concurrent_users":3,"max_customers":10000,"max_orders_month":1000,"storage_gb":10,"max_stores":1,"max_nit":1}', true),
  ('Growth', 'Plan para empresas en crecimiento con mayores limites.', '{"max_users":15,"max_concurrent_users":8,"max_customers":50000,"max_orders_month":5000,"storage_gb":50,"max_stores":3,"max_nit":2}', true)
ON CONFLICT DO NOTHING;

-- Schema version record
INSERT INTO schema_versions (scope, version, name, description) VALUES
  ('platform', '001', 'Platform Core Schema', 'Esquema inicial de Platform DB con tenants, features, memberships, roles, branding, databases, audit y demo requests.')
ON CONFLICT (scope, version) DO NOTHING;

-- ============================================================================
-- 9. BOOTSTRAP SUPER ADMIN
-- ============================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@ekoscrm.com' AND is_sso_user = false LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
      is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@ekoscrm.com',
      crypt('EkosAdmin2026!', gen_salt('bf')),
      now(), now(), now(), null,
      '{}'::jsonb, '{}'::jsonb, '', '',
      false
    );
  END IF;

  SELECT id INTO v_role_id FROM platform_roles WHERE key = 'super_admin';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO platform_user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 10. DEMO TENANTS (SOLEÉ & Empresa Demo)
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
  INSERT INTO tenants (commercial_name, legal_name, slug, commercial_status, technical_status, country, currency, language, timezone, business_template_id, plan_id, wizard_completed)
  VALUES ('SOLEÉ', 'SOLEÉ S.A.S.', 'solee', 'trial', 'pending_setup', 'Colombia', 'COP', 'es', 'America/Bogota', v_retail, v_starter, true)
  ON CONFLICT (slug) DO UPDATE SET
    commercial_name = EXCLUDED.commercial_name,
    legal_name = EXCLUDED.legal_name,
    business_template_id = EXCLUDED.business_template_id,
    plan_id = EXCLUDED.plan_id,
    wizard_completed = EXCLUDED.wizard_completed,
    updated_at = now()
  RETURNING id INTO v_solee_id;

  -- Empresa Demo tenant
  INSERT INTO tenants (commercial_name, legal_name, slug, commercial_status, technical_status, country, currency, language, timezone, business_template_id, plan_id, wizard_completed)
  VALUES ('Empresa Demo', 'Empresa Demo S.A.S.', 'empresa-demo', 'trial', 'pending_setup', 'Colombia', 'COP', 'es', 'America/Bogota', v_services, v_starter, true)
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
  INSERT INTO tenant_features (tenant_id, feature_key, enabled, config_state, release_status)
  SELECT v_solee_id, key, true,
    CASE WHEN implementation_status = 'implemented' THEN 'enabled'::feature_config_state ELSE 'pending_config'::feature_config_state END,
    'planned'::release_status
  FROM features
  WHERE key IN ('crm.dashboard','crm.customers','crm.products','crm.sales','crm.orders','crm.tasks','crm.segments','crm.campaigns','capture.fairs','integration.shopify','integration.siigo','analytics.repurchase_pilot','automation.followups','chatbot.guided_web','channel.email')
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    config_state = EXCLUDED.config_state,
    updated_at = now();

  -- Empresa Demo features
  INSERT INTO tenant_features (tenant_id, feature_key, enabled, config_state, release_status)
  SELECT v_demo_id, key, true,
    CASE WHEN implementation_status = 'implemented' THEN 'enabled'::feature_config_state ELSE 'pending_config'::feature_config_state END,
    'planned'::release_status
  FROM features
  WHERE key IN ('crm.dashboard','crm.customers','crm.sales','crm.tasks','crm.segments','channel.email')
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
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

  -- SOLEÉ subdomain
  INSERT INTO tenant_domains (tenant_id, hostname, domain_type, verification_status, is_primary)
  VALUES (v_solee_id, 'solee.ekoscrm.com', 'subdomain', 'pending', true)
  ON CONFLICT (hostname) DO NOTHING;

  -- Empresa Demo subdomain
  INSERT INTO tenant_domains (tenant_id, hostname, domain_type, verification_status, is_primary)
  VALUES (v_demo_id, 'demo.ekoscrm.com', 'subdomain', 'pending', true)
  ON CONFLICT (hostname) DO NOTHING;
END $$;
