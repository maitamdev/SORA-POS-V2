-- Database hardening migration for existing Sora POS installations.
-- Run after database/schema.sql. Review duplicate barcodes before creating the unique index.

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique
  ON products(barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_price_stock_check') THEN
    ALTER TABLE products
      ADD CONSTRAINT products_price_stock_check
      CHECK (
        cost_price >= 0
        AND sell_price >= 0
        AND min_stock_level >= 0
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amount_status_check') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_amount_status_check
      CHECK (
        total_amount >= 0
        AND discount_amount >= 0
        AND final_amount >= 0
        AND status IN ('completed', 'cancelled', 'refunded')
        AND payment_status IN ('paid', 'unpaid', 'partial')
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_details_amount_quantity_check') THEN
    ALTER TABLE order_details
      ADD CONSTRAINT order_details_amount_quantity_check
      CHECK (
        quantity > 0
        AND unit_price >= 0
        AND discount >= 0
        AND subtotal >= 0
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_status_check') THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_amount_status_check
      CHECK (
        amount >= 0
        AND received_amount >= 0
        AND change_amount >= 0
        AND method IN ('cash', 'card', 'transfer', 'momo', 'zalopay')
        AND status IN ('completed', 'failed', 'refunded')
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_sessions_status_cash_check') THEN
    ALTER TABLE shift_sessions
      ADD CONSTRAINT shift_sessions_status_cash_check
      CHECK (
        status IN ('opened', 'checked_in', 'closed', 'cancelled')
        AND opening_cash >= 0
        AND (closing_cash IS NULL OR closing_cash >= 0)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transactions_type_check') THEN
    ALTER TABLE stock_transactions
      ADD CONSTRAINT stock_transactions_type_check
      CHECK (type IN ('import', 'sale', 'adjustment', 'return')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_alerts_status_check') THEN
    ALTER TABLE stock_alerts
      ADD CONSTRAINT stock_alerts_status_check
      CHECK (status IN ('low_stock', 'out_of_stock', 'resolved')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_recommendations_status_priority_check') THEN
    ALTER TABLE ai_recommendations
      ADD CONSTRAINT ai_recommendations_status_priority_check
      CHECK (
        recommended_quantity >= 0
        AND priority IN ('low', 'medium', 'high')
        AND status IN ('pending', 'approved', 'rejected')
      ) NOT VALID;
  END IF;
END $$;
