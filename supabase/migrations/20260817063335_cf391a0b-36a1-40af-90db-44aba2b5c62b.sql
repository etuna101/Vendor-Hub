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