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

REVOKE ALL ON FUNCTION public.create_pending_mpesa_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_mpesa_payment(uuid, numeric, text) TO service_role;
REVOKE ALL ON FUNCTION public.process_successful_mpesa_payment(text, text, text, timestamptz, numeric, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_successful_mpesa_payment(text, text, text, timestamptz, numeric, text, integer, text)
  TO service_role;