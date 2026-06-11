-- ======================================================
-- 1. BẢNG PHIẾU NHẬP KHO (goods_receipts)
-- ======================================================
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

-- ======================================================
-- 2. BẢNG CHI TIẾT PHIẾU NHẬP KHO (goods_receipt_details)
-- ======================================================
CREATE TABLE IF NOT EXISTS goods_receipt_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),                  -- Số lượng nhập
  unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),      -- Giá nhập của mặt hàng đó
  subtotal DECIMAL(15, 2) NOT NULL,                                -- Thành tiền = quantity * unit_price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ======================================================
-- 3. TRIGGER CẬP NHẬT THỜI GIAN CHỈNH SỬA (updated_at)
-- ======================================================
CREATE TRIGGER update_goods_receipts_updated_at 
BEFORE UPDATE ON goods_receipts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ======================================================
-- 4. TẠO CÁC CHỈ MỤC (INDEXES) TỐI ƯU TRUY VẤN
-- ======================================================
CREATE INDEX IF NOT EXISTS idx_goods_receipts_supplier_id ON goods_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_user_id ON goods_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_receipt_number ON goods_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_details_receipt_id ON goods_receipt_details(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipt_details_product_id ON goods_receipt_details(product_id);
