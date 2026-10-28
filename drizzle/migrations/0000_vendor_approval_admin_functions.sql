-- Vendor approval workflow: columns on profiles
ALTER TABLE public.profiles ADD COLUMN approval_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN rejection_reason text;
ALTER TABLE public.profiles ADD COLUMN approved_at timestamptz;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected','suspended'));

-- Existing accounts (created before this feature) stay approved so nobody is locked out
UPDATE public.profiles SET approval_status = 'approved', approved_at = COALESCE(approved_at, now());

COMMENT ON COLUMN public.profiles.approval_status IS 'Vendor account lifecycle: pending|approved|rejected|suspended. New signups start pending; admin approves via approve_vendor().';

-- Admin: list vendor accounts (excludes admins)
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.full_name, p.business_name, p.phone,
         COALESCE(p.email, u.email),
         u.email_confirmed_at IS NOT NULL,
         p.approval_status, p.rejection_reason, p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'vendor')
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = p.id AND ur2.role = 'admin')
  ORDER BY CASE p.approval_status WHEN 'pending' THEN 0 ELSE 1 END, p.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.approve_vendor(vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles
  SET approval_status = 'approved', approved_at = now(), rejection_reason = NULL, updated_at = now()
  WHERE id = vendor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vendor not found'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (vendor_id, 'vendor') ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_vendor(vendor_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles
  SET approval_status = 'rejected', rejection_reason = reason, updated_at = now()
  WHERE id = vendor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vendor not found'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.suspend_vendor(vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET approval_status = 'suspended', updated_at = now() WHERE id = vendor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vendor not found'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reinstate_vendor(vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles
  SET approval_status = 'approved', approved_at = now(), rejection_reason = NULL, updated_at = now()
  WHERE id = vendor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'vendor not found'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_vendor(_vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  BEGIN
    DELETE FROM auth.users WHERE id = _vendor_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'vendor not found'; END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback if the auth catalog row cannot be removed from here:
    -- clear the vendor's business data and profile row directly.
    DELETE FROM public.notifications WHERE user_id = _vendor_id;
    DELETE FROM public.credit_payments WHERE user_id = _vendor_id;
    DELETE FROM public.sales WHERE user_id = _vendor_id;
    DELETE FROM public.stock_history WHERE user_id = _vendor_id;
    DELETE FROM public.expenses WHERE user_id = _vendor_id;
    DELETE FROM public.ai_interactions WHERE user_id = _vendor_id;
    DELETE FROM public.products WHERE user_id = _vendor_id;
    DELETE FROM public.customers WHERE user_id = _vendor_id;
    DELETE FROM public.user_roles WHERE user_id = _vendor_id;
    DELETE FROM public.profiles WHERE id = _vendor_id;
  END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_vendor_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_vendor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_vendor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_vendor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reinstate_vendor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_vendor(uuid) TO authenticated;