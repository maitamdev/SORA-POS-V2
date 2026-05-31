# 🗄️ Thiết Kế Cơ Sở Dữ Liệu - Sora POS

**Phiên bản:** 1.0  
**Hệ quản trị CSDL:** PostgreSQL (Supabase)  
**Ngày tạo:** 31/05/2026  

---

## 1. Tổng Quan

Cơ sở dữ liệu Sora POS gồm **12 bảng** được thiết kế theo chuẩn **3NF (Third Normal Form)**, sử dụng **UUID** làm khóa chính để đảm bảo tính duy nhất và hỗ trợ phân tán dữ liệu.

### Danh sách bảng

| STT | Tên bảng | Mô tả | Số cột |
|-----|----------|-------|--------|
| 1 | `roles` | Vai trò người dùng | 5 |
| 2 | `users` | Tài khoản người dùng | 11 |
| 3 | `categories` | Danh mục sản phẩm | 7 |
| 4 | `suppliers` | Nhà cung cấp | 9 |
| 5 | `products` | Sản phẩm | 15 |
| 6 | `customers` | Khách hàng | 9 |
| 7 | `orders` | Hóa đơn | 11 |
| 8 | `order_details` | Chi tiết hóa đơn | 8 |
| 9 | `payments` | Thanh toán | 8 |
| 10 | `stock_transactions` | Giao dịch kho | 9 |
| 11 | `stock_alerts` | Cảnh báo tồn kho | 8 |
| 12 | `ai_recommendations` | Gợi ý nhập hàng AI | 12 |

---

## 2. Entity Relationship Diagram (ERD)

```
┌──────────────┐
│    roles     │
│──────────────│
│ PK id (UUID) │
│    name      │        ┌───────────────────┐
│    description│       │      users        │
│    created_at│        │───────────────────│
│    updated_at│◄───────│ PK id (UUID)      │
└──────────────┘   1:N  │    email          │
                        │    password_hash   │
                        │    full_name       │
                        │    phone           │
                        │    avatar_url      │
                        │ FK role_id ────────│──► roles.id
                        │    is_active       │
                        │    last_login      │
                        │    created_at      │
                        │    updated_at      │
                        └────────┬──────────┘
                                 │
                    ┌────────────┼────────────────────┐
                    │            │                     │
                    ▼ 1:N        ▼ 1:N                ▼ 1:N
          ┌─────────────┐  ┌──────────────┐   ┌───────────────────┐
          │   orders    │  │stock_trans.  │   │ai_recommendations │
          │─────────────│  │──────────────│   │───────────────────│
          │ PK id       │  │ PK id        │   │ PK id             │
          │ order_number│  │ FK product_id│   │ FK product_id     │
          │ FK customer │  │    type      │   │    current_stock  │
          │ FK user_id──│  │    quantity  │   │    avg_daily_sales│
          │ total_amount│  │ prev_stock   │   │    recommended_qty│
          │ discount    │  │ new_stock    │   │    priority       │
          │ final_amount│  │ reference_id │   │    reason         │
          │    status   │  │    note      │   │    ai_insight     │
          │ payment_stat│  │ FK user_id   │   │    status         │
          │    note     │  │ created_at   │   │ FK created_by     │
          │ created_at  │  └──────────────┘   │ created_at        │
          │ updated_at  │                     │ updated_at        │
          └──────┬──────┘                     └───────────────────┘
                 │
          ┌──────┼──────┐
          │             │
          ▼ 1:N         ▼ 1:N
  ┌───────────────┐  ┌──────────────┐
  │order_details  │  │  payments    │
  │───────────────│  │──────────────│
  │ PK id         │  │ PK id        │
  │ FK order_id   │  │ FK order_id  │
  │ FK product_id │  │    method    │
  │ product_name  │  │    amount    │
  │    quantity   │  │ received_amt │
  │    unit_price │  │ change_amt   │
  │    discount   │  │ reference    │
  │    subtotal   │  │    status    │
  │ created_at    │  │ created_at   │
  └───────────────┘  └──────────────┘


┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  categories  │     │    products      │     │   suppliers      │
│──────────────│     │──────────────────│     │──────────────────│
│ PK id (UUID) │◄────│ PK id (UUID)     │────►│ PK id (UUID)     │
│    name      │ 1:N │    sku           │ N:1 │    name          │
│ description  │     │    barcode       │     │ contact_person   │
│    image_url │     │    name          │     │    email         │
│    is_active │     │    description   │     │    phone         │
│ created_at   │     │ FK category_id──│     │    address       │
│ updated_at   │     │ FK supplier_id──│     │    tax_code      │
└──────────────┘     │    cost_price    │     │    is_active     │
                     │    sell_price    │     │ created_at       │
┌──────────────┐     │ stock_quantity   │     │ updated_at       │
│  customers   │     │ min_stock_level  │     └──────────────────┘
│──────────────│     │    unit          │
│ PK id (UUID) │     │    image_url     │     ┌──────────────────┐
│    name      │     │    is_active     │     │  stock_alerts    │
│    email     │     │ created_at       │     │──────────────────│
│    phone     │     │ updated_at       │     │ PK id            │
│    address   │     └──────────────────┘     │ FK product_id    │
│    points    │                               │ current_stock    │
│ total_spent  │                               │ min_stock_level  │
│    is_active │                               │    status        │
│ created_at   │                               │ resolved_at      │
│ updated_at   │                               │ FK resolved_by   │
└──────────────┘                               │ created_at       │
                                               │ updated_at       │
                                               └──────────────────┘
```

