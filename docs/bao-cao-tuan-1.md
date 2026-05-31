# 📝 BÁO CÁO TUẦN 1
# Đồ Án Cơ Sở — Hệ Thống Quản Lý Bán Hàng Tại Quầy (Sora POS)

**Sinh viên:** [Họ tên]  
**MSSV:** [Mã số sinh viên]  
**Lớp:** [Tên lớp]  
**GVHD:** [Tên giảng viên]  
**Ngày báo cáo:** ____/____/2026  

---

## 1. Tiêu Đề Tuần 1

> **"Phân tích yêu cầu, thiết kế kiến trúc hệ thống và cơ sở dữ liệu"**

---

## 2. Mục Tiêu Tuần 1

| # | Mục tiêu | Trạng thái |
|---|----------|------------|
| 1 | Xác định bài toán và phạm vi dự án | ✅ Hoàn thành |
| 2 | Phân tích yêu cầu chức năng và phi chức năng | ✅ Hoàn thành |
| 3 | Xác định đối tượng sử dụng và phân quyền | ✅ Hoàn thành |
| 4 | Lựa chọn công nghệ phù hợp | ✅ Hoàn thành |
| 5 | Thiết kế kiến trúc hệ thống (Client-Server 3 tầng) | ✅ Hoàn thành |
| 6 | Thiết kế cơ sở dữ liệu (ERD + Schema SQL) | ✅ Hoàn thành |
| 7 | Thiết kế API endpoints | ✅ Hoàn thành |
| 8 | Khởi tạo Git repository | ✅ Hoàn thành |

---

## 3. Giới Thiệu Đề Tài

### 3.1 Tên đề tài
**Sora POS** — Hệ thống quản lý bán hàng tại quầy (Point of Sale) tích hợp AI gợi ý nhập hàng.

### 3.2 Lý do chọn đề tài
- Các cửa hàng bán lẻ nhỏ và vừa hiện nay vẫn quản lý thủ công (sổ sách, Excel), dễ sai sót, mất thời gian.
- Cần một hệ thống phần mềm giúp **tự động hóa** quy trình bán hàng, quản lý kho, và theo dõi doanh thu.
- Tích hợp **AI** để gợi ý nhập hàng thông minh, giúp chủ cửa hàng ra quyết định tốt hơn.

### 3.3 Phạm vi dự án
Xây dựng ứng dụng web full-stack bao gồm:
- Bán hàng tại quầy (POS)
- Quản lý sản phẩm, danh mục, nhà cung cấp, khách hàng
- Tạo hóa đơn, xuất PDF
- Quản lý kho hàng, cảnh báo tồn kho
- Dashboard thống kê, báo cáo doanh thu
- AI gợi ý nhập hàng (Groq API)

---

## 4. Phân Tích Yêu Cầu

### 4.1 Đối tượng sử dụng (3 vai trò)

| Vai trò | Quyền hạn chính |
|---------|-----------------|
| **Admin** (Quản trị viên) | Toàn quyền: quản lý người dùng, sản phẩm, kho, báo cáo, AI, cài đặt |
| **Manager** (Quản lý) | Quản lý sản phẩm, kho, hóa đơn, khách hàng, xem báo cáo |
| **Cashier** (Thu ngân) | Bán hàng tại quầy, tạo hóa đơn, xem tồn kho |

### 4.2 Yêu cầu chức năng (tóm tắt 9 module)

| Module | Chức năng chính |
|--------|----------------|
| **Xác thực** | Đăng nhập/xuất JWT, phân quyền RBAC |
| **Dashboard** | Thống kê doanh thu, biểu đồ, top SP bán chạy |
| **POS** | Màn hình bán hàng: chọn SP, giỏ hàng, thanh toán |
| **Sản phẩm** | CRUD sản phẩm, danh mục, tìm kiếm, filter |
| **Hóa đơn** | Tạo đơn, xem chi tiết, xuất PDF, hủy đơn |
| **Kho hàng** | Nhập kho, điều chỉnh tồn, cảnh báo hết hàng |
| **Đối tác** | CRUD khách hàng, nhà cung cấp, nhân viên |
| **Báo cáo** | Doanh thu theo ngày/tuần/tháng, top SP |
| **AI** | Gợi ý nhập hàng dựa trên doanh số + Groq AI |

*(Chi tiết đầy đủ: xem file `docs/SRS.md`)*

### 4.3 Yêu cầu phi chức năng

