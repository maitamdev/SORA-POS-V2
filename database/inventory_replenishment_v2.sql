-- SORA POS: enterprise replenishment policy and incoming purchase order support.
-- Run after database/schema.sql. The backend keeps a safe fallback until this migration is applied.

CREATE TABLE IF NOT EXISTS public.product_supply_policies (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  lead_time_days INTEGER NOT NULL DEFAULT 3 CHECK (lead_time_days BETWEEN 0 AND 90),
  safety_stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (safety_stock_qty >= 0),
  target_cover_days INTEGER NOT NULL DEFAULT 14 CHECK (target_cover_days BETWEEN 1 AND 90),
  review_period_days INTEGER NOT NULL DEFAULT 7 CHECK (review_period_days BETWEEN 1 AND 90),
  service_level NUMERIC(5, 4) NOT NULL DEFAULT 0.9500 CHECK (service_level >= 0.8 AND service_level < 1),
  moq INTEGER NOT NULL DEFAULT 1 CHECK (moq > 0),
  order_multiple INTEGER NOT NULL DEFAULT 1 CHECK (order_multiple > 0),
  min_shelf_life_days INTEGER NOT NULL DEFAULT 0 CHECK (min_shelf_life_days >= 0),
  is_auto_replenishable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'in_transit', 'partially_received', 'received', 'cancelled')),
  expected_at TIMESTAMPTZ,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  note TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= quantity),
  unit_cost NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_order_id, product_id)
);

ALTER TABLE public.ai_recommendations
  ADD COLUMN IF NOT EXISTS engine_version VARCHAR(40),
  ADD COLUMN IF NOT EXISTS forecast_confidence VARCHAR(10),
  ADD COLUMN IF NOT EXISTS inventory_position INTEGER,
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER,
  ADD COLUMN IF NOT EXISTS reorder_point INTEGER,
  ADD COLUMN IF NOT EXISTS safety_stock INTEGER,
  ADD COLUMN IF NOT EXISTS incoming_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS data_quality VARCHAR(30),
  ADD COLUMN IF NOT EXISTS snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_product_supply_policies_updated_at
  ON public.product_supply_policies(updated_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_expected_at
  ON public.purchase_orders(status, expected_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id
  ON public.purchase_order_items(product_id);

-- These tables are accessed through the authenticated backend service role.
-- Keep direct anonymous Supabase access denied by default.
ALTER TABLE public.product_supply_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

INSERT INTO public.product_supply_policies(product_id)
SELECT id
FROM public.products
WHERE is_active = TRUE
ON CONFLICT (product_id) DO NOTHING;

DROP TRIGGER IF EXISTS update_product_supply_policies_updated_at ON public.product_supply_policies;
CREATE TRIGGER update_product_supply_policies_updated_at
  BEFORE UPDATE ON public.product_supply_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
