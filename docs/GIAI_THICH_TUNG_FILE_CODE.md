# Giai Thich Tung File Code - Sora POS V2

Tai lieu nay liet ke cac file code quan trong trong repo va giai thich: file lam gi, dung cong nghe/ky thuat nao, khi bao ve nen noi nhu the nao.

> Cach hoc nhanh: khong can hoc thuoc tung dong code. Hay nam 3 y moi file: muc dich, du lieu vao/ra, lien ket voi file nao.

---

## 1. Root Va Entry Points

| File | Vai tro | Cong nghe/ky thuat | Giai thich khi bao ve |
|---|---|---|---|
| `package.json` | Cau hinh monorepo, scripts chung | npm workspaces | Du an gom frontend, backend, scanner trong mot repo, chay/build/test bang script tong |
| `vercel.json` | Cau hinh deploy len Vercel | Vercel routing | Dieu huong request API ve backend entry va static frontend |
| `api/index.ts` | Entry cho serverless API | Express app export | Khi deploy, Vercel goi file nay de chay backend |
| `README.md` | Huong dan cai dat/tong quan | Markdown | Tai lieu cho nguoi cai dat va demo |

---

## 2. Backend - Entry, Config, App

| File | Vai tro | Cong nghe/ky thuat | Giai thich khi bao ve |
|---|---|---|---|
| `backend/src/server.ts` | Khoi dong server local | Node.js, Express listen | File nay chi dung khi chay dev/start local, lang nghe port va log thong tin API |
| `backend/src/app.ts` | Tao Express app | Express, CORS, compression, morgan, security headers | Day la noi gan middleware, CORS, body parser, docs route va router chinh |
| `backend/src/config/env.ts` | Doc bien moi truong | dotenv | Tap trung cau hinh JWT, Supabase, Groq, SMTP, PayOS, Telegram |
| `backend/src/config/supabase.ts` | Tao Supabase client backend | Supabase SDK, Proxy lazy init | Dung service role key de backend truy cap database; lazy init giup khong crash khi chua config |

---

## 3. Backend - Middlewares

| File | Vai tro | Cong nghe/ky thuat | Giai thich khi bao ve |
|---|---|---|---|
| `auth.middleware.ts` | Xac thuc JWT | jsonwebtoken, Supabase query | Doc Bearer token, verify, nap lai user active tu database roi gan `req.user` |
| `role.middleware.ts` | Phan quyen role | RBAC | Kiem tra `req.user.role` co nam trong danh sach role duoc phep khong |
| `validate.middleware.ts` | Validate input | Zod | Kiem tra body truoc khi vao controller, tranh du lieu sai vao service |
| `rateLimit.middleware.ts` | Gioi han request | In-memory bucket | Bao ve login/AI API khoi spam, dat gioi han theo IP |
| `error.middleware.ts` | Xu ly loi tap trung | Express error handler | Chuan hoa response loi, che stack trace o production |

---

## 4. Backend - Routes

Routes la lop khai bao URL, method, middleware va controller. Route khong chua logic nghiep vu nang.

| File | Chuc nang route | API chinh | Middleware noi bat |
|---|---|---|---|
| `routes/index.ts` | Gom tat ca route con | `/api/*`, `/health` | Router tong |
| `auth.routes.ts` | Dang nhap/dang xuat/me | `/auth/login`, `/auth/me` | rate limit, validate login |
| `catalog.routes.ts` | San pham/danh muc/NCC/khach hang | `/products`, `/categories`, `/suppliers`, `/customers` | auth, role, validate |
| `order.routes.ts` | Hoa don | `/orders`, `/orders/:id/cancel` | auth, role, validate |
| `stock.routes.ts` | Ton kho/canh bao/dieu chinh | `/stock/*` | auth, role, validate |
| `goodsReceipt.routes.ts` | Phieu nhap kho | `/stock/receipts` | auth, role |
| `report.routes.ts` | Dashboard/bao cao/AI report | `/reports/*` | auth, role, rate limit AI |
| `ai.routes.ts` | AI goi y nhap/mo ta/danh muc | `/ai/*` | auth, role, rate limit |
| `staff.routes.ts` | Nhan vien | `/staff/*` | admin/manager xem, admin tao/sua |
| `shift.routes.ts` | Ca lam | `/shifts/*` | role cashier/admin/manager |
| `settings.routes.ts` | Cau hinh he thong | `/settings/operation` | admin update |
| `audit.routes.ts` | Nhat ky kiem toan | `/audit-logs` | admin/manager |
| `payos.routes.ts` | Thanh toan PayOS | `/payos/create`, `/payos/status` | auth + role, webhook public co verify |
| `webhook.routes.ts` | Webhook Supabase audit | `/webhooks/supabase-audit` | async handler |
| `telegram.routes.ts` | Telegram bot webhook | `/webhooks/telegram` | command parser |

