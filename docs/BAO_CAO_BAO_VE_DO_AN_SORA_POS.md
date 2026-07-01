# Bao Cao Tong Hop Bao Ve Do An - Sora POS V2

Tai lieu nay dung de hoc thuyet trinh va tra loi khi bao ve do an. Noi dung tap trung vao: bai toan, kien truc, cong nghe, module chuc nang, y nghia code va cac diem co the dung de giai thich voi giang vien.

> Ghi chu: Tai lieu nay viet tieng Viet khong dau de tranh loi ma hoa khi mo tren nhieu may/IDE khac nhau.

---

## 1. Gioi Thieu De Tai

**Ten de tai:** Sora POS V2 - He thong quan ly ban hang tai quay tich hop AI.

**Bai toan thuc te:** Nhieu cua hang nho va vua van quan ly ban hang, ton kho, bao cao doanh thu bang so tay hoac Excel. Cach lam nay de sai sot, kho kiem soat ton kho, kho tong hop doanh thu va khong co du lieu de ra quyet dinh kinh doanh.

**Muc tieu cua he thong:**

- Ho tro ban hang tai quay nhanh, co gio hang, thanh toan, in hoa don.
- Quan ly san pham, danh muc, nha cung cap, khach hang, nhan vien.
- Quan ly ton kho, nhap kho, dieu chinh kho, canh bao ton kho thap.
- Quan ly ca lam viec cua thu ngan, doi soat tien mat.
- Bao cao doanh thu, loi nhuan, san pham ban chay.
- Tich hop AI de phan tich doanh thu va goi y nhap hang.
- Luu lich su phan tich AI vao co so du lieu de xem lai.
- Ho tro mot phan offline POS va scanner ma vach.

**Doi tuong su dung:**

| Vai tro | Quyen han chinh |
|---|---|
| Admin | Quan tri toan bo he thong, cau hinh, nhan vien, bao cao, audit log |
| Manager | Quan ly san pham, kho, don hang, ca lam, bao cao |
| Cashier | Ban hang POS, xem don cua minh, quan ly ca cua minh |

---

## 2. Kien Truc Tong The

He thong duoc xay dung theo mo hinh **client-server 3 tang**:

```txt
Frontend React/Vite
        |
        | REST API + JWT
        v
Backend Express/TypeScript
        |
        | Supabase SDK + RPC SQL
        v
Supabase PostgreSQL
        |
        | External API
        v
Groq AI / PayOS / Telegram
```

### 2.1 Frontend

Frontend la ung dung React SPA, chay tren trinh duyet. No phu trach giao dien, tuong tac nguoi dung, goi API, hien thi bieu do, quan ly state POS va offline cache.

Cong nghe chinh:

- **React 19:** xay UI bang component.
- **TypeScript:** kiem soat kieu du lieu, giam loi runtime.
- **Vite:** build/dev server nhanh.
- **Tailwind CSS:** tao giao dien nhanh bang utility class.
- **Zustand:** quan ly state dang nhap va gio hang POS.
- **Axios:** goi API backend, gan JWT vao header.
- **Recharts:** ve bieu do doanh thu, loi nhuan, san pham ban chay.
- **Dexie/IndexedDB:** luu du lieu offline cho POS.
- **PWA:** ho tro service worker va offline experience.

### 2.2 Backend

Backend la Express API viet bang TypeScript. No phu trach xac thuc, phan quyen, validation, nghiep vu va truy van database.

Cong nghe chinh:

- **Node.js + Express:** tao REST API.
- **TypeScript:** code backend co type.
- **JWT:** xac thuc nguoi dung.
- **bcryptjs:** bam mat khau.
- **Zod:** validate request body.
- **Supabase SDK:** ket noi PostgreSQL.
- **PostgreSQL RPC:** thuc hien transaction quan trong nhu checkout va huy don.
- **Groq API:** goi AI de phan tich va tao noi dung.

### 2.3 Database

Database dung PostgreSQL tren Supabase.

Cac bang quan trong:

- `users`, `roles`: tai khoan va vai tro.
- `products`, `categories`, `suppliers`: danh muc hang hoa.
- `customers`: khach hang va diem tich luy.
- `orders`, `order_details`, `payments`: hoa don, chi tiet va thanh toan.
- `shift_sessions`, `cash_drawer_transactions`: ca lam va giao dich tien mat.
- `goods_receipts`, `goods_receipt_details`: phieu nhap kho.
- `stock_transactions`, `stock_alerts`: lich su kho va canh bao.
- `ai_recommendations`: goi y nhap hang AI.
- `ai_revenue_analyses`: lich su phan tich doanh thu AI.
- `audit_logs`: nhat ky kiem toan.

### 2.4 Tai sao dung RPC SQL cho checkout?

