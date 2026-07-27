
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
