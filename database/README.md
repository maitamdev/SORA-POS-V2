# Database - Sora POS

Thư mục này chứa các file SQL để thiết lập cơ sở dữ liệu PostgreSQL/Supabase cho Sora POS.

## Thu Tu Chay Migration

Chay cac file trong Supabase SQL Editor theo dung thu tu:

| Thu tu | File | Mo ta |
|---|---|---|
| 1 | `schema.sql` | Tạo bảng, indexes và triggers cơ bản |
| 2 | `app_settings.sql` | Tạo cấu hình vận hành của cửa hàng |
| 3 | `order_details_cost_snapshot.sql` | Bổ sung giá vốn tại thời điểm bán để báo cáo lợi nhuận quá khứ chính xác |
| 4 | `ai_revenue_analyses.sql` | Tạo bảng lưu lịch sử phân tích doanh thu AI |
| 5 | `payment_intents.sql` | Tạo bảng lưu trạng thái thanh toán ngoài hệ thống như PayOS |
| 6 | `hardening.sql` | Thêm ràng buộc dữ liệu và bật Row Level Security |
| 7 | `enterprise_pos_core.sql` | Tạo RPC transaction cho checkout, hủy đơn, nhập kho và audit log |
| 8 | `stock_atomic_rpc.sql` | Tạo RPC thao tác kho atomic |
| 9 | `expiry_setup.sql` | Tạo bảng/chức năng quản lý lô hàng và hạn sử dụng nếu cần |
| 10 | `lot_expiry_upgrade.sql` | Gộp lô trùng, bắt buộc HSD/số lô và cập nhật RPC cho database đang chạy |
| 11 | `inventory_replenishment_v2.sql` | Chính sách lead time, tồn an toàn, MOQ và đơn mua đang về cho engine nhập hàng v2 |
| 12 | `seed.sql` | Du lieu mau, chi dung cho demo/database moi |

## Luu Y

- Không chạy `seed.sql` trên database đang có dữ liệu thật vì file này có thể xóa/ghi đè dữ liệu mẫu.
- Backend dung `SUPABASE_SERVICE_ROLE_KEY` de thuc hien CRUD qua Express API.
- Frontend chỉ nên dùng Supabase anon key cho Realtime/subscription, không CRUD trực tiếp.
- Sau khi thêm migration mới, cập nhật cả `schema.sql` và file migration riêng để hỗ trợ database mới lẫn database đang tồn tại.

## Tai Khoan Demo

| Email | Mat khau | Vai tro |
|---|---|---|
| `admin@sorapos.com` | `password123` | Admin |

Mật khẩu demo chỉ dùng cho môi trường thuyết trình/kiểm thử. Khi đưa lên production cần đổi ngay tài khoản mặc định.


# Khởi Tạo Database Sora POS (PostgreSQL/Supabase)
