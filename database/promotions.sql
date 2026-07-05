-- ============================================
-- Promotions / Discount Codes
-- Run after database/schema.sql
-- ============================================

-- Drop old table if recreating (comment out in production!)
-- DROP TABLE IF EXISTS public.promotions CASCADE;

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  description TEXT,

  -- ============================================
  -- Discount config — 7 promotion types:
  --
  --   'percent'              → Giảm X% trên đơn/sản phẩm
  --   'fixed_amount'         → Giảm X đồng cố định
  --   'buy_x_get_y'          → Mua X tặng Y (BOGO)
  --   'fixed_price'          → Combo giá cố định (3 SP bất kỳ = 99k)
  --   'nth_item_discount'    → SP thứ N giảm X% (SP thứ 2 giảm 50%)
  --   'happy_hour'           → Khung giờ vàng giảm X%
  --   'bundle'               → Combo SP cụ thể (1 nước + 1 snack = 35k)
  --
  -- ============================================
  discount_type VARCHAR(25) NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN (
      'percent', 'fixed_amount', 'buy_x_get_y', 'fixed_price',
      'nth_item_discount', 'happy_hour', 'bundle'
    )),

  -- For percent/fixed_amount/happy_hour: the discount value (% or đ)
  -- For fixed_price/bundle: the combo price
  -- For buy_x_get_y: not used (set to 0)
  -- For nth_item_discount: the % discount on the Nth item
  discount_value NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),

  max_discount NUMERIC(15, 2),             -- Cap giảm tối đa (cho loại %)
  min_order_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,

  -- ============================================
  -- Buy X Get Y (BOGO) config
  --   VD: Mua 2 tặng 1 → buy_quantity=2, get_quantity=1
  -- ============================================
  buy_quantity INTEGER DEFAULT 0,
  get_quantity INTEGER DEFAULT 0,
  get_product_ids UUID[] DEFAULT '{}',     -- SP tặng (rỗng = tặng SP giá thấp nhất)

  -- ============================================
  -- Fixed Price combo config
  --   VD: Combo 3 SP bất kỳ = 99k → combo_quantity=3, discount_value=99000
  -- ============================================
  combo_quantity INTEGER DEFAULT 0,

  -- ============================================
  -- Nth Item Discount config
  --   VD: SP thứ 2 giảm 50% → nth_item=2, discount_value=50
  --   VD: SP thứ 3 giảm 30% → nth_item=3, discount_value=30
  -- ============================================
  nth_item INTEGER DEFAULT 2,              -- SP thứ mấy được giảm

  -- ============================================
  -- Happy Hour config (khung giờ vàng)
  --   VD: 14:00 - 17:00 giảm 30%
  --   Áp dụng mỗi ngày trong khoảng start_date → end_date
  -- ============================================
  happy_hour_start TIME,                   -- Giờ bắt đầu (VD: '14:00')
  happy_hour_end TIME,                     -- Giờ kết thúc (VD: '17:00')

  -- ============================================
  -- Bundle config (combo SP cụ thể)
  --   VD: 1 Coca + 1 Lays = 35k
  --   bundle_product_ids chứa IDs các SP trong combo
  --   discount_value = giá combo
  -- ============================================
  bundle_product_ids UUID[] DEFAULT '{}',

  -- Scope (for percent, fixed_amount, nth_item_discount, happy_hour)
  apply_to VARCHAR(20) NOT NULL DEFAULT 'all'
    CHECK (apply_to IN ('all', 'category', 'product')),
  apply_to_ids UUID[] NOT NULL DEFAULT '{}',

  -- Validity
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,

  -- Usage limits
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Meta
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_code
  ON public.promotions(code) WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON public.promotions(is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_promotions_created_at
  ON public.promotions(created_at DESC);

DROP TRIGGER IF EXISTS update_promotions_updated_at ON public.promotions;
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
