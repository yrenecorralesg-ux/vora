/*
# VORA Core — Phase 1: tenant (company) management

1. Purpose
- Store the fiscal and contact data required to register a company: tax ID (RIF),
  contact email and phone.
- Record the infrastructure mode chosen for each company (Shared or Dedicated).
- Add the administrative status 'pending' for companies registered but not yet activated.
- Restrict platform-level RLS checks on tenants, subscriptions and audit logs to the
  super_admin role (previously any platform role row was enough).

2. Administrative vs technical status
- commercial_status = administrative status (pending, active, suspended; trial and
  cancelled are kept for existing rows).
- technical_status = provisioning status (pending_setup, ready, error). It only becomes
  'ready' when the infrastructure is verified; registering a company never marks it ready.

3. Data safety
- Additive only: new enum value, new enum type, nullable columns and indexes.
- infrastructure_mode defaults to 'shared' for existing rows; no rows are deleted.
- The new 'pending' value is not used inside this migration (Postgres requires the
  enum change to be committed first); the API sets it explicitly on new companies.
*/

-- 1. Administrative status: pending
ALTER TYPE public.commercial_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'trial';

-- 2. Infrastructure mode
DO $$ BEGIN
  CREATE TYPE public.infrastructure_mode AS ENUM ('shared', 'dedicated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Company fiscal / contact data and infrastructure mode
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS infrastructure_mode public.infrastructure_mode NOT NULL DEFAULT 'shared';

-- One company per tax ID (case-insensitive); rows without tax ID are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_tax_id_unique
  ON public.tenants (upper(tax_id))
  WHERE tax_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_plan ON public.tenants (plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_infrastructure_mode ON public.tenants (infrastructure_mode);

-- 4. Super admin check usable from RLS policies
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_user_roles pur
    JOIN public.platform_roles pr ON pr.id = pur.role_id
    WHERE pur.user_id = auth.uid()
      AND pr.key = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated;

-- 5. Reinforce RLS: platform access requires super_admin; members keep access to their own company.
DROP POLICY IF EXISTS "tenants_select_platform_or_member" ON public.tenants;
CREATE POLICY "tenants_select_platform_or_member" ON public.tenants
FOR SELECT TO authenticated USING (
  public.is_platform_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenants.id AND tm.auth_user_id = auth.uid() AND tm.status = 'active'
  )
);

DROP POLICY IF EXISTS "tenants_insert_platform" ON public.tenants;
CREATE POLICY "tenants_insert_platform" ON public.tenants
FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin());

DROP POLICY IF EXISTS "tenants_update_platform" ON public.tenants;
CREATE POLICY "tenants_update_platform" ON public.tenants
FOR UPDATE TO authenticated
USING (public.is_platform_super_admin())
WITH CHECK (public.is_platform_super_admin());

DROP POLICY IF EXISTS "tsub_select_platform" ON public.tenant_subscriptions;
CREATE POLICY "tsub_select_platform" ON public.tenant_subscriptions
FOR SELECT TO authenticated USING (
  public.is_platform_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenant_subscriptions.tenant_id AND tm.auth_user_id = auth.uid() AND tm.status = 'active'
  )
);

DROP POLICY IF EXISTS "tsub_insert_platform" ON public.tenant_subscriptions;
CREATE POLICY "tsub_insert_platform" ON public.tenant_subscriptions
FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin());

DROP POLICY IF EXISTS "tsub_update_platform" ON public.tenant_subscriptions;
CREATE POLICY "tsub_update_platform" ON public.tenant_subscriptions
FOR UPDATE TO authenticated
USING (public.is_platform_super_admin())
WITH CHECK (public.is_platform_super_admin());

DROP POLICY IF EXISTS "pal_select_admin" ON public.platform_audit_logs;
CREATE POLICY "pal_select_admin" ON public.platform_audit_logs
FOR SELECT TO authenticated USING (public.is_platform_super_admin());

DROP POLICY IF EXISTS "pal_insert_admin" ON public.platform_audit_logs;
CREATE POLICY "pal_insert_admin" ON public.platform_audit_logs
FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin());
