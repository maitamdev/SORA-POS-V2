# Bang Chuc Nang - Thuat Toan - API - CSDL

Tai lieu nay dung de tra nhanh khi thuyet trinh. Moi module gom: muc dich, file code, API, bang CSDL, thuat toan/nghiep vu va y nghia.

---

## 1. Dang Nhap Va Phan Quyen

| Muc | Noi dung |
|---|---|
| Muc dich | Cho nguoi dung dang nhap va truy cap dung vai tro |
| Vai tro | Admin, manager, cashier |
| Frontend | `LoginPage.tsx`, `auth.store.ts`, `ProtectedRoute.tsx`, `api.ts` |
| Backend | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.middleware.ts`, `role.middleware.ts` |
| Database | `users`, `roles` |
| API | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Cong nghe | JWT, bcrypt, Zod, Zustand |

### Thuat toan/logic

```txt
Input: email/password
1. Validate request bang Zod.
2. Tim user theo email.
3. Kiem tra user active.
4. So sanh password bang bcrypt.compare.
5. Tao JWT bang jwt.sign.
6. Frontend luu token va user.
7. Moi request sau do gan Bearer token.
```

### Y nghia

Dam bao nguoi dung phai dang nhap moi vao duoc he thong. Role duoc dung de han che chuc nang, vi du cashier khong duoc xem bao cao doanh thu.

---

## 2. Quan Ly San Pham

| Muc | Noi dung |
|---|---|
| Muc dich | Quan ly mat hang ban trong POS |
| Frontend | `ProductsPage.tsx`, `catalog.api.ts` |
| Backend | `catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts`, `catalog.validation.ts` |
| Database | `products`, `categories`, `suppliers`, `stock_alerts` |
| API | `GET /products`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `POST /products/bulk` |
| Cong nghe | CRUD REST, Zod, Supabase query, soft delete |

### Logic

- SKU la ma quan ly san pham.
- Barcode dung de quet tai POS.
- `cost_price` la gia von hien tai.
- `sell_price` la gia ban.
- `stock_quantity` la ton kho.
- `min_stock_level` la nguong canh bao.
- Khi xoa san pham, he thong nen de inactive thay vi xoa du lieu lich su.

### Y nghia

San pham la du lieu trung tam cua he thong. Don hang, kho, bao cao, AI goi y deu phu thuoc vao san pham.

---

## 3. Quan Ly Danh Muc

| Muc | Noi dung |
|---|---|
| Muc dich | Phan nhom san pham de tim kiem, bao cao category sales |
| Frontend | `CategoriesPage.tsx` |
| Backend | `catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts` |
| Database | `categories`, `products` |
| API | `GET /categories`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` |
| Cong nghe | CRUD, relation product-category |

### Logic

Moi san pham co the thuoc mot danh muc. Bao cao doanh thu theo danh muc gom doanh thu order_details theo product category.

---

## 4. Quan Ly Khach Hang

| Muc | Noi dung |
|---|---|
| Muc dich | Luu thong tin khach, diem tich luy, lich su mua |
| Frontend | `CustomersPage.tsx`, `CartPanel.tsx` |
| Backend | `catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts` |
| Database | `customers`, `orders` |
| API | `GET /customers`, `POST /customers`, `PUT /customers/:id`, `DELETE /customers/:id` |
| Cong nghe | CRUD, loyalty point |

### Thuat toan diem tich luy

Trong RPC checkout:

```txt
points_discount = used_points * 1000
points_earned = floor(final_amount / 10000)
customer.points = current_points - used_points + points_earned
customer.total_spent += final_amount
```

### Y nghia

Giup cua hang cham soc khach hang, ap dung loyalty program va xem khach hang than thiet.

---

## 5. Quan Ly Nha Cung Cap

| Muc | Noi dung |
|---|---|
| Muc dich | Luu nha cung cap cho san pham va nhap kho |
| Frontend | `SuppliersPage.tsx` |
| Backend | `catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts` |
| Database | `suppliers`, `products`, `goods_receipts` |
| API | `GET /suppliers`, `POST /suppliers`, `PUT /suppliers/:id`, `DELETE /suppliers/:id` |
| Role | Admin, manager |

### Y nghia

Quan ly nguon hang, ho tro nhap kho va truy xuat nha cung cap.

---

