# 📋 Kế Hoạch Báo Cáo Tuần - Xây Dựng Hệ Thống Sora POS

## Tổng Quan

Đây là kế hoạch chia nhỏ hệ thống **Sora POS** (đã hoàn thiện) thành **10 tuần báo cáo**, mỗi tuần có sản phẩm cụ thể để trình bày cho giảng viên. Kèm theo là **prompt chính xác** để copy-paste nhờ AI code từng tuần.

---

## 📅 Lộ Trình 10 Tuần

| Tuần | Nội dung báo cáo | Deliverables |
|------|------------------|--------------|
| **1** | Phân tích yêu cầu, thiết kế CSDL | Tài liệu SRS, ERD, schema.sql |
| **2** ⭐ | Backend skeleton + Auth + Login UI | Server chạy được, đăng nhập thành công |
| **3** | CRUD Sản phẩm + Danh mục | Quản lý sản phẩm, danh mục cơ bản |
| **4** | Màn hình POS bán hàng | Giao diện chọn SP, thêm giỏ hàng |
| **5** | Tạo hóa đơn + Thanh toán | Tạo order, in hóa đơn, xuất PDF |
| **6** | Quản lý Kho hàng | Nhập kho, điều chỉnh tồn kho, cảnh báo |
| **7** | Quản lý KH + NCC + Nhân viên | CRUD khách hàng, nhà cung cấp, phân quyền |
| **8** | Dashboard + Báo cáo | Biểu đồ doanh thu, thống kê bán chạy |
| **9** | AI gợi ý nhập hàng | Tích hợp Groq API, gợi ý thông minh |
| **10** | Hoàn thiện + Deploy | Landing page, tối ưu, deploy Vercel |

---

## ⭐ TUẦN 2 - Chi Tiết (Tuần hiện tại)

### Mục tiêu tuần 2
- ✅ Khởi tạo project Backend (Express + TypeScript)
- ✅ Khởi tạo project Frontend (React + Vite + TypeScript + Tailwind)
- ✅ Kết nối Supabase PostgreSQL
- ✅ Tạo Database Schema cơ bản (roles, users)
- ✅ API đăng nhập / đăng xuất (JWT)
- ✅ Trang Login UI responsive
- ✅ Protected Route (chưa đăng nhập → redirect login)
- ✅ Health check API

### Những gì **CHƯA** làm ở tuần 2
- ❌ CRUD sản phẩm, danh mục
- ❌ Màn hình POS
- ❌ Hóa đơn, thanh toán
- ❌ Kho hàng, báo cáo
- ❌ AI recommendations

---

## 🤖 PROMPT CHO TUẦN 2

> [!IMPORTANT]
> Copy prompt bên dưới và paste vào một cuộc hội thoại AI mới. Đảm bảo AI có quyền đọc folder Sora-POS gốc để tham khảo kiến trúc.

### Prompt 1: Đọc & hiểu project gốc

```
Tôi có một project POS (Point of Sale) hoàn chỉnh tại folder hiện tại (Sora-pos). Hãy đọc 
và phân tích toàn bộ cấu trúc project này để hiểu kiến trúc, công nghệ, và cách tổ chức code.

Cụ thể hãy đọc:
1. README.md - Tổng quan project
2. database/schema.sql - Database schema
3. backend/package.json - Dependencies backend
4. backend/src/app.ts - Express setup
5. backend/src/server.ts - Server entry
6. backend/src/config/ - Cấu hình
7. backend/src/middlewares/ - Tất cả middleware
8. backend/src/routes/index.ts - Routes structure
9. backend/src/services/auth.service.ts - Auth logic
10. backend/src/controllers/auth.controller.ts - Auth controller
11. frontend/package.json - Dependencies frontend
12. frontend/src/App.tsx - React routing
13. frontend/src/stores/auth.store.ts - Auth state
14. frontend/src/services/api.ts - Axios config
15. frontend/src/services/auth.api.ts - Auth API calls
16. frontend/src/pages/auth/LoginPage.tsx - Login UI
17. frontend/src/routes/ProtectedRoute.tsx - Route guard
18. frontend/src/components/layout/MainLayout.tsx - Layout
19. frontend/src/index.css - Global styles

Sau khi đọc xong, hãy tóm tắt:
- Công nghệ sử dụng
- Kiến trúc tổng thể (layers, patterns)
- Cách xử lý Auth (JWT flow)
- Cách tổ chức code frontend (stores, services, pages)
```

