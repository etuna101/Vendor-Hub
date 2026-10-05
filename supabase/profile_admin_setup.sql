-- VendorHub profile, approval, and admin setup.
-- Run after the existing VendorHub schema bundle. Safe to re-run.

-- 1. Profile fields and approval state. Existing vendors stay active on upgrade;
-- new Auth users receive pending status from handle_new_user below.
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('vendor','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stall_location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS produce_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'vendor';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status public.approval_status NOT NULL DEFAULT 'approved';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;
UPDATE public.profiles p SET role = 'admin'::public.user_role
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role::text='admin');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
ALTER TABLE public.profiles ALTER COLUMN approval_status TYPE public.approval_status USING approval_status::text::public.approval_status;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'vendor';
ALTER TABLE public.profiles ALTER COLUMN approval_status SET DEFAULT 'pending';

-- 2. Fixed-search-path authorization helpers avoid policy recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role::text = 'admin')
$$;
CREATE OR REPLACE FUNCTION public.is_approved_vendor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND approval_status = 'approved')
$$;

-- 3. Auth signup profile creation. Existing user_roles remains the source of admin authority.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name, phone, email, preferred_language,
    approval_status, role)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'business_name',''),
    COALESCE(NEW.raw_user_meta_data->>'phone',''), NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'preferred_language','en'), 'pending', 'vendor')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendor')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Block privilege/status edits by non-admin callers.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Trusted SQL editor/service-role maintenance (including first-admin setup).
  IF auth.uid() IS NULL AND auth.role() IS NULL THEN RETURN NEW; END IF;
  IF current_setting('vendorhub.approval_rpc', true) = 'on' THEN RETURN NEW; END IF;
  IF NOT public.is_admin() THEN
    NEW.email := OLD.email;
    NEW.role := OLD.role;
    NEW.approval_status := OLD.approval_status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejection_reason := OLD.rejection_reason;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'use the vendor approval RPC to change admin-controlled profile fields';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY profiles_update_self_or_admin ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin());
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;

-- 5. Admin audit log; clients cannot write directly.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('approve','reject','suspend','reinstate')),
  target_vendor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_audit_log TO authenticated;
DROP POLICY IF EXISTS admin_audit_read ON public.admin_audit_log;
CREATE POLICY admin_audit_read ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_vendor_approval(_vendor_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _actor uuid := auth.uid();
DECLARE _action text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF _status NOT IN ('approved','rejected','suspended') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _vendor_id) THEN RAISE EXCEPTION 'vendor not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _vendor_id AND role::text = 'admin') THEN
    RAISE EXCEPTION 'admin accounts cannot be changed through vendor approval';
  END IF;
  IF _status = 'approved' AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _vendor_id AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'vendor email must be verified before approval';
  END IF;
  _action := CASE _status WHEN 'approved' THEN CASE WHEN (SELECT approval_status FROM public.profiles WHERE id=_vendor_id)='suspended' THEN 'reinstate' ELSE 'approve' END WHEN 'rejected' THEN 'reject' WHEN 'suspended' THEN 'suspend' ELSE 'reinstate' END;
  PERFORM set_config('vendorhub.approval_rpc','on',true);
  UPDATE public.profiles SET approval_status=_status::public.approval_status,
    rejection_reason=CASE WHEN _status='rejected' THEN NULLIF(_reason,'') ELSE NULL END,
    approved_by=CASE WHEN _status='approved' THEN _actor ELSE approved_by END,
    approved_at=CASE WHEN _status='approved' THEN now() ELSE approved_at END
    WHERE id=_vendor_id;
  INSERT INTO public.admin_audit_log(actor_id, action, target_vendor_id, reason)
    VALUES (_actor, _action, _vendor_id, NULLIF(_reason,''));