---

## 3. Mối Quan Hệ Giữa Các Bảng

| Quan hệ | Kiểu | Mô tả |
|----------|------|-------|
| `roles` → `users` | 1:N | Một vai trò có nhiều người dùng |
| `users` → `orders` | 1:N | Một nhân viên tạo nhiều hóa đơn |
| `users` → `stock_transactions` | 1:N | Một nhân viên thực hiện nhiều giao dịch kho |
| `categories` → `products` | 1:N | Một danh mục chứa nhiều sản phẩm |
| `suppliers` → `products` | 1:N | Một NCC cung cấp nhiều sản phẩm |
| `customers` → `orders` | 1:N | Một khách hàng có nhiều hóa đơn |
| `orders` → `order_details` | 1:N | Một hóa đơn có nhiều chi tiết |
| `orders` → `payments` | 1:N | Một hóa đơn có nhiều lần thanh toán |
| `products` → `order_details` | 1:N | Một SP xuất hiện trong nhiều hóa đơn |
| `products` → `stock_transactions` | 1:N | Một SP có nhiều giao dịch kho |
| `products` → `stock_alerts` | 1:N | Một SP có nhiều cảnh báo tồn kho |
| `products` → `ai_recommendations` | 1:N | Một SP có nhiều gợi ý nhập hàng |

---

## 4. Chi Tiết Từng Bảng

