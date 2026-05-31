# 🏗️ Kiến Trúc Hệ Thống - Sora POS

**Ngày tạo:** 31/05/2026  
**Phiên bản:** 1.0  

---

## 1. Tổng Quan Kiến Trúc

Sora POS sử dụng kiến trúc **Client-Server** 3 tầng (3-tier architecture):

```
┌─────────────────────────────────────────────────┐
│              PRESENTATION LAYER                  │
│         (Frontend - React SPA)                   │
│                                                  │
│  ┌──────┐  ┌────────┐  ┌─────────┐  ┌────────┐ │
│  │Pages │  │Stores  │  │Services │  │Routes  │ │
│  │(UI)  │  │(State) │  │(API)    │  │(Guard) │ │
│  └──────┘  └────────┘  └────┬────┘  └────────┘ │
│                              │ Axios HTTP        │
└──────────────────────────────┼───────────────────┘
                               │
                        ┌──────▼──────┐
                        │  REST API   │
                        └──────┬──────┘
                               │
┌──────────────────────────────┼───────────────────┐
│              BUSINESS LOGIC LAYER                 │
│         (Backend - Express.js)                    │
│                                                   │
│  ┌───────────┐   ┌─────────────┐   ┌──────────┐ │
│  │Middlewares │──>│ Controllers │──>│ Services │ │
│  │(Auth,Role, │   │(Request     │   │(Business │ │
│  │ Validate)  │   │ handling)   │   │ logic)   │ │
│  └───────────┘   └─────────────┘   └────┬─────┘ │
│                                          │       │
└──────────────────────────────────────────┼───────┘
                                           │
┌──────────────────────────────────────────┼───────┐
│              DATA ACCESS LAYER                    │
│         (Supabase PostgreSQL)                     │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │              PostgreSQL Database             │ │
│  │  12 tables + indexes + triggers              │ │
│  └─────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

---

## 2. Công Nghệ & Lý Do Chọn

### 2.1 Frontend

| Công nghệ | Phiên bản | Lý do chọn |
|-----------|-----------|-----------|
| **ReactJS** | 18.3 | Thư viện UI phổ biến nhất, component-based, virtual DOM tối ưu hiệu năng |
| **TypeScript** | 5.5 | Type-safe, giảm lỗi runtime, hỗ trợ IDE tốt hơn |
| **Vite** | 5.4 | Build tool nhanh nhất hiện tại (HMR < 50ms), thay thế Webpack |
| **Tailwind CSS** | 3.4 | Utility-first CSS, phát triển nhanh, bundle size nhỏ (chỉ CSS đã dùng) |
| **Zustand** | 4.5 | State management đơn giản hơn Redux, không cần boilerplate |
| **React Router** | 6.26 | Routing tiêu chuẩn cho React SPA |
| **Axios** | 1.7 | HTTP client với interceptors, auto-retry, cancel token |
| **React Hook Form** | 7.53 | Form management hiệu năng cao (uncontrolled components) |
| **Zod** | 3.23 | Schema validation type-safe, dùng chung frontend-backend |
| **Recharts** | 2.12 | Biểu đồ React đẹp, dễ customize, responsive |

### 2.2 Backend

| Công nghệ | Phiên bản | Lý do chọn |
|-----------|-----------|-----------|
| **Express.js** | 4.21 | Framework Node.js phổ biến nhất, lightweight, middleware ecosystem lớn |
| **TypeScript** | 5.5 | Giống frontend, type-safe cho API |
| **JWT** | 9.0 | Stateless authentication, không cần session server |
| **bcryptjs** | 2.4 | Băm mật khẩu an toàn, chống rainbow table |
| **Zod** | 3.23 | Validate request body, reuse schema với frontend |
| **tsx** | 4.19 | Chạy TypeScript trực tiếp không cần build (dev mode) |
| **morgan** | 1.10 | HTTP request logger cho development |

### 2.3 Database

| Công nghệ | Lý do chọn |
|-----------|-----------|
| **PostgreSQL** | RDBMS mạnh nhất, hỗ trợ UUID native, JSON, full-text search |
| **Supabase** | PostgreSQL managed cloud, free tier 500MB, SDK tốt, realtime |

### 2.4 AI Integration

| Công nghệ | Lý do chọn |
|-----------|-----------|
| **Groq SDK** | API inference cực nhanh (< 500ms), free tier rộng rãi |

---

## 3. Cấu Trúc Thư Mục Chi Tiết

### 3.1 Backend

```
backend/
├── src/
│   ├── app.ts                    # Express app setup (middlewares, routes)
│   ├── server.ts                 # Server entry point (listen port)
│   ├── config/
│   │   ├── env.ts                # Environment variables
│   │   ├── supabase.ts           # Supabase client (lazy init)
│   │   └── groq.ts               # Groq AI client
│   ├── routes/
│   │   ├── index.ts              # Route aggregator + health check
│   │   ├── auth.routes.ts        # POST /login, /logout, GET /me
│   │   ├── product.routes.ts     # CRUD /products
│   │   ├── category.routes.ts    # CRUD /categories
│   │   ├── order.routes.ts       # /orders + /orders/:id/pdf
│   │   ├── stock.routes.ts       # /stock/alerts, /stock/import
│   │   ├── report.routes.ts      # /reports/dashboard, /reports/revenue
│   │   └── ai.routes.ts          # /ai/recommend-restock
│   ├── controllers/              # Request/Response handling
│   │   └── *.controller.ts       # Một controller per module
│   ├── services/                 # Business logic (DB queries)
│   │   └── *.service.ts          # Một service per module
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # JWT verification
│   │   ├── role.middleware.ts     # RBAC authorization
│   │   ├── validate.middleware.ts # Zod schema validation
│   │   └── error.middleware.ts    # Global error handler
│   ├── types/                    # TypeScript interfaces
│   ├── validations/              # Zod schemas (request body)
│   └── utils/
│       ├── response.ts           # Chuẩn hóa API response
│       ├── pdf.ts                # Tạo PDF hóa đơn
│       └── qr.ts                 # Tạo QR code
├── package.json
├── tsconfig.json
├── .env.example
└── vercel.json                   # Vercel serverless config
```

### 3.2 Frontend

```
frontend/
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Router setup + route definitions
│   ├── index.css                 # Tailwind + custom animations
│   ├── pages/                    # Mỗi page = một thư mục
│   │   ├── auth/LoginPage.tsx    # Trang đăng nhập
│   │   ├── dashboard/            # Dashboard thống kê
│   │   ├── pos/POSPage.tsx       # Màn hình bán hàng
│   │   ├── products/             # Quản lý sản phẩm
│   │   ├── categories/           # Quản lý danh mục
│   │   ├── orders/               # Quản lý hóa đơn
│   │   ├── stock/                # Quản lý kho
│   │   ├── customers/            # Quản lý khách hàng
│   │   ├── suppliers/            # Quản lý NCC
│   │   ├── employees/            # Quản lý nhân viên
│   │   ├── reports/              # Báo cáo
│   │   ├── ai/                   # AI gợi ý
│   │   └── settings/             # Cài đặt
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx    # Sidebar + Content area
│   │   │   └── Sidebar.tsx       # Navigation menu
│   │   └── common/               # Shared UI components
│   ├── stores/                   # Zustand state stores
│   │   ├── auth.store.ts         # Auth state (user, token, login/logout)
│   │   └── cart.store.ts         # POS cart state
│   ├── services/                 # API call functions
│   │   ├── api.ts                # Axios instance + interceptors
│   │   ├── auth.api.ts           # Auth API calls
│   │   ├── product.api.ts        # Product API calls
│   │   └── ...                   # Một file per module
│   ├── types/                    # TypeScript interfaces
│   ├── validations/              # Zod schemas (form validation)
│   └── utils/                    # Helper functions
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