### Prompt 2: Tạo code tuần 2 (CƠ BẢN)

```
Dựa trên project Sora-POS mà bạn vừa phân tích, tôi cần tạo lại project này NHƯNG 
chỉ ở mức CƠ BẢN cho tuần thứ 2 của báo cáo đồ án. 

## Yêu cầu tuần 2:

### Database (chỉ 2 bảng)
- Bảng `roles` (id, name, description, created_at, updated_at)
- Bảng `users` (id, email, password_hash, full_name, phone, role_id, is_active, 
  last_login, created_at, updated_at)
- Seed data: 3 roles (admin, manager, cashier) + 1 user admin mặc định

### Backend (Express + TypeScript)
Tham khảo cách tổ chức code từ project gốc nhưng chỉ tạo:
- `src/config/env.ts` - Biến môi trường (PORT, JWT_SECRET, SUPABASE_URL, v.v.)
- `src/config/supabase.ts` - Supabase client
- `src/app.ts` - Express setup (cors, json parser, morgan, routes, error handler)
- `src/server.ts` - Khởi chạy server
- `src/middlewares/auth.middleware.ts` - Verify JWT token
- `src/middlewares/error.middleware.ts` - Global error handler
- `src/middlewares/role.middleware.ts` - Kiểm tra role
- `src/routes/index.ts` - Health check + mount auth routes
- `src/routes/auth.routes.ts` - POST /login, POST /logout, GET /me
- `src/controllers/auth.controller.ts` - Xử lý request auth
- `src/services/auth.service.ts` - Logic đăng nhập, verify token
- `src/types/index.ts` - Interface User, Role, AuthPayload
- `src/utils/response.ts` - Helper format response
- `package.json` với dependencies: express, cors, morgan, dotenv, jsonwebtoken, 
  bcryptjs, @supabase/supabase-js, zod, tsx, typescript
- `tsconfig.json`
- `.env.example`

### Frontend (React + Vite + TypeScript + Tailwind)
Tham khảo UI và code style từ project gốc nhưng chỉ tạo:
- `src/main.tsx` - Entry point
- `src/App.tsx` - BrowserRouter, Routes chỉ có Login + Dashboard placeholder
- `src/index.css` - Tailwind directives + custom styles cơ bản
- `src/services/api.ts` - Axios instance với interceptor (tham khảo project gốc)
- `src/services/auth.api.ts` - login(), logout(), getMe()
- `src/stores/auth.store.ts` - Zustand store cho auth (tham khảo project gốc)
- `src/pages/auth/LoginPage.tsx` - Form đăng nhập đẹp, responsive
- `src/pages/dashboard/DashboardPage.tsx` - Placeholder "Welcome to Sora POS"
- `src/routes/ProtectedRoute.tsx` - Redirect nếu chưa đăng nhập
- `src/components/layout/MainLayout.tsx` - Sidebar đơn giản (chỉ có Dashboard, sẽ 
  thêm menu sau)
- `src/types/index.ts` - Interface User, Role, LoginForm
- `package.json` với dependencies: react, react-dom, react-router-dom, axios, 
  zustand, react-hook-form, @hookform/resolvers, zod, react-hot-toast, 
  react-icons, tailwindcss, vite
- `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`
- `.env.example`

## Nguyên tắc quan trọng:
1. Code phải CHẠY ĐƯỢC - không có placeholder hay TODO
2. Giữ CÙNG code style, naming convention, folder structure như project gốc
3. UI Login phải ĐẸP và responsive (tham khảo LoginPage.tsx gốc)
4. Dashboard chỉ là trang welcome đơn giản, có hiển thị tên user đã đăng nhập
5. Sidebar có sẵn cấu trúc nhưng chỉ có 1-2 menu item (Dashboard)
6. PHẢI có validation form (react-hook-form + zod)
7. PHẢI có toast notification (react-hot-toast)
8. PHẢI xử lý loading state khi đăng nhập

Hãy tạo toàn bộ files trên. Bắt đầu từ Database → Backend → Frontend.
```

---

## 📝 Prompt Cho Các Tuần Tiếp Theo

### Tuần 3: CRUD Sản phẩm + Danh mục

