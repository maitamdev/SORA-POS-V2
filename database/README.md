# 🗄️ Database - Sora POS

## Tổng quan

Thư mục này chứa các file SQL để thiết lập cơ sở dữ liệu cho hệ thống Sora POS.

## Files

| File | Mô tả |
|------|-------|
| `schema.sql` | Tạo tất cả bảng, indexes, triggers (12 bảng) |
| `seed.sql` | Dữ liệu khởi tạo ban đầu (3 roles + 1 admin) |
| `app_settings.sql` | Bảng cấu hình vận hành cửa hàng |
| `shift_sessions.sql` | Migration bổ sung ca làm nếu đang dùng schema cũ |
| `hardening.sql` | Ràng buộc bảo vệ dữ liệu và unique barcode |
| `enterprise_pos_core.sql` | Transaction tạo/hủy hóa đơn, audit log, loyalty delta cho POS doanh nghiệp |

> Lưu ý: `seed.sql` là script reset/demo và có `DELETE FROM` nhiều bảng. Không chạy file này trên database production đang có dữ liệu thật.

## Cách sử dụng

### Bước 1: Tạo project trên Supabase
1. Truy cập [supabase.com](https://supabase.com)
2. Tạo organization mới (nếu chưa có)
3. Tạo project mới, chọn region gần nhất (Singapore)
4. Đợi project khởi tạo xong (~2 phút)

### Bước 2: Chạy Schema
1. Vào **SQL Editor** trên Supabase Dashboard
2. Dán toàn bộ nội dung file `schema.sql`
3. Nhấn **Run** để tạo tất cả bảng

### Bước 3: Chạy migration vận hành
1. Chạy `app_settings.sql` để tạo bảng cấu hình vận hành
2. Chạy `hardening.sql` để thêm ràng buộc dữ liệu an toàn
3. Chạy `enterprise_pos_core.sql` để bật transaction checkout/cancel và audit log

### Bước 4: Chạy Seed Data
1. Vẫn trong **SQL Editor**
2. Dán toàn bộ nội dung file `seed.sql`
3. Nhấn **Run** để thêm dữ liệu mẫu
4. Chỉ chạy seed trên database mới/demo vì script này có xóa dữ liệu cũ

### Bước 5: Lấy Connection Info
Vào **Settings > API** để lấy:
- `SUPABASE_URL` (Project URL)
- `SUPABASE_ANON_KEY` (anon public key)
- `SUPABASE_SERVICE_ROLE_KEY` (service_role secret key)

## Tài khoản mặc định

| Email | Mật khẩu | Vai trò |
|-------|-----------|---------|
| admin@sorapos.com | password123 | Admin |

## Sơ đồ quan hệ (ERD)

Xem chi tiết tại: [docs/database-design.md](../docs/database-design.md)

```
roles ──1:N──> users ──1:N──> orders ──1:N──> order_details
                  │                      └──1:N──> payments
                  └──1:N──> stock_transactions

categories ──1:N──> products ──1:N──> order_details
suppliers  ──1:N──>     │      └──1:N──> stock_transactions
                        ├──1:N──> stock_alerts
                        └──1:N──> ai_recommendations

customers ──1:N──> orders
```
