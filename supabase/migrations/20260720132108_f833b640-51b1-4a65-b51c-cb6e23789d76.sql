
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