---

## 5. Backend - Controllers

Controller nhan `Request`, goi service, tra response. Controller khong nen chua nhieu business logic.

| File | Vai tro | Noi dung chinh |
|---|---|---|
| `auth.controller.ts` | Xu ly login/logout/me | Goi `AuthService`, tra user/token |
| `catalog.controller.ts` | CRUD catalog | Gom Category, Product, Supplier, Customer controller |
| `order.controller.ts` | Don hang | List, get, create, cancel, send email; truyen user vao service de check quyen |
| `stock.controller.ts` | Ton kho | Inventory, alerts, import, adjust, resolve alert, summary |
| `goodsReceipt.controller.ts` | Phieu nhap | Tao phieu, list, detail, update payment |
| `report.controller.ts` | Bao cao | Dashboard, revenue, top products, AI analysis history/detail/delete |
| `ai.controller.ts` | AI | Goi y nhap hang, barcode lookup, generate description/category |
| `staff.controller.ts` | Nhan vien | List, create, update, deactivate, staff report |
| `shift.controller.ts` | Ca lam | Open/check-in/close/cancel/report |
| `settings.controller.ts` | Cai dat | Get/update/default settings |
| `audit.controller.ts` | Audit log | List audit logs |

Vi du khi thay hoi `order.controller.ts`:

> File nay la lop dieu phoi HTTP request cho hoa don. No khong truc tiep tru kho, ma goi `OrderService`. Khi tao don, controller lay `req.user.userId`, goi service tao don, sau do neu khach co email thi gui hoa don bat dong bo.

---

## 6. Backend - Services

Service la noi chua business logic va truy van database.

| File | Vai tro | Thuat toan/logic noi bat |
|---|---|---|
| `auth.service.ts` | Dang nhap, lay user hien tai | bcrypt compare, JWT sign, sanitize user |
| `catalog.service.ts` | San pham/danh muc/NCC/khach hang | Phan trang, search, bulk create, sync stock alert |
| `order.service.ts` | Hoa don | Goi RPC `create_pos_order`, `cancel_pos_order`, gioi han cashier xem don cua minh |
| `stock.service.ts` | Kho | Tinh ton kho, canh bao, giao dich kho, summary, adjust/import |
| `goodsReceipt.service.ts` | Nhap kho | Goi RPC tao phieu nhap, fallback JS neu can |
| `report.service.ts` | Bao cao | Group doanh thu theo ngay, tinh COGS/profit, tao AI prompt, luu AI report |
| `ai.service.ts` | AI va barcode | Restock analysis, rule fallback, Groq prompt, external lookup |
| `staff.service.ts` | Nhan vien | Tao/sua user, hash password, report doanh thu nhan vien |
| `shift.service.ts` | Ca lam | Tao ma ca, check-in, close, tinh doanh thu ca, cash difference |
| `settings.service.ts` | Cai dat | Doc/ghi JSON settings trong `app_settings` |
| `audit.service.ts` | Audit | Phan trang/filter audit log, map actor user |
| `email.service.ts` | Email hoa don | Tao HTML invoice, gui SMTP neu co config |
| `notification.service.ts` | Notification | Gui thong bao ton kho/audit qua Telegram |
| `payos.service.ts` | Thanh toan PayOS | Tao link/QR thanh toan, verify webhook |

### Service quan trong nhat: `order.service.ts`

Di voi SQL function `create_pos_order`.

Logic:

```txt
Frontend payload -> OrderService.create -> supabase.rpc('create_pos_order')
```

Ly do:

- Dam bao transaction.
- Tranh ban qua ton.
- Ghi stock transaction.
- Ghi audit log.
- Cap nhat diem khach hang.

### Service quan trong nhat: `report.service.ts`

Logic:

- `dashboard`: tong hop nhieu khoi du lieu cho dashboard.
- `revenue`: tao bucket theo ngay, tinh revenue/orders/cogs/profit.
- `topProducts`: gom order_details theo product.
- `aiAnalysis`: tong hop data -> tao prompt -> goi Groq -> parse JSON -> luu DB.
- `aiAnalysisHistory/detail/delete`: quan ly lich su bao cao AI.

---

## 7. Backend - Validations

| File | Validate cho | Y nghia |
|---|---|---|
| `auth.validation.ts` | Login | Email/password khong rong |
| `catalog.validation.ts` | Product/category/customer/supplier | Gia khong am, UUID hop le, field bat buoc |
| `order.validation.ts` | Tao/huy order | Items toi thieu 1, quantity > 0, payment method hop le |
| `stock.validation.ts` | Nhap/dieu chinh kho | quantity/new_stock hop le |
| `staff.validation.ts` | Nhan vien | Password, role, active status |
| `shift.validation.ts` | Ca lam | opening cash, closing cash, note |
| `settings.validation.ts` | Cau hinh | Gioi han discount, page size, receipt copies |
| `ai.validation.ts` | AI request | Product id, status, prompt input |

Khi bao ve:

> Validation bang Zod giup he thong chan du lieu sai ngay tai API boundary, tranh loi lan vao business logic va database.

---

## 8. Backend - Utils, Types, Docs, Tests

| File | Vai tro |
|---|---|
| `utils/AppError.ts` | Custom error co status code |
| `utils/asyncHandler.ts` | Boc async controller, day loi ve error middleware |
| `utils/cache.ts` | Memory cache ngan han cho dashboard/report |
| `utils/posCalculations.ts` | Ham tinh toan POS/store health testable |
| `utils/query.ts` | Parse pagination, convert number, clean empty string |
| `utils/response.ts` | Chuan hoa success/error response |
| `types/user.type.ts` | UserRole, JwtPayload, augment Express Request |
| `docs/apiDocs.ts` | OpenAPI spec va UI docs `/api-docs` |
| `tests/apiDocs.test.ts` | Dam bao endpoint quan trong co trong docs |
| `tests/cache.test.ts` | Test cache |
| `tests/enterpriseSql.test.ts` | Test SQL transaction co function/cost snapshot |
| `tests/posCalculations.test.ts` | Test tinh toan POS |
| `tests/checkAuditLogs.ts` | Script doc audit log |
| `tests/test_orders.ts` | Script test order thu cong |

---

## 9. Frontend - Entry Va Routing

| File | Vai tro | Giai thich |
|---|---|---|
| `frontend/src/main.tsx` | Entry React | Render app, dang ky PWA service worker |
| `frontend/src/App.tsx` | Khai bao routes | Dung lazy loading, ProtectedRoute, redirect theo role |
| `frontend/src/index.css` | Global CSS | Tailwind base, animations, custom classes |
| `frontend/src/vite-env.d.ts` | Type env | Khai bao type cho Vite env/PWA |
| `routes/ProtectedRoute.tsx` | Bao ve route | Kiem tra login va role o frontend |

---

## 10. Frontend - Layout Va Common Components

| File | Vai tro | Giai thich |
|---|---|---|
| `MainLayout.tsx` | Layout chinh | Sidebar + content, khoi dong auto sync offline |
| `Sidebar.tsx` | Menu dieu huong | Loc menu theo role, logout |
| `CrudPage.tsx` | Component CRUD dung chung | Ho tro table/form CRUD co ban |
| `ErrorBoundary.tsx` | Bat loi UI | Neu component loi, hien fallback thay vi crash ca app |
| `NetworkStatusBar.tsx` | Trang thai online/offline | Hien so don pending va trang thai sync |
| `NotificationCenter.tsx` | Trung tam thong bao | Hien notification realtime/local |

---

## 11. Frontend - Pages

