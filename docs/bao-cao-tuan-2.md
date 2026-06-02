# BÁO CÁO TIẾN ĐỘ — TUẦN 2
# Xây Dựng Hệ Thống Bán Hàng Tại Quầy Tích Hợp Quản Lý Kho Và Cảnh Báo Tồn Kho Thấp

---

**Sinh viên:** [Họ tên]  
**MSSV:** [Mã số sinh viên]  
**Lớp:** [Tên lớp]  
**GVHD:** [Tên giảng viên]  
**Tuần báo cáo:** Tuần 2  
**Nội dung:** Thiết lập dự án — Backend API — Xác thực (Auth) — Giao diện đăng nhập & Dashboard  

---

## 1. Tóm Tắt Công Việc Tuần 2

Tuần 2 tập trung vào việc **xây dựng nền tảng kỹ thuật** cho toàn bộ hệ thống Sora POS. Cụ thể, đã hoàn thành:

| # | Hạng mục | Trạng thái |
|---|----------|:----------:|
| 1 | Thiết lập cấu trúc dự án (Monorepo) | ✅ Hoàn thành |
| 2 | Tạo CSDL trên Supabase (12 bảng, indexes, triggers) | ✅ Hoàn thành |
| 3 | Xây dựng Backend API (Express + TypeScript) | ✅ Hoàn thành |
| 4 | Hệ thống xác thực JWT (Login / Logout / GetMe) | ✅ Hoàn thành |
| 5 | Middleware bảo mật (Auth, Role, Validate, Error) | ✅ Hoàn thành |
| 6 | Xây dựng Frontend (React + Vite + Tailwind CSS) | ✅ Hoàn thành |
| 7 | Thiết kế giao diện Đăng nhập (Split-screen cao cấp) | ✅ Hoàn thành |
| 8 | Thiết kế giao diện Dashboard (Empty State) | ✅ Hoàn thành |
| 9 | Sidebar điều hướng đa vai trò (RBAC) | ✅ Hoàn thành |
| 10 | Kết nối Frontend ↔ Backend (Axios + Proxy) | ✅ Hoàn thành |

---

## 2. Chi Tiết Công Việc Đã Thực Hiện

### 2.1 Thiết Lập Cấu Trúc Dự Án

Dự án được tổ chức theo kiến trúc **Monorepo** gồm 3 module chính:

```
SORA-POS-V2/
├── .git/                    # Git version control
├── .gitignore
├── README.md
├── database/                # Scripts SQL
│   ├── schema.sql           # Cấu trúc 12 bảng
│   └── seed.sql             # Dữ liệu khởi tạo
├── docs/                    # Tài liệu dự án
│   ├── SRS.md               # Đặc tả yêu cầu
│   ├── architecture.md      # Kiến trúc hệ thống
│   ├── database-design.md   # Thiết kế CSDL
│   ├── api-specification.md # Đặc tả API
│   └── bao-cao-tuan-1.md
├── backend/                 # Express API Server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts
│       ├── server.ts
│       ├── config/          (2 files)
│       ├── controllers/     (1 file)
│       ├── middlewares/      (4 files)
│       ├── routes/           (2 files)
│       ├── services/         (1 file)
│       ├── types/            (1 file)
│       ├── utils/            (1 file)
│       └── validations/      (1 file)
└── frontend/                # React SPA
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── components/layout/ (2 files)
        ├── pages/auth/        (1 file)
        ├── pages/dashboard/   (1 file)
        ├── routes/            (1 file)
        ├── services/          (2 files)
        ├── stores/            (1 file)
        ├── types/             (1 file)
        └── validations/       (1 file)
```

**Tổng cộng:** ~40 files source code (không kể config, node_modules)

---

### 2.2 Công Nghệ Sử Dụng

