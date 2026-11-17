-- ============================================================
-- VORA Warehouse – Proveedores (Fase 2)
-- Tablas: warehouse_supplier_profiles, warehouse_supplier_terms
-- Principios:
--   · Multitenant: tenant_id en todas las filas + RLS forzado.
--   · Aislamiento estricto por empresa.
--   · Términos comerciales (plazos, moneda, crédito, lead time).
-- ============================================================
BEGIN;

-- ----------------------------------------------------------------
-- 1. Perfiles de proveedores
-- ----------------------------------------------------------------
CREATE TABLE public.warehouse_supplier_profiles (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  code         TEXT,                    -- Código único opcional por tenant (ej. PROV-001)
  name         TEXT        NOT NULL,    -- Razón social o nombre comercial
  tax_id       TEXT,                    -- RIF, NIT, CIF, RFC o documento fiscal
  contact_name TEXT,                    -- Nombre de la persona de contacto
  email        TEXT,                    -- Correo electrónico comercial
  phone        TEXT,                    -- Teléfono de contacto
  address      TEXT,                    -- Dirección física
  city         TEXT,
  country      TEXT        DEFAULT 'VE',
  category     TEXT        DEFAULT 'general', -- 'materia_prima', 'empaque', 'insumo', 'servicios', 'general'
  status       TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'blocked')),
  notes        TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT wh_sup_prof_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX wh_sup_prof_tenant_idx
  ON public.warehouse_supplier_profiles (tenant_id, status);
CREATE INDEX wh_sup_prof_tenant_cat_idx
  ON public.warehouse_supplier_profiles (tenant_id, category);

ALTER TABLE public.warehouse_supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_supplier_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY wh_sup_prof_tenant_isolation ON public.warehouse_supplier_profiles
  FOR ALL TO authenticated
  USING (
    public.vora_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = warehouse_supplier_profiles.tenant_id
        AND m.auth_user_id = auth.uid()
        AND m.status = 'active'
    )
  );

REVOKE ALL ON public.warehouse_supplier_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_supplier_profiles TO authenticated;
GRANT ALL ON public.warehouse_supplier_profiles TO service_role;

-- ----------------------------------------------------------------
-- 2. Condiciones y términos comerciales del proveedor
-- ----------------------------------------------------------------
CREATE TABLE public.warehouse_supplier_terms (
  id                       UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id              UUID          NOT NULL REFERENCES public.warehouse_supplier_profiles(id) ON DELETE CASCADE,

  payment_terms_days       INTEGER       NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0), -- 0=contado, 15, 30, etc.
  currency                 CHAR(3)       NOT NULL DEFAULT 'USD',
  credit_limit             NUMERIC(14,2) DEFAULT 0 CHECK (credit_limit >= 0),
  discount_percentage      NUMERIC(5,2)  DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  lead_time_days           INTEGER       DEFAULT 0 CHECK (lead_time_days >= 0),
  preferred_payment_method TEXT          DEFAULT 'transfer', -- 'transfer', 'pago_movil', 'cash', 'zelle'
  bank_details             JSONB         DEFAULT '{}'::jsonb,

  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT wh_sup_terms_tenant_supplier UNIQUE (tenant_id, supplier_id)
);

CREATE INDEX wh_sup_terms_tenant_supplier_idx
  ON public.warehouse_supplier_terms (tenant_id, supplier_id);

ALTER TABLE public.warehouse_supplier_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_supplier_terms FORCE ROW LEVEL SECURITY;

CREATE POLICY wh_sup_terms_tenant_isolation ON public.warehouse_supplier_terms
  FOR ALL TO authenticated
  USING (
    public.vora_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = warehouse_supplier_terms.tenant_id
        AND m.auth_user_id = auth.uid()
        AND m.status = 'active'
    )
  );

REVOKE ALL ON public.warehouse_supplier_terms FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_supplier_terms TO authenticated;
GRANT ALL ON public.warehouse_supplier_terms TO service_role;

-- ----------------------------------------------------------------
-- 3. Promover estado en el catálogo de features
-- ----------------------------------------------------------------
UPDATE public.features
SET implementation_status = 'implemented'
WHERE key = 'warehouse.suppliers';

COMMIT;