```
Tiếp tục phát triển hệ thống Sora POS. Tuần này thêm chức năng CRUD sản phẩm và 
danh mục.

## Database - Thêm 2 bảng:
- `categories` (id, name, description, image_url, is_active, created_at, updated_at)
- `products` (id, sku, barcode, name, description, category_id, cost_price, 
  sell_price, stock_quantity, min_stock_level, unit, image_url, is_active, 
  created_at, updated_at)

## Backend - Thêm:
- routes/product.routes.ts - CRUD endpoints
- routes/category.routes.ts - CRUD endpoints
- controllers/product.controller.ts
- controllers/category.controller.ts
- services/product.service.ts (tham khảo product.service.ts gốc)
- services/category.service.ts (tham khảo category.service.ts gốc)
- validations/product.validation.ts
- validations/category.validation.ts
- Cập nhật routes/index.ts mount thêm routes mới

## Frontend - Thêm:
- pages/products/ProductsPage.tsx - Bảng danh sách SP, tìm kiếm, filter, thêm/sửa/xóa
- pages/categories/CategoriesPage.tsx - Quản lý danh mục
- services/product.api.ts
- services/category.api.ts
- Cập nhật Sidebar thêm menu Sản phẩm, Danh mục
- Cập nhật App.tsx thêm routes mới

Tham khảo code gốc để giữ đúng style. UI phải ĐẸP với table, modal, search bar.
```

---

### Tuần 4: Màn hình POS

```
Tiếp tục phát triển Sora POS. Tuần này xây dựng màn hình POS bán hàng tại quầy.

## Yêu cầu:
- Trang POS chia 2 phần: bên trái là danh sách sản phẩm (grid), bên phải là giỏ hàng
- Tìm kiếm sản phẩm theo tên/SKU/barcode
- Filter theo danh mục
- Click sản phẩm → thêm vào giỏ hàng
- Tăng/giảm số lượng, xóa item khỏi giỏ
- Hiển thị tổng tiền real-time
- Zustand store cho giỏ hàng (cart.store.ts - tham khảo project gốc)

## Backend: Không cần thêm API mới (dùng lại GET /products)
## Frontend:
- pages/pos/POSPage.tsx (tham khảo POSPage.tsx gốc)
- stores/cart.store.ts (tham khảo cart.store.ts gốc)
- Cập nhật Sidebar + Routes
```

---

### Tuần 5: Hóa đơn + Thanh toán

```
Tiếp tục phát triển Sora POS. Tuần này thêm tạo hóa đơn và thanh toán.

## Database - Thêm 3 bảng:
- `orders` (tham khảo schema.sql gốc)
- `order_details` (tham khảo schema.sql gốc)
- `payments` (tham khảo schema.sql gốc)

## Backend:
- Thêm order routes, controller, service (tham khảo order.service.ts gốc)
- Thêm payment routes, controller, service
- Logic: tạo order → tạo order_details → trừ stock → tạo payment
- Tạo PDF hóa đơn với pdfkit

## Frontend:
- Tích hợp nút "Thanh toán" trên POS → tạo order
- pages/orders/OrdersPage.tsx - Xem danh sách hóa đơn
- Chi tiết hóa đơn, xuất PDF
```

---

### Tuần 6: Quản lý Kho

```
Tiếp tục phát triển Sora POS. Tuần này thêm quản lý kho hàng.

## Database - Thêm 2 bảng:
- `stock_transactions` (tham khảo schema.sql gốc)
- `stock_alerts` (tham khảo schema.sql gốc)

## Backend:
- stock routes, controller, service (tham khảo stock.service.ts gốc)
- API: GET /stock/alerts, POST /stock/import, POST /stock/adjust

## Frontend:
- pages/stock/StockPage.tsx - Tabs: Tồn kho, Nhập kho, Cảnh báo
- Hiển thị sản phẩm sắp hết hàng (badge cảnh báo)
- Form nhập kho
```

---

### Tuần 7: KH + NCC + Nhân viên

```
Tiếp tục phát triển Sora POS. Tuần này thêm quản lý khách hàng, nhà cung cấp, nhân viên.

## Database - Thêm bảng:
- `customers` (tham khảo schema.sql gốc)
- `suppliers` (tham khảo schema.sql gốc)

## Backend:
- customer routes/controller/service
- supplier routes/controller/service
- employee routes/controller/service (quản lý users)

## Frontend:
- pages/customers/CustomersPage.tsx
- pages/suppliers/SuppliersPage.tsx
- pages/employees/EmployeesPage.tsx
- Phân quyền hiển thị (cashier không thấy quản lý NV)
```