## 6. Ban Hang POS

| Muc | Noi dung |
|---|---|
| Muc dich | Ban hang tai quay nhanh va chinh xac |
| Frontend | `POSPage.tsx`, `CartPanel.tsx`, `ProductGrid.tsx`, POS hooks |
| Backend | `order.routes.ts`, `order.controller.ts`, `order.service.ts` |
| Database | `orders`, `order_details`, `payments`, `products`, `stock_transactions`, `customers` |
| API | `POST /orders` |
| SQL | `create_pos_order` trong `enterprise_pos_core.sql` |
| Cong nghe | Transaction SQL, row lock, idempotency |

### Thuat toan checkout

```txt
Input: customer_id, payment, items
1. Kiem tra user active va role.
2. Kiem tra cashier co ca dang check-in neu la cashier.
3. Kiem tra client_order_number de tranh tao trung don.
4. Gom san pham trung nhau thanh so luong tong.
5. Lock rows products FOR UPDATE.
6. Kiem tra san pham active va du ton.
7. Tinh total_amount.
8. Tinh discount, diem dung, final_amount.
9. Tao order.
10. Tao order_details, luu product_name, unit_price, cost_price snapshot.
11. Tao payment.
12. Tru stock_quantity.
13. Tao stock_transactions.
14. Sync stock_alert.
15. Cap nhat diem khach hang.
16. Ghi audit log.
```

### Y nghia

Day la luong cot loi cua POS. Viec dua vao transaction database giup du lieu nhat quan, khong bi lech ton kho/hoa don/thanh toan.

---

## 7. Huy Hoa Don

| Muc | Noi dung |
|---|---|
| Muc dich | Huy don nhung van giu lich su |
| Frontend | `OrdersPage.tsx` |
| Backend | `order.routes.ts`, `order.controller.ts`, `order.service.ts` |
| Database | `orders`, `payments`, `products`, `stock_transactions`, `audit_logs` |
| API | `PATCH /orders/:id/cancel` |
| SQL | `cancel_pos_order` |

### Logic

- Chi admin/manager duoc huy.
- Khong xoa order, chi doi `status = cancelled`.
- Payment doi `refunded`.
- Neu restock thi cong lai ton kho.
- Ghi stock transaction type `return`.
- Ghi audit log.

### Y nghia

Day la cach lam dung doanh nghiep: bao toan lich su, tranh xoa du lieu quan trong.

---

## 8. Thanh Toan Tien Mat, Chuyen Khoan, PayOS/VietQR

| Muc | Noi dung |
|---|---|
| Muc dich | Ho tro nhieu phuong thuc thanh toan |
| Frontend | `CashPaymentModal.tsx`, `TransferPaymentModal.tsx`, `vietqr.ts` |
| Backend | `payos.routes.ts`, `payos.service.ts`, SQL payment insert |
| Database | `payments`, `orders` |
| API | `/payos/create`, `/payos/status/:orderCode`, `/payos/webhook` |

### Logic tien mat

```txt
if received_amount < final_amount => khong cho thanh toan
change_amount = received_amount - final_amount
```

### Logic chuyen khoan

- Co the tao QR VietQR tinh.
- Neu co PayOS config, tao payment link/QR.
- Webhook PayOS xac minh giao dich.

---

## 9. Quan Ly Ton Kho

| Muc | Noi dung |
|---|---|
| Muc dich | Theo doi va dieu chinh ton kho |
| Frontend | `StockPage.tsx`, `stock.api.ts` |
| Backend | `stock.routes.ts`, `stock.controller.ts`, `stock.service.ts` |
| Database | `products`, `stock_transactions`, `stock_alerts` |
| API | `GET /stock/inventory`, `GET /stock/alerts`, `POST /stock/import`, `POST /stock/adjust` |

### Logic canh bao ton kho

```txt
if stock_quantity <= 0 => out_of_stock
else if stock_quantity <= min_stock_level => low_stock
else => resolved/no alert
```

### Y nghia

Quan ly ton kho giup cua hang tranh het hang, tranh ban am kho, va co lich su moi lan thay doi.

---

## 10. Nhap Kho