| Layer | Công nghệ | Phiên bản |
|-------|-----------|-----------|
| **Frontend** | React + Vite + TypeScript | React 19, Vite 8, TS 6 |
| **Styling** | Tailwind CSS | 3.4 |
| **State Management** | Zustand (persist middleware) | 5.0 |
| **Form & Validation** | React Hook Form + Zod | RHF 7.76, Zod 4.4 |
| **HTTP Client** | Axios (interceptors) | 1.16 |
| **Routing** | React Router DOM | 7.16 |
| **Icons** | react-icons (HiOutline series) | 5.6 |
| **Toast** | react-hot-toast | 2.6 |
| **Backend** | Express + TypeScript | Express 4.21, TS 5.5 |
| **Auth** | JWT + bcryptjs | jsonwebtoken 9.0, bcryptjs 2.4 |
| **Database** | Supabase PostgreSQL | supabase-js 2.45 |
| **Dev Runner** | tsx (watch mode) | 4.19 |
| **Logging** | morgan | 1.10 |

---

### 2.3 Backend API — Kiến Trúc Phân Tầng (Layered Architecture)

Backend được thiết kế theo mô hình **Layered Architecture** chuẩn:

```
Client Request
    ↓
  Routes (định tuyến)
    ↓
  Middlewares (validate, auth, role, error)
    ↓
  Controllers (điều phối)
    ↓
  Services (logic nghiệp vụ)
    ↓
  Supabase Client (truy vấn CSDL)
```

#### 2.3.1 Cấu hình (Config)

| File | Chức năng |
|------|-----------|
| `config/env.ts` | Load biến môi trường (PORT, JWT_SECRET, SUPABASE keys, CORS origin) |
| `config/supabase.ts` | Khởi tạo Supabase client với Proxy pattern (lazy init để tránh crash khi chưa có config) |

#### 2.3.2 Middlewares (4 files)

| Middleware | Chức năng |
|------------|-----------|
| `auth.middleware.ts` | Xác thực JWT token từ header `Authorization: Bearer <token>`. Giải mã payload (userId, email, role) và gắn vào `req.user` |
| `role.middleware.ts` | Kiểm tra vai trò người dùng theo RBAC. Nhận danh sách roles cho phép, từ chối truy cập nếu không đủ quyền (HTTP 403) |
| `validate.middleware.ts` | Validation request body bằng Zod schema. Tự động trả về lỗi chi tiết nếu dữ liệu không hợp lệ |
| `error.middleware.ts` | Global error handler. Bắt mọi lỗi throw từ services, format response thống nhất `{ success, message }` |

#### 2.3.3 API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|:----:|
| `GET` | `/api/health` | Health check — kiểm tra API đang chạy | ❌ |
| `POST` | `/api/auth/login` | Đăng nhập (email + password → JWT token) | ❌ |
| `POST` | `/api/auth/logout` | Đăng xuất (invalidate session) | ✅ |
| `GET` | `/api/auth/me` | Lấy thông tin user hiện tại từ token | ✅ |

#### 2.3.4 Luồng Xác Thực (Authentication Flow)

```
┌─────────────┐      POST /api/auth/login       ┌─────────────────┐
│   Frontend   │ ──────────────────────────────→ │   Backend API    │
│  (LoginPage) │   { email, password }           │                  │
│              │                                  │  1. Zod validate │
│              │                                  │  2. Query user   │
│              │                                  │  3. bcrypt.compare│
│              │      { user, token }             │  4. Sign JWT     │
│              │ ←────────────────────────────── │  5. Update login │
│              │                                  └─────────────────┘
│  Zustand:    │
│  set(user,   │      GET /api/auth/me
│   token,     │ ──────────────────────────────→  Verify token
│   isAuth)    │      Authorization: Bearer xxx   Return user info
│              │ ←──────────────────────────────
│  persist to  │
│  localStorage│
└─────────────┘
```

#### 2.3.5 Format Response Thống Nhất

Mọi API response đều tuân theo chuẩn format:

```json
// Thành công
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": { ... }
}

// Thất bại
{
  "success": false,
  "message": "Email hoặc mật khẩu không đúng"
}
```

---

### 2.4 Frontend — Kiến Trúc Component

Frontend được xây dựng theo kiến trúc **Component-based** với luồng dữ liệu một chiều:

