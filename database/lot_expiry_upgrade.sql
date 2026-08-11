-- ====================================================================
-- Lot / HSD upgrade for existing Sora POS databases
-- Run after database/stock_atomic_rpc.sql and database/expiry_setup.sql.
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  original_quantity INTEGER NOT NULL CHECK (original_quantity >= 0),
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.goods_receipt_details ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.goods_receipt_details ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);

-- Merge accidental duplicate rows before enforcing one row per product + lô + HSD.
WITH grouped AS (
  SELECT
    MIN(id) AS survivor_id,
    product_id,
    batch_number,
    expiry_date,
    SUM(original_quantity)::integer AS original_quantity,
    SUM(quantity)::integer AS quantity
  FROM public.product_batches
  GROUP BY product_id, batch_number, expiry_date
), updated AS (
  UPDATE public.product_batches b
  SET original_quantity = g.original_quantity,
      quantity = g.quantity,
      updated_at = NOW()
  FROM grouped g
  WHERE b.id = g.survivor_id
  RETURNING b.id
)
DELETE FROM public.product_batches b
USING grouped g
WHERE b.product_id = g.product_id
  AND b.batch_number = g.batch_number
  AND b.expiry_date = g.expiry_date
  AND b.id <> g.survivor_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_batches_product_batch_expiry
  ON public.product_batches(product_id, batch_number, expiry_date);