- **Hiệu năng:** API phản hồi ≤ 500ms, trang load ≤ 3s
- **Bảo mật:** Mật khẩu băm bcrypt, JWT token, RBAC, CORS
- **Giao diện:** Responsive, font Inter, toast notification, loading state
- **Mở rộng:** Kiến trúc phân lớp, RESTful API chuẩn

---

## 5. Công Nghệ Sử Dụng

### 5.1 Tổng quan stack

```
Frontend:  React + TypeScript + Vite + Tailwind CSS
Backend:   Express.js + TypeScript + JWT
Database:  PostgreSQL (Supabase)
AI:        Groq SDK
Deploy:    Vercel
```

### 5.2 Lý do chọn từng công nghệ

| Công nghệ | Lý do |
|-----------|-------|
| **React** | Thư viện UI phổ biến nhất, component-based, ecosystem lớn |
| **TypeScript** | Type-safe, giảm lỗi runtime, IDE hỗ trợ tốt |
| **Vite** | Build tool nhanh nhất (HMR < 50ms), thay thế Webpack |
| **Tailwind CSS** | Utility-first, phát triển nhanh, bundle nhỏ |
| **Zustand** | State management đơn giản hơn Redux, không boilerplate |
| **Express.js** | Framework Node.js nhẹ, middleware ecosystem phong phú |
| **JWT** | Xác thực stateless, không cần session server |
| **Supabase** | PostgreSQL cloud miễn phí, SDK tốt, dễ setup |
| **Zod** | Validation type-safe, dùng chung FE-BE |

---

## 6. Thiết Kế Kiến Trúc

### 6.1 Mô hình Client-Server 3 tầng

```
┌────────────────────────────────────────────┐
│         PRESENTATION (Frontend)            │
│    React + Zustand + Axios + Tailwind      │
└────────────────────┬───────────────────────┘
                     │ HTTP REST API
┌────────────────────▼───────────────────────┐
│         BUSINESS LOGIC (Backend)           │
│  Express → Middleware → Controller → Service│
└────────────────────┬───────────────────────┘
                     │ Supabase SDK
┌────────────────────▼───────────────────────┐
│         DATA ACCESS (Database)             │
│        PostgreSQL (Supabase Cloud)         │
└────────────────────────────────────────────┘
```

### 6.2 Kiến trúc Backend (Layered Architecture)

```
Request → Route → [Auth Middleware] → [Role Middleware] → [Validate Middleware]
                                                                  ↓
                                                            Controller
                                                                  ↓
                                                             Service
                                                                  ↓
                                                           Supabase DB
```

*(Chi tiết: xem file `docs/architecture.md`)*

---

## 7. Thiết Kế Cơ Sở Dữ Liệu

### 7.1 Tổng quan: 12 bảng

| Nhóm | Bảng | Mô tả |
|------|------|-------|
| **Người dùng** | `roles`, `users` | Vai trò + tài khoản |
| **Sản phẩm** | `categories`, `suppliers`, `products` | Danh mục, NCC, SP |
| **Bán hàng** | `customers`, `orders`, `order_details`, `payments` | KH, hóa đơn, thanh toán |
| **Kho** | `stock_transactions`, `stock_alerts` | Giao dịch kho, cảnh báo |
| **AI** | `ai_recommendations` | Gợi ý nhập hàng |

### 7.2 Sơ đồ quan hệ (ERD tóm tắt)

```
roles ──1:N──► users ──1:N──► orders ──1:N──► order_details
                 │                 │    └──1:N──► payments
                 │                 │
                 │           customers
                 │
                 └──1:N──► stock_transactions

categories ──1:N──► products ──1:N──► stock_alerts
suppliers  ──1:N──►    │     └──1:N──► ai_recommendations
                       │
                       └──1:N──► order_details
```

### 7.3 Ví dụ bảng quan trọng

**Bảng `products` (15 cột):**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID (PK) | Khóa chính |
| sku | VARCHAR(100) | Mã SKU (duy nhất) |
| name | VARCHAR(255) | Tên sản phẩm |
| category_id | UUID (FK) | → categories |
| supplier_id | UUID (FK) | → suppliers |
| cost_price | DECIMAL(15,2) | Giá nhập |
| sell_price | DECIMAL(15,2) | Giá bán |
| stock_quantity | INTEGER | Tồn kho hiện tại |
| min_stock_level | INTEGER | Ngưỡng cảnh báo |

*(Chi tiết đầy đủ 12 bảng: xem file `docs/database-design.md`)*

