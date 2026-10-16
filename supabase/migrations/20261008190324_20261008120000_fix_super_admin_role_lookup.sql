/*
# Fix super admin role lookup

1. Purpose
- Make the super admin check work through the authenticated session used by the application.
- Remove the recursive row-level security condition that could make role lookups fail or return no rows.

2. Modified tables and policies
- `platform_user_roles`: replace the recursive SELECT policy with an ownership-only policy that lets an authenticated user read their own role assignments.
- `platform_roles`: keep the existing authenticated read policy so the role key can be resolved through the relationship.

3. Security
- Users can read only role assignments belonging to their own authenticated user ID.
- No anonymous access is added.
- No roles, users, or existing data are deleted or changed.

4. Important notes
- Administrative list screens may use their existing server-side privileged access separately.
- This migration is safe to re-run because the policy is dropped and recreated by name.
*/

DROP POLICY IF EXISTS "pur_select_own_or_admin" ON public.platform_user_roles;

DROP POLICY IF EXISTS "pur_select_own"
ON public.platform_user_roles;

CREATE POLICY "pur_select_own" ON public.platform_user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());