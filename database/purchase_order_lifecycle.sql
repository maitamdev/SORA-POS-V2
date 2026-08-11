-- SORA POS: purchase order lifecycle and atomic partial receiving.
-- Run after enterprise_pos_core.sql, lot_expiry_upgrade.sql and
-- inventory_replenishment_v2.sql.

BEGIN;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.goods_receipt_details
  ADD COLUMN IF NOT EXISTS purchase_order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_status
  ON public.purchase_orders(supplier_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_id
  ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_details_purchase_order_item
  ON public.goods_receipt_details(purchase_order_item_id);

-- Create a draft PO and its lines in one transaction.
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_payload jsonb,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_supplier_id uuid;
  v_expected_at timestamptz;
  v_note text;
  v_item_count integer;
  v_total numeric(15, 2);
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid purchase order payload';
  END IF;

  v_order_number := NULLIF(trim(p_payload->>'order_number'), '');
  v_supplier_id := NULLIF(p_payload->>'supplier_id', '')::uuid;
  v_expected_at := NULLIF(p_payload->>'expected_at', '')::timestamptz;
  v_note := NULLIF(trim(p_payload->>'note'), '');

  IF v_order_number IS NULL OR length(v_order_number) > 50 THEN
    RAISE EXCEPTION 'Order number is required and must be at most 50 characters';
  END IF;

  IF v_supplier_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = v_supplier_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Active supplier is required';
  END IF;

  DROP TABLE IF EXISTS pg_temp.purchase_order_input;
  CREATE TEMP TABLE purchase_order_input ON COMMIT DROP AS
  SELECT product_id, quantity, unit_cost
  FROM jsonb_to_recordset(COALESCE(p_payload->'items', '[]'::jsonb)) AS item(
    product_id uuid,
    quantity integer,
    unit_cost numeric
  );

  SELECT COUNT(*) INTO v_item_count FROM pg_temp.purchase_order_input;
  IF v_item_count = 0 OR v_item_count > 500 THEN
    RAISE EXCEPTION 'Purchase order must contain between 1 and 500 items';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_temp.purchase_order_input
    WHERE product_id IS NULL OR quantity IS NULL OR quantity <= 0
      OR unit_cost IS NULL OR unit_cost < 0
  ) THEN
    RAISE EXCEPTION 'Each purchase order line needs a product, positive quantity and non-negative cost';
  END IF;

  IF (SELECT COUNT(*) FROM pg_temp.purchase_order_input)
     <> (SELECT COUNT(DISTINCT product_id) FROM pg_temp.purchase_order_input) THEN
    RAISE EXCEPTION 'A product can appear only once in a purchase order';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM pg_temp.purchase_order_input i
    JOIN public.products p ON p.id = i.product_id AND p.is_active = TRUE
  ) <> v_item_count THEN
    RAISE EXCEPTION 'One or more products do not exist or are inactive';
  END IF;

  SELECT COALESCE(SUM(quantity * unit_cost), 0)::numeric(15, 2)
  INTO v_total
  FROM pg_temp.purchase_order_input;

  INSERT INTO public.purchase_orders(
    order_number,
    supplier_id,
    status,
    expected_at,
    total_amount,
    note,
    created_by
  )
  VALUES (
    v_order_number,
    v_supplier_id,
    'draft',
    v_expected_at,
    v_total,
    v_note,
    p_user_id
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.purchase_order_items(purchase_order_id, product_id, quantity, unit_cost)
  SELECT v_order_id, product_id, quantity, unit_cost
  FROM pg_temp.purchase_order_input;

  PERFORM public.write_audit_log(
    p_user_id,
    'purchase_order.create',
    'purchase_orders',
    v_order_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'supplier_id', v_supplier_id,
      'total_amount', v_total,
      'item_count', v_item_count
    )
  );

  RETURN v_order_id;
END;
$$;