```
App.tsx
  ├── BrowserRouter
  │     ├── /login → LoginPage (public)
  │     └── /* → ProtectedRoute → MainLayout → Outlet
  │                                   ├── Sidebar (fixed, 256px)
  │                                   └── <main> → DashboardPage
  │
  ├── Zustand Store (auth.store.ts)
  │     ├── user, token, isAuthenticated
  │     ├── login(), logout(), checkAuth()
  │     └── persist → localStorage('sora-pos-auth')
  │
  └── Axios Service (api.ts)
        ├── Base URL: /api (proxy → localhost:3001)
        ├── Interceptor: auto-attach Bearer token
        └── Interceptor: auto-logout on 401
```

#### 2.4.1 Bảo Vệ Route (Protected Route)

Component `ProtectedRoute.tsx` thực hiện:
- Kiểm tra `isAuthenticated` → redirect về `/login` nếu chưa đăng nhập
- Kiểm tra role (nếu route yêu cầu) → hiển thị trang 403 nếu không đủ quyền
- Hiển thị loading spinner trong lúc `checkAuth()` đang chạy

#### 2.4.2 State Management (Zustand)

Store `auth.store.ts` quản lý toàn bộ trạng thái xác thực:

| Action | Mô tả |
|--------|-------|
| `login(email, password)` | Gọi API login → set user + token + isAuthenticated |
| `logout()` | Fire-and-forget API logout → clear state + localStorage |
| `checkAuth()` | Gọi API `/me` để verify token còn hợp lệ (khi reload trang) |
| `hasRole(...roles)` | Kiểm tra user có thuộc vai trò được phép không |

Dữ liệu được **persist** vào `localStorage` với key `sora-pos-auth` để giữ phiên đăng nhập khi refresh trang.

---

### 2.5 Thiết Kế Giao Diện Đăng Nhập (LoginPage)

Trang đăng nhập được thiết kế theo phong cách **Split-screen** cao cấp:

#### Panel trái (Light theme — Form đăng nhập):
- Logo **Sora POS** với icon túi shopping gradient xanh
- Form đăng nhập gồm:
  - Input "Tên đăng nhập" (email) với icon User bên trái
  - Input "Mật khẩu" với icon Lock bên trái và nút toggle hiện/ẩn mật khẩu
  - Checkbox "Ghi nhớ đăng nhập"
  - Nút "Đăng nhập" màu xanh dương đậm (`bg-blue-600`) bo tròn
  - Link "Quên mật khẩu?"
- Nút phụ "Đăng nhập với tài khoản khác" viền xám nhạt
- Footer bản quyền
- **Easter Egg**: Click logo Sora POS → tự động điền tài khoản admin

#### Panel phải (Dark theme — Showcase):
- Ảnh nền kệ hàng siêu thị phủ gradient xanh navy mờ ảo
- Tiêu đề: "Quản lý bán hàng & tồn kho toàn diện"
- 4 khối tính năng dạng card bán trong suốt (glassmorphism):
  - Bán hàng nhanh | Quản lý tồn kho | Quét mã vạch | Báo cáo chi tiết
- Mockup thiết bị POS (màn hình cảm ứng + máy in hóa đơn + máy quét)
- Card floating "Cảnh báo tồn kho thấp" nổi trên bên phải
- Card floating "Tổng quan tồn kho" với biểu đồ Donut SVG
- Thanh KPI Bar thống kê ở chân trang

---

### 2.6 Thiết Kế Giao Diện Dashboard (Empty State)

Dashboard được thiết kế ở **trạng thái khởi tạo** (chưa có dữ liệu thực) gồm:

#### Header bar:
- Lời chào: "Xin chào, [Tên] 👋" + vai trò
- Thanh tìm kiếm nhanh (⌘/)
- Nút thông báo (bell icon)
- Badge profile người dùng (avatar + tên + vai trò)

#### 4 Thẻ KPI:
| Thẻ | Giá trị | Ghi chú |
|-----|---------|---------|
| Doanh thu hôm nay | 0đ | Sparkline phẳng, badge 0% |
| Đơn hàng | 0 | Sparkline phẳng, badge 0% |
| Sản phẩm | 0 | Sparkline phẳng, badge 0% |
| Cảnh báo tồn kho | 0 | Sparkline phẳng, badge 0% |

#### Biểu đồ doanh thu (50% width):
- Hệ trục tọa độ với gridlines
- Đường phẳng tại mốc 0 (nét đứt)
- Overlay thông báo: *"Chưa có dữ liệu doanh thu"*
- Toggle thời gian: 7 ngày / 30 ngày / 12 tháng
- Footer: Tổng doanh thu = 0đ, Trung bình/ngày = 0đ