END $$;
CREATE OR REPLACE FUNCTION public.approve_vendor(vendor_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.set_vendor_approval(vendor_id,'approved',NULL) $$;
CREATE OR REPLACE FUNCTION public.reject_vendor(vendor_id uuid, reason text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.set_vendor_approval(vendor_id,'rejected',reason) $$;
CREATE OR REPLACE FUNCTION public.suspend_vendor(vendor_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.set_vendor_approval(vendor_id,'suspended',NULL) $$;
CREATE OR REPLACE FUNCTION public.reinstate_vendor(vendor_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT public.set_vendor_approval(vendor_id,'approved',NULL) $$;
REVOKE ALL ON FUNCTION public.set_vendor_approval(uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_vendor_approval(uuid,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.approve_vendor(uuid), public.reject_vendor(uuid,text),
  public.suspend_vendor(uuid), public.reinstate_vendor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_vendor(uuid), public.reject_vendor(uuid,text),
  public.suspend_vendor(uuid), public.reinstate_vendor(uuid) TO authenticated;

-- Secure admin listing includes email confirmation state from auth.users.
CREATE OR REPLACE FUNCTION public.admin_vendor_list()
RETURNS TABLE(user_id uuid, full_name text, business_name text, phone text, email text,
  email_verified boolean, approval_status text, rejection_reason text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT p.id,p.full_name,p.business_name,p.phone,u.email,(u.email_confirmed_at IS NOT NULL),
    p.approval_status::text,p.rejection_reason,p.created_at
    FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role::text='admin')
    ORDER BY p.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_vendor_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_vendor_list() TO authenticated;

-- 6. Only approved vendors can use their own operational records. Admin read policies remain.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['products','stock_history','customers','sales','credit_payments','expenses','ai_interactions','notifications'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS approved_vendor_access ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS approved_vendor_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', CASE t
      WHEN 'products' THEN 'own products' WHEN 'stock_history' THEN 'own stock history select'
      WHEN 'customers' THEN 'own customers' WHEN 'sales' THEN 'own sales'
      WHEN 'credit_payments' THEN 'own credit payments' WHEN 'expenses' THEN 'own expenses'
      WHEN 'ai_interactions' THEN 'own ai interactions read' ELSE 'own notifications' END, t);
    IF t = 'stock_history' OR t = 'ai_interactions' THEN
      EXECUTE format('CREATE POLICY approved_vendor_access ON public.%I FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) AND public.is_approved_vendor())',t);
      IF t = 'stock_history' THEN
        EXECUTE 'DROP POLICY IF EXISTS "own stock history insert" ON public.stock_history';
        EXECUTE 'CREATE POLICY approved_vendor_insert ON public.stock_history FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND public.is_approved_vendor())';
      ELSE
        EXECUTE 'DROP POLICY IF EXISTS "own ai interactions insert" ON public.ai_interactions';
        EXECUTE 'CREATE POLICY approved_vendor_insert ON public.ai_interactions FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND public.is_approved_vendor())';
      END IF;
    ELSE
      EXECUTE format('CREATE POLICY approved_vendor_access ON public.%I FOR ALL TO authenticated USING (user_id=(SELECT auth.uid()) AND public.is_approved_vendor()) WITH CHECK (user_id=(SELECT auth.uid()) AND public.is_approved_vendor())',t);
    END IF;
  END LOOP;
END $$;

-- Approved-vendor check for SECURITY DEFINER RPCs that mutate operational records.
-- Keep their row policies as defense in depth and prevent RPC bypasses.
CREATE OR REPLACE FUNCTION public.require_approved_vendor()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() AND NOT public.is_approved_vendor() THEN
    RAISE EXCEPTION 'vendor approval required' USING ERRCODE = '42501';
  END IF;
END $$;

-- The existing payment reservation RPC is SECURITY DEFINER. Retain its balance
-- checks while adding approval and ownership checks so elevated execution cannot bypass RLS.
CREATE OR REPLACE FUNCTION public.create_pending_mpesa_payment(
  _sale_id uuid, _amount numeric, _phone_number text
) RETURNS public.credit_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale public.sales%ROWTYPE; _paid numeric; _pending_count integer; _payment public.credit_payments%ROWTYPE;
BEGIN
  PERFORM public.require_approved_vendor();
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF _sale.is_credit AND _sale.credit_paid THEN RAISE EXCEPTION 'debt is already paid'; END IF;
  SELECT COALESCE(sum(amount),0) INTO _paid FROM public.credit_payments WHERE sale_id=_sale.id AND status='SUCCESS';
  SELECT count(*) INTO _pending_count FROM public.credit_payments WHERE sale_id=_sale.id AND status='PENDING';
  IF _pending_count > 0 THEN RAISE EXCEPTION 'a payment request is already pending'; END IF;
  IF _amount > GREATEST(_sale.total-_paid,0) THEN RAISE EXCEPTION 'amount exceeds outstanding balance'; END IF;
  INSERT INTO public.credit_payments(user_id,sale_id,amount,phone_number,status)
    VALUES(auth.uid(),_sale.id,_amount,public.normalize_kenyan_phone(_phone_number),'PENDING') RETURNING * INTO _payment;
  RETURN _payment;
END $$;

-- 7. Public avatar reads and per-user upload/update/delete under <auth.uid()>/.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('avatars','avatars',true,2097152,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=2097152,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects FOR SELECT USING (bucket_id='avatars');
DROP POLICY IF EXISTS avatars_owner_insert ON storage.objects;
CREATE POLICY avatars_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text)
  WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);

-- 8. Verify email confirmation is enabled in Authentication > Providers > Email.
-- Set Site URL and redirect URL to https://<your-domain>/auth/signin (and localhost for development).
-- For a first admin, replace the email and run once from the SQL editor:
-- INSERT INTO public.user_roles(user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE lower(email)=lower('you@example.com')
-- ON CONFLICT (user_id, role) DO NOTHING;
-- UPDATE public.profiles SET role='admin', approval_status='approved'
-- WHERE id=(SELECT id FROM auth.users WHERE lower(email)=lower('you@example.com'));
-- Tables whose access policies this script changes: products, stock_history, customers,
-- sales, credit_payments, expenses, ai_interactions, notifications. Existing vendor records remain owned as before.