---

## 4. Design Patterns Sử Dụng

### 4.1 Layered Architecture (Backend)
```
Request → Route → [Middleware] → Controller → Service → Database
                                                        ↓
Response ← Controller ← Service ← Database Result
```

- **Route**: Định nghĩa HTTP method + path + middleware chain
- **Middleware**: Auth check, role check, request validation
- **Controller**: Nhận request, gọi service, format response
- **Service**: Business logic thuần, tương tác database

### 4.2 Repository Pattern (Service Layer)
Mỗi service encapsulate tất cả DB queries cho một entity:
```typescript
// Ví dụ: ProductService
class ProductService {
  static async getAll(filters)    // SELECT ... WHERE ...
  static async getById(id)        // SELECT ... WHERE id = ?
  static async create(data)       // INSERT INTO ...
  static async update(id, data)   // UPDATE ... SET ... WHERE id = ?
  static async delete(id)         // UPDATE ... SET is_active = false
}
```

### 4.3 Proxy Pattern (Supabase Client)
Lazy initialization để tránh crash khi chưa config:
```typescript
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});
```

### 4.4 Observer Pattern (Zustand Store)
Components tự động re-render khi state thay đổi:
```typescript
// Store
const useAuthStore = create(persist((set, get) => ({
  user: null,
  login: async () => { ... set({ user, token }) },
})));

// Component
function Sidebar() {
  const { user } = useAuthStore(); // Auto re-render khi user thay đổi
}
```

### 4.5 Interceptor Pattern (Axios)
Tự động gắn token và xử lý lỗi 401:
```typescript
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

## 5. Luồng Xử Lý Chính

### 5.1 Authentication Flow (JWT)
```
┌──────────┐          ┌──────────┐          ┌──────────┐
│ Frontend │          │ Backend  │          │ Database │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │ POST /auth/login    │                     │
     │ { email, password } │                     │
     │────────────────────>│                     │
     │                     │ SELECT user WHERE   │
     │                     │ email = ?           │
     │                     │────────────────────>│
     │                     │     user data       │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ bcrypt.compare()    │
     │                     │ jwt.sign()          │
     │                     │                     │
     │   { user, token }   │                     │
     │<────────────────────│                     │
     │                     │                     │
     │ Zustand: save to    │                     │
     │ localStorage        │                     │
     │                     │                     │
     │ Redirect → Dashboard│                     │
     └─────────────────────┘                     │
```

### 5.2 POS Sale Flow
```
1. Cashier chọn sản phẩm → Thêm vào cart (Zustand store)
2. Nhấn "Thanh toán" → POST /api/orders (gửi cart items)
3. Backend:
   a. Tạo record trong bảng `orders`
   b. Tạo records trong bảng `order_details`
   c. Trừ `stock_quantity` trong bảng `products`
   d. Tạo record trong bảng `payments`
   e. Tạo `stock_transactions` (type: 'sale')
   f. Kiểm tra ngưỡng → Tạo `stock_alerts` nếu cần
4. Trả về order data → Frontend hiển thị hóa đơn
```

---

## 6. Bảo Mật

| Lớp | Biện pháp |
|-----|-----------|
| **Transport** | HTTPS (Vercel tự cấp SSL) |
| **Authentication** | JWT token trong header Authorization |
| **Authorization** | RBAC middleware kiểm tra role |
| **Password** | bcrypt hash (10 salt rounds) |
| **Input** | Zod validation trên cả client & server |
| **CORS** | Whitelist origin cụ thể |
| **Sensitive Data** | .env trong .gitignore, không push lên Git |
| **SQL Injection** | Supabase SDK parameterized queries |