-- Enforce an explicit workflow. Receiving is deliberately not exposed as a
-- generic status update because it must also update stock and receipt batches.
CREATE OR REPLACE FUNCTION public.set_purchase_order_status(
  p_purchase_order_id uuid,
  p_status text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.purchase_orders%ROWTYPE;
  v_allowed boolean := FALSE;
BEGIN
  IF p_status NOT IN ('pending', 'approved', 'ordered', 'in_transit', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid purchase order status';
  END IF;

  SELECT * INTO v_order
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order was not found';
  END IF;

  IF v_order.status = p_status THEN
    RETURN v_order.id;
  END IF;

  v_allowed := CASE v_order.status
    WHEN 'draft' THEN p_status IN ('pending', 'cancelled')
    WHEN 'pending' THEN p_status IN ('draft', 'approved', 'cancelled')
    WHEN 'approved' THEN p_status IN ('ordered', 'cancelled')
    WHEN 'ordered' THEN p_status IN ('in_transit', 'cancelled')
    WHEN 'in_transit' THEN p_status = 'cancelled'
    WHEN 'partially_received' THEN p_status = 'cancelled'
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Cannot change purchase order from % to %', v_order.status, p_status;
  END IF;

  UPDATE public.purchase_orders
  SET status = p_status,
      approved_by = CASE WHEN p_status = 'approved' THEN p_user_id ELSE approved_by END,
      approved_at = CASE WHEN p_status = 'approved' THEN NOW() ELSE approved_at END,
      ordered_at = CASE WHEN p_status = 'ordered' THEN NOW() ELSE ordered_at END,
      in_transit_at = CASE WHEN p_status = 'in_transit' THEN NOW() ELSE in_transit_at END,
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
      cancelled_by = CASE WHEN p_status = 'cancelled' THEN p_user_id ELSE cancelled_by END,
      updated_at = NOW()
  WHERE id = p_purchase_order_id;

  PERFORM public.write_audit_log(
    p_user_id,
    'purchase_order.status_change',
    'purchase_orders',
    p_purchase_order_id,
    jsonb_build_object('from', v_order.status, 'to', p_status)
  );

  RETURN p_purchase_order_id;
END;
$$;

-- Receive all or part of a PO. The PO and line rows are locked before stock is
-- touched. The existing create_goods_receipt RPC handles stock, batches,
-- expiry dates, alerts, stock transactions and receipt audit atomically.
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_payload jsonb,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.purchase_orders%ROWTYPE;
  v_receipt_id uuid;
  v_receipt_number text;
  v_paid_amount numeric(15, 2);
  v_total numeric(15, 2);
  v_input_count integer;
  v_item_count integer;
  v_next_status text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid purchase receipt payload';
  END IF;

  SELECT * INTO v_order
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order was not found';
  END IF;

  IF v_order.status NOT IN ('approved', 'ordered', 'in_transit', 'partially_received') THEN
    RAISE EXCEPTION 'Purchase order must be approved or in transit before receiving';
  END IF;

  v_receipt_number := NULLIF(trim(p_payload->>'receipt_number'), '');
  v_paid_amount := COALESCE((p_payload->>'paid_amount')::numeric, 0);

  IF v_receipt_number IS NULL OR length(v_receipt_number) > 50 THEN
    RAISE EXCEPTION 'Receipt number is required and must be at most 50 characters';
  END IF;
  IF v_paid_amount < 0 THEN
    RAISE EXCEPTION 'Paid amount cannot be negative';
  END IF;

  DROP TABLE IF EXISTS pg_temp.purchase_receipt_input;
  CREATE TEMP TABLE purchase_receipt_input ON COMMIT DROP AS
  SELECT
    x.purchase_order_item_id,
    poi.product_id,
    x.quantity,
    COALESCE(x.unit_price, poi.unit_cost)::numeric AS unit_price,
    NULLIF(trim(x.expiry_date), '')::date AS expiry_date,
    NULLIF(trim(x.batch_number), '') AS batch_number
  FROM jsonb_to_recordset(COALESCE(p_payload->'items', '[]'::jsonb)) AS x(
    purchase_order_item_id uuid,
    quantity integer,
    unit_price numeric,
    expiry_date text,
    batch_number text
  )
  JOIN public.purchase_order_items poi
    ON poi.id = x.purchase_order_item_id
   AND poi.purchase_order_id = p_purchase_order_id;

  SELECT jsonb_array_length(COALESCE(p_payload->'items', '[]'::jsonb)) INTO v_input_count;
  SELECT COUNT(*) INTO v_item_count FROM pg_temp.purchase_receipt_input;

  IF v_input_count = 0 OR v_input_count > 500 OR v_item_count <> v_input_count THEN
    RAISE EXCEPTION 'Receipt contains an invalid purchase order line';
  END IF;

  IF v_item_count <> (SELECT COUNT(DISTINCT purchase_order_item_id) FROM pg_temp.purchase_receipt_input) THEN
    RAISE EXCEPTION 'A purchase order line can be received only once per receipt';
  END IF;

  -- Lock every line after the header lock so two receiving requests cannot
  -- both pass the outstanding-quantity check.
  PERFORM 1
  FROM public.purchase_order_items poi
  JOIN pg_temp.purchase_receipt_input r ON r.purchase_order_item_id = poi.id
  FOR UPDATE OF poi;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.purchase_receipt_input r
    JOIN public.purchase_order_items poi ON poi.id = r.purchase_order_item_id
    WHERE r.quantity IS NULL OR r.quantity <= 0
      OR r.quantity > (poi.quantity - poi.received_quantity)
      OR r.unit_price IS NULL OR r.unit_price < 0
      OR r.expiry_date IS NULL OR r.expiry_date < CURRENT_DATE
      OR r.batch_number IS NULL OR length(r.batch_number) = 0 OR length(r.batch_number) > 100
  ) THEN
    RAISE EXCEPTION 'Received quantity, cost, batch or expiry date is invalid';
  END IF;

  SELECT COALESCE(SUM(quantity * unit_price), 0)::numeric(15, 2)
  INTO v_total
  FROM pg_temp.purchase_receipt_input;
  IF v_paid_amount > v_total THEN
    RAISE EXCEPTION 'Paid amount cannot exceed this receipt total';
  END IF;

  SELECT public.create_goods_receipt(
    jsonb_build_object(
      'receipt_number', v_receipt_number,
      'supplier_id', v_order.supplier_id,
      'note', NULLIF(trim(p_payload->>'note'), ''),
      'paid_amount', v_paid_amount,
      'items', (
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', product_id,
          'quantity', quantity,
          'unit_price', unit_price,
          'expiry_date', to_char(expiry_date, 'YYYY-MM-DD'),
          'batch_number', batch_number
        ))
        FROM pg_temp.purchase_receipt_input
      )
    ),
    p_user_id
  ) INTO v_receipt_id;

  UPDATE public.goods_receipt_details d
  SET purchase_order_item_id = r.purchase_order_item_id
  FROM pg_temp.purchase_receipt_input r
  WHERE d.goods_receipt_id = v_receipt_id
    AND d.product_id = r.product_id;

  UPDATE public.purchase_order_items poi
  SET received_quantity = poi.received_quantity + r.quantity
  FROM pg_temp.purchase_receipt_input r
  WHERE poi.id = r.purchase_order_item_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id
      AND received_quantity < quantity
  ) THEN
    v_next_status := 'received';
  ELSE
    v_next_status := 'partially_received';
  END IF;

  UPDATE public.purchase_orders
  SET status = v_next_status,
      received_at = CASE WHEN v_next_status = 'received' THEN NOW() ELSE received_at END,
      updated_at = NOW()
  WHERE id = p_purchase_order_id;

  PERFORM public.write_audit_log(
    p_user_id,
    'purchase_order.receive',
    'purchase_orders',
    p_purchase_order_id,
    jsonb_build_object(
      'receipt_id', v_receipt_id,
      'receipt_number', v_receipt_number,
      'received_total', v_total,
      'item_count', v_item_count,
      'status', v_next_status
    )
  );

  RETURN v_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase_order(jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_purchase_order_status(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_purchase_order_status(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, jsonb, uuid) TO service_role;

COMMIT;
