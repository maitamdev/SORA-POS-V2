-- ====================================================================
-- Expiration Date (HSD) Tracking Setup & Trigger Functions Update
-- PostgreSQL (Supabase)
-- ====================================================================

-- 1. Create product_batches table to store stock segmented by batch and HSD
CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  original_quantity INTEGER NOT NULL CHECK (original_quantity >= 0),
  quantity INTEGER NOT NULL DEFAULT 0, -- Current quantity in batch
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON public.product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry_date ON public.product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_quantity ON public.product_batches(quantity);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_product_batches_updated_at ON public.product_batches;
CREATE TRIGGER update_product_batches_updated_at BEFORE UPDATE ON public.product_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Add expiry_date and batch_number columns to goods_receipt_details
ALTER TABLE public.goods_receipt_details ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.goods_receipt_details ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);

-- ====================================================================
-- 3. RE-CREATE GOODS RECEIPT RPC WITH BATCH INTEGRATION
-- ====================================================================
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

  IF v_receipt_number IS NULL THEN
    RAISE EXCEPTION 'Receipt number is required';
  END IF;

  -- Create temporary table for validation & processing, parsing expiry_date & batch_number
  DROP TABLE IF EXISTS pg_temp.goods_receipt_items;
  
  CREATE TEMP TABLE goods_receipt_items ON COMMIT DROP AS
  SELECT
    (item->>'product_id')::uuid AS product_id,
    (item->>'quantity')::integer AS quantity,
    (item->>'unit_price')::numeric(15, 2) AS unit_price,
    COALESCE(NULLIF(item->>'expiry_date', '')::date, CURRENT_DATE + INTERVAL '1 year') AS expiry_date,
    COALESCE(NULLIF(trim(item->>'batch_number'), ''), 'BAT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text, 1, 8)) AS batch_number
  FROM jsonb_to_recordset(COALESCE(p_payload->'items', '[]'::jsonb)) AS item(product_id uuid, quantity integer, unit_price numeric, expiry_date text, batch_number text);

  SELECT COUNT(*) INTO v_item_count FROM goods_receipt_items;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Danh sách sản phẩm nhập không được để trống';
  END IF;

  -- Validate inputs
  IF EXISTS (
    SELECT 1 FROM pg_temp.goods_receipt_items 
    WHERE quantity <= 0 OR unit_price < 0
  ) THEN
    RAISE EXCEPTION 'Số lượng nhập phải lớn hơn 0 và giá nhập không được nhỏ hơn 0';
  END IF;

  -- Calculate total amount
  SELECT SUM(quantity * unit_price) INTO v_total_amount FROM goods_receipt_items;

  -- Determine payment status
  IF v_paid_amount >= v_total_amount THEN
    v_payment_status := 'paid';
  ELSIF v_paid_amount > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'unpaid';
  END IF;

  -- Insert goods_receipts
  INSERT INTO public.goods_receipts(
    receipt_number,
    supplier_id,
    user_id,
    total_amount,
    paid_amount,
    payment_status,
    note
  )
  VALUES (
    v_receipt_number,
    v_supplier_id,
    p_user_id,
    v_total_amount,
    v_paid_amount,
    v_payment_status,
    v_note
  )
  RETURNING id INTO v_receipt_id;

  -- Insert details (including expiry_date & batch_number)
  INSERT INTO public.goods_receipt_details(
    goods_receipt_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    expiry_date,
    batch_number
  )
  SELECT
    v_receipt_id,
    product_id,
    quantity,
    unit_price,
    (quantity * unit_price),
    expiry_date,
    batch_number
  FROM pg_temp.goods_receipt_items;

  -- Update products stock & cost price and insert stock transactions + product batches
  FOR v_product IN
    SELECT
      i.product_id,
      i.quantity,
      i.unit_price,
      i.expiry_date,
      i.batch_number,
      p.stock_quantity
    FROM pg_temp.goods_receipt_items i
    JOIN public.products p ON p.id = i.product_id
    FOR UPDATE OF p
  LOOP
    v_previous_stock := v_product.stock_quantity;
    v_new_stock := v_previous_stock + v_product.quantity;

    -- Update product total stock
    UPDATE public.products
    SET stock_quantity = v_new_stock,
        cost_price = v_product.unit_price
    WHERE id = v_product.product_id;

    -- Insert into product_batches for tracking expiration dates
    INSERT INTO public.product_batches(
      product_id,
      batch_number,
      expiry_date,
      original_quantity,
      quantity
    )
    VALUES (
      v_product.product_id,
      v_product.batch_number,
      v_product.expiry_date,
      v_product.quantity,
      v_product.quantity
    );

    -- Insert stock transaction
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
      v_product.product_id,
      'import',
      v_product.quantity,
      v_previous_stock,
      v_new_stock,
      v_receipt_id,
      'Nhập kho theo phiếu ' || v_receipt_number || ' (Lô: ' || v_product.batch_number || ', HSD: ' || to_char(v_product.expiry_date, 'DD/MM/YYYY') || ')',
      p_user_id
    );

    -- Sync stock alert in transaction
    PERFORM public.sync_stock_alert_in_tx(v_product.product_id);
  END LOOP;

  -- Write audit log
  PERFORM public.write_audit_log(
    p_user_id,
    'goods_receipt.create',
    'goods_receipts',
    v_receipt_id,
    jsonb_build_object(
      'receipt_number', v_receipt_number,
      'total_amount', v_total_amount,
      'paid_amount', v_paid_amount,
      'item_count', v_item_count
    )
  );

  RETURN v_receipt_id;
END;
$$;


