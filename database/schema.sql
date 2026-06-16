-- ============================================
-- Sora POS - Database Schema
-- PostgreSQL (Supabase)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ROLES
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL, -- admin, manager, cashier
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. SUPPLIERS
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  tax_code VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. PRODUCTS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  barcode VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  cost_price DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Giá nhập
  sell_price DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Giá bán
  stock_quantity INTEGER NOT NULL DEFAULT 0,     -- Tồn kho hiện tại
  min_stock_level INTEGER NOT NULL DEFAULT 10,   -- Ngưỡng cảnh báo tồn kho thấp
  unit VARCHAR(50) DEFAULT 'cái',                -- Đơn vị tính
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. CUSTOMERS
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  points INTEGER DEFAULT 0,          -- Điểm tích lũy
  total_spent DECIMAL(15, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. SHIFT SESSIONS (Ca làm nhân viên)
-- ============================================
CREATE TABLE IF NOT EXISTS shift_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_name VARCHAR(80),
  shift_code VARCHAR(16) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'opened', -- opened, checked_in, closed, cancelled
  opening_cash DECIMAL(15, 2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(15, 2),
  expected_cash DECIMAL(15, 2),
  cash_difference DECIMAL(15, 2),
  note TEXT,
  manager_note TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. ORDERS (Hóa đơn)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,      -- Mã hóa đơn: ORD-20240101-001
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),    -- Nhân viên tạo hóa đơn
  shift_id UUID REFERENCES shift_sessions(id) ON DELETE SET NULL,
  shift_code VARCHAR(16),
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,     -- Tổng tiền trước giảm giá
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,  -- Số tiền giảm giá
  final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,     -- Tổng tiền sau giảm giá
  status VARCHAR(20) NOT NULL DEFAULT 'completed',     -- completed, cancelled, refunded
  payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',  -- paid, unpaid, partial
  note TEXT,
  loyalty_points_used INTEGER NOT NULL DEFAULT 0,
  loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT orders_loyalty_points_check CHECK (loyalty_points_used >= 0 AND loyalty_points_earned >= 0)
);

-- ============================================
-- 9. ORDER DETAILS (Chi tiết hóa đơn)
-- ============================================
CREATE TABLE IF NOT EXISTS order_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,   -- Lưu tên tại thời điểm mua
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,   -- Giá bán tại thời điểm mua
  discount DECIMAL(15, 2) DEFAULT 0,
  subtotal DECIMAL(15, 2) NOT NULL,     -- quantity * unit_price - discount
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. PAYMENTS (Thanh toán)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method VARCHAR(50) NOT NULL DEFAULT 'cash', -- cash, card, transfer, momo, zalopay
  amount DECIMAL(15, 2) NOT NULL,
  received_amount DECIMAL(15, 2) DEFAULT 0,   -- Số tiền khách đưa
  change_amount DECIMAL(15, 2) DEFAULT 0,     -- Tiền thừa
  reference_code VARCHAR(100),                 -- Mã giao dịch (chuyển khoản/ví)
  status VARCHAR(20) DEFAULT 'completed',      -- completed, failed, refunded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 11. CASH DRAWER TRANSACTIONS (Két tiền mặt)
-- ============================================
CREATE TABLE IF NOT EXISTS cash_drawer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shift_sessions(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash_in', 'cash_out')),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. GOODS RECEIPTS (Phiếu nhập kho)
-- ============================================
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,                       -- Mã phiếu: GR-YYYYMMDD-XXXX
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,     -- Nhà cung cấp
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,    -- Người nhập hàng
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,                  -- Tổng tiền hàng nhập
  paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,                   -- Số tiền đã thanh toán trước
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',            -- paid (đã trả), unpaid (chưa trả), partial (trả một phần)
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 13. GOODS RECEIPT DETAILS (Chi tiết phiếu nhập kho)
-- ============================================
CREATE TABLE IF NOT EXISTS goods_receipt_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),                  -- Số lượng nhập
  unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),      -- Giá nhập của mặt hàng đó
  subtotal DECIMAL(15, 2) NOT NULL,                                -- Thành tiền = quantity * unit_price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 14. STOCK TRANSACTIONS (Giao dịch kho)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  type VARCHAR(20) NOT NULL,          -- import, sale, adjustment, return
  quantity INTEGER NOT NULL,          -- Số lượng (dương = nhập, âm = xuất)
  previous_stock INTEGER NOT NULL,    -- Tồn kho trước giao dịch
  new_stock INTEGER NOT NULL,         -- Tồn kho sau giao dịch
  reference_id UUID,                  -- ID hóa đơn hoặc phiếu nhập
  note TEXT,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 15. STOCK ALERTS (Cảnh báo tồn kho)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  current_stock INTEGER NOT NULL,
  min_stock_level INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'low_stock', -- low_stock, out_of_stock, resolved
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 16. AI RECOMMENDATIONS (Gợi ý nhập hàng AI)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  current_stock INTEGER NOT NULL,
  min_stock_level INTEGER NOT NULL,
  average_daily_sales DECIMAL(10, 2) NOT NULL,
  recommended_quantity INTEGER NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium', -- low, medium, high
  reason TEXT,
  ai_insight TEXT,                                  -- Insight từ Groq AI
  status VARCHAR(20) DEFAULT 'pending',            -- pending, approved, rejected
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 17. AUDIT LOGS (Nhật ký kiểm toán)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_shift_code ON orders(shift_code);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_details_order_id ON order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_order_details_product_id ON order_details(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_employee_id ON shift_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_opened_by ON shift_sessions(opened_by);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_shift_date ON shift_sessions(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_status ON shift_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_sessions_employee_active ON shift_sessions(employee_id) WHERE status IN ('opened', 'checked_in');
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_sessions_code_per_day ON shift_sessions(shift_date, shift_code) WHERE status IN ('opened', 'checked_in');
CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_shift_id ON cash_drawer_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_transactions_created_at ON cash_drawer_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_supplier_id ON goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_user_id ON goods_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_receipt_number ON goods_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_details_receipt_id ON goods_receipt_details(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_details_product_id ON goods_receipt_details(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(type);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_product_id ON ai_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- TRIGGERS: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_sessions_updated_at BEFORE UPDATE ON shift_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_alerts_updated_at BEFORE UPDATE ON stock_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_recommendations_updated_at BEFORE UPDATE ON ai_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goods_receipts_updated_at BEFORE UPDATE ON goods_receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