### 4.1 Bảng `roles` — Vai trò người dùng

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK, DEFAULT uuid_generate_v4() | Khóa chính |
| `name` | VARCHAR(50) | UNIQUE, NOT NULL | Tên vai trò: admin, manager, cashier |
| `description` | TEXT | | Mô tả vai trò |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.2 Bảng `users` — Tài khoản người dùng

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email đăng nhập |
| `password_hash` | VARCHAR(255) | NOT NULL | Mật khẩu đã băm (bcrypt) |
| `full_name` | VARCHAR(255) | NOT NULL | Họ tên |
| `phone` | VARCHAR(20) | | Số điện thoại |
| `avatar_url` | TEXT | | Ảnh đại diện |
| `role_id` | UUID | FK → roles(id), NOT NULL | Vai trò |
| `is_active` | BOOLEAN | DEFAULT TRUE | Trạng thái hoạt động |
| `last_login` | TIMESTAMPTZ | | Lần đăng nhập cuối |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.3 Bảng `categories` — Danh mục sản phẩm

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `name` | VARCHAR(255) | NOT NULL | Tên danh mục |
| `description` | TEXT | | Mô tả |
| `image_url` | TEXT | | Ảnh danh mục |
| `is_active` | BOOLEAN | DEFAULT TRUE | Trạng thái |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.4 Bảng `suppliers` — Nhà cung cấp

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `name` | VARCHAR(255) | NOT NULL | Tên NCC |
| `contact_person` | VARCHAR(255) | | Người liên hệ |
| `email` | VARCHAR(255) | | Email |
| `phone` | VARCHAR(20) | | SĐT |
| `address` | TEXT | | Địa chỉ |
| `tax_code` | VARCHAR(50) | | Mã số thuế |
| `is_active` | BOOLEAN | DEFAULT TRUE | Trạng thái |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.5 Bảng `products` — Sản phẩm

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `sku` | VARCHAR(100) | UNIQUE, NOT NULL | Mã SKU |
| `barcode` | VARCHAR(100) | | Mã vạch |
| `name` | VARCHAR(255) | NOT NULL | Tên SP |
| `description` | TEXT | | Mô tả |
| `category_id` | UUID | FK → categories(id) | Danh mục |
| `supplier_id` | UUID | FK → suppliers(id) | Nhà cung cấp |
| `cost_price` | DECIMAL(15,2) | NOT NULL, DEFAULT 0 | Giá nhập |
| `sell_price` | DECIMAL(15,2) | NOT NULL, DEFAULT 0 | Giá bán |
| `stock_quantity` | INTEGER | NOT NULL, DEFAULT 0 | Tồn kho |
| `min_stock_level` | INTEGER | NOT NULL, DEFAULT 10 | Ngưỡng cảnh báo |
| `unit` | VARCHAR(50) | DEFAULT 'cái' | Đơn vị tính |
| `image_url` | TEXT | | Ảnh SP |
| `is_active` | BOOLEAN | DEFAULT TRUE | Trạng thái |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.6 Bảng `customers` — Khách hàng

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `name` | VARCHAR(255) | NOT NULL | Tên KH |
| `email` | VARCHAR(255) | | Email |
| `phone` | VARCHAR(20) | | SĐT |
| `address` | TEXT | | Địa chỉ |
| `points` | INTEGER | DEFAULT 0 | Điểm tích lũy |
| `total_spent` | DECIMAL(15,2) | DEFAULT 0 | Tổng chi tiêu |
| `is_active` | BOOLEAN | DEFAULT TRUE | Trạng thái |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.7 Bảng `orders` — Hóa đơn

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `order_number` | VARCHAR(50) | UNIQUE, NOT NULL | Mã hóa đơn: ORD-20240101-001 |
| `customer_id` | UUID | FK → customers(id) | Khách hàng (optional) |
| `user_id` | UUID | FK → users(id), NOT NULL | Nhân viên tạo |
| `total_amount` | DECIMAL(15,2) | NOT NULL, DEFAULT 0 | Tổng tiền gốc |
| `discount_amount` | DECIMAL(15,2) | NOT NULL, DEFAULT 0 | Giảm giá |
| `final_amount` | DECIMAL(15,2) | NOT NULL, DEFAULT 0 | Tổng thanh toán |
| `status` | VARCHAR(20) | DEFAULT 'completed' | completed, cancelled, refunded |
| `payment_status` | VARCHAR(20) | DEFAULT 'paid' | paid, unpaid, partial |
| `note` | TEXT | | Ghi chú |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.8 Bảng `order_details` — Chi tiết hóa đơn

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `order_id` | UUID | FK → orders(id), CASCADE | Hóa đơn |
| `product_id` | UUID | FK → products(id), RESTRICT | Sản phẩm |
| `product_name` | VARCHAR(255) | NOT NULL | Tên SP tại thời điểm mua |
| `quantity` | INTEGER | NOT NULL | Số lượng |
| `unit_price` | DECIMAL(15,2) | NOT NULL | Đơn giá tại thời điểm mua |
| `discount` | DECIMAL(15,2) | DEFAULT 0 | Giảm giá |
| `subtotal` | DECIMAL(15,2) | NOT NULL | quantity × unit_price - discount |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |

### 4.9 Bảng `payments` — Thanh toán

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `order_id` | UUID | FK → orders(id), CASCADE | Hóa đơn |
| `method` | VARCHAR(50) | NOT NULL, DEFAULT 'cash' | cash, card, transfer, momo, zalopay |
| `amount` | DECIMAL(15,2) | NOT NULL | Số tiền thanh toán |
| `received_amount` | DECIMAL(15,2) | DEFAULT 0 | Tiền khách đưa |
| `change_amount` | DECIMAL(15,2) | DEFAULT 0 | Tiền thừa |
| `reference_code` | VARCHAR(100) | | Mã giao dịch |
| `status` | VARCHAR(20) | DEFAULT 'completed' | completed, failed, refunded |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |

### 4.10 Bảng `stock_transactions` — Giao dịch kho

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `product_id` | UUID | FK → products(id), RESTRICT | Sản phẩm |
| `type` | VARCHAR(20) | NOT NULL | import, sale, adjustment, return |
| `quantity` | INTEGER | NOT NULL | Số lượng (+ nhập, - xuất) |
| `previous_stock` | INTEGER | NOT NULL | Tồn trước giao dịch |
| `new_stock` | INTEGER | NOT NULL | Tồn sau giao dịch |
| `reference_id` | UUID | | ID tham chiếu (order/phiếu nhập) |
| `note` | TEXT | | Ghi chú |
| `user_id` | UUID | FK → users(id), NOT NULL | Người thực hiện |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian |

