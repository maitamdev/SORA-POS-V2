-- ============================================
-- Sora POS - Performance Optimization Indexes
-- PostgreSQL (Supabase)
-- ============================================

-- 1. Enable pg_trgm extension for ultra-fast ILIKE fuzzy searches
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Products table indexes
-- Barcode index for instant 0ms scanner lookup
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Composite index for POS category filtering and active status
CREATE INDEX IF NOT EXISTS idx_products_active_cat ON products(is_active, category_id);

-- GIN Trigram indexes for fast text search (name, sku, barcode)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_barcode_trgm ON products USING gin (barcode gin_trgm_ops) WHERE barcode IS NOT NULL;

-- 3. Orders table indexes
-- Composite index for status + created_at date filtering (Dashboard, Reports)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- 4. Stock alerts & Customers indexes
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status_created ON stock_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_active_name ON customers(is_active, name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
