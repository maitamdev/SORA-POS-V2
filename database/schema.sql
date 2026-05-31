-- ============================================
-- Sora POS - Database Schema
-- PostgreSQL (Supabase)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ROLES
-- ============================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL, -- admin, manager, cashier
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. USERS
-- ============================================
CREATE TABLE users (
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
CREATE TABLE categories (
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
CREATE TABLE suppliers (
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
CREATE TABLE products (
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
CREATE TABLE customers (
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
-- 7. ORDERS (Hóa đơn)
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,      -- Mã hóa đơn: ORD-20240101-001
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),    -- Nhân viên tạo hóa đơn
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,     -- Tổng tiền trước giảm giá
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,  -- Số tiền giảm giá
  final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,     -- Tổng tiền sau giảm giá
  status VARCHAR(20) NOT NULL DEFAULT 'completed',     -- completed, cancelled, refunded
  payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',  -- paid, unpaid, partial
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. ORDER DETAILS (Chi tiết hóa đơn)
-- ============================================
CREATE TABLE order_details (
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
-- 9. PAYMENTS (Thanh toán)
-- ============================================
CREATE TABLE payments (
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
-- 10. STOCK TRANSACTIONS (Giao dịch kho)
-- ============================================
CREATE TABLE stock_transactions (
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
-- 11. STOCK ALERTS (Cảnh báo tồn kho)
-- ============================================
CREATE TABLE stock_alerts (
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
-- 12. AI RECOMMENDATIONS (Gợi ý nhập hàng AI)
-- ============================================
CREATE TABLE ai_recommendations (
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
-- INDEXES
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_details_order_id ON order_details(order_id);
CREATE INDEX idx_order_details_product_id ON order_details(product_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX idx_stock_transactions_type ON stock_transactions(type);
CREATE INDEX idx_stock_alerts_product_id ON stock_alerts(product_id);
CREATE INDEX idx_stock_alerts_status ON stock_alerts(status);
CREATE INDEX idx_ai_recommendations_product_id ON ai_recommendations(product_id);

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
CREATE TRIGGER update_stock_alerts_updated_at BEFORE UPDATE ON stock_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_recommendations_updated_at BEFORE UPDATE ON ai_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