#### Top sản phẩm bán chạy (25% width):
- Empty State: Icon cúp vàng mờ + thông báo *"Chưa có dữ liệu bán hàng"*

#### Cảnh báo tồn kho thấp (25% width):
- Empty State: Icon checkmark xanh lục + thông báo *"Tồn kho an toàn"*

#### Bố cục chân trang (chia đôi 50/50):
| Cột trái — Thao tác nhanh | Cột phải — Gợi ý & thông tin |
|---------------------------|------------------------------|
| 🛒 Bán hàng — Tạo đơn hàng mới | Doanh thu tuần: 0đ (0%) |
| 🚛 Nhập kho — Tạo phiếu nhập | Lợi nhuận ước tính: 0đ (0%) |
| ➕ Thêm SP — Thêm sản phẩm mới | Tỷ lệ lợi nhuận: 0% (0%) |
| 📊 Báo cáo — Xem báo cáo tổng quan | |

---

### 2.7 Sidebar Điều Hướng

Sidebar cố định bên trái (256px) với thiết kế tối (dark theme):

#### Tính năng:
- Logo gradient xanh dương + tên hệ thống
- Menu điều hướng theo vai trò (RBAC):

| Menu item | Admin | Manager | Cashier |
|-----------|:-----:|:-------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ |
| Bán hàng (POS) | ✅ | ✅ | ✅ |
| Sản phẩm | ✅ | ✅ | ✅ |
| Danh mục | ✅ | ✅ | ❌ |
| Hóa đơn | ✅ | ✅ | ✅ |
| Kho hàng | ✅ | ✅ | ❌ |
| Cảnh báo tồn kho | ✅ | ✅ | ✅ |
| Khách hàng | ✅ | ✅ | ✅ |
| Báo cáo | ✅ | ✅ | ❌ |
| AI Gợi ý | ✅ | ✅ | ❌ |
| Cài đặt | ✅ | ❌ | ❌ |

- Active link dạng viên thuốc bo tròn (`rounded-xl`) màu xanh dương
- Khu vực chân: Avatar + tên + vai trò + nút Đăng xuất

---

### 2.8 Cơ Sở Dữ Liệu (Đã Triển Khai Trên Supabase)

Schema đầy đủ gồm **12 bảng** đã được tạo trên Supabase:

| # | Bảng | Mô tả | Tuần sử dụng |
|---|------|-------|:------------:|
| 1 | `roles` | Vai trò (admin, manager, cashier) | Tuần 2 ✅ |
| 2 | `users` | Người dùng hệ thống | Tuần 2 ✅ |
| 3 | `categories` | Danh mục sản phẩm | Tuần 3 |
| 4 | `suppliers` | Nhà cung cấp | Tuần 4 |
| 5 | `products` | Sản phẩm (SKU, barcode, giá nhập/bán, tồn kho) | Tuần 3 |
| 6 | `customers` | Khách hàng (điểm tích lũy) | Tuần 4 |
| 7 | `orders` | Hóa đơn bán hàng | Tuần 5 |
| 8 | `order_details` | Chi tiết hóa đơn | Tuần 5 |
| 9 | `payments` | Thanh toán (tiền mặt, thẻ, ví điện tử) | Tuần 5 |
| 10 | `stock_transactions` | Giao dịch kho (nhập/xuất/điều chỉnh) | Tuần 6 |
| 11 | `stock_alerts` | Cảnh báo tồn kho thấp | Tuần 6 |
| 12 | `ai_recommendations` | Gợi ý nhập hàng từ AI | Tuần 9 |

**Bổ sung kỹ thuật:**
- 15 indexes cho các trường thường xuyên query (email, SKU, FK, created_at)
- 9 triggers tự động cập nhật `updated_at` khi UPDATE
- Dữ liệu seed: 3 roles + 1 tài khoản admin (`admin@sorapos.com` / `password123`)

---

