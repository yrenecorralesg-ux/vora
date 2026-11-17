-- VORA Core: progressive onboarding, hybrid infrastructure and manual SaaS billing.
-- Incremental migration. Production execution requires approval.
BEGIN;
ALTER TABLE public.tenants ADD COLUMN infrastructure_mode text NOT NULL DEFAULT 'dedicated'
  CHECK (infrastructure_mode IN ('shared', 'dedicated'));
ALTER TABLE public.tenants ADD COLUMN tax_id text;
ALTER TABLE public.tenants ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.tenants ALTER COLUMN timezone SET DEFAULT 'America/Caracas';
ALTER TABLE public.plans ADD COLUMN monthly_price_usd numeric(14,2) CHECK (monthly_price_usd >= 0);
ALTER TABLE public.plans ADD COLUMN infrastructure_mode text NOT NULL DEFAULT 'shared'
  CHECK (infrastructure_mode IN ('shared', 'dedicated'));
ALTER TABLE public.tenant_features ADD COLUMN contracted boolean NOT NULL DEFAULT false;
UPDATE public.tenant_features SET contracted = enabled;
ALTER TABLE public.tenant_domains ADD COLUMN verification_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.tenant_domains ADD COLUMN last_checked_at timestamptz;
ALTER TABLE public.tenant_domains ADD COLUMN verification_error text;

CREATE FUNCTION public.vora_is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM platform_user_roles ur JOIN platform_roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid() AND r.key='super_admin');
$$;
REVOKE ALL ON FUNCTION public.vora_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vora_is_super_admin() TO authenticated, service_role;

CREATE TABLE public.platform_billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  bank_code text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', tax_id text NOT NULL DEFAULT '',
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), effective_date date NOT NULL UNIQUE,
  ves_per_usd numeric(18,6) NOT NULL CHECK (ves_per_usd > 0),
  source text NOT NULL CHECK (length(trim(source)) > 0),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  subscription_id uuid NOT NULL REFERENCES public.tenant_subscriptions(id),
  period_start date NOT NULL, period_end date NOT NULL CHECK (period_end > period_start),
  amount_usd numeric(14,2) NOT NULL CHECK (amount_usd > 0),
  exchange_rate_id uuid NOT NULL REFERENCES public.platform_exchange_rates(id),
  ves_per_usd numeric(18,6) NOT NULL CHECK (ves_per_usd > 0),
  amount_ves numeric(18,2) NOT NULL CHECK (amount_ves > 0),
  recipient jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,period_start), UNIQUE (id,tenant_id)
);
CREATE TABLE public.platform_payment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid NOT NULL, reference text NOT NULL CHECK (length(trim(reference)) BETWEEN 4 AND 100),
  bank_code text NOT NULL CHECK (bank_code ~ '^[0-9]{4}$'),
  phone text NOT NULL CHECK (phone ~ '^04[0-9]{9}$'),
  paid_on date NOT NULL, amount_ves numeric(18,2) NOT NULL CHECK (amount_ves > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reported_by uuid NOT NULL, reviewed_by uuid, review_note text, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id,tenant_id) REFERENCES public.platform_invoices(id,tenant_id),
  UNIQUE (bank_code,reference,paid_on)
);
CREATE UNIQUE INDEX one_approved_payment_per_invoice ON public.platform_payment_reports(invoice_id) WHERE status='approved';
CREATE UNIQUE INDEX one_pending_payment_per_invoice ON public.platform_payment_reports(invoice_id) WHERE status='pending';

ALTER TABLE public.platform_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_payment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_settings_read ON public.platform_billing_settings FOR SELECT TO authenticated USING (public.vora_is_super_admin());
CREATE POLICY rates_read ON public.platform_exchange_rates FOR SELECT TO authenticated USING (public.vora_is_super_admin());
CREATE POLICY invoices_read ON public.platform_invoices FOR SELECT TO authenticated USING (
 public.vora_is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=platform_invoices.tenant_id AND m.auth_user_id=auth.uid() AND m.status='active' AND m.role IN ('tenant_admin','admin')));