| Muc | Noi dung |
|---|---|
| Muc dich | Tao phieu nhap va cong ton kho |
| Frontend | `CreateReceiptPage.tsx`, `ReceiptListPage.tsx` |
| Backend | `goodsReceipt.routes.ts`, `goodsReceipt.controller.ts`, `goodsReceipt.service.ts` |
| Database | `goods_receipts`, `goods_receipt_details`, `products`, `stock_transactions` |
| API | `POST /stock/receipts`, `GET /stock/receipts` |
| SQL | `create_goods_receipt` |

### Logic

```txt
total_amount = sum(quantity * unit_price)
payment_status =
  paid if paid_amount >= total_amount
  partial if paid_amount > 0
  unpaid otherwise
stock_quantity = stock_quantity + quantity
cost_price = unit_price moi nhat
```

---

## 11. Ca Lam

| Muc | Noi dung |
|---|---|
| Muc dich | Quan ly thu ngan theo ca va doi soat tien |
| Frontend | `ShiftsPage.tsx`, `MyShiftPage.tsx`, `ShiftGuard.tsx` |
| Backend | `shift.routes.ts`, `shift.controller.ts`, `shift.service.ts` |
| Database | `shift_sessions`, `cash_drawer_transactions`, `orders` |
| API | `/shifts`, `/shifts/active/check-in`, `/shifts/active/close` |

### Logic doi soat tien

```txt
expected_cash = opening_cash + cash_sales + cash_in - cash_out
cash_difference = closing_cash - expected_cash
```

### Y nghia

Giu ky luat thu ngan, biet ca nao ban duoc bao nhieu va co lech tien khong.

---

## 12. Dashboard

| Muc | Noi dung |
|---|---|
| Muc dich | Xem nhanh tinh hinh kinh doanh |
| Frontend | `DashboardPage.tsx` |
| Backend | `report.routes.ts`, `report.controller.ts`, `report.service.ts` |
| Database | `orders`, `order_details`, `payments`, `stock_alerts`, `products` |
| API | `GET /reports/dashboard` |

### Chi so

- Doanh thu hom nay.
- Tang truong so voi hom qua.
- Don hang hom nay.
- San pham da ban.
- COGS, profit.
- Canh bao ton kho.
- Recent orders.
- Top products.

---

## 13. Bao Cao Doanh Thu

| Muc | Noi dung |
|---|---|
| Muc dich | Phan tich doanh thu theo ngay/khoang thoi gian |
| Frontend | `ReportsPage.tsx` |
| Backend | `ReportService.revenue`, `ReportService.topProducts` |
| Database | `orders`, `order_details`, `products` |
| API | `GET /reports/revenue`, `GET /reports/top-products` |

### Thuat toan bucket theo ngay

```txt
1. Tao map ngay tu fromDate den endDate.
2. Lay orders completed trong khoang.
3. Lay order_details va cost_price snapshot.
4. Voi moi order:
   key = local date
   bucket.revenue += final_amount
   bucket.orders += 1
   bucket.cogs += sum(quantity * cost_price)
   bucket.profit = revenue - cogs
5. Tra ve array buckets.
```

---

## 14. AI Phan Tich Doanh Thu

| Muc | Noi dung |
|---|---|
| Muc dich | Tao bao cao phan tich kinh doanh tu dong |
| Frontend | `ReportsPage.tsx`, `report.api.ts` |
| Backend | `ReportService.aiAnalysis` |
| Database | `ai_revenue_analyses`, `orders`, `order_details`, `payments` |
| API | `POST /reports/ai-analysis`, `GET /reports/ai-analysis/history`, `GET /reports/ai-analysis/:id` |
| Cong nghe | Groq AI, JSONB, prompt engineering |

### Logic

```txt
1. Lay revenue trend.
2. Lay top products.
3. Lay category sales.
4. Lay payment stats.
5. Tinh metric: totalRevenue, totalCogs, totalProfit, margin, AOV, volatility, WoW growth.
6. Tao system prompt yeu cau AI tra ve JSON.
7. Goi Groq API.
8. Parse JSON.
9. Luu vao ai_revenue_analyses.
10. Frontend hien va cho mo lai lich su.
```

### Y nghia

Giup chu cua hang khong chi xem so lieu, ma co phan tich va khuyen nghi hanh dong.

---

## 15. AI Goi Y Nhap Hang