## 3. Kiến Trúc Tổng Quan Hệ Thống

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER                                │
│                                                                │
│  ┌─────────────────────┐     ┌──────────────────────────┐    │
│  │     React SPA        │     │     Vite Dev Server      │    │
│  │  (localhost:5173)    │────→│  Proxy /api → :3001      │    │
│  │                      │     └──────────────────────────┘    │
│  │  • LoginPage         │                                      │
│  │  • DashboardPage     │                                      │
│  │  • Sidebar           │                                      │
│  │  • ProtectedRoute    │                                      │
│  │                      │                                      │
│  │  Zustand + Axios     │                                      │
│  └──────────┬───────────┘                                      │
│             │ HTTP (Axios)                                      │
└─────────────┼──────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────┐
│                   EXPRESS API SERVER                           │
│                   (localhost:3001)                              │
│                                                                │
│  app.ts → CORS + JSON Parser + Morgan + Routes + ErrorHandler │
│                                                                │
│  Routes:                                                       │
│    GET  /api/health          → Health check                   │
│    POST /api/auth/login      → Validate → Login               │
│    POST /api/auth/logout     → Auth → Logout                  │
│    GET  /api/auth/me         → Auth → GetMe                   │
│                                                                │
│  Middlewares: Auth → Role → Validate → Error                  │
│  Services:   AuthService (bcrypt + JWT + Supabase query)      │
└──────────────────────┬─────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   SUPABASE (PostgreSQL)                        │
│                                                                │
│  12 tables + 15 indexes + 9 triggers                          │
│  Tuần 2: Chỉ sử dụng roles + users                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Kết Quả Kiểm Thử

### 4.1 Kiểm thử Backend API

| Test Case | Input | Expected | Actual | Kết quả |
|-----------|-------|----------|--------|:-------:|
| Health Check | `GET /api/health` | `{ success: true }` | `{ success: true, message: "🚀 Sora POS API is running" }` | ✅ |
| Login đúng | `email: admin@sorapos.com, password: password123` | Trả về `{ user, token }` | Đúng như kỳ vọng | ✅ |
| Login sai password | `email: admin@sorapos.com, password: wrong` | HTTP 401 | `{ success: false, message: "Email hoặc mật khẩu không đúng" }` | ✅ |
| Login thiếu email | `{ password: "123" }` | HTTP 400 (validation) | Trả về lỗi Zod validation | ✅ |
| Get Me (có token) | `GET /api/auth/me` + Bearer token | Trả về thông tin user | Đúng | ✅ |
| Get Me (không token) | `GET /api/auth/me` (no header) | HTTP 401 | `{ message: "Không tìm thấy token" }` | ✅ |
| Get Me (token hết hạn) | Token expired | HTTP 401 | Auto-logout trên frontend | ✅ |

### 4.2 Kiểm thử Frontend

| Test Case | Mô tả | Kết quả |
|-----------|-------|:-------:|
| Truy cập `/` khi chưa login | Redirect về `/login` | ✅ |
| Đăng nhập thành công | Redirect về Dashboard, hiển thị tên user | ✅ |
| Đăng nhập sai | Hiện thông báo lỗi + shake animation | ✅ |
| Reload trang sau login | Giữ phiên (localStorage persist) | ✅ |
| Đăng xuất | Clear state + redirect `/login` | ✅ |
| Easter Egg (click logo) | Auto-fill tài khoản admin | ✅ |
| TypeScript compile | `npx tsc --noEmit` → 0 lỗi | ✅ |
| Dashboard empty state | Tất cả chỉ số = 0, thông báo trống hiển thị đúng | ✅ |
| Sidebar active state | Highlight dạng pill bo tròn màu xanh | ✅ |
| Responsive layout | Dashboard cards responsive 1-2-4 columns | ✅ |

### 4.3 Biên dịch

```bash
# Backend
$ cd backend && npm run dev
# Server running on port 3001 ✅

# Frontend
$ cd frontend && npm run dev
# Vite dev server on http://localhost:5173 ✅

# TypeScript check
$ cd frontend && npx tsc --noEmit
# Completed with 0 errors ✅
```

---

## 5. Thống Kê Source Code

