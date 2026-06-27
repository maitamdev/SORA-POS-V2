-- Atomic stock import/adjust RPC for manual inventory operations.
-- Run after database/enterprise_pos_core.sql.

CREATE OR REPLACE FUNCTION public.apply_stock_change(
  p_product_id uuid,
  p_mode text,
  p_quantity integer,
  p_new_stock integer,
  p_user_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product record;
  v_previous_stock integer;
  v_next_stock integer;
  v_delta integer;
  v_transaction_id uuid;
  v_latest_batch record;
BEGIN
  IF p_mode NOT IN ('import', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid stock change mode';
  END IF;

  IF p_mode = 'import' AND COALESCE(p_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Import quantity must be greater than 0';
  END IF;

  IF p_mode = 'adjustment' AND COALESCE(p_new_stock, -1) < 0 THEN
    RAISE EXCEPTION 'New stock cannot be negative';
  END IF;

  SELECT id, stock_quantity
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product was not found';
  END IF;

  v_previous_stock := COALESCE(v_product.stock_quantity, 0);

  IF p_mode = 'import' THEN
    v_delta := p_quantity;
    v_next_stock := v_previous_stock + v_delta;
  ELSE
    v_next_stock := p_new_stock;
    v_delta := v_next_stock - v_previous_stock;
  END IF;

  UPDATE public.products
  SET stock_quantity = v_next_stock
  WHERE id = p_product_id;

  SELECT *
  INTO v_latest_batch
  FROM public.product_batches
  WHERE product_id = p_product_id
  ORDER BY expiry_date DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.product_batches
    SET quantity = GREATEST(0, quantity + v_delta)
    WHERE id = v_latest_batch.id;
  ELSE
    INSERT INTO public.product_batches(
      product_id,
      batch_number,
      expiry_date,
      original_quantity,
      quantity
    )
    VALUES (
      p_product_id,
      CASE WHEN p_mode = 'import' THEN 'BAT-IMPORTED' ELSE 'BAT-ADJUSTED' END,
      CURRENT_DATE + INTERVAL '1 year',
      GREATEST(v_next_stock, 0),
      GREATEST(v_next_stock, 0)
    );
  END IF;

  INSERT INTO public.stock_transactions(
    product_id,
    type,
    quantity,
    previous_stock,
    new_stock,
    note,
    user_id
  )
  VALUES (
    p_product_id,
    p_mode,
    v_delta,
    v_previous_stock,
    v_next_stock,
    COALESCE(p_note, CASE WHEN p_mode = 'import' THEN 'Nhập kho' ELSE 'Điều chỉnh tồn kho' END),
    p_user_id
  )
  RETURNING id INTO v_transaction_id;

  PERFORM public.sync_stock_alert_in_tx(p_product_id);

  RETURN v_transaction_id;
END;
$$;