---

### Tuần 8: Dashboard + Báo cáo

```
Tiếp tục phát triển Sora POS. Tuần này xây dựng Dashboard thống kê và báo cáo.

## Backend:
- report routes/controller/service (tham khảo report.service.ts gốc)
- API: GET /reports/dashboard, GET /reports/revenue, GET /reports/top-products

## Frontend:
- pages/dashboard/DashboardPage.tsx - Nâng cấp thành dashboard thực sự:
  + Card thống kê: doanh thu hôm nay, tổng đơn, SP bán chạy
  + Biểu đồ doanh thu (Recharts - LineChart)
  + Top sản phẩm bán chạy (BarChart)
- pages/reports/ReportsPage.tsx - Báo cáo chi tiết, filter theo ngày
```

---

### Tuần 9: AI Gợi ý nhập hàng

```
Tiếp tục phát triển Sora POS. Tuần này tích hợp AI gợi ý nhập hàng.

## Database - Thêm bảng:
- `ai_recommendations` (tham khảo schema.sql gốc)

## Backend:
- Tích hợp Groq SDK
- ai routes/controller/service (tham khảo ai.service.ts gốc)
- Logic: phân tích doanh số → tính recommended_quantity → gọi Groq AI lấy insight

## Frontend:
- pages/ai/AIRecommendationsPage.tsx
- Hiển thị gợi ý AI dạng card, có priority badge
- Nút approve/reject
```

---

### Tuần 10: Hoàn thiện + Deploy

```
Hoàn thiện Sora POS. Tuần cuối: polish, tối ưu, deploy.

## Nhiệm vụ:
- Landing page giới thiệu sản phẩm (HTML/CSS/JS thuần)
- Tạo QR code cho sản phẩm
- Settings page (cài đặt cửa hàng)
- Deploy Frontend lên Vercel
- Deploy Backend lên Vercel (serverless)
- Viết README.md hoàn chỉnh
- Chuẩn bị slide báo cáo cuối kỳ
```

---

## 🎯 Nội Dung Báo Cáo Mẫu - Tuần 2

### Tiêu đề: "Thiết lập nền tảng hệ thống - Backend API & Xác thực người dùng"

### Nội dung trình bày:
1. **Kiến trúc hệ thống** (vẽ sơ đồ Client-Server-Database)
2. **Database Schema** (bảng roles, users - ERD)
3. **Backend API**:
   - Health check: `GET /api/health`
   - Đăng nhập: `POST /api/auth/login`
   - Đăng xuất: `POST /api/auth/logout`
   - Lấy thông tin user: `GET /api/auth/me`
4. **Demo live**:
   - Chạy backend → test API bằng Postman
   - Chạy frontend → đăng nhập thành công
   - Hiển thị trang Dashboard với tên user
   - Thử đăng nhập sai → hiện lỗi
   - Protected route: chưa login → redirect về login
5. **Công nghệ đã sử dụng**: Express, JWT, React, Zustand, Tailwind CSS

### Kết quả đạt được tuần 2:
- ✅ Server backend chạy ổn định tại port 3001
- ✅ Kết nối thành công với Supabase PostgreSQL
- ✅ Hệ thống xác thực JWT hoạt động
- ✅ Giao diện đăng nhập responsive, có validation
- ✅ Protected routes bảo vệ trang nội bộ

### Kế hoạch tuần 3:
- Xây dựng CRUD quản lý sản phẩm và danh mục

---

## ⚠️ Lưu Ý Quan Trọng

> [!WARNING]
> - Mỗi tuần phải **commit riêng** trên GitHub để giảng viên thấy tiến trình
> - Đặt tên branch theo tuần: `week-2/auth-setup`, `week-3/product-crud`, v.v.
> - Mỗi tuần nên có **3-5 commits** với message rõ ràng
> - Giữ `.env` trong `.gitignore`, chỉ push `.env.example`

> [!TIP]
> - Screenshot kết quả demo để đưa vào slide báo cáo
> - Quay video demo ngắn (~1 phút) cho mỗi tính năng
> - Chuẩn bị sẵn câu trả lời cho câu hỏi "Tại sao chọn công nghệ X?"