| Muc | Noi dung |
|---|---|
| Muc dich | Goi y san pham can nhap va so luong nen nhap |
| Frontend | `AIRecommendationsPage.tsx` |
| Backend | `ai.routes.ts`, `ai.controller.ts`, `ai.service.ts` |
| Database | `products`, `orders`, `order_details`, `ai_recommendations` |
| API | `GET /ai/restock-analysis`, `POST /ai/recommend-restock` |

### Thuat toan

```txt
speed30d = quantity sold last 30 days / 30
speed7d = quantity sold last 7 days / 7
trend = compare speed7d with speed30d
stock_days = current_stock / speed30d
target_stock = speed30d * target_days
recommended_quantity = max(target_stock - current_stock, 0)
priority:
  high if out of stock or stock_days very low
  medium if low stock
  low otherwise
```

---

## 16. Offline POS

| Muc | Noi dung |
|---|---|
| Muc dich | Ho tro ban hang khi mat mang |
| Frontend | `offlineDB.ts`, `offlineSync.ts`, `usePOSProducts.ts`, `usePOSCheckout.ts`, `NetworkStatusBar.tsx` |
| Backend | `order.routes.ts`, `order.service.ts` |
| Database local | IndexedDB |
| Database server | PostgreSQL |

### Logic

```txt
Online:
  sync products/categories/customers ve IndexedDB

Offline:
  doc san pham tu IndexedDB
  tao pending order
  tru ton local tam thoi

Online lai:
  gui pending order len API
  neu thanh cong xoa pending
  neu loi danh dau failed
```

### Y nghia

Tang kha nang van hanh khi mang khong on dinh, phu hop cua hang ban le.

---

## 17. Scanner Ma Vach

| Muc | Noi dung |
|---|---|
| Muc dich | Quet barcode tu thiet bi khac va day vao POS |
| Frontend POS | `useBarcodeScanner.ts`, `PairingModal.tsx` |
| Scanner | `sora-scanner/src/supabase.ts`, `sora-scanner/App.tsx` |
| Cong nghe | Supabase Realtime |

### Logic

```txt
1. POS tao pairing code/channel.
2. Scanner ket noi cung channel.
3. Scanner quet barcode va publish event.
4. POS lang nghe event va them/tim san pham.
```

---

## 18. Audit Log

| Muc | Noi dung |
|---|---|
| Muc dich | Luu vet hanh dong quan trong |
| Frontend | `AuditLogsPage.tsx` |
| Backend | `audit.routes.ts`, `audit.controller.ts`, `audit.service.ts` |
| Database | `audit_logs` |
| SQL | `write_audit_log` |

### Y nghia

Trong he thong doanh nghiep, cac thao tac nhu tao/huy don, nhap kho, dieu chinh kho can co lich su de truy vet.

---

## 19. Settings

| Muc | Noi dung |
|---|---|
| Muc dich | Cau hinh cach cua hang van hanh |
| Frontend | `SettingsPage.tsx` |
| Backend | `settings.routes.ts`, `settings.controller.ts`, `settings.service.ts` |
| Database | `app_settings` |
| API | `GET /settings/operation`, `PUT /settings/operation` |

### Vi du setting anh huong nghiep vu

- `allowSellOutOfStock`: co cho ban qua ton hay khong.
- `allowDiscount`: co cho giam gia hay khong.
- `maxDiscountPercent`: giam gia toi da.
- `defaultMinStockLevel`: nguong ton thap mac dinh.
- `bankBin`, `bankAccountNumber`, `bankAccountName`: tao VietQR.

---

## 20. Tong Hop Chuc Nang Theo Vai Tro

| Chuc nang | Admin | Manager | Cashier |
|---|---:|---:|---:|
| Dashboard | Co | Co | Khong |
| POS ban hang | Co | Co | Co |
| San pham | Co | Co | Xem |
| Danh muc | Co | Co | Khong |
| Hoa don | Co | Co | Don cua minh |
| Huy hoa don | Co | Co | Khong |
| Kho | Co | Co | Xem/canh bao |
| Nhap kho | Co | Co | Khong |
| Khach hang | Co | Co | Co |
| Nha cung cap | Co | Co | Khong |
| Nhan vien | Co | Han che theo backend hien tai | Khong |
| Ca lam | Co | Co | Ca cua minh |
| Bao cao | Co | Co | Khong |
| AI | Co | Co | Khong |
| Settings | Co | Khong | Khong |
| Audit log | Co | Co | Khong |