CREATE POLICY payments_read ON public.platform_payment_reports FOR SELECT TO authenticated USING (
 public.vora_is_super_admin() OR EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=platform_payment_reports.tenant_id AND m.auth_user_id=auth.uid() AND m.status='active' AND m.role IN ('tenant_admin','admin')));
REVOKE ALL ON public.platform_billing_settings, public.platform_exchange_rates, public.platform_invoices, public.platform_payment_reports FROM anon, authenticated;
GRANT SELECT ON public.platform_billing_settings, public.platform_exchange_rates, public.platform_invoices, public.platform_payment_reports TO authenticated;
GRANT ALL ON public.platform_billing_settings, public.platform_exchange_rates, public.platform_invoices, public.platform_payment_reports TO service_role;

-- Creation is atomic: a tenant cannot be left without its reserved domain and branding.
CREATE FUNCTION public.vora_create_tenant(p_name text, p_slug text, p_mode text, p_legal text DEFAULT NULL, p_tax_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.tenants;
BEGIN
 IF NOT public.vora_is_super_admin() THEN RAISE EXCEPTION 'Permisos insuficientes'; END IF;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 200 OR p_slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
 OR p_slug IN ('www','admin','api','auth','login','app','mail','support','billing','status','t') THEN RAISE EXCEPTION 'Nombre o subdominio inválido'; END IF;
 INSERT INTO tenants(commercial_name,legal_name,tax_id,slug,infrastructure_mode,country,currency,timezone)
 VALUES(trim(p_name),nullif(trim(p_legal),''),nullif(trim(p_tax_id),''),p_slug,p_mode,'VE','USD','America/Caracas') RETURNING * INTO t;
 INSERT INTO tenant_domains(tenant_id,hostname,domain_type,is_primary) VALUES(t.id,p_slug||'.vora.venesoftca.com','subdomain',true);
 INSERT INTO tenant_branding(tenant_id,primary_color,secondary_color,accent_color,login_background_color,font_family)
 VALUES(t.id,'#285C49','#A9BEA5','#C97857','#F6F2E9','Inter');
 INSERT INTO platform_audit_logs(actor_id,tenant_id,action,resource,resource_id,details)
 VALUES(auth.uid(),t.id,'tenant.create','tenants',t.id::text,jsonb_build_object('slug',p_slug,'mode',p_mode));
 RETURN to_jsonb(t);
END; $$;

CREATE FUNCTION public.vora_assign_plan(p_tenant uuid,p_plan uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.plans;
BEGIN
 IF NOT public.vora_is_super_admin() THEN RAISE EXCEPTION 'Permisos insuficientes'; END IF;
 SELECT * INTO STRICT p FROM plans WHERE id=p_plan AND is_active;
 IF NOT EXISTS(SELECT 1 FROM tenants WHERE id=p_tenant AND infrastructure_mode=p.infrastructure_mode) THEN RAISE EXCEPTION 'El plan no coincide con la modalidad de la empresa'; END IF;
 UPDATE tenants SET plan_id=p_plan WHERE id=p_tenant;
 INSERT INTO tenant_subscriptions(tenant_id,plan_id,status) VALUES(p_tenant,p_plan,'trial')
 ON CONFLICT(tenant_id) DO UPDATE SET plan_id=EXCLUDED.plan_id;
 INSERT INTO platform_audit_logs(actor_id,tenant_id,action,resource,resource_id,details)
 VALUES(auth.uid(),p_tenant,'tenant.plan.assign','plans',p_plan::text,'{}');
END; $$;

CREATE FUNCTION public.vora_issue_invoice(p_tenant uuid,p_period date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.tenant_subscriptions; p public.plans; r public.platform_exchange_rates; b public.platform_billing_settings; i public.platform_invoices;
BEGIN
 IF NOT public.vora_is_super_admin() THEN RAISE EXCEPTION 'Permisos insuficientes'; END IF;
 SELECT * INTO STRICT s FROM tenant_subscriptions WHERE tenant_id=p_tenant FOR UPDATE;
 SELECT * INTO STRICT p FROM plans WHERE id=s.plan_id AND is_active AND monthly_price_usd>0;
 IF EXISTS(SELECT 1 FROM platform_invoices WHERE tenant_id=p_tenant AND status<>'cancelled' AND period_start < (p_period+interval '1 month')::date AND period_end > p_period) THEN RAISE EXCEPTION 'El período se superpone con otro cargo'; END IF;
 SELECT * INTO STRICT r FROM platform_exchange_rates WHERE effective_date=(now() AT TIME ZONE 'America/Caracas')::date;
 SELECT * INTO STRICT b FROM platform_billing_settings WHERE id AND bank_code ~ '^[0-9]{4}$' AND phone ~ '^04[0-9]{9}$' AND length(tax_id)>3;
 INSERT INTO platform_invoices(tenant_id,subscription_id,period_start,period_end,amount_usd,exchange_rate_id,ves_per_usd,amount_ves,recipient,created_by)
 VALUES(p_tenant,s.id,p_period,(p_period+interval '1 month')::date,p.monthly_price_usd,r.id,r.ves_per_usd,round(p.monthly_price_usd*r.ves_per_usd,2),jsonb_build_object('bank_code',b.bank_code,'phone',b.phone,'tax_id',b.tax_id),auth.uid()) RETURNING * INTO i;
 INSERT INTO platform_audit_logs(actor_id,tenant_id,action,resource,resource_id,details)
 VALUES(auth.uid(),p_tenant,'billing.invoice.issue','platform_invoices',i.id::text,jsonb_build_object('amount_usd',i.amount_usd,'rate',r.ves_per_usd));
 RETURN to_jsonb(i);
END; $$;

CREATE FUNCTION public.vora_review_payment(p_payment uuid,p_approve boolean,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE report public.platform_payment_reports; invoice public.platform_invoices;
BEGIN
 IF NOT public.vora_is_super_admin() THEN RAISE EXCEPTION 'Permisos insuficientes'; END IF;
 SELECT * INTO STRICT report FROM platform_payment_reports WHERE id=p_payment;
 SELECT * INTO STRICT invoice FROM platform_invoices WHERE id=report.invoice_id FOR UPDATE;
 SELECT * INTO STRICT report FROM platform_payment_reports WHERE id=p_payment FOR UPDATE;
 IF report.status<>'pending' OR invoice.status<>'pending' THEN RAISE EXCEPTION 'El pago o cargo ya fue procesado'; END IF;
 IF length(trim(coalesce(p_note,'')))<3 THEN RAISE EXCEPTION 'Indica la nota de revisión'; END IF;
 IF p_approve AND report.amount_ves<>invoice.amount_ves THEN RAISE EXCEPTION 'El monto debe coincidir con el cargo'; END IF;
 UPDATE platform_payment_reports SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(p_note) WHERE id=p_payment;
 IF p_approve THEN
  UPDATE platform_invoices SET status='paid' WHERE id=invoice.id;
  UPDATE tenant_subscriptions SET status='active',ended_at=greatest(coalesce(ended_at,invoice.period_end::timestamptz),invoice.period_end::timestamptz) WHERE id=invoice.subscription_id;
 END IF;
 INSERT INTO platform_audit_logs(actor_id,tenant_id,action,resource,resource_id,details)
 VALUES(auth.uid(),report.tenant_id,'billing.payment.review','platform_payment_reports',p_payment::text,jsonb_build_object('approved',p_approve,'note',p_note));
END; $$;

REVOKE ALL ON FUNCTION public.vora_create_tenant(text,text,text,text,text), public.vora_assign_plan(uuid,uuid),public.vora_issue_invoice(uuid,date),public.vora_review_payment(uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vora_create_tenant(text,text,text,text,text),public.vora_assign_plan(uuid,uuid),public.vora_issue_invoice(uuid,date),public.vora_review_payment(uuid,boolean,text) TO authenticated;
INSERT INTO public.plans(name,description,limits,monthly_price_usd,infrastructure_mode)
SELECT 'Emprende','Plan Shared de entrada. Servicios contratados configurables por Venesoft.','{"max_users": 2,"max_stores": 1}',15,'shared'
WHERE NOT EXISTS(SELECT 1 FROM public.plans WHERE name='Emprende');

CREATE TABLE public.tenant_workspaces (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id), schema_version text NOT NULL DEFAULT 'core-1', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_read ON public.tenant_workspaces FOR SELECT TO authenticated USING (
 public.vora_is_super_admin() OR EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=tenant_workspaces.tenant_id AND m.auth_user_id=auth.uid() AND m.status='active'));
REVOKE ALL ON public.tenant_workspaces FROM anon,authenticated;
GRANT SELECT ON public.tenant_workspaces TO authenticated;
GRANT ALL ON public.tenant_workspaces TO service_role;
-- Backfill the standard domain only when it is not already claimed.
INSERT INTO public.tenant_domains(tenant_id,hostname,domain_type,is_primary)
SELECT id,slug||'.vora.venesoftca.com','subdomain',NOT EXISTS(SELECT 1 FROM public.tenant_domains d WHERE d.tenant_id=tenants.id AND d.is_primary)
FROM public.tenants WHERE length(slug)<=63 ON CONFLICT(hostname) DO NOTHING;

CREATE FUNCTION public.vora_validate_readiness(p_tenant uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ready boolean;
BEGIN
 IF NOT public.vora_is_super_admin() THEN RAISE EXCEPTION 'Permisos insuficientes'; END IF;
 SELECT t.plan_id IS NOT NULL AND EXISTS(SELECT 1 FROM tenant_databases d WHERE d.tenant_id=t.id AND d.connection_status='connected')
 AND EXISTS(SELECT 1 FROM tenant_memberships m WHERE m.tenant_id=t.id AND m.status='active' AND m.role IN ('tenant_admin','admin'))
 INTO ready FROM tenants t WHERE t.id=p_tenant;
 IF ready IS NULL THEN RAISE EXCEPTION 'Empresa inexistente'; END IF;
 UPDATE tenants SET technical_status=CASE WHEN ready THEN 'ready'::technical_status ELSE 'pending_setup'::technical_status END WHERE id=p_tenant;
 INSERT INTO platform_audit_logs(actor_id,tenant_id,action,resource,resource_id,details)
 VALUES(auth.uid(),p_tenant,'tenant.readiness.check','tenants',p_tenant::text,jsonb_build_object('ready',ready));
 RETURN ready;
END; $$;
REVOKE ALL ON FUNCTION public.vora_validate_readiness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vora_validate_readiness(uuid) TO authenticated;
-- Enforce the plan user limit in the database, including concurrent invitations.
CREATE FUNCTION public.vora_membership_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap integer; used integer;
BEGIN
 IF NEW.status<>'active' THEN RETURN NEW; END IF;
 PERFORM 1 FROM tenants WHERE id=NEW.tenant_id FOR UPDATE;
 SELECT (p.limits->>'max_users')::integer INTO cap FROM tenants t JOIN plans p ON p.id=t.plan_id WHERE t.id=NEW.tenant_id;
 IF cap IS NOT NULL THEN
  SELECT count(*) INTO used FROM tenant_memberships WHERE tenant_id=NEW.tenant_id AND status='active' AND id<>NEW.id;
  IF used>=cap THEN RAISE EXCEPTION 'Límite de usuarios del plan alcanzado'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.vora_membership_quota() FROM PUBLIC;
CREATE TRIGGER vora_membership_quota BEFORE INSERT OR UPDATE ON public.tenant_memberships FOR EACH ROW EXECUTE FUNCTION public.vora_membership_quota();
-- Reassignment cannot silently put a tenant above its contracted user allowance.
CREATE FUNCTION public.vora_plan_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap integer;
BEGIN
 IF NEW.plan_id IS NOT DISTINCT FROM OLD.plan_id THEN RETURN NEW; END IF;
 SELECT (limits->>'max_users')::integer INTO cap FROM plans WHERE id=NEW.plan_id;
 IF cap IS NOT NULL AND (SELECT count(*) FROM tenant_memberships WHERE tenant_id=NEW.id AND status='active')>cap THEN RAISE EXCEPTION 'El plan no admite los usuarios activos actuales'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.vora_plan_quota() FROM PUBLIC;
CREATE TRIGGER vora_plan_quota BEFORE UPDATE OF plan_id ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.vora_plan_quota();
COMMIT;
