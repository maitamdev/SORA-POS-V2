# 🗄️ Database - Sora POS

## Tổng quan

Thư mục này chứa các file SQL để thiết lập cơ sở dữ liệu cho hệ thống Sora POS trên PostgreSQL (Supabase).

## Thứ tự chạy Migration

Hãy đăng nhập vào **SQL Editor** trên Supabase Dashboard và chạy các file SQL theo đúng thứ tự dưới đây:

| Thứ tự | File | Mô tả |
|---|---|---|
| 1 | `schema.sql` | Tạo toàn bộ cấu trúc bảng hệ thống, chỉ mục (indexes), và triggers cập nhật thời gian |
| 2 | `app_settings.sql` | Tạo bảng lưu cấu hình vận hành và hoạt động của cửa hàng |
| 3 | `hardening.sql` | Thêm các ràng buộc dữ liệu an toàn và kích hoạt Row Level Security (RLS) bảo vệ toàn bộ bảng |
| 4 | `enterprise_pos_core.sql` | Đăng ký các hàm xử lý Transaction an toàn (checkout, hủy đơn, nhập kho) và Audit log |
| 5 | `seed.sql` | Khởi tạo dữ liệu mẫu (vai trò thành viên và tài khoản admin mặc định) |

> ⚠️ **Cảnh báo**: Chỉ chạy `seed.sql` khi thiết lập môi trường thử nghiệm hoặc ban đầu. Không chạy trên môi trường production có dữ liệu thực tế vì script này chứa các lệnh xóa dữ liệu cũ.

## Tài khoản mặc định

| Email | Mật khẩu | Vai trò |
|---|---|---|
| admin@sorapos.com | password123 | Admin |

## Sơ đồ quan hệ thực thể (ERD)

Xem chi tiết tại: [docs/database-design.md](../docs/database-design.md)
