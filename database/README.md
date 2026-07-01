# Database - Sora POS

Thu muc nay chua cac file SQL de thiet lap co so du lieu PostgreSQL/Supabase cho Sora POS.

## Thu Tu Chay Migration

Chay cac file trong Supabase SQL Editor theo dung thu tu:

| Thu tu | File | Mo ta |
|---|---|---|
| 1 | `schema.sql` | Tao bang, indexes va triggers co ban |
| 2 | `app_settings.sql` | Tao cau hinh van hanh cua cua hang |
| 3 | `order_details_cost_snapshot.sql` | Bo sung gia von tai thoi diem ban de bao cao loi nhuan qua khu chinh xac |
| 4 | `ai_revenue_analyses.sql` | Tao bang luu lich su phan tich doanh thu AI |
| 5 | `hardening.sql` | Them rang buoc du lieu va bat Row Level Security |
| 6 | `enterprise_pos_core.sql` | Tao RPC transaction cho checkout, huy don, nhap kho va audit log |
| 7 | `stock_atomic_rpc.sql` | Tao RPC thao tac kho atomic |
| 8 | `expiry_setup.sql` | Tao bang/chuc nang quan ly lo hang va han su dung neu can |
| 9 | `seed.sql` | Du lieu mau, chi dung cho demo/database moi |

## Luu Y

- Khong chay `seed.sql` tren database dang co du lieu that vi file nay co the xoa/ghi de du lieu mau.
- Backend dung `SUPABASE_SERVICE_ROLE_KEY` de thuc hien CRUD qua Express API.
- Frontend chi nen dung Supabase anon key cho Realtime/subscription, khong CRUD truc tiep.
- Sau khi them migration moi, cap nhat ca `schema.sql` va file migration rieng de ho tro database moi lan database dang ton tai.

## Tai Khoan Demo

| Email | Mat khau | Vai tro |
|---|---|---|
| `admin@sorapos.com` | `password123` | Admin |

Mat khau demo chi dung cho moi truong thuyet trinh/kiem thu. Khi dua len production can doi ngay tai khoan mac dinh.