| File | Chuc nang | API/Store lien quan |
|---|---|---|
| `LoginPage.tsx` | Dang nhap | `auth.store`, `auth.api` |
| `DashboardPage.tsx` | Dashboard tong quan | `reportAPI.dashboard` |
| `POSPage.tsx` | Man hinh ban hang | POS hooks, `pos.store` |
| `ProductsPage.tsx` | Quan ly san pham | `catalog.api`, AI suggest |
| `CategoriesPage.tsx` | Quan ly danh muc | `catalog.api`, AI category image |
| `CustomersPage.tsx` | Quan ly khach hang | `catalog.api` |
| `SuppliersPage.tsx` | Quan ly NCC | `catalog.api`, AI supplier suggest |
| `OrdersPage.tsx` | Danh sach/chi tiet/huy hoa don | `order.api` |
| `StockPage.tsx` | Ton kho, alert, transaction, dieu chinh | `stock.api` |
| `CreateReceiptPage.tsx` | Tao phieu nhap kho | `goodsReceipt.api`, `catalog.api` |
| `ReceiptListPage.tsx` | Danh sach phieu nhap | `goodsReceipt.api` |
| `ReportsPage.tsx` | Bao cao doanh thu, AI report, stock summary | `report.api`, `ai.api`, `stock.api` |
| `AIRecommendationsPage.tsx` | Goi y nhap hang AI | `ai.api` |
| `ShiftsPage.tsx` | Quan ly ca lam admin/manager | `shift.api` |
| `MyShiftPage.tsx` | Ca cua thu ngan | `shift.api` |
| `StaffPage.tsx` | Quan ly nhan vien | `staff.api` |
| `SettingsPage.tsx` | Cau hinh he thong | `settings.api` |
| `AuditLogsPage.tsx` | Xem audit log | `audit.api` |
| `ScannerPage.tsx` | Trang scanner web/mobile pairing | Supabase realtime |
| `NotFoundPage.tsx` | Trang 404 | React Router |

---

## 12. Frontend - POS Components, Hooks, Utils

### Components

| File | Vai tro |
|---|---|
| `CartPanel.tsx` | Hien gio hang, khach hang, giam gia, tong tien |
| `ProductGrid.tsx` | Hien san pham dang grid de them vao gio |
| `POSHeader.tsx` | Search, barcode input, filter/category |
| `CheckoutFooter.tsx` | Nut thanh toan va tong ket |
| `CheckoutConfirmModal.tsx` | Xac nhan thanh toan |
| `CashPaymentModal.tsx` | Nhap tien khach dua, tinh tien thua |
| `TransferPaymentModal.tsx` | Tao/ hien QR thanh toan chuyen khoan |
| `ReceiptPreview.tsx` | Xem/in/gui email hoa don |
| `ShiftGuard.tsx` | Bat buoc cashier co ca dang hoat dong |
| `PairingModal.tsx` | Ghép scanner voi POS |
| `ClearCartModal.tsx` | Xac nhan xoa gio |

### Hooks

| File | Vai tro | Thuat toan/logic |
|---|---|---|
| `usePOSCart.ts` | Quan ly gio hang | Add/remove/update quantity, tinh total |
| `usePOSProducts.ts` | Tai san pham/danh muc/khach hang | Online API, fallback offline IndexedDB |
| `usePOSCheckout.ts` | Xu ly thanh toan | Tao order online/offline, sync shift, tao receipt data |
| `usePOSBarcode.ts` | Xu ly barcode | Tim san pham theo barcode/SKU online/offline |
| `usePOSHotkeys.ts` | Phim tat POS | F3 search, hotkey thanh toan/xoa |

### Utils

| File | Vai tro |
|---|---|
| `posHelpers.ts` | Format tien, loc san pham, helper POS |
| `receiptTemplate.ts` | HTML template hoa don |
| `receiptPrinter.ts` | In hoa don qua iframe/window print |

---

## 13. Frontend - Services API

Moi file service la mot lop goi API qua Axios.

| File | API module | Giai thich |
|---|---|---|
| `api.ts` | Axios core | Base URL, gan JWT, xu ly 401, demo intercept |
| `auth.api.ts` | Auth | login/logout/me |
| `catalog.api.ts` | Catalog | products/categories/customers/suppliers |
| `order.api.ts` | Orders | list/create/get/cancel/send-email |
| `stock.api.ts` | Stock | inventory/alerts/transactions/summary |
| `goodsReceipt.api.ts` | Goods receipt | phieu nhap |
| `report.api.ts` | Reports | dashboard/revenue/top-products/AI report history |
| `ai.api.ts` | AI | restock analysis, suggestions |
| `staff.api.ts` | Staff | nhan vien/report |
| `shift.api.ts` | Shifts | ca lam |
| `settings.api.ts` | Settings | cau hinh |
| `audit.api.ts` | Audit | audit logs |
| `payos.service.ts` backend / frontend transfer modal | Payment | PayOS/VietQR |
| `supabase.ts` | Supabase client frontend | Chi dung realtime, khong CRUD |
| `realtimeService.ts` | Realtime subscriptions | Subscribe orders/products/shifts/alerts |
| `offlineDB.ts` | IndexedDB schema | Luu products/categories/customers/pending orders |
| `offlineSync.ts` | Dong bo offline | Day pending orders khi online lai |