-- ====================================================================
-- 4. RE-CREATE POS CHECKOUT RPC WITH BATCH INTEGRATION (FIFO)
-- ====================================================================
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
  
  -- Batch deduction variables
  v_rem_qty integer;
  v_batch record;
  v_deduct integer;
  v_batch_id uuid;
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

  -- Deduct stock, log transactions AND apply FIFO to product batches
  FOR v_product IN
    SELECT
      p.id,
      p.stock_quantity,
      i.quantity AS sale_quantity
    FROM pg_temp.pos_order_items i
    JOIN public.products p ON p.id = i.product_id
  LOOP
    -- 1. Deduct total stock in products table
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_product.sale_quantity
    WHERE id = v_product.id
    RETURNING stock_quantity INTO v_new_stock;

    -- 2. Deduct from product_batches using FIFO (oldest expiry_date first)
    v_rem_qty := v_product.sale_quantity;
    
    FOR v_batch IN
      SELECT id, quantity
      FROM public.product_batches
      WHERE product_id = v_product.id AND quantity > 0
      ORDER BY expiry_date ASC
      FOR UPDATE
    LOOP
      IF v_rem_qty <= 0 THEN
        EXIT;
      END IF;

      v_deduct := LEAST(v_batch.quantity, v_rem_qty);
      
      UPDATE public.product_batches
      SET quantity = quantity - v_deduct
      WHERE id = v_batch.id;

      v_rem_qty := v_rem_qty - v_deduct;
    END LOOP;

    -- 3. If there is remaining quantity (oversold or no batches present), deduct from latest batch or create default
    IF v_rem_qty > 0 THEN
      SELECT id INTO v_batch_id
      FROM public.product_batches
      WHERE product_id = v_product.id
      ORDER BY expiry_date DESC
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.product_batches
        SET quantity = quantity - v_rem_qty
        WHERE id = v_batch_id;
      ELSE
        -- No batches exist, create a default system batch
        INSERT INTO public.product_batches(
          product_id,
          batch_number,
          expiry_date,
          original_quantity,
          quantity
        )
        VALUES (
          v_product.id,
          'BAT-SYSTEM-DEFAULT',
          CURRENT_DATE + INTERVAL '1 year',
          0,
          -v_rem_qty
        );
      END IF;
    END IF;

    -- 4. Log stock transaction
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


-- ====================================================================
-- 5. RE-CREATE POS CANCEL ORDER RPC WITH BATCH INTEGRATION
-- ====================================================================
CREATE OR REPLACE FUNCTION public.cancel_pos_order(
  p_order_id uuid,
  p_user_id uuid,
  p_restock boolean DEFAULT true,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_order record;
  v_detail record;
  v_previous_stock integer;
  v_new_stock integer;
  v_batch_id uuid;
BEGIN
  SELECT r.name
  INTO v_role
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = p_user_id
    AND u.is_active IS TRUE;

  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only admin or manager can cancel orders';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order was not found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order has already been cancelled';
  END IF;

  IF p_restock THEN
    FOR v_detail IN
      SELECT product_id, quantity
      FROM public.order_details
      WHERE order_id = p_order_id
    LOOP
      SELECT stock_quantity
      INTO v_previous_stock
      FROM public.products
      WHERE id = v_detail.product_id
      FOR UPDATE;

      IF FOUND THEN
        -- 1. Restock total quantity in products table
        UPDATE public.products
        SET stock_quantity = stock_quantity + v_detail.quantity
        WHERE id = v_detail.product_id
        RETURNING stock_quantity INTO v_new_stock;

        -- 2. Return quantity to the latest batch of this product
        SELECT id INTO v_batch_id
        FROM public.product_batches
        WHERE product_id = v_detail.product_id
        ORDER BY expiry_date DESC
        LIMIT 1;

        IF FOUND THEN
          UPDATE public.product_batches
          SET quantity = quantity + v_detail.quantity
          WHERE id = v_batch_id;
        ELSE
          -- Create returned batch if none exists
          INSERT INTO public.product_batches(
            product_id,
            batch_number,
            expiry_date,
            original_quantity,
            quantity
          )
          VALUES (
            v_detail.product_id,
            'BAT-RETURNED',
            CURRENT_DATE + INTERVAL '1 year',
            v_detail.quantity,
            v_detail.quantity
          );
        END IF;

        -- 3. Log stock transaction
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
          v_detail.product_id,
          'return',
          v_detail.quantity,
          v_previous_stock,
          v_new_stock,
          p_order_id,
          COALESCE(NULLIF(trim(p_note), ''), 'Restock from cancelled order ' || v_order.order_number),
          p_user_id
        );

        PERFORM public.sync_stock_alert_in_tx(v_detail.product_id);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      payment_status = 'unpaid',
      note = COALESCE(NULLIF(trim(p_note), ''), note),
      cancelled_at = now(),
      cancelled_by = p_user_id
  WHERE id = p_order_id;

  UPDATE public.payments
  SET status = 'refunded'
  WHERE order_id = p_order_id
    AND status = 'completed';

  IF v_order.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_spent = GREATEST(COALESCE(total_spent, 0) - COALESCE(v_order.final_amount, 0), 0),
        points = GREATEST(
          COALESCE(points, 0)
          + COALESCE(v_order.loyalty_points_used, 0)
          - COALESCE(v_order.loyalty_points_earned, 0),
          0
        )
    WHERE id = v_order.customer_id;
  END IF;

  PERFORM public.write_audit_log(
    p_user_id,
    'order.cancel',
    'orders',
    p_order_id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'restock', p_restock,
      'final_amount', v_order.final_amount
    )
  );

  RETURN p_order_id;
END;
$$;