Checkout la nghiep vu nhay cam: tao order, tao chi tiet, tao payment, tru ton kho, ghi stock transaction, cap nhat diem khach hang, ghi audit log. Neu lam bang nhieu API/nhieu lenh rieng le thi co the xay ra loi nua chung: tao hoa don roi nhung chua tru kho, hoac tru kho roi nhung chua tao payment.

Vi vay du an dung PostgreSQL function `create_pos_order` trong `database/enterprise_pos_core.sql`. Tat ca thao tac nam trong mot transaction cua database. Neu loi o bat ky buoc nao, database rollback, du lieu khong bi lech.

---

## 3. Luong Xu Ly Chinh

### 3.1 Luong dang nhap

1. Nguoi dung nhap email/password tren `LoginPage`.
2. Frontend goi `POST /api/auth/login`.
3. Backend validate bang Zod.
4. `AuthService` tim user trong database.
5. So sanh mat khau bang bcrypt.
6. Neu dung, tao JWT gom `userId`, `email`, `role`.
7. Frontend luu user/token vao Zustand persist.
8. Cac request sau do Axios gan `Authorization: Bearer <token>`.
9. `authMiddleware` verify token va nap lai user active tu database.

Y nghia: dam bao chi nguoi dung hop le moi truy cap he thong, role trong token duoc kiem tra lai voi database de tranh stale permission.

### 3.2 Luong ban hang POS

1. Cashier vao man POS.
2. `usePOSProducts` tai san pham, danh muc, khach hang.
3. Cashier tim/quet ma vach, them san pham vao gio.
4. `usePOSCart` tinh tong tien, giam gia, diem tich luy.
5. Khi thanh toan, `usePOSCheckout` tao payload don hang.
6. Backend goi RPC `create_pos_order`.
7. RPC khoa dong san pham bang `FOR UPDATE`, kiem tra ton kho, tao order, payment, tru kho, ghi audit.
8. Backend tra ve don hang day du.
9. Frontend hien hoa don, co the in/in preview.

Y nghia: luong nay dam bao ban hang nhanh nhung van an toan du lieu.

### 3.3 Luong huy hoa don

1. Admin/manager chon huy hoa don.
2. Frontend goi `PATCH /api/orders/:id/cancel`.
3. Backend goi RPC `cancel_pos_order`.
4. RPC kiem tra role, khoa order, doi status thanh `cancelled`.
5. Neu `restock = true`, cong lai ton kho.
6. Payment doi sang `refunded`.
7. Diem tich luy khach hang duoc hoan/tinh lai.
8. Ghi audit log.

Y nghia: khong xoa cung hoa don, giu audit trail dung chuan doanh nghiep.

### 3.4 Luong nhap kho

1. Admin/manager tao phieu nhap.
2. Frontend goi API goods receipt.
3. Backend goi RPC `create_goods_receipt`.
4. Database tao phieu, chi tiet, cong ton kho, cap nhat gia von moi, ghi stock transaction.
5. Dong bo lai stock alert.

Y nghia: moi lan nhap kho co chung tu va lich su, khong sua ton kho am tham.

### 3.5 Luong bao cao doanh thu

1. Frontend goi `/api/reports/revenue`, `/top-products`, `/dashboard`.
2. `ReportService` lay orders hoan thanh theo ngay.
3. Lay chi tiet order de tinh COGS.
4. COGS uu tien `order_details.cost_price`, tuc gia von tai thoi diem ban.
5. Tinh revenue, orders, cogs, profit theo tung ngay.
6. Frontend dung Recharts ve bieu do.

Cong thuc:

```txt
revenue = tong final_amount cua order completed
cogs = tong quantity * cost_price tai thoi diem ban
profit = revenue - cogs
profit_margin = profit / revenue * 100
```

Y nghia: neu sau nay gia nhap san pham thay doi, bao cao qua khu van dung vi da luu gia von luc ban.

### 3.6 Luong AI phan tich doanh thu

1. Frontend goi `POST /api/reports/ai-analysis`.
2. Backend tong hop du lieu doanh thu, top products, category sales, payment stats.
3. Backend tao prompt co so lieu that.
4. Goi Groq API de sinh bao cao JSON.
5. Parse JSON.
6. Luu vao `ai_revenue_analyses`.
7. Frontend hien bao cao va lich su da luu.

Y nghia: AI chi la bo phan tich, du lieu dau vao la so lieu that trong CSDL, ket qua cuoi cung duoc luu lai de xem lich su.

### 3.7 Luong AI goi y nhap hang

1. Backend phan tich toc do ban cua tung san pham.
2. Tinh average daily sales.
3. Tinh so ngay ton kho con lai.
4. Tinh so luong nen nhap.
5. Neu co AI key, goi Groq de tao insight bang ngon ngu tu nhien.
6. Neu AI loi, he thong co fallback rule-based.

Cong thuc co ban:

