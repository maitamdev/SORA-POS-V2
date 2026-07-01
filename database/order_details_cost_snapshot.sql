-- Add cost price snapshot to order details for accurate historical COGS/profit reports.
-- Run once before/with enterprise_pos_core.sql updates.

ALTER TABLE public.order_details
  ADD COLUMN IF NOT EXISTS cost_price numeric(15, 2) NOT NULL DEFAULT 0;

UPDATE public.order_details od
SET cost_price = COALESCE(p.cost_price, 0)
FROM public.products p
WHERE od.product_id = p.id
  AND COALESCE(od.cost_price, 0) = 0;
