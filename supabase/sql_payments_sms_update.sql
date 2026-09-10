-- VendorHub — SMS reminders + M-Pesa STK push update
-- Run this whole file in your own Supabase project's SQL Editor.
-- Safe to re-run. Requires the base VendorHub schema (supabase/schema_bundle.sql sections 1-7).
-- Contains NO secrets: Daraja / Africa's Talking keys are Edge Function secrets.


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
