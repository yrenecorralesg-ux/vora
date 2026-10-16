/*
# Bootstrap first super admin user

1. Purpose
- Creates the first super admin user so the platform can be accessed.
- No public signup exists; this is the initial bootstrap account.

2. What it creates
- One row in auth.users with email admin@ekoscrm.com and a bcrypt-hashed password.
- One row in platform_user_roles linking that user to the super_admin role.

3. Security
- Password is bcrypt-hashed via pgcrypto (gen_salt('bf')).
- Email confirmation is set to now() so login works immediately.
- The super_admin role assignment is idempotent.

4. Credentials
- Email: admin@ekoscrm.com
- Password: EkosAdmin2026!
*/

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
