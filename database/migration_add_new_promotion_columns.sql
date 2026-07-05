-- ========================================================
-- Migration: Add new promotion columns and update constraints
-- Run this in your Supabase SQL Editor to update the schema
-- without losing existing promotion data.
-- ========================================================

-- 1. Remove old constraints to prevent violations on buy_x_get_y (discount_value = 0)
ALTER TABLE public.promotions 
  DROP CONSTRAINT IF EXISTS promotions_discount_type_check,
  DROP CONSTRAINT IF EXISTS promotions_discount_value_check;

-- 2. Add columns for 7 promotion types if they don't exist
ALTER TABLE public.promotions 
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(25) NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS buy_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS get_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS get_product_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS combo_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nth_item INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS happy_hour_start TIME,
  ADD COLUMN IF NOT EXISTS happy_hour_end TIME,
  ADD COLUMN IF NOT EXISTS bundle_product_ids UUID[] DEFAULT '{}';

-- 3. Apply the updated constraint check for discount_type
ALTER TABLE public.promotions 
  ADD CONSTRAINT promotions_discount_type_check 
  CHECK (discount_type IN (
    'percent', 'fixed_amount', 'buy_x_get_y', 'fixed_price',
    'nth_item_discount', 'happy_hour', 'bundle'
  ));

-- 4. Apply the updated constraint check for discount_value (allow >= 0 for Buy X Get Y)
ALTER TABLE public.promotions 
  ADD CONSTRAINT promotions_discount_value_check 
  CHECK (discount_value >= 0);

-- 5. Reload PostgREST schema cache so API sees the changes immediately
NOTIFY pgrst, 'reload schema';