```txt
average_daily_sales = tong so luong ban trong N ngay / N
target_stock = average_daily_sales * target_days
recommended_quantity = max(target_stock - current_stock, 0)
```

### 3.8 Luong offline POS

1. Khi online, frontend sync products/categories/customers ve IndexedDB.
2. Khi mat mang, POS van doc du lieu tu IndexedDB.
3. Don offline duoc luu vao pending orders.
4. Khi co mang lai, `offlineSync` day don len backend.
5. Backend van kiem tra ton kho that. Neu het ton thi sync fail va bao loi.

Y nghia: ho tro ban hang tam thoi khi mang chap chon, nhung database server van la nguon dung cuoi cung.

---

## 4. Cac Module Chuc Nang

### 4.1 Auth va RBAC

Chuc nang:

- Dang nhap/dang xuat.
- Lay thong tin nguoi dung hien tai.
- Phan quyen theo role.

File chinh:

- Backend: `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.middleware.ts`, `role.middleware.ts`.
- Frontend: `LoginPage.tsx`, `auth.store.ts`, `ProtectedRoute.tsx`, `api.ts`.
- Database: `users`, `roles`.

Cong nghe/ky thuat:

- JWT de xac thuc.
- bcrypt de hash password.
- Middleware de bao ve route.
- Zustand persist de luu session frontend.

### 4.2 Catalog: San pham, danh muc, nha cung cap, khach hang

Chuc nang:

- CRUD san pham.
- CRUD danh muc.
- CRUD nha cung cap.
- CRUD khach hang.
- Bulk import san pham.
- Tim kiem theo ten, SKU, barcode.

File chinh:

- Backend: `catalog.routes.ts`, `catalog.controller.ts`, `catalog.service.ts`, `catalog.validation.ts`.
- Frontend: `ProductsPage.tsx`, `CategoriesPage.tsx`, `SuppliersPage.tsx`, `CustomersPage.tsx`, `catalog.api.ts`.
- Database: `products`, `categories`, `suppliers`, `customers`.

Ky thuat:

- Phan trang bang `parsePagination`.
- Soft delete qua `is_active`.
- Unique SKU/barcode.
- Validation Zod.

### 4.3 POS va Order

Chuc nang:

- Ban hang tai quay.
- Gio hang.
- Thanh toan tien mat/chuyen khoan/the.
- Tao hoa don.
- In hoa don.
- Huy hoa don.
- Gui email hoa don.

File chinh:

- Backend: `order.routes.ts`, `order.controller.ts`, `order.service.ts`, `order.validation.ts`.
- Frontend: `POSPage.tsx`, `CartPanel.tsx`, `ProductGrid.tsx`, `CashPaymentModal.tsx`, `TransferPaymentModal.tsx`, `ReceiptPreview.tsx`.
- Hooks: `usePOSCart.ts`, `usePOSCheckout.ts`, `usePOSProducts.ts`, `usePOSBarcode.ts`, `usePOSHotkeys.ts`.
- Database: `orders`, `order_details`, `payments`, `stock_transactions`.
- SQL: `enterprise_pos_core.sql`.

Ky thuat:

- Transaction SQL.
- Row lock `FOR UPDATE`.
- Idempotency bang `client_order_number`.
- Snapshot gia ban, ten san pham, gia von tai thoi diem ban.

### 4.4 Stock va Goods Receipt

Chuc nang:

- Xem ton kho.
- Canh bao ton thap/het hang.
- Nhap kho.
- Dieu chinh ton kho.
- Xem giao dich kho.
- Quan ly lo/han su dung neu bat migration expiry.

File chinh:

- Backend: `stock.routes.ts`, `stock.controller.ts`, `stock.service.ts`, `stock.validation.ts`.
- Backend nhap kho: `goodsReceipt.routes.ts`, `goodsReceipt.controller.ts`, `goodsReceipt.service.ts`.
- Frontend: `StockPage.tsx`, `CreateReceiptPage.tsx`, `ReceiptListPage.tsx`, `stock.api.ts`, `goodsReceipt.api.ts`.
- Database: `stock_transactions`, `stock_alerts`, `goods_receipts`, `goods_receipt_details`.
- SQL: `stock_atomic_rpc.sql`, `enterprise_pos_core.sql`, `expiry_setup.sql`.

Ky thuat:

- Stock transaction log.
- Sync stock alert sau moi thay doi ton.
- RPC atomic cho thao tac kho.

### 4.5 Shift Management

Chuc nang:

- Quan ly ca lam cua nhan vien.
- Thu ngan check-in.
- Ghi tien dau ca.
- Dong ca, doi soat tien mat.
- Bao cao doanh thu theo ca.

File chinh:

