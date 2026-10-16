/*
# Lock down Platform Data API grants and mutable trigger search path

1. Purpose
- Keep public reference catalog reads available to the landing and wizard.
- Remove anonymous access to administrative and tenant configuration tables.
- Keep demo request creation available only for the public form and admin reads restricted by existing RLS.

2. Security changes
- Revoke all Data API privileges from anon on every Platform table.
- Grant anon only SELECT on business_templates, features, and plans.
- Grant anon only INSERT on demo_requests.
- Keep authenticated privileges available where existing RLS policies enforce platform or membership authorization.
- Set an explicit search_path on update_updated_at so the trigger cannot resolve attacker-controlled objects.

3. Important notes
- This migration is additive and does not delete rows or change user data.
- Server routes still perform explicit authorization before privileged mutations.
- Public catalog rows are intentionally readable; administrative rows are not.
*/

REVOKE ALL ON TABLE business_templates, demo_requests, features, migration_runs, plans, platform_audit_logs, platform_roles, platform_user_roles, role_permissions, schema_versions, tenant_branding, tenant_databases, tenant_domains, tenant_features, tenant_invitations, tenant_memberships, tenant_subscriptions, tenants FROM anon;

GRANT SELECT ON TABLE business_templates, features, plans TO anon;
GRANT INSERT ON TABLE demo_requests TO anon;

ALTER FUNCTION public.update_updated_at() SET search_path = public;
