-- Fix admin_vendor_list on databases where auth.users.email is varchar.
-- PL/pgSQL RETURN QUERY requires each selected column's type to exactly match
-- the RETURNS TABLE declaration, so cast every returned column explicitly.
CREATE OR REPLACE FUNCTION public.admin_vendor_list()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  business_name text,
  phone text,
  email text,
  email_verified boolean,
  approval_status text,
  rejection_reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id::uuid,
    p.full_name::text,
    p.business_name::text,
    p.phone::text,
    u.email::text,
    (u.email_confirmed_at IS NOT NULL)::boolean,
    p.approval_status::text,
    p.rejection_reason::text,
    p.created_at::timestamptz
  FROM public.profiles AS p
  JOIN auth.users AS u ON u.id = p.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS r
    WHERE r.user_id = p.id
      AND r.role::text = 'admin'
  )
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_vendor_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_vendor_list() TO authenticated;