### 4.11 Bảng `stock_alerts` — Cảnh báo tồn kho

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `product_id` | UUID | FK → products(id), CASCADE | Sản phẩm |
| `current_stock` | INTEGER | NOT NULL | Tồn kho hiện tại |
| `min_stock_level` | INTEGER | NOT NULL | Ngưỡng cảnh báo |
| `status` | VARCHAR(20) | DEFAULT 'low_stock' | low_stock, out_of_stock, resolved |
| `resolved_at` | TIMESTAMPTZ | | Thời gian xử lý |
| `resolved_by` | UUID | FK → users(id) | Người xử lý |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

### 4.12 Bảng `ai_recommendations` — Gợi ý nhập hàng AI

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|-----|--------------|-----------|-------|
| `id` | UUID | PK | Khóa chính |
| `product_id` | UUID | FK → products(id), CASCADE | Sản phẩm |
| `current_stock` | INTEGER | NOT NULL | Tồn kho hiện tại |
| `min_stock_level` | INTEGER | NOT NULL | Ngưỡng cảnh báo |
| `average_daily_sales` | DECIMAL(10,2) | NOT NULL | Bán TB/ngày |
| `recommended_quantity` | INTEGER | NOT NULL | SL đề xuất nhập |
| `priority` | VARCHAR(10) | DEFAULT 'medium' | low, medium, high |
| `reason` | TEXT | | Lý do gợi ý |
| `ai_insight` | TEXT | | Phân tích từ AI |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending, approved, rejected |
| `created_by` | UUID | FK → users(id) | Người tạo |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Thời gian cập nhật |

---

## 5. Indexes (Chỉ mục)

| Index | Bảng | Cột | Mục đích |
|-------|------|-----|----------|
| `idx_users_email` | users | email | Tăng tốc tìm kiếm theo email (login) |
| `idx_users_role_id` | users | role_id | Tăng tốc filter theo vai trò |
| `idx_products_sku` | products | sku | Tăng tốc tìm theo mã SKU |
| `idx_products_category_id` | products | category_id | Tăng tốc filter theo danh mục |
| `idx_products_supplier_id` | products | supplier_id | Tăng tốc filter theo NCC |
| `idx_orders_user_id` | orders | user_id | Tăng tốc filter đơn theo NV |
| `idx_orders_customer_id` | orders | customer_id | Tăng tốc filter đơn theo KH |
| `idx_orders_created_at` | orders | created_at | Tăng tốc báo cáo theo ngày |
| `idx_order_details_order_id` | order_details | order_id | Tăng tốc lấy chi tiết đơn |
| `idx_order_details_product_id` | order_details | product_id | Tăng tốc thống kê SP |
| `idx_payments_order_id` | payments | order_id | Tăng tốc lấy thanh toán |
| `idx_stock_transactions_product_id` | stock_transactions | product_id | Tăng tốc lịch sử kho |
| `idx_stock_transactions_type` | stock_transactions | type | Tăng tốc filter loại giao dịch |
| `idx_stock_alerts_product_id` | stock_alerts | product_id | Tăng tốc cảnh báo |
| `idx_stock_alerts_status` | stock_alerts | status | Tăng tốc filter trạng thái |
| `idx_ai_recommendations_product_id` | ai_recommendations | product_id | Tăng tốc gợi ý theo SP |

---

## 6. Triggers

### Auto-update `updated_at`
Tất cả bảng có cột `updated_at` đều có trigger tự động cập nhật giá trị khi record bị UPDATE:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Áp dụng cho: `roles`, `users`, `categories`, `suppliers`, `products`, `customers`, `orders`, `stock_alerts`, `ai_recommendations`.

---

## 7. Quy Ước Đặt Tên

| Loại | Quy ước | Ví dụ |
|------|---------|-------|
| Tên bảng | snake_case, số nhiều | `order_details`, `stock_alerts` |
| Tên cột | snake_case | `created_at`, `full_name` |
| Khóa chính | `id` (UUID) | `id UUID PRIMARY KEY` |
| Khóa ngoại | `<tên_bảng_số_ít>_id` | `category_id`, `user_id` |
| Index | `idx_<bảng>_<cột>` | `idx_products_sku` |
| Trigger | `update_<bảng>_updated_at` | `update_users_updated_at` |
| Timestamp | TIMESTAMPTZ + DEFAULT NOW() | `created_at`, `updated_at` |
