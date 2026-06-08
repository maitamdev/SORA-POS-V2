-- Enterprise POS core migration for Sora POS.
-- Run after database/schema.sql and database/app_settings.sql.
--
-- This migration makes checkout/cancel operations transactional inside
-- PostgreSQL, adds audit logs, and records loyalty deltas on each order.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON public.audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_points_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_loyalty_points_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_loyalty_points_check
      CHECK (loyalty_points_used >= 0 AND loyalty_points_earned >= 0) NOT VALID;
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (p_actor_id, p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_stock_alert_in_tx(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock integer;
  v_min_stock integer;
  v_status text;
  v_active_alert_id uuid;
BEGIN
  SELECT stock_quantity, min_stock_level
  INTO v_current_stock, v_min_stock
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_status := CASE
    WHEN v_current_stock <= 0 THEN 'out_of_stock'
    WHEN v_current_stock <= v_min_stock THEN 'low_stock'
    ELSE NULL
  END;

  SELECT id
  INTO v_active_alert_id
  FROM public.stock_alerts
  WHERE product_id = p_product_id
    AND status IN ('low_stock', 'out_of_stock')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_status IS NULL THEN
    IF v_active_alert_id IS NOT NULL THEN
      UPDATE public.stock_alerts
      SET status = 'resolved',
          resolved_at = now(),
          updated_at = now()
      WHERE id = v_active_alert_id;
    END IF;
    RETURN;
  END IF;

  IF v_active_alert_id IS NOT NULL THEN
    UPDATE public.stock_alerts
    SET current_stock = v_current_stock,
        min_stock_level = v_min_stock,
        status = v_status,
        updated_at = now()
    WHERE id = v_active_alert_id;
  ELSE
    INSERT INTO public.stock_alerts(product_id, current_stock, min_stock_level, status)
    VALUES (p_product_id, v_current_stock, v_min_stock, v_status);
  END IF;
END;
$$;

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

  SELECT r.name
  INTO v_role
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = p_user_id
    AND u.is_active IS TRUE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User is inactive or not found';
  END IF;

  IF v_role = 'cashier' THEN
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
    FROM pos_order_items
    WHERE quantity <= 0 OR discount < 0
  ) THEN
    RAISE EXCEPTION 'Invalid item quantity or discount';
  END IF;

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
    FROM pos_order_items i
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

  INSERT INTO public.orders(
    order_number,
    customer_id,
    user_id,
    shift_id,
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
  FROM pos_order_items i
  JOIN public.products p ON p.id = i.product_id;

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

  FOR v_product IN
    SELECT
      p.id,
      p.stock_quantity,
      i.quantity AS sale_quantity
    FROM pos_order_items i
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

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_spent = COALESCE(total_spent, 0) + v_final_amount,
        points = GREATEST(COALESCE(points, 0) - v_points_used + v_points_earned, 0)
    WHERE id = v_customer_id;
  END IF;

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
      'shift_id', v_shift_id
    )
  );

  RETURN v_order_id;
END;
$$;

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
        UPDATE public.products
        SET stock_quantity = stock_quantity + v_detail.quantity
        WHERE id = v_detail.product_id
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