### 7.4 Thiết kế nổi bật
- **UUID** làm khóa chính (hỗ trợ phân tán, không xung đột)
- **Soft delete** (`is_active = false`) thay vì xóa thực
- **Trigger** tự động cập nhật `updated_at`
- **16 indexes** để tối ưu truy vấn
- **Lưu `product_name` trong `order_details`** để giữ lại tên tại thời điểm mua (tránh ảnh hưởng khi SP đổi tên)

---

## 8. Thiết Kế API

### 8.1 Chuẩn RESTful
- Base URL: `http://localhost:3001/api`
- Format response thống nhất: `{ success, message, data }`
- HTTP methods: GET (đọc), POST (tạo), PUT (sửa), DELETE (xóa)

### 8.2 API Endpoints chính (14 nhóm)

| Method | Endpoint | Module |
|--------|----------|--------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| GET | `/api/auth/me` | Verify token |
| GET/POST | `/api/products` | Sản phẩm |
| GET/POST | `/api/categories` | Danh mục |
| POST | `/api/orders` | Tạo hóa đơn |
| GET | `/api/stock/alerts` | Cảnh báo kho |
| POST | `/api/stock/import` | Nhập kho |
| GET | `/api/reports/dashboard` | Dashboard |
| POST | `/api/ai/recommend-restock` | AI gợi ý |

*(Chi tiết request/response: xem file `docs/api-specification.md`)*

---

## 9. Deliverables (Sản Phẩm Tuần 1)

| # | Sản phẩm | File/Vị trí |
|---|----------|-------------|
| 1 | Tài liệu đặc tả yêu cầu (SRS) | `docs/SRS.md` |
| 2 | Thiết kế CSDL + ERD | `docs/database-design.md` |
| 3 | Database Schema SQL | `database/schema.sql` (12 bảng) |
| 4 | Seed Data SQL | `database/seed.sql` (3 roles + 1 admin) |
| 5 | Kiến trúc hệ thống | `docs/architecture.md` |
| 6 | API Specification | `docs/api-specification.md` |
| 7 | README dự án | `README.md` |
| 8 | Git repository | 5 commits trên branch `week-1/requirements-analysis` |

---

## 10. Cấu Trúc Thư Mục Hiện Tại

```
SORA-POS-V2/
├── .gitignore
├── README.md                         # Tổng quan dự án
├── database/
│   ├── README.md                     # Hướng dẫn setup DB
│   ├── schema.sql                    # 12 bảng + indexes + triggers
│   └── seed.sql                      # 3 roles + 1 admin user
└── docs/
    ├── SRS.md                        # Đặc tả yêu cầu phần mềm
    ├── database-design.md            # Thiết kế CSDL + ERD
    ├── architecture.md               # Kiến trúc hệ thống
    ├── api-specification.md          # Đặc tả API
    └── bao-cao-tuan-1.md            # Báo cáo này
```

---

## 11. Kế Hoạch Tuần 2

> **Tuần 2: Thiết lập nền tảng — Backend API & Xác thực người dùng**

| # | Công việc |
|---|-----------|
| 1 | Khởi tạo Backend (Express + TypeScript) |
| 2 | Khởi tạo Frontend (React + Vite + TypeScript + Tailwind) |
| 3 | Kết nối Supabase PostgreSQL |
| 4 | Tạo bảng roles + users trên Supabase |
| 5 | API đăng nhập / đăng xuất (JWT) |
| 6 | Trang Login UI (responsive, validation) |
| 7 | Protected Route (chưa login → redirect) |
| 8 | Health check API |

---

## 12. Kết Luận

Tuần 1 đã hoàn thành giai đoạn **phân tích và thiết kế**, đặt nền tảng vững chắc cho quá trình phát triển tiếp theo:

- ✅ Xác định rõ **9 module chức năng** và **3 vai trò** người dùng
- ✅ Lựa chọn **stack công nghệ hiện đại** phù hợp với yêu cầu
- ✅ Thiết kế **kiến trúc 3 tầng** rõ ràng, dễ mở rộng
- ✅ Thiết kế **CSDL 12 bảng** chuẩn hóa 3NF với ERD đầy đủ
- ✅ Đặc tả **14 nhóm API endpoint** RESTful
- ✅ Khởi tạo **Git repository** với 5 commits có ý nghĩa

Dự án sẵn sàng chuyển sang giai đoạn **lập trình** từ tuần 2.