---

## 14. Frontend - Stores, Hooks, Types, Utils

| File | Vai tro |
|---|---|
| `stores/auth.store.ts` | Luu user/token/loginAt, login/logout/checkAuth |
| `stores/pos.store.ts` | State POS: gio hang, khach, payment, UI |
| `stores/notification.store.ts` | State thong bao |
| `hooks/useBarcodeScanner.ts` | Lang nghe scanner qua Supabase realtime |
| `hooks/useNetworkStatus.ts` | Theo doi online/offline va pending orders |
| `types/domain.type.ts` | Type domain: Product, Order, Shift, AI... |
| `types/user.type.ts` | Type user/role/api response |
| `utils/banks.ts` | Danh sach ngan hang/VietQR |
| `utils/vietqr.ts` | Tao URL/QR VietQR |
| `utils/userDisplay.ts` | Format ten/role nguoi dung |
| `validations/login.schema.ts` | Zod validation login frontend |

---

## 15. Database Files

| File | Vai tro | Giai thich |
|---|---|---|
| `schema.sql` | Tao schema goc | Bang, khoa ngoai, index, trigger updated_at |
| `app_settings.sql` | Cau hinh | Tao `app_settings` va default operation |
| `enterprise_pos_core.sql` | Nghiep vu POS transaction | RPC checkout, cancel order, create goods receipt, audit |
| `stock_atomic_rpc.sql` | Kho atomic | RPC thao tac kho an toan |
| `expiry_setup.sql` | Han su dung/lo hang | Bang va view/canh bao expiry |
| `hardening.sql` | Rang buoc va RLS | Constraint an toan, enable RLS |
| `ai_revenue_analyses.sql` | Luu AI report | Tao bang lich su phan tich doanh thu AI |
| `order_details_cost_snapshot.sql` | Snapshot gia von | Them `cost_price` vao order_details va backfill |
| `seed.sql` | Du lieu demo | Tao role va admin demo |
| `README.md` | Huong dan migration | Thu tu chay file SQL |

---

## 16. Scanner App

| File | Vai tro |
|---|---|
| `sora-scanner/src/supabase.ts` | Khoi tao Supabase client cho scanner |
| `sora-scanner/App.tsx` | Ung dung scanner mobile |
| `sora-scanner/index.ts` | Entry React Native/Expo |

Y tuong:

- Scanner quet ma vach.
- Gui event qua Supabase realtime channel.
- POS lang nghe channel va tu dong nhan barcode.

---

## 17. Cach Tra Loi Khi Thay Hoi Ve Cau Truc Code

**Cau hoi:** Vi sao tach route, controller, service?

Tra loi:

> Route chi khai bao URL va middleware. Controller nhan request va tra response. Service chua business logic va truy van database. Tach nhu vay giup code de bao tri, de test va dung voi layered architecture.

**Cau hoi:** File nao quan trong nhat trong backend?

Tra loi:

> `enterprise_pos_core.sql` va `order.service.ts` la hai phan rat quan trong. `order.service.ts` goi RPC, con SQL RPC dam bao transaction khi tao hoa don, tru kho, tao thanh toan va ghi audit log.

**Cau hoi:** File nao quan trong nhat trong frontend?

Tra loi:

> `POSPage.tsx` va cac hook POS nhu `usePOSCheckout.ts`, `usePOSCart.ts`, `usePOSProducts.ts`. Trang POS la luong nghiep vu chinh cua he thong.

**Cau hoi:** AI nam o dau?

Tra loi:

> AI nam o `backend/src/services/ai.service.ts` cho goi y nhap hang/san pham, va `backend/src/services/report.service.ts` cho phan tich doanh thu. Ket qua phan tich doanh thu AI duoc luu vao bang `ai_revenue_analyses`.