- Backend: `shift.routes.ts`, `shift.controller.ts`, `shift.service.ts`, `shift.validation.ts`.
- Frontend: `ShiftsPage.tsx`, `MyShiftPage.tsx`, `ShiftGuard.tsx`, `shift.api.ts`.
- Database: `shift_sessions`, `cash_drawer_transactions`.

Ky thuat:

- Unique active shift theo employee.
- Tinh expected cash = opening cash + cash sales.
- So sanh cash difference.

### 4.6 Reports va Dashboard

Chuc nang:

- Dashboard tong quan.
- Doanh thu theo ngay.
- Loi nhuan/COGS.
- Top san pham.
- Category sales.
- Payment stats.
- AI revenue analysis.
- Lich su bao cao AI.

File chinh:

- Backend: `report.routes.ts`, `report.controller.ts`, `report.service.ts`.
- Frontend: `DashboardPage.tsx`, `ReportsPage.tsx`, `report.api.ts`.
- Database: `orders`, `order_details`, `payments`, `products`, `categories`, `ai_revenue_analyses`.

Ky thuat:

- Group data theo ngay.
- Tinh bucket ngay co revenue/orders/cogs/profit.
- Cache dashboard ngan han bang memory cache.
- AI prompt engineering.
- Luu JSONB cho report AI.

### 4.7 AI Module

Chuc nang:

- Goi y nhap hang.
- Phan tich restock.
- Tao mo ta san pham.
- Goi y danh muc.
- Goi y anh danh muc.
- Merge/thong tin san pham tu barcode.
- Goi y nha cung cap.

File chinh:

- Backend: `ai.routes.ts`, `ai.controller.ts`, `ai.service.ts`, `ai.validation.ts`.
- Frontend: `AIRecommendationsPage.tsx`, `ai.api.ts`.
- Database: `ai_recommendations`.

Ky thuat:

- Rule-based fallback.
- Groq API.
- External lookup barcode/Wikipedia/DuckDuckGo tuy chuc nang.
- Rate limit de tranh spam AI.

### 4.8 Settings

Chuc nang:

- Cau hinh ten cua hang, dia chi, hotline.
- Cau hinh thanh toan, VietQR bank.
- Cau hinh chiet khau, ban qua ton, canh bao ton.
- Cau hinh may in hoa don.

File chinh:

- Backend: `settings.routes.ts`, `settings.controller.ts`, `settings.service.ts`, `settings.validation.ts`.
- Frontend: `SettingsPage.tsx`, `settings.api.ts`.
- Database: `app_settings`.

Ky thuat:

- Luu settings dang JSONB.
- Validate bang Zod.
- Chi admin duoc update.

### 4.9 Audit va Notification

Chuc nang:

- Ghi lai hanh dong quan trong.
- Xem audit logs.
- Gui notification Telegram/email khi can.

File chinh:

- Backend: `audit.routes.ts`, `audit.controller.ts`, `audit.service.ts`.
- Backend: `notification.service.ts`, `email.service.ts`, `telegram.routes.ts`, `webhook.routes.ts`.
- Frontend: `AuditLogsPage.tsx`, `NotificationCenter.tsx`, `realtimeService.ts`.
- Database: `audit_logs`.

Ky thuat:

- Audit log qua SQL function `write_audit_log`.
- Supabase Realtime/webhook.
- Telegram bot.

---

## 5. Diem Noi Bat De Trinh Bay Voi Thay

1. **Transaction an toan cho POS:** Checkout/huy don dung PostgreSQL RPC, tranh lech du lieu.
2. **Audit trail:** Khong xoa cung hoa don, dung cancel/refund de giu lich su.
3. **Phan quyen hai lop:** Frontend an menu, backend middleware van la lop bao ve chinh.
4. **Bao cao loi nhuan dung hon:** Luu `cost_price` tai thoi diem ban.
5. **AI co luu CSDL:** Bao cao AI duoc luu JSONB trong `ai_revenue_analyses`.
6. **Offline POS:** Co IndexedDB va co dong bo lai khi co mang.
7. **Ca lam thu ngan:** Co check-in, close shift, doi soat tien.
8. **Tai lieu API:** Co OpenAPI page tai `/api-docs`.
9. **PWA:** Co service worker/offline support.

---

## 6. Han Che Va Huong Phat Trien

Han che hien tai:

- Token dang luu localStorage, chua phai bao mat cao nhat.
- Bao cao AI phu thuoc Groq API.
- Offline order van co the sync fail neu ton kho server khong du.
- Chua co role permission granular theo tung action.
- Chua co test E2E frontend.
- Bundle frontend con lon do chart/xlsx.

Huong phat trien:

- Chuyen auth sang httpOnly cookie/refresh token.
- Them E2E test voi Playwright.
- Them export PDF cho bao cao AI.
- Them phan quyen chi tiet theo permission.
- Them dashboard realtime nang cao.
- Them FIFO/weighted average cost cho gia von.
- Them module barcode label/in tem san pham.

