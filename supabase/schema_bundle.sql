-- VendorHub full schema bundle
-- Run this top-to-bottom in your own Supabase project's SQL editor.


-- ================= 20260719122013_142d630d-af45-422e-9a5a-9fbe1d3289b4.sql =================


-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'vendor');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'vendor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','sw')),
  has_seen_welcome BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Handle new user - auto-create profile + vendor role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name, phone, email, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'business_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendor');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'piece',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 5,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Stock history (append-only)
CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('restock','sale','adjustment')),
  quantity NUMERIC NOT NULL,
  note TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_history TO authenticated;
GRANT ALL ON public.stock_history TO service_role;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stock history select" ON public.stock_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own stock history insert" ON public.stock_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers" ON public.customers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  is_credit BOOLEAN NOT NULL DEFAULT false,
  credit_paid BOOLEAN NOT NULL DEFAULT false,
  date TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales" ON public.sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Credit payments
CREATE TABLE public.credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  note TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_payments TO authenticated;
GRANT ALL ON public.credit_payments TO service_role;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credit payments" ON public.credit_payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expenses
CREATE TYPE public.expense_category AS ENUM ('transport','rent','stock_purchase','utilities','other');
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category expense_category NOT NULL DEFAULT 'other',
  amount NUMERIC NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses" ON public.expenses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Atomic sale RPC