DROP FUNCTION IF EXISTS public.apply_stock_change(uuid, text, integer, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.apply_stock_change(
  p_product_id uuid,
  p_mode text,
  p_quantity integer,
  p_new_stock integer,
  p_user_id uuid,
  p_note text DEFAULT NULL,
  p_batch_number text DEFAULT NULL,
  p_expiry_date date DEFAULT NULL
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
  v_batch record;
BEGIN
  IF p_mode NOT IN ('import', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid stock change mode';
  END IF;
  IF p_mode = 'import' AND COALESCE(p_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Import quantity must be greater than 0';
  END IF;
  IF p_mode = 'import' AND NULLIF(trim(p_batch_number), '') IS NULL THEN
    RAISE EXCEPTION 'Batch number is required for imports';
  END IF;
  IF p_mode = 'import' AND (p_expiry_date IS NULL OR p_expiry_date < CURRENT_DATE) THEN
    RAISE EXCEPTION 'Expiry date must be today or later';
  END IF;
  IF p_mode = 'adjustment' AND COALESCE(p_new_stock, -1) < 0 THEN
    RAISE EXCEPTION 'New stock cannot be negative';
  END IF;

  SELECT id, stock_quantity INTO v_product
  FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product was not found'; END IF;

  v_previous_stock := COALESCE(v_product.stock_quantity, 0);
  IF p_mode = 'import' THEN
    v_delta := p_quantity;
    v_next_stock := v_previous_stock + v_delta;
  ELSE
    v_next_stock := p_new_stock;
    v_delta := v_next_stock - v_previous_stock;
  END IF;

  UPDATE public.products SET stock_quantity = v_next_stock WHERE id = p_product_id;

  IF p_mode = 'import' THEN
    SELECT * INTO v_batch
    FROM public.product_batches
    WHERE product_id = p_product_id
      AND batch_number = trim(p_batch_number)
      AND expiry_date = p_expiry_date
    LIMIT 1 FOR UPDATE;
  ELSE
    SELECT * INTO v_batch
    FROM public.product_batches
    WHERE product_id = p_product_id
    ORDER BY expiry_date DESC
    LIMIT 1 FOR UPDATE;
  END IF;

  IF FOUND THEN
    UPDATE public.product_batches
    SET quantity = GREATEST(0, quantity + v_delta),
        original_quantity = CASE WHEN p_mode = 'import'
          THEN original_quantity + v_delta ELSE original_quantity END,
        updated_at = NOW()
    WHERE id = v_batch.id;
  ELSE
    INSERT INTO public.product_batches(product_id, batch_number, expiry_date, original_quantity, quantity)
    VALUES (
      p_product_id,
      CASE WHEN p_mode = 'import' THEN trim(p_batch_number) ELSE 'BAT-ADJUSTED' END,
      CASE WHEN p_mode = 'import' THEN p_expiry_date ELSE CURRENT_DATE + INTERVAL '1 year' END,
      CASE WHEN p_mode = 'import' THEN v_delta ELSE GREATEST(v_next_stock, 0) END,
      CASE WHEN p_mode = 'import' THEN v_delta ELSE GREATEST(v_next_stock, 0) END
    );
  END IF;

  INSERT INTO public.stock_transactions(product_id, type, quantity, previous_stock, new_stock, note, user_id)
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

CREATE OR REPLACE FUNCTION public.create_goods_receipt(
  p_payload jsonb,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt_id uuid;
  v_receipt_number text;
  v_supplier_id uuid;
  v_note text;
  v_paid_amount numeric(15, 2);
  v_total_amount numeric(15, 2) := 0;
  v_payment_status text := 'unpaid';
  v_item record;
  v_item_count integer;
  v_previous_stock integer;
  v_new_stock integer;
  v_product record;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid goods receipt payload';
  END IF;

  v_supplier_id := NULLIF(p_payload->>'supplier_id', '')::uuid;
  v_note := NULLIF(trim(p_payload->>'note'), '');
  v_paid_amount := COALESCE((p_payload->>'paid_amount')::numeric, 0);
  v_receipt_number := NULLIF(trim(p_payload->>'receipt_number'), '');
  IF v_receipt_number IS NULL THEN RAISE EXCEPTION 'Receipt number is required'; END IF;

  DROP TABLE IF EXISTS pg_temp.goods_receipt_items;
  CREATE TEMP TABLE goods_receipt_items ON COMMIT DROP AS
  SELECT product_id, quantity, unit_price,
    NULLIF(expiry_date, '')::date AS expiry_date,
    NULLIF(trim(batch_number), '') AS batch_number
  FROM jsonb_to_recordset(COALESCE(p_payload->'items', '[]'::jsonb))
    AS item(product_id uuid, quantity integer, unit_price numeric, expiry_date text, batch_number text);

  SELECT COUNT(*) INTO v_item_count FROM goods_receipt_items;
  IF v_item_count = 0 THEN RAISE EXCEPTION 'Danh sách sản phẩm nhập không được để trống'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.goods_receipt_items
    WHERE quantity <= 0 OR unit_price < 0 OR expiry_date IS NULL
      OR expiry_date < CURRENT_DATE OR batch_number IS NULL
  ) THEN
    RAISE EXCEPTION 'Mỗi dòng nhập phải có số lượng, giá, số lô và HSD hợp lệ';
  END IF;

  SELECT SUM(quantity * unit_price) INTO v_total_amount FROM goods_receipt_items;
  IF v_paid_amount >= v_total_amount THEN v_payment_status := 'paid';
  ELSIF v_paid_amount > 0 THEN v_payment_status := 'partial';
  ELSE v_payment_status := 'unpaid'; END IF;

  INSERT INTO public.goods_receipts(receipt_number, supplier_id, user_id, total_amount, paid_amount, payment_status, note)
  VALUES (v_receipt_number, v_supplier_id, p_user_id, v_total_amount, v_paid_amount, v_payment_status, v_note)
  RETURNING id INTO v_receipt_id;

  INSERT INTO public.goods_receipt_details(goods_receipt_id, product_id, quantity, unit_price, subtotal, expiry_date, batch_number)
  SELECT v_receipt_id, product_id, quantity, unit_price, quantity * unit_price, expiry_date, batch_number
  FROM pg_temp.goods_receipt_items;

  FOR v_item IN SELECT product_id, quantity, unit_price, expiry_date, batch_number FROM pg_temp.goods_receipt_items LOOP
    SELECT id, stock_quantity INTO v_product
    FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product was not found'; END IF;

    v_previous_stock := COALESCE(v_product.stock_quantity, 0);
    v_new_stock := v_previous_stock + v_item.quantity;
    UPDATE public.products SET stock_quantity = v_new_stock, cost_price = v_item.unit_price
    WHERE id = v_item.product_id;

    INSERT INTO public.product_batches(product_id, batch_number, expiry_date, original_quantity, quantity)
    VALUES (v_item.product_id, v_item.batch_number, v_item.expiry_date, v_item.quantity, v_item.quantity)
    ON CONFLICT (product_id, batch_number, expiry_date)
    DO UPDATE SET quantity = public.product_batches.quantity + EXCLUDED.quantity,
      original_quantity = public.product_batches.original_quantity + EXCLUDED.original_quantity,
      updated_at = NOW();

    INSERT INTO public.stock_transactions(product_id, type, quantity, previous_stock, new_stock, reference_id, note, user_id)
    VALUES (
      v_item.product_id, 'import', v_item.quantity, v_previous_stock, v_new_stock, v_receipt_id,
      'Nhập kho theo phiếu ' || v_receipt_number || ' (Lô: ' || v_item.batch_number || ', HSD: ' || to_char(v_item.expiry_date, 'DD/MM/YYYY') || ')',
      p_user_id
    );
    PERFORM public.sync_stock_alert_in_tx(v_item.product_id);
  END LOOP;

  PERFORM public.write_audit_log(
    p_user_id, 'goods_receipt.create', 'goods_receipts', v_receipt_id,
    jsonb_build_object('receipt_number', v_receipt_number, 'total_amount', v_total_amount,
      'paid_amount', v_paid_amount, 'item_count', v_item_count)
  );
  RETURN v_receipt_id;
END;
$$;

COMMIT;