| Module | Số files | Ngôn ngữ |
|--------|:--------:|----------|
| Backend Config | 2 | TypeScript |
| Backend Controllers | 1 | TypeScript |
| Backend Middlewares | 4 | TypeScript |
| Backend Routes | 2 | TypeScript |
| Backend Services | 1 | TypeScript |
| Backend Types | 1 | TypeScript |
| Backend Utils | 1 | TypeScript |
| Backend Validations | 1 | TypeScript |
| Backend Entry | 2 | TypeScript |
| **Backend Tổng** | **15** | |
| Frontend Components | 2 | TSX |
| Frontend Pages | 2 | TSX |
| Frontend Routes | 1 | TSX |
| Frontend Services | 2 | TypeScript |
| Frontend Stores | 1 | TypeScript |
| Frontend Types | 1 | TypeScript |
| Frontend Validations | 1 | TypeScript |
| Frontend Entry | 2 | TSX |
| Frontend Styles | 1 | CSS |
| **Frontend Tổng** | **13** | |
| Database Scripts | 2 | SQL |
| Tài liệu | 5 | Markdown |
| **TỔNG CỘNG** | **~35** | |

---

## 6. Khó Khăn Gặp Phải Và Cách Giải Quyết

### 6.1 Lỗi Bcrypt Hash không khớp
- **Vấn đề**: Password hash được seed vào database bị cắt ngắn/sai format, dẫn đến `bcrypt.compare()` luôn trả về `false` → không thể đăng nhập.
- **Giải pháp**: Viết script Node.js sử dụng Supabase client để tạo hash mới từ `bcrypt.hashSync('password123', 10)` và UPDATE trực tiếp vào database.

### 6.2 Lỗi PowerShell Variable Expansion
- **Vấn đề**: Ký tự `$` trong chuỗi bcrypt hash (`$2a$10$...`) bị PowerShell hiểu nhầm thành biến, gây truncation.
- **Giải pháp**: Sử dụng file `.js` độc lập để thực hiện database operations thay vì chạy inline qua PowerShell.

### 6.3 Lỗi Port EADDRINUSE
- **Vấn đề**: Chạy nhiều instance backend dẫn đến port 3001 bị chiếm.
- **Giải pháp**: Kill process cũ trước khi khởi động lại dev server.

### 6.4 TypeScript Deprecation Warning
- **Vấn đề**: TypeScript cảnh báo `baseUrl` khi không kết hợp với `paths` trong `tsconfig.json`.
- **Giải pháp**: Loại bỏ `baseUrl` khỏi cấu hình TypeScript frontend.

---

## 7. Tài Khoản Đăng Nhập Hệ Thống

| Vai trò | Email | Mật khẩu |
|---------|-------|----------|
| Admin (Quản trị viên) | admin@sorapos.com | password123 |

---

## 8. Kế Hoạch Tuần 3

| # | Hạng mục | Mô tả |
|---|----------|-------|
| 1 | CRUD Danh mục | API + UI quản lý danh mục sản phẩm |
| 2 | CRUD Sản phẩm | API + UI quản lý sản phẩm (giá, tồn kho, ảnh, mã vạch) |
| 3 | Tìm kiếm & Lọc | Tìm sản phẩm theo tên, SKU; lọc theo danh mục |
| 4 | Upload ảnh | Tích hợp Supabase Storage cho ảnh sản phẩm |
| 5 | Seed dữ liệu mẫu | Tạo 10 danh mục + 50 sản phẩm để test |

---

## 9. Kết Luận

Tuần 2 đã hoàn thành đúng tiến độ **100%** các mục tiêu đề ra:

- ✅ **Nền tảng kỹ thuật** vững chắc: Backend Express API + Frontend React SPA đã kết nối thông suốt
- ✅ **Hệ thống xác thực** hoàn chỉnh: JWT + bcrypt + RBAC + persist session
- ✅ **Giao diện cao cấp**: Trang đăng nhập split-screen và Dashboard empty state được thiết kế theo phong cách SaaS hiện đại
- ✅ **CSDL sẵn sàng**: 12 bảng đã tạo trên Supabase, sẵn sàng cho các module tiếp theo
- ✅ **Code quality**: TypeScript strict mode, 0 lỗi biên dịch, cấu trúc rõ ràng

Hệ thống đã sẵn sàng để mở rộng tính năng CRUD sản phẩm & danh mục ở tuần 3.
