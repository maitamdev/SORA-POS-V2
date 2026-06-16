-- Migration Patch: SORA POS V2 Enterprise Enhancements
-- Run this in Supabase SQL Editor.

-- 1. Alter orders table to support shift_code tracking for offline synchronization
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS shift_code VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_orders_shift_code 
  ON public.orders(shift_code);

-- 2. Create Cash Drawer Transactions table (Cash In / Cash Out)
CREATE TABLE IF NOT EXISTS public.cash_drawer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash_in', 'cash_out')),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_shift_id 
  ON public.cash_drawer_transactions(shift_id);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_created_at 
  ON public.cash_drawer_transactions(created_at DESC);

-- 3. Update create_pos_order to accept and process shift_code in payload
CREATE OR REPLACE FUNCTION public.create_pos_order(
  p_payload jsonb,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_shift_id uuid;
  v_shift_code text;
  v_client_order_number text;
  v_existing_order_id uuid;
  v_order_number text;
  v_order_id uuid;
  v_customer_id uuid;
  v_customer record;
  v_item_count integer;
  v_locked_count integer := 0;
  v_product record;
  v_total_amount numeric(15, 2) := 0;
  v_discount_amount numeric(15, 2) := 0;
  v_points_used integer := 0;
  v_points_discount numeric(15, 2) := 0;
  v_manual_discount numeric(15, 2) := 0;
  v_final_amount numeric(15, 2) := 0;
  v_points_earned integer := 0;
  v_note text;
  v_payment_method text := 'cash';
  v_received_amount numeric(15, 2);
  v_reference_code text;
  v_allow_sell_out_of_stock boolean := false;
  v_allow_discount boolean := true;
  v_max_discount_percent numeric(6, 2) := 100;
  v_new_stock integer;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid order payload';
  END IF;

  -- Get User Role
  SELECT r.name
  INTO v_role
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = p_user_id
    AND u.is_active IS TRUE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User is inactive or not found';
  END IF;

  -- Extract shift_code from payload
  v_shift_code := upper(NULLIF(trim(p_payload->>'shift_code'), ''));

  -- Determine Shift ID
  IF v_shift_code IS NOT NULL THEN
    -- Try to match by shift_code
    SELECT id
    INTO v_shift_id
    FROM public.shift_sessions
    WHERE shift_code = v_shift_code
    LIMIT 1;
  END IF;

  -- Fallback if shift_code is missing or not found on server
  IF v_shift_id IS NULL AND v_role = 'cashier' THEN
    SELECT id
    INTO v_shift_id
    FROM public.shift_sessions
    WHERE employee_id = p_user_id
      AND status = 'checked_in'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_shift_id IS NULL THEN
      RAISE EXCEPTION 'Cashier must check in to an active shift before checkout';
    END IF;
  END IF;

  -- Get App Settings
  SELECT
    COALESCE((value->>'allowSellOutOfStock')::boolean, false),
    COALESCE((value->>'allowDiscount')::boolean, true),
    COALESCE((value->>'maxDiscountPercent')::numeric, 100)
  INTO v_allow_sell_out_of_stock, v_allow_discount, v_max_discount_percent
  FROM public.app_settings
  WHERE key = 'operation';

  v_allow_sell_out_of_stock := COALESCE(v_allow_sell_out_of_stock, false);
  v_allow_discount := COALESCE(v_allow_discount, true);
  v_max_discount_percent := COALESCE(v_max_discount_percent, 100);

  -- Validate Client Order Number (Idempotency check)
  v_client_order_number := upper(NULLIF(trim(p_payload->>'client_order_number'), ''));
  IF v_client_order_number IS NOT NULL THEN
    IF v_client_order_number !~ '^[A-Z0-9-]{6,50}$' THEN
      RAISE EXCEPTION 'Invalid client order number';
    END IF;

    SELECT id
    INTO v_existing_order_id
    FROM public.orders
    WHERE order_number = v_client_order_number;

    IF v_existing_order_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.orders
        WHERE id = v_existing_order_id
          AND user_id = p_user_id
      ) THEN
        RETURN v_existing_order_id;
      END IF;

      RAISE EXCEPTION 'Order number already exists';
    END IF;
  END IF;

  -- Process Temp Table for Items
  DROP TABLE IF EXISTS pg_temp.pos_order_items;

  CREATE TEMP TABLE pos_order_items ON COMMIT DROP AS
  SELECT
    item.product_id,
    SUM(item.quantity)::integer AS quantity,
    SUM(COALESCE(item.discount, 0))::numeric(15, 2) AS discount
  FROM jsonb_to_recordset(COALESCE(p_payload->'items', '[]'::jsonb))
    AS item(product_id uuid, quantity integer, discount numeric)
  GROUP BY item.product_id;

  SELECT COUNT(*) INTO v_item_count FROM pos_order_items;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Order must include at least one item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.pos_order_items
    WHERE quantity <= 0 OR discount < 0
  ) THEN
    RAISE EXCEPTION 'Invalid item quantity or discount';
  END IF;

  -- Validate Products & Stock
  FOR v_product IN
    SELECT
      p.id,
      p.name,
      p.sell_price,
      p.stock_quantity,
      p.min_stock_level,
      p.is_active,
      i.quantity AS sale_quantity,
      i.discount AS line_discount
    FROM pg_temp.pos_order_items i
    JOIN public.products p ON p.id = i.product_id
    FOR UPDATE OF p
  LOOP
    v_locked_count := v_locked_count + 1;

    IF v_product.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Product "%" is inactive', v_product.name;
    END IF;

    IF NOT v_allow_sell_out_of_stock AND v_product.stock_quantity < v_product.sale_quantity THEN
      RAISE EXCEPTION 'Product "%" does not have enough stock (remaining %)', v_product.name, v_product.stock_quantity;
    END IF;

    IF (v_product.sell_price * v_product.sale_quantity - v_product.line_discount) < 0 THEN
      RAISE EXCEPTION 'Item discount cannot exceed line amount for "%"', v_product.name;
    END IF;

    v_total_amount := v_total_amount + (v_product.sell_price * v_product.sale_quantity - v_product.line_discount);
  END LOOP;

  IF v_locked_count <> v_item_count THEN
    RAISE EXCEPTION 'One or more products were not found';
  END IF;

  -- Loyalty point processing
  v_customer_id := NULLIF(p_payload->>'customer_id', '')::uuid;
  v_points_used := GREATEST(COALESCE((p_payload->>'used_points')::integer, 0), 0);
  v_points_discount := v_points_used * 1000;

  IF v_customer_id IS NULL AND v_points_used > 0 THEN
    RAISE EXCEPTION 'Cannot redeem loyalty points without a customer';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    SELECT id, points, total_spent
    INTO v_customer
    FROM public.customers
    WHERE id = v_customer_id
      AND is_active IS TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer is inactive or not found';
    END IF;

    IF v_points_used > COALESCE(v_customer.points, 0) THEN
      RAISE EXCEPTION 'Customer does not have enough loyalty points';
    END IF;
  END IF;

  -- Calculate discount amounts
  v_discount_amount := LEAST(
    GREATEST(COALESCE((p_payload->>'discount_amount')::numeric, 0), 0),
    v_total_amount
  );
  v_manual_discount := GREATEST(v_discount_amount - v_points_discount, 0);

  IF v_manual_discount > 0 AND NOT v_allow_discount THEN
    RAISE EXCEPTION 'Discounts are disabled by store settings';
  END IF;

  IF v_manual_discount > (v_total_amount * v_max_discount_percent / 100) THEN
    RAISE EXCEPTION 'Manual discount exceeds the configured maximum';
  END IF;

  IF v_points_used > 0 AND v_discount_amount < v_points_discount THEN
    RAISE EXCEPTION 'Loyalty point discount is invalid';
  END IF;

  v_final_amount := GREATEST(v_total_amount - v_discount_amount, 0);
  v_points_earned := floor(v_final_amount / 10000)::integer;

  -- Payment configurations
  v_payment_method := COALESCE(NULLIF(p_payload#>>'{payment,method}', ''), 'cash');
  IF v_payment_method NOT IN ('cash', 'card', 'transfer', 'momo', 'zalopay') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  v_received_amount := COALESCE((p_payload#>>'{payment,received_amount}')::numeric, v_final_amount);
  v_reference_code := NULLIF(trim(p_payload#>>'{payment,reference_code}'), '');

  IF v_payment_method = 'cash' AND v_received_amount < v_final_amount THEN
    RAISE EXCEPTION 'Cash received is not enough to complete payment';
  END IF;

  v_note := NULLIF(trim(p_payload->>'note'), '');
  IF v_points_used > 0 OR v_points_earned > 0 THEN
    v_note := concat_ws(
      E'\n',
      v_note,
      format('[Loyalty] Used %s points. Earned +%s points.', v_points_used, v_points_earned)
    );
  END IF;

  v_order_number := COALESCE(
    v_client_order_number,
    'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 8, '0')
  );

  -- Insert new order
  INSERT INTO public.orders(
    order_number,
    customer_id,
    user_id,
    shift_id,
    shift_code,
    total_amount,
    discount_amount,
    final_amount,
    status,
    payment_status,
    note,
    loyalty_points_used,
    loyalty_points_earned
  )
  VALUES (
    v_order_number,
    v_customer_id,
    p_user_id,
    v_shift_id,
    v_shift_code,
    v_total_amount,
    v_discount_amount,
    v_final_amount,
    'completed',
    'paid',
    v_note,
    v_points_used,
    v_points_earned
  )
  RETURNING id INTO v_order_id;

  -- Insert order items
  INSERT INTO public.order_details(
    order_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    discount,
    subtotal
  )
  SELECT
    v_order_id,
    p.id,
    p.name,
    i.quantity,
    p.sell_price,
    i.discount,
    (p.sell_price * i.quantity - i.discount)
  FROM pg_temp.pos_order_items i
  JOIN public.products p ON p.id = i.product_id;

  -- Insert payment record
  INSERT INTO public.payments(
    order_id,
    method,
    amount,
    received_amount,
    change_amount,
    reference_code,
    status
  )
  VALUES (
    v_order_id,
    v_payment_method,
    v_final_amount,
    v_received_amount,
    GREATEST(v_received_amount - v_final_amount, 0),
    v_reference_code,
    'completed'
  );

  -- Deduct stock & log stock transaction
  FOR v_product IN
    SELECT
      p.id,
      p.stock_quantity,
      i.quantity AS sale_quantity
    FROM pg_temp.pos_order_items i
    JOIN public.products p ON p.id = i.product_id
  LOOP
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_product.sale_quantity
    WHERE id = v_product.id
    RETURNING stock_quantity INTO v_new_stock;

    INSERT INTO public.stock_transactions(
      product_id,
      type,
      quantity,
      previous_stock,
      new_stock,
      reference_id,
      note,
      user_id
    )
    VALUES (
      v_product.id,
      'sale',
      -v_product.sale_quantity,
      v_product.stock_quantity,
      v_new_stock,
      v_order_id,
      'Sale order ' || v_order_number,
      p_user_id
    );

    PERFORM public.sync_stock_alert_in_tx(v_product.id);
  END LOOP;

  -- Update Customer loyalty fields
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_spent = COALESCE(total_spent, 0) + v_final_amount,
        points = GREATEST(COALESCE(points, 0) - v_points_used + v_points_earned, 0)
    WHERE id = v_customer_id;
  END IF;

  -- Log audit trail
  PERFORM public.write_audit_log(
    p_user_id,
    'order.create',
    'orders',
    v_order_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'final_amount', v_final_amount,
      'item_count', v_item_count,
      'payment_method', v_payment_method,
      'shift_id', v_shift_id,
      'shift_code', v_shift_code
    )
  );

  RETURN v_order_id;
END;
$$;
