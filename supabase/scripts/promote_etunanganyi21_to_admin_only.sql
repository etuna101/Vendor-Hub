-- Make the existing account an admin only (not a vendor).
-- Run once in the Supabase SQL Editor for the project used by this app.
BEGIN;

DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id
    INTO _user_id
    FROM auth.users
   WHERE lower(email) = lower('etunanganyi21@gmail.com');

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user found for etunanganyi21@gmail.com. Sign up first.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
   WHERE user_id = _user_id
     AND role::text <> 'admin';

  UPDATE public.profiles
     SET role = 'admin',
         approval_status = 'approved'
   WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin role was assigned, but no profile exists for etunanganyi21@gmail.com.';
  END IF;
END $$;

COMMIT;

-- Check the final state: this account should have exactly one role, admin.
SELECT u.email, r.role
  FROM auth.users AS u
  JOIN public.user_roles AS r ON r.user_id = u.id
 WHERE lower(u.email) = lower('etunanganyi21@gmail.com');