CREATE OR REPLACE FUNCTION public.record_sale(
  _product_id UUID,
  _quantity NUMERIC,
  _unit_price NUMERIC,
  _customer_id UUID,
  _is_credit BOOLEAN
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _product RECORD;
  _sale_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;

  SELECT * INTO _product FROM public.products WHERE id = _product_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  IF _product.current_stock < _quantity THEN RAISE EXCEPTION 'insufficient stock'; END IF;

  UPDATE public.products SET current_stock = current_stock - _quantity, updated_at = now() WHERE id = _product_id;

  INSERT INTO public.stock_history (user_id, product_id, change_type, quantity, note)
  VALUES (_uid, _product_id, 'sale', -_quantity, NULL);

  INSERT INTO public.sales (user_id, product_id, product_name_snapshot, quantity, unit_price, total, customer_id, is_credit)
  VALUES (_uid, _product_id, _product.name, _quantity, _unit_price, _quantity * _unit_price, _customer_id, _is_credit)
  RETURNING id INTO _sale_id;

  RETURN _sale_id;
END;
$$;

-- Restock helper (atomic)
CREATE OR REPLACE FUNCTION public.record_restock(
  _product_id UUID,
  _quantity NUMERIC,
  _note TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  UPDATE public.products SET current_stock = current_stock + _quantity, updated_at = now()
    WHERE id = _product_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  INSERT INTO public.stock_history (user_id, product_id, change_type, quantity, note)
  VALUES (_uid, _product_id, 'restock', _quantity, _note);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ================= 20260719122026_2f708304-9637-4b0b-9957-b2ceee63653e.sql =================


REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_sale(UUID, NUMERIC, NUMERIC, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_restock(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sale(UUID, NUMERIC, NUMERIC, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_restock(UUID, NUMERIC, TEXT) TO authenticated;


-- ================= 20260720132108_f833b640-51b1-4a65-b51c-cb6e23789d76.sql =================


-- Switch record_sale and record_restock to SECURITY INVOKER so they run under the caller's RLS.
CREATE OR REPLACE FUNCTION public.record_sale(_product_id uuid, _quantity numeric, _unit_price numeric, _customer_id uuid, _is_credit boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _product RECORD;
  _sale_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;

  SELECT * INTO _product FROM public.products WHERE id = _product_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  IF _product.current_stock < _quantity THEN RAISE EXCEPTION 'insufficient stock'; END IF;

  UPDATE public.products SET current_stock = current_stock - _quantity, updated_at = now() WHERE id = _product_id;

  INSERT INTO public.stock_history (user_id, product_id, change_type, quantity, note)
  VALUES (_uid, _product_id, 'sale', -_quantity, NULL);

  INSERT INTO public.sales (user_id, product_id, product_name_snapshot, quantity, unit_price, total, customer_id, is_credit)
  VALUES (_uid, _product_id, _product.name, _quantity, _unit_price, _quantity * _unit_price, _customer_id, _is_credit)
  RETURNING id INTO _sale_id;

  RETURN _sale_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_restock(_product_id uuid, _quantity numeric, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  UPDATE public.products SET current_stock = current_stock + _quantity, updated_at = now()
    WHERE id = _product_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  INSERT INTO public.stock_history (user_id, product_id, change_type, quantity, note)
  VALUES (_uid, _product_id, 'restock', _quantity, _note);
END;
$function$;

-- Revoke direct execute on trigger-only SECURITY DEFINER functions from API roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;


-- ================= 20260721191638_b32516dc-a40c-4099-a244-46b5df871127.sql =================


ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'wages';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'market_fee';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'misc';

CREATE TABLE public.ai_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'chat',
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_interactions TO authenticated;
GRANT ALL ON public.ai_interactions TO service_role;

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ai interactions read" ON public.ai_interactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own ai interactions insert" ON public.ai_interactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_interactions_user_created_idx ON public.ai_interactions (user_id, created_at DESC);


-- ================= 20260722083920_7835e4eb-c217-441b-ae83-4cc47a9c9215.sql =================

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date DATE;

-- ================= 20260727162910_c7d23f97-aab5-4aa0-88e4-4c5363bf8598.sql =================


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, business_name, phone, email, preferred_language)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'business_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profiles insert failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'vendor')
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user user_roles insert failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the unique constraint the ON CONFLICT relies on exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;


-- ================= 20260727164359_7fe64a38-2e69-4667-ae5f-06e25770e2a2.sql =================


-- system_prompts table
CREATE TABLE public.system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  content text NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_prompts TO authenticated;
GRANT ALL ON public.system_prompts TO service_role;
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read system prompts" ON public.system_prompts FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write system prompts" ON public.system_prompts FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER system_prompts_updated_at BEFORE UPDATE ON public.system_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_prompts (key, content) VALUES
('insight_en', 'You are VendorHub''s business advisor for small fresh-produce vendors (''Mama Mboga'') in Kenya. Base every answer strictly on the vendor data summary provided. NEVER invent numbers, product names, or customers that are not in the data. If the data does not answer the question, say so honestly and suggest what to record next. Use KES for money. Be warm and encouraging. Respond only in simple English that a Mama Mboga vendor can easily read. Give exactly ONE short, friendly sentence of business advice — no lists, no preamble.'),
('insight_sw', 'You are VendorHub''s business advisor for small fresh-produce vendors (''Mama Mboga'') in Kenya. Base every answer strictly on the vendor data summary provided. NEVER invent numbers, product names, or customers that are not in the data. If the data does not answer the question, say so honestly and suggest what to record next. Use KES for money. Be warm and encouraging. Respond only in simple Kiswahili that a Mama Mboga vendor can easily read. Give exactly ONE short, friendly sentence of business advice — no lists, no preamble.'),
('chat_en', 'You are VendorHub''s business advisor for small fresh-produce vendors (''Mama Mboga'') in Kenya. Base every answer strictly on the vendor data summary provided. NEVER invent numbers, product names, or customers that are not in the data. If the data does not answer the question, say so honestly and suggest what to record next. Use KES for money. Be warm and encouraging. Respond only in simple English that a Mama Mboga vendor can easily read. Keep responses to 2-4 short sentences in plain language. Use bullet points only if truly necessary.'),
('chat_sw', 'You are VendorHub''s business advisor for small fresh-produce vendors (''Mama Mboga'') in Kenya. Base every answer strictly on the vendor data summary provided. NEVER invent numbers, product names, or customers that are not in the data. If the data does not answer the question, say so honestly and suggest what to record next. Use KES for money. Be warm and encouraging. Respond only in simple Kiswahili that a Mama Mboga vendor can easily read. Keep responses to 2-4 short sentences in plain language. Use bullet points only if truly necessary.');

-- Admin read policies across vendor tables
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all sales" ON public.sales FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all expenses" ON public.expenses FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all products" ON public.products FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all ai interactions" ON public.ai_interactions FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all customers" ON public.customers FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all credit payments" ON public.credit_payments FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admins manage user_roles (promote/revoke)
CREATE POLICY "admins read all user roles" ON public.user_roles FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert user roles" ON public.user_roles FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete user roles" ON public.user_roles FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin') AND NOT (user_id = auth.uid() AND role = 'admin'));

-- Admin-only vendor overview function
CREATE OR REPLACE FUNCTION public.admin_vendor_overview()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  business_name text,
  phone text,
  created_at timestamptz,
  sales_count bigint,
  total_sales numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.business_name, p.phone, p.created_at,
    COALESCE(s.cnt, 0), COALESCE(s.tot, 0)
  FROM public.profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*)::bigint cnt, SUM(total)::numeric tot
    FROM public.sales GROUP BY user_id
  ) s ON s.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC;
$$;

-- Platform stats function
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT jsonb_build_object(
    'total_vendors', (SELECT COUNT(*) FROM public.profiles),
    'total_admins', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'),
    'total_sales', (SELECT COUNT(*) FROM public.sales),
    'total_sales_amount', (SELECT COALESCE(SUM(total),0) FROM public.sales),
    'total_products', (SELECT COUNT(*) FROM public.products),
    'low_stock_alerts', (SELECT COUNT(*) FROM public.products WHERE current_stock <= low_stock_threshold AND is_active),
    'total_ai_interactions', (SELECT COUNT(*) FROM public.ai_interactions),
    'expense_categories', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT category::text, COUNT(*)::bigint AS count, SUM(amount)::numeric AS total
        FROM public.expenses GROUP BY category ORDER BY count DESC
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;


-- ================= 20260728052816_4af73d03-651d-4de8-8057-f362be415d53.sql =================

INSERT INTO public.user_roles (user_id, role) VALUES ('a3dae86f-f39e-478f-b02a-09d9d053d90c', 'admin'), ('8de28b3a-e37b-4176-a7bc-4650d2aae449', 'admin') ON CONFLICT (user_id, role) DO NOTHING;

-- ================= 20260801104042_f3a4f22d-6861-4fd5-bb87-79b64d2c4df5.sql =================

-- Idempotent schema safety net: creates anything missing, never drops data.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','vendor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE public.expense_category AS ENUM ('transport','rent','stock_purchase','utilities','other','wages','market_fee','misc');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text,
  preferred_language text NOT NULL DEFAULT 'en',
  has_seen_welcome boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'vendor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  current_stock numeric NOT NULL DEFAULT 0,
  low_stock_threshold numeric NOT NULL DEFAULT 5,
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  quantity numeric NOT NULL,
  note text,
  date timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_snapshot text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  is_credit boolean NOT NULL DEFAULT false,
  credit_paid boolean NOT NULL DEFAULT false,
  date timestamptz NOT NULL DEFAULT now(),
  due_date date
);

CREATE TABLE IF NOT EXISTS public.credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  note text,
  date timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL DEFAULT 'other',
  amount numeric NOT NULL,
  description text,
  date timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'chat',
  query text NOT NULL,
  response text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  content text NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants (idempotent)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT ON public.stock_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT ON public.ai_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_prompts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles, public.products, public.customers, public.stock_history,
  public.sales, public.credit_payments, public.expenses, public.ai_interactions,
  public.system_prompts, public.user_roles TO service_role;

-- RLS on for every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Policies: create only when absent
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','customers','sales','credit_payments','expenses'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='own '||t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', 'own '||t, t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='admins read all '||t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))', 'admins read all '||t, t);
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='own profile select') THEN
    CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='own profile insert') THEN
    CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='own profile update') THEN
    CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stock_history' AND policyname='own stock history select') THEN
    CREATE POLICY "own stock history select" ON public.stock_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stock_history' AND policyname='own stock history insert') THEN
    CREATE POLICY "own stock history insert" ON public.stock_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_interactions' AND policyname='own ai interactions read') THEN
    CREATE POLICY "own ai interactions read" ON public.ai_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_interactions' AND policyname='own ai interactions insert') THEN
    CREATE POLICY "own ai interactions insert" ON public.ai_interactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='users read own roles') THEN
    CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='system_prompts' AND policyname='admins read system prompts') THEN
    CREATE POLICY "admins read system prompts" ON public.system_prompts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- updated_at triggers (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_system_prompts_updated_at ON public.system_prompts;
CREATE TRIGGER update_system_prompts_updated_at BEFORE UPDATE ON public.system_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure signup trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================= 20260817063335_cf391a0b-36a1-40af-90db-44aba2b5c62b.sql =================

ALTER TABLE public.stock_history ADD COLUMN IF NOT EXISTS value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.stock_history ADD COLUMN IF NOT EXISTS reason text;

CREATE OR REPLACE FUNCTION public.record_stock_loss(_product_id uuid, _quantity numeric, _reason text, _note text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _p RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  IF COALESCE(_reason,'') NOT IN ('spoilage','damage','theft','personal_use','correction') THEN
    RAISE EXCEPTION 'invalid reason';
  END IF;

  SELECT * INTO _p FROM public.products WHERE id = _product_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  IF _p.current_stock < _quantity THEN RAISE EXCEPTION 'quantity exceeds current stock'; END IF;

  UPDATE public.products SET current_stock = current_stock - _quantity, updated_at = now() WHERE id = _product_id;

  INSERT INTO public.stock_history (user_id, product_id, change_type, quantity, note, reason, value)
  VALUES (_uid, _product_id, 'loss', -_quantity, _note, _reason, _quantity * _p.cost_price);
END;
$$;

REVOKE ALL ON FUNCTION public.record_stock_loss(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stock_loss(uuid, numeric, text, text) TO authenticated;


-- ============================================================
-- Payment (M-Pesa/Daraja) and SMS reminder infrastructure
-- ============================================================

-- VendorHub payment and SMS infrastructure.
--
-- Existing model reused:
--   * public.sales is the debt ledger (is_credit = true).
--   * public.credit_payments is the repayment ledger and remains the balance
--     source of truth.  Do not add a separately maintained balance column.
--
-- This migration deliberately contains no Daraja or Africa's Talking secrets.

-- Store Kenyan mobile numbers in the form 2547XXXXXXXX where they are Kenyan.
-- Non-Kenyan/legacy numbers are left as digit-only values so existing customer
-- data is preserved; provider integrations must reject unsuitable numbers.
CREATE OR REPLACE FUNCTION public.normalize_kenyan_phone(_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _digits text := regexp_replace(COALESCE(_phone, ''), '[^0-9]', '', 'g');
BEGIN
  IF _digits = '' THEN
    RETURN NULL;
  ELSIF _digits ~ '^0(7|1)[0-9]{8}$' THEN
    RETURN '254' || substring(_digits FROM 2);
  ELSIF _digits ~ '^(7|1)[0-9]{8}$' THEN
    RETURN '254' || _digits;
  END IF;
  RETURN _digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_customer_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone := public.normalize_kenyan_phone(NEW.phone);
  RETURN NEW;
END;
$$;

UPDATE public.customers
SET phone = public.normalize_kenyan_phone(phone)
WHERE phone IS NOT NULL
  AND phone IS DISTINCT FROM public.normalize_kenyan_phone(phone);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.customers'::regclass
      AND tgname = 'trg_customers_normalize_phone'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_customers_normalize_phone
      BEFORE INSERT OR UPDATE OF phone ON public.customers
      FOR EACH ROW EXECUTE FUNCTION public.normalize_customer_phone();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.customers'::regclass
      AND tgname = 'trg_customers_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_customers_updated_at
      BEFORE UPDATE ON public.customers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Extend the existing repayment ledger for manual and M-Pesa payments.
-- Existing rows are historical/manual payments, so SUCCESS is the safe default.
ALTER TABLE public.credit_payments
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS merchant_request_id text,
  ADD COLUMN IF NOT EXISTS checkout_request_id text,
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number text,
  ADD COLUMN IF NOT EXISTS transaction_date timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS result_code integer,
  ADD COLUMN IF NOT EXISTS result_description text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.credit_payments
  DROP CONSTRAINT IF EXISTS credit_payments_status_check;
ALTER TABLE public.credit_payments
  ADD CONSTRAINT credit_payments_status_check
  CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')) NOT VALID;

ALTER TABLE public.credit_payments
  DROP CONSTRAINT IF EXISTS credit_payments_amount_positive;
ALTER TABLE public.credit_payments
  ADD CONSTRAINT credit_payments_amount_positive CHECK (amount > 0) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS credit_payments_checkout_request_id_key
  ON public.credit_payments (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_payments_mpesa_receipt_number_key
  ON public.credit_payments (mpesa_receipt_number)
  WHERE mpesa_receipt_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_payments_sale_id_idx ON public.credit_payments (sale_id);
CREATE INDEX IF NOT EXISTS credit_payments_user_id_idx ON public.credit_payments (user_id);
CREATE INDEX IF NOT EXISTS credit_payments_merchant_request_id_idx
  ON public.credit_payments (merchant_request_id) WHERE merchant_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_payments_status_idx ON public.credit_payments (status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.credit_payments'::regclass
      AND tgname = 'trg_credit_payments_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_credit_payments_updated_at
      BEFORE UPDATE ON public.credit_payments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Helpful access paths for the existing debt ledger (sales where is_credit).
CREATE INDEX IF NOT EXISTS sales_credit_vendor_due_idx
  ON public.sales (user_id, due_date) WHERE is_credit = true AND credit_paid = false;
CREATE INDEX IF NOT EXISTS sales_credit_customer_idx
  ON public.sales (customer_id) WHERE is_credit = true;

-- Server-side SMS/audit history.  A notification references the existing debt
-- (sales) and payment (credit_payments) rows; payment_id is optional for debt
-- reminders. reminder_date is the business date used to deduplicate reminders.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  credit_payment_id uuid REFERENCES public.credit_payments(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'DEBT_CREATED', 'DEBT_DUE_SOON', 'DEBT_DUE_TODAY', 'DEBT_OVERDUE',
    'PAYMENT_SUCCESS', 'PAYMENT_FAILED'
  )),
  channel text NOT NULL DEFAULT 'SMS' CHECK (channel = 'SMS'),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  provider_message_id text,
  failure_reason text,
  reminder_date date,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
      AND policyname = 'own notifications'
  ) THEN
    CREATE POLICY "own notifications" ON public.notifications
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
      AND policyname = 'admins read all notifications'
  ) THEN
    CREATE POLICY "admins read all notifications" ON public.notifications
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.notifications'::regclass
      AND tgname = 'trg_notifications_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_notifications_updated_at
      BEFORE UPDATE ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_customer_id_idx ON public.notifications (customer_id);
CREATE INDEX IF NOT EXISTS notifications_sale_id_idx ON public.notifications (sale_id);
CREATE INDEX IF NOT EXISTS notifications_type_status_idx ON public.notifications (type, status);

-- A debt reminder for a given sale and business date can be queued only once.
-- This prevents repeated scheduler runs from sending duplicate SMS messages.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_debt_reminder_per_day_key
  ON public.notifications (sale_id, type, reminder_date)
  WHERE type IN ('DEBT_DUE_SOON', 'DEBT_DUE_TODAY', 'DEBT_OVERDUE')
    AND sale_id IS NOT NULL AND reminder_date IS NOT NULL;

-- A confirmed payment can have one success/failure notification record. This
-- makes callback retries unable to enqueue duplicate payment SMS messages.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_payment_result_key
  ON public.notifications (credit_payment_id, type)
  WHERE type IN ('PAYMENT_SUCCESS', 'PAYMENT_FAILED')
    AND credit_payment_id IS NOT NULL;

-- Create a provider payment while locking the debt. This prevents two STK
-- requests from reserving the same remaining balance at the same time.
CREATE OR REPLACE FUNCTION public.create_pending_mpesa_payment(
  _sale_id uuid,
  _amount numeric,
  _phone_number text
)
RETURNS public.credit_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sale public.sales%ROWTYPE;
  _paid numeric;
  _pending_count integer;
  _payment public.credit_payments%ROWTYPE;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF _sale.is_credit AND _sale.credit_paid THEN RAISE EXCEPTION 'debt is already paid'; END IF;
  SELECT COALESCE(sum(amount), 0) INTO _paid
  FROM public.credit_payments WHERE sale_id = _sale.id AND status = 'SUCCESS';
  SELECT count(*) INTO _pending_count
  FROM public.credit_payments WHERE sale_id = _sale.id AND status = 'PENDING';
  IF _pending_count > 0 THEN RAISE EXCEPTION 'a payment request is already pending'; END IF;
  IF _amount > GREATEST(_sale.total - _paid, 0) THEN
    RAISE EXCEPTION 'amount exceeds outstanding balance';
  END IF;
  INSERT INTO public.credit_payments (user_id, sale_id, amount, phone_number, status)
  VALUES (_sale.user_id, _sale.id, _amount, public.normalize_kenyan_phone(_phone_number), 'PENDING')
  RETURNING * INTO _payment;
  RETURN _payment;
END;
$$;

-- Record a non-successful callback without changing the debt balance. A
-- callback after success is deliberately a no-op, so a late failure cannot
-- reverse a confirmed payment.
CREATE OR REPLACE FUNCTION public.process_failed_mpesa_payment(
  _checkout_request_id text,
  _merchant_request_id text,
  _result_code integer,
  _result_description text
)
RETURNS public.credit_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _payment public.credit_payments%ROWTYPE;
BEGIN
  SELECT * INTO _payment FROM public.credit_payments
  WHERE checkout_request_id = _checkout_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found for checkout request %', _checkout_request_id; END IF;
  IF _payment.status = 'PENDING' THEN
    UPDATE public.credit_payments
    SET status = CASE WHEN _result_code = 1032 THEN 'CANCELLED' ELSE 'FAILED' END,
        merchant_request_id = COALESCE(_merchant_request_id, merchant_request_id),
        result_code = _result_code, result_description = _result_description
    WHERE id = _payment.id
    RETURNING * INTO _payment;
  END IF;
  RETURN _payment;
END;
$$;

-- Atomically confirm a successful Daraja payment callback.
-- Intended only for a trusted Edge Function using the service role.  It locks
-- the payment and debt, is idempotent, and derives paid/balance from successful
-- ledger rows rather than storing an independently mutable balance.
CREATE OR REPLACE FUNCTION public.process_successful_mpesa_payment(
  _checkout_request_id text,
  _merchant_request_id text,
  _mpesa_receipt_number text,
  _transaction_date timestamptz,
  _amount numeric,
  _phone_number text,
  _result_code integer DEFAULT 0,
  _result_description text DEFAULT NULL
)
RETURNS TABLE (
  payment_id uuid,
  sale_id uuid,
  amount_paid numeric,
  balance numeric,
  debt_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment public.credit_payments%ROWTYPE;
  _sale public.sales%ROWTYPE;
  _paid numeric;
BEGIN
  IF COALESCE(trim(_checkout_request_id), '') = ''
     OR COALESCE(trim(_mpesa_receipt_number), '') = '' OR _amount <= 0 THEN
    RAISE EXCEPTION 'checkout request, receipt number, and positive amount are required';
  END IF;

  SELECT * INTO _payment
  FROM public.credit_payments
  WHERE checkout_request_id = _checkout_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for checkout request %', _checkout_request_id;
  END IF;
  SELECT * INTO _sale FROM public.sales WHERE id = _payment.sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale not found for payment';
  END IF;
  IF _payment.status = 'SUCCESS' THEN
    SELECT COALESCE(sum(amount), 0) INTO _paid
    FROM public.credit_payments WHERE sale_id = _sale.id AND status = 'SUCCESS';
    RETURN QUERY SELECT _payment.id, _sale.id, _paid,
      GREATEST(_sale.total - _paid, 0),
      CASE WHEN _paid >= _sale.total THEN 'PAID' WHEN _paid > 0 THEN 'PARTIALLY_PAID'
           WHEN _sale.due_date < CURRENT_DATE THEN 'OVERDUE' ELSE 'PENDING' END;
    RETURN;
  END IF;
  IF _payment.status <> 'PENDING' THEN
    RAISE EXCEPTION 'payment is in terminal status %', _payment.status;
  END IF;
  IF _payment.amount <> _amount THEN
    RAISE EXCEPTION 'callback amount does not match payment request';
  END IF;

  UPDATE public.credit_payments
  SET status = 'SUCCESS', merchant_request_id = COALESCE(_merchant_request_id, merchant_request_id),
      mpesa_receipt_number = _mpesa_receipt_number,
      transaction_date = COALESCE(_transaction_date, now()),
      phone_number = public.normalize_kenyan_phone(_phone_number),
      result_code = COALESCE(_result_code, 0), result_description = _result_description
  WHERE id = _payment.id;

  SELECT COALESCE(sum(amount), 0) INTO _paid
  FROM public.credit_payments WHERE sale_id = _sale.id AND status = 'SUCCESS';

  UPDATE public.sales SET credit_paid = (_paid >= total) WHERE id = _sale.id;

  RETURN QUERY SELECT _payment.id, _sale.id, _paid,
    GREATEST(_sale.total - _paid, 0),
    CASE WHEN _paid >= _sale.total THEN 'PAID' WHEN _paid > 0 THEN 'PARTIALLY_PAID'
         WHEN _sale.due_date < CURRENT_DATE THEN 'OVERDUE' ELSE 'PENDING' END;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_kenyan_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_customer_phone() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_successful_mpesa_payment(text, text, text, timestamptz, numeric, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_successful_mpesa_payment(text, text, text, timestamptz, numeric, text, integer, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.create_pending_mpesa_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_failed_mpesa_payment(text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_mpesa_payment(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_failed_mpesa_payment(text, text, integer, text) TO service_role;

-- ============================================================
-- 8. Daily debt-reminder scheduler (pg_cron + pg_net)
-- ------------------------------------------------------------
-- Run AFTER deploying the `debt-reminders` Edge Function and after setting
-- the CRON_SECRET function secret. Replace <your-ref> and <your CRON_SECRET>.
-- Runs 04:00 UTC = 07:00 Nairobi, every day.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('vendorhub-daily-debt-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vendorhub-daily-debt-reminders');

SELECT cron.schedule(
  'vendorhub-daily-debt-reminders',
  '0 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://<your-ref>.supabase.co/functions/v1/debt-reminders',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<your CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);
