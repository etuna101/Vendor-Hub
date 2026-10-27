-- Promote vendors to admins and demote admins without ever removing the last admin.
-- A transaction-scoped advisory lock serializes concurrent demotions.
-- Normalize any legacy accounts that accidentally have both role rows.
DELETE FROM public.user_roles AS vendor_role
USING public.user_roles AS admin_role
WHERE vendor_role.user_id = admin_role.user_id
  AND vendor_role.role = 'vendor'
  AND admin_role.role = 'admin';

CREATE OR REPLACE FUNCTION public.admin_manage_user_role(_target_user uuid, _make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _admin_count bigint;
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF _target_user IS NULL THEN
    RAISE EXCEPTION 'INVALID_TARGET' USING ERRCODE = '22023';
  END IF;

  IF _make_admin THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user AND role = 'vendor') THEN
      RAISE EXCEPTION 'VENDOR_NOT_FOUND' USING ERRCODE = '22023';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = 'vendor';
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN;
  END IF;

  IF _caller = _target_user THEN
    RAISE EXCEPTION 'CANNOT_DEMOTE_SELF' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_NOT_FOUND' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vendorhub-admin-role-change'));
  SELECT count(*) INTO _admin_count FROM public.user_roles WHERE role = 'admin';
  IF _admin_count <= 1 THEN
    RAISE EXCEPTION 'LAST_ADMIN' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user AND role = 'admin';
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, 'vendor')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_user_role(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_user_role(uuid, boolean) TO authenticated;
