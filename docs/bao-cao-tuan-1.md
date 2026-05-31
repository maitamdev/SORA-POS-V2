# BÁO CÁO TIẾN ĐỘ — TUẦN 1
# Xây Dựng Hệ Thống Bán Hàng Tại Quầy Tích Hợp Quản Lý Kho Và Cảnh Báo Tồn Kho Thấp

---

**Sinh viên:** [Họ tên]  
**MSSV:** [Mã số sinh viên]  
**Lớp:** [Tên lớp]  
**GVHD:** [Tên giảng viên]  
**Tuần báo cáo:** Tuần 1  
**Nội dung:** Phân tích yêu cầu — Thiết kế cơ sở dữ liệu — Thiết kế kiến trúc hệ thống  

---

## 1. Đặt Vấn Đề

Trong bối cảnh thương mại bán lẻ tại Việt Nam đang phát triển mạnh mẽ, hầu hết các cửa hàng nhỏ và vừa vẫn đang vận hành theo phương thức truyền thống: ghi chép sổ sách bằng tay, theo dõi tồn kho bằng file Excel, và tính toán doanh thu thủ công. Phương thức này bộc lộ nhiều hạn chế nghiêm trọng:

- **Sai sót trong quá trình bán hàng:** Nhầm giá, tính tiền sai, thiếu hóa đơn — ảnh hưởng trực tiếp đến doanh thu và uy tín cửa hàng.
- **Mất kiểm soát tồn kho:** Không biết mặt hàng nào sắp hết, mặt hàng nào tồn quá nhiều — dẫn đến đứt hàng hoặc ứ đọng vốn.
- **Thiếu dữ liệu ra quyết định:** Không có thống kê, báo cáo → chủ cửa hàng chỉ quyết định dựa trên cảm tính, không có cơ sở dữ liệu.
- **Không có cảnh báo kịp thời:** Hàng hết trên kệ mới biết, không có cơ chế cảnh báo chủ động khi tồn kho xuống dưới ngưỡng an toàn.

Xuất phát từ những vấn đề thực tiễn trên, đề tài **"Xây dựng hệ thống bán hàng tại quầy (POS) tích hợp quản lý kho và cảnh báo tồn kho thấp"** được đề xuất nhằm giải quyết đồng thời hai bài toán cốt lõi: **tối ưu quy trình bán hàng** và **kiểm soát kho hàng thông minh**.

---

## 2. Mục Tiêu Đề Tài

### 2.1 Mục tiêu tổng quát
Xây dựng một ứng dụng web hoàn chỉnh cho phép các cửa hàng bán lẻ thực hiện **bán hàng tại quầy**, **quản lý kho hàng** và **nhận cảnh báo tồn kho thấp tự động** — tất cả trên một nền tảng duy nhất.

### 2.2 Mục tiêu cụ thể

| # | Mục tiêu | Mô tả chi tiết |
|---|----------|-----------------|
| 1 | Bán hàng tại quầy (POS) | Giao diện chọn sản phẩm nhanh, tạo hóa đơn, hỗ trợ nhiều phương thức thanh toán |
| 2 | Quản lý sản phẩm & danh mục | Thêm, sửa, xóa sản phẩm; phân loại theo danh mục; quản lý giá nhập, giá bán |
| 3 | Quản lý kho hàng | Nhập kho, điều chỉnh tồn kho, ghi nhận lịch sử mọi giao dịch xuất/nhập kho |
| 4 | Cảnh báo tồn kho thấp | Tự động phát cảnh báo khi tồn kho xuống dưới ngưỡng an toàn đã cài đặt |
| 5 | Hóa đơn & thanh toán | Tạo hóa đơn chi tiết, hỗ trợ xuất PDF, lưu trữ lịch sử giao dịch |
| 6 | Thống kê & báo cáo | Dashboard trực quan với biểu đồ doanh thu, sản phẩm bán chạy |
| 7 | Phân quyền người dùng | Hệ thống 3 vai trò (Admin, Manager, Cashier) với quyền hạn riêng biệt |
| 8 | Gợi ý nhập hàng bằng AI | Phân tích doanh số tự động, đề xuất số lượng nhập hàng tối ưu |

---

## 3. Phạm Vi Và Giới Hạn

### 3.1 Phạm vi thực hiện
- Đối tượng: Cửa hàng bán lẻ nhỏ và vừa (tạp hóa, cửa hàng tiện lợi, shop thời trang...)
- Nền tảng: Ứng dụng web (hoạt động trên trình duyệt, ưu tiên desktop)
- Quy mô: Tối đa 1.000 sản phẩm, 10 nhân viên, 200 đơn hàng/ngày

### 3.2 Giới hạn
- Không tích hợp thanh toán online thực tế (chỉ ghi nhận phương thức)
- Không hỗ trợ đa ngôn ngữ (chỉ tiếng Việt)
- Sử dụng Supabase free tier (500MB database)

---

## 4. Phân Tích Yêu Cầu

### 4.1 Các tác nhân hệ thống

Hệ thống có **3 tác nhân** (actor) với phân quyền phân cấp rõ ràng:

```
┌───────────────────────────────────────────────────────────┐
│                     ADMIN (Quản trị)                      │
│  • Toàn quyền hệ thống                                   │
│  • Quản lý nhân viên, phân quyền                          │
│  • Xem báo cáo, cài đặt, AI gợi ý                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │               MANAGER (Quản lý)                     │  │
│  │  • Quản lý sản phẩm, danh mục, NCC                 │  │
│  │  • Quản lý kho hàng, nhập kho                       │  │
│  │  • Xem báo cáo doanh thu                            │  │
│  │  ┌───────────────────────────────────────────────┐  │  │
│  │  │            CASHIER (Thu ngân)                  │  │  │
│  │  │  • Bán hàng tại quầy (POS)                    │  │  │
│  │  │  • Tạo hóa đơn, thanh toán                    │  │  │
│  │  │  • Xem tồn kho, cảnh báo                      │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 4.2 Yêu cầu chức năng

Hệ thống được chia thành **9 module** chức năng:

#### Module 1: Xác thực & Phân quyền
| ID | Chức năng | Mô tả |
|----|-----------|-------|
| AUTH-01 | Đăng nhập | Xác thực bằng email/password, cấp JWT token |
| AUTH-02 | Đăng xuất | Xóa phiên đăng nhập |
| AUTH-03 | Phân quyền | Kiểm tra vai trò trước mỗi thao tác (RBAC) |
| AUTH-04 | Bảo vệ trang | Tự động chuyển về Login nếu chưa đăng nhập |

#### Module 2: Màn hình POS (Bán hàng tại quầy)
| ID | Chức năng | Mô tả |
|----|-----------|-------|
| POS-01 | Hiển thị sản phẩm | Lưới sản phẩm, phân loại theo danh mục |
| POS-02 | Tìm kiếm nhanh | Tìm theo tên, mã SKU, mã vạch |
| POS-03 | Giỏ hàng | Thêm/xóa/sửa số lượng, tính tổng real-time |
| POS-04 | Thanh toán | Tiền mặt, thẻ, chuyển khoản, ví điện tử |

#### Module 3: Quản lý sản phẩm & danh mục
| ID | Chức năng | Mô tả |
|----|-----------|-------|
| PROD-01 | CRUD sản phẩm | Thêm/sửa/xóa, kèm giá nhập/bán, ảnh, mã vạch |
| PROD-02 | CRUD danh mục | Phân loại sản phẩm |
| PROD-03 | Tìm kiếm & lọc | Tìm theo tên, lọc theo danh mục, trạng thái |

#### Module 4: Quản lý kho hàng ⭐
| ID | Chức năng | Mô tả |
|----|-----------|-------|
| STK-01 | Xem tồn kho | Danh sách sản phẩm kèm số lượng tồn hiện tại |
| STK-02 | Nhập kho | Tạo phiếu nhập, tự động cộng tồn kho |
| STK-03 | Điều chỉnh tồn kho | Tăng/giảm tồn khi kiểm kê thực tế |
| STK-04 | Lịch sử giao dịch | Log chi tiết mọi thay đổi (nhập, bán, điều chỉnh) |

#### Module 5: Cảnh báo tồn kho thấp ⭐
| ID | Chức năng | Mô tả |
|----|-----------|-------|
| ALR-01 | Cài ngưỡng cảnh báo | Mỗi SP có `min_stock_level` riêng |
| ALR-02 | Tự động phát cảnh báo | Khi `stock_quantity ≤ min_stock_level` → tạo alert |
| ALR-03 | Hiển thị cảnh báo | Badge đỏ trên sidebar, danh sách SP cần nhập |
| ALR-04 | Xử lý cảnh báo | Đánh dấu "đã xử lý" sau khi nhập hàng |

#### Module 6: Hóa đơn & thanh toán
| ID | Chức năng | Mô tả |
|----|-----------|-------|
| ORD-01 | Tạo hóa đơn | Từ giỏ hàng POS → tạo order + chi tiết + payment |
| ORD-02 | Xem lịch sử | Danh sách hóa đơn, filter theo ngày/trạng thái |
| ORD-03 | Xuất PDF | In hóa đơn dạng PDF |
| ORD-04 | Hủy đơn | Hủy và hoàn trả tồn kho tự động |

#### Module 7: Quản lý đối tác
- CRUD khách hàng (điểm tích lũy, tổng chi tiêu)
- CRUD nhà cung cấp (thông tin liên hệ, mã số thuế)
- CRUD nhân viên (tạo tài khoản, phân quyền)

#### Module 8: Dashboard & báo cáo
- Biểu đồ doanh thu theo ngày/tuần/tháng
- Top sản phẩm bán chạy
- Tổng hợp tình trạng kho

#### Module 9: AI gợi ý nhập hàng
- Phân tích doanh số trung bình → đề xuất số lượng nhập
- Công thức: `recommended = avg_daily_sales × 14 - current_stock`
- Gọi Groq AI để phân tích xu hướng, đưa lời khuyên

### 4.3 Yêu cầu phi chức năng

| Tiêu chí | Yêu cầu |
|----------|---------|
| **Hiệu năng** | API phản hồi ≤ 500ms; giao diện tải lần đầu ≤ 3 giây |
| **Bảo mật** | Mật khẩu băm bcrypt; JWT token; phân quyền RBAC; CORS |
| **Khả dụng** | Responsive (desktop ưu tiên); font rõ ràng; toast notification |
| **Mở rộng** | Kiến trúc phân lớp; API RESTful chuẩn; có thể tích hợp mobile |
| **Tin cậy** | Soft delete (không xóa vĩnh viễn); log mọi giao dịch kho |

---

## 5. Lựa Chọn Công Nghệ

### 5.1 Tổng quan kiến trúc công nghệ

```
┌────────────────────────────────────────────────────────────┐
│  FRONTEND                                                   │
│  React 18 · TypeScript · Vite · Tailwind CSS · Zustand     │
├────────────────────────────────────────────────────────────┤
│  BACKEND                                                    │
│  Express.js · TypeScript · JWT · Zod · Supabase SDK        │
├────────────────────────────────────────────────────────────┤
│  DATABASE                                                   │
│  PostgreSQL (Supabase Cloud)                                │
├────────────────────────────────────────────────────────────┤
│  AI · DEPLOY                                                │
│  Groq SDK · Vercel                                          │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Phân tích lý do lựa chọn

| Thành phần | Công nghệ | Tại sao chọn? |
|------------|-----------|---------------|
| UI Framework | **React 18** | Component-based, virtual DOM hiệu năng cao, ecosystem lớn nhất |
| Language | **TypeScript** | Type-safe giúp phát hiện lỗi ngay lúc code, hỗ trợ IDE mạnh |
| Build Tool | **Vite** | Hot Module Replacement < 50ms, nhanh gấp 10-20x Webpack |
| CSS | **Tailwind CSS** | Utility-first, phát triển nhanh, chỉ bundle CSS đã dùng |
| State Mgmt | **Zustand** | API đơn giản hơn Redux, persist state vào localStorage |
| HTTP Client | **Axios** | Interceptors tự động gắn token, xử lý lỗi tập trung |
| Form | **React Hook Form** | Hiệu năng cao (uncontrolled components), ít re-render |
| Validation | **Zod** | Type-safe, dùng chung cho cả frontend và backend |
| Server | **Express.js** | Nhẹ, linh hoạt, middleware ecosystem phong phú |
| Auth | **JWT** | Stateless, không cần session server, dễ scale |
| Password | **bcrypt** | Chống rainbow table, standard công nghiệp |
| Database | **Supabase PostgreSQL** | Managed cloud, free tier 500MB, SDK chất lượng |
| AI | **Groq SDK** | Inference cực nhanh (< 500ms), free tier rộng |
| Deploy | **Vercel** | Zero-config, auto HTTPS, CI/CD tích hợp |

---

## 6. Thiết Kế Kiến Trúc Hệ Thống

### 6.1 Kiến trúc tổng thể: Client-Server 3 tầng

```
                    ┌──────────────────────────────────────┐
                    │      TRÌNH DUYỆT (Client)            │
                    │                                      │
                    │  React + Zustand + Tailwind CSS       │
                    │  ┌────────┐ ┌────────┐ ┌──────────┐ │
                    │  │ Pages  │ │ Stores │ │ Services │ │
                    │  │  (UI)  │ │(State) │ │ (Axios)  │ │
                    │  └────────┘ └────────┘ └────┬─────┘ │
                    └─────────────────────────────┼────────┘
                                                  │ REST API
                                                  ▼
                    ┌──────────────────────────────────────┐
                    │      MÁY CHỦ (Backend)               │
                    │                                      │
                    │  Express.js + TypeScript + JWT        │
                    │  ┌────────────────────────────────┐  │
                    │  │ Routes → Middlewares            │  │
                    │  │   → Controllers → Services     │  │
                    │  └───────────────────────┬────────┘  │
                    └──────────────────────────┼───────────┘
                                               │ Supabase SDK
                                               ▼
                    ┌──────────────────────────────────────┐
                    │      CƠ SỞ DỮ LIỆU                  │
                    │                                      │
                    │  PostgreSQL (Supabase Cloud)          │
                    │  12 bảng · 16 indexes · 9 triggers   │
                    └──────────────────────────────────────┘
```

### 6.2 Luồng xử lý request trong Backend

Mỗi request từ client đi qua các tầng theo thứ tự:

```
HTTP Request
    │
    ▼
  Route           ← Định nghĩa endpoint (method + path)
    │
    ▼
  Auth Middleware  ← Verify JWT token → gắn user vào request
    │
    ▼
  Role Middleware  ← Kiểm tra role có được phép không
    │
    ▼
  Validate MW     ← Kiểm tra body/params bằng Zod schema
    │
    ▼
  Controller      ← Nhận request, gọi service, format response
    │
    ▼
  Service         ← Business logic thuần, tương tác Supabase DB
    │
    ▼
HTTP Response     ← { success: true/false, message, data }
```

### 6.3 Luồng xác thực JWT

```
┌────────────┐                    ┌────────────┐                  ┌──────────┐
│  Frontend  │                    │  Backend   │                  │ Database │
└─────┬──────┘                    └─────┬──────┘                  └────┬─────┘
      │  POST /api/auth/login           │                              │
      │  { email, password }            │                              │
      │────────────────────────────────►│                              │
      │                                 │  SELECT * FROM users         │
      │                                 │  WHERE email = ?             │
      │                                 │─────────────────────────────►│
      │                                 │         user data            │
      │                                 │◄─────────────────────────────│
      │                                 │                              │
      │                                 │  bcrypt.compare(password)    │
      │                                 │  jwt.sign({ userId, role })  │
      │                                 │                              │
      │     { user, token }             │                              │
      │◄────────────────────────────────│                              │
      │                                 │                              │
      │  Lưu token vào localStorage     │                              │
      │  (Zustand persist)              │                              │
      │                                 │                              │
      │  GET /api/products              │                              │
      │  Authorization: Bearer <token>  │                              │
      │────────────────────────────────►│                              │
      │                                 │  jwt.verify(token)           │
      │                                 │  → req.user = decoded        │
      │                                 │                              │
      │     { products: [...] }         │                              │
      │◄────────────────────────────────│                              │
```

---

## 7. Thiết Kế Cơ Sở Dữ Liệu

### 7.1 Tổng quan

Cơ sở dữ liệu gồm **12 bảng**, sử dụng **UUID** làm khóa chính, thiết kế theo chuẩn **3NF**, được chia thành 5 nhóm logic:

| Nhóm | Bảng | Mục đích |
|------|------|----------|
| 👤 Người dùng | `roles`, `users` | Quản lý tài khoản, vai trò |
| 📦 Sản phẩm | `categories`, `suppliers`, `products` | Danh mục, NCC, sản phẩm |
| 🧾 Bán hàng | `customers`, `orders`, `order_details`, `payments` | Khách hàng, hóa đơn, thanh toán |
| 🏭 Kho hàng | `stock_transactions`, `stock_alerts` | Giao dịch kho, cảnh báo tồn |
| 🤖 AI | `ai_recommendations` | Gợi ý nhập hàng |

### 7.2 Sơ đồ quan hệ thực thể (ERD)

```
┌──────────┐         ┌───────────────┐         ┌──────────────┐
│  roles   │──1:N──►│    users      │──1:N──►│   orders     │
│          │         │               │         │              │
│ id (PK)  │         │ id (PK)       │         │ id (PK)      │
│ name     │         │ email         │         │ order_number │
│          │         │ password_hash │         │ total_amount │
└──────────┘         │ full_name     │         │ final_amount │
                     │ role_id (FK)──│         │ user_id (FK)─│
                     │ is_active     │         │ customer_id  │
                     └───────┬───────┘         └──────┬───────┘
                             │                        │
                             │                   ┌────┴─────┐
                             │                   │          │
                             ▼               ┌───▼────┐ ┌───▼──────┐
                     ┌───────────────┐       │order_  │ │payments  │
                     │stock_         │       │details │ │          │
                     │transactions   │       │        │ │ method   │
                     │               │       │quantity│ │ amount   │
                     │ product_id(FK)│       │subtotal│ │ status   │
                     │ type          │       └────────┘ └──────────┘
                     │ quantity      │
                     │ user_id (FK)  │
                     └───────────────┘

┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│ categories   │     │    products       │     │  suppliers   │
│              │     │                   │     │              │
│ id (PK)      │     │ id (PK)           │     │ id (PK)      │
│ name         │◄─1:N│ sku (UNIQUE)      │N:1─►│ name         │
│ is_active    │     │ name              │     │ phone        │
└──────────────┘     │ category_id (FK)──│     │ tax_code     │
                     │ supplier_id (FK)──│     └──────────────┘
┌──────────────┐     │ cost_price        │
│ customers    │     │ sell_price        │     ┌──────────────────┐
│              │     │ stock_quantity ◄──│─────│  stock_alerts    │
│ id (PK)      │     │ min_stock_level   │     │                  │
│ name         │     │ is_active         │     │ current_stock    │
│ phone        │     └───────────────────┘     │ min_stock_level  │
│ points       │                               │ status           │
│ total_spent  │     ┌──────────────────────┐  │ (low_stock /     │
└──────────────┘     │  ai_recommendations  │  │  out_of_stock /  │
                     │                      │  │  resolved)       │
                     │ product_id (FK)      │  └──────────────────┘
                     │ avg_daily_sales      │
                     │ recommended_quantity │
                     │ priority (low/med/hi)│
                     │ ai_insight           │
                     └──────────────────────┘
```

### 7.3 Cơ chế cảnh báo tồn kho thấp (điểm nhấn đề tài)

Đây là tính năng cốt lõi của đề tài. Cơ chế hoạt động:

```
 Bán hàng thành công
        │
        ▼
 Trừ stock_quantity trong bảng products
        │
        ▼
 Kiểm tra: stock_quantity ≤ min_stock_level ?
        │
   ┌────┴────┐
   │ ĐÚNG   │ SAI → Không làm gì
   ▼         │
 Tạo record │
 stock_alerts│
 status =    │
 'low_stock' │
        │
        ▼
 Hiển thị badge cảnh báo đỏ trên Sidebar
 + Danh sách SP cần nhập hàng gấp
        │
        ▼
 Manager/Admin nhập kho
        │
        ▼
 Cập nhật status = 'resolved'
```

**Ví dụ minh họa:**

| Sản phẩm | Tồn kho | Ngưỡng cảnh báo | Trạng thái |
|-----------|---------|-----------------|------------|
| Coca Cola 330ml | 25 | 20 | ✅ Bình thường |
| Mì Hảo Hảo | **8** | 15 | ⚠️ **Tồn kho thấp** |
| Khăn giấy Pulppy | **0** | 10 | 🔴 **Hết hàng** |

### 7.4 Thiết kế nổi bật

| Kỹ thuật | Giải thích |
|----------|-----------|
| **UUID** làm khóa chính | Không xung đột khi merge dữ liệu, hỗ trợ phân tán |
| **Soft delete** (is_active) | Không xóa vĩnh viễn, giữ toàn vẹn dữ liệu lịch sử |
| **Lưu product_name trong order_details** | Giữ lại tên SP tại thời điểm mua (tránh sai khi SP đổi tên) |
| **16 indexes** | Tối ưu truy vấn cho tìm kiếm, filter, báo cáo |
| **9 triggers** | Tự động cập nhật `updated_at` khi sửa record |
| **Decimal(15,2)** cho tiền | Tránh lỗi làm tròn floating-point |

---

## 8. Thiết Kế API

### 8.1 Nguyên tắc thiết kế

- **RESTful**: Sử dụng HTTP method chuẩn (GET, POST, PUT, DELETE)
- **Base URL**: `http://localhost:3001/api`
- **Format thống nhất**: Mọi response đều có dạng `{ success, message, data }`
- **Authentication**: Bearer Token trong header `Authorization`

### 8.2 Danh sách API Endpoints

| # | Method | Endpoint | Mô tả | Tuần |
|---|--------|----------|-------|------|
| 1 | GET | `/api/health` | Kiểm tra server hoạt động | 2 |
| 2 | POST | `/api/auth/login` | Đăng nhập | 2 |
| 3 | POST | `/api/auth/logout` | Đăng xuất | 2 |
| 4 | GET | `/api/auth/me` | Xác thực token | 2 |
| 5 | GET/POST/PUT/DELETE | `/api/products` | CRUD sản phẩm | 3 |
| 6 | GET/POST/PUT/DELETE | `/api/categories` | CRUD danh mục | 3 |
| 7 | GET/POST | `/api/orders` | Hóa đơn | 5 |
| 8 | GET | `/api/orders/:id/pdf` | Xuất PDF hóa đơn | 5 |
| 9 | GET | `/api/stock/alerts` | Danh sách cảnh báo tồn kho | 6 |
| 10 | POST | `/api/stock/import` | Nhập kho | 6 |
| 11 | POST | `/api/stock/adjust` | Điều chỉnh tồn kho | 6 |
| 12 | GET | `/api/reports/dashboard` | Dữ liệu thống kê | 8 |
| 13 | GET | `/api/reports/revenue` | Báo cáo doanh thu | 8 |
| 14 | POST | `/api/ai/recommend-restock` | AI gợi ý nhập hàng | 9 |

---

## 9. Sản Phẩm Tuần 1

| # | Sản phẩm | Mô tả | Vị trí |
|---|----------|-------|--------|
| 1 | Tài liệu phân tích yêu cầu (SRS) | 9 module, 3 vai trò, yêu cầu phi chức năng | `docs/SRS.md` |
| 2 | Thiết kế cơ sở dữ liệu | ERD, chi tiết 12 bảng, indexes, triggers | `docs/database-design.md` |
| 3 | Database Schema (SQL) | Code SQL tạo toàn bộ 12 bảng | `database/schema.sql` |
| 4 | Dữ liệu khởi tạo (SQL) | 3 vai trò + 1 tài khoản admin | `database/seed.sql` |
| 5 | Kiến trúc hệ thống | Sơ đồ 3 tầng, design patterns, luồng xử lý | `docs/architecture.md` |
| 6 | Đặc tả API | 14 endpoints, request/response format | `docs/api-specification.md` |
| 7 | README dự án | Tổng quan, hướng dẫn cài đặt, cấu hình | `README.md` |
| 8 | Git Repository | 6 commits trên branch `week-1/requirements-analysis` | `.git/` |

---

## 10. Kế Hoạch Tuần 2

> **Nội dung:** Thiết lập nền tảng — Backend API & Giao diện đăng nhập

| # | Công việc dự kiến |
|---|-------------------|
| 1 | Khởi tạo Backend project (Express + TypeScript) |
| 2 | Khởi tạo Frontend project (React + Vite + TypeScript + Tailwind CSS) |
| 3 | Kết nối Supabase PostgreSQL, chạy schema + seed |
| 4 | Xây dựng API xác thực: login, logout, verify token |
| 5 | Xây dựng giao diện đăng nhập (responsive, dark theme) |
| 6 | Cài đặt Protected Route (chưa login → redirect) |
| 7 | Trang Dashboard placeholder (hiển thị tên user đã đăng nhập) |

---

## 11. Kết Luận Tuần 1

Tuần 1 đã hoàn thành toàn bộ giai đoạn **phân tích và thiết kế**, tạo nền tảng vững chắc trước khi bước vào lập trình:

- ✅ **Bài toán rõ ràng:** Xác định được 9 module chức năng với điểm nhấn là **quản lý kho** và **cảnh báo tồn kho thấp**
- ✅ **Phân quyền chặt chẽ:** 3 vai trò phân cấp (Admin → Manager → Cashier)
- ✅ **Công nghệ hiện đại:** React, TypeScript, Express, Supabase, JWT — mỗi lựa chọn đều có lý do kỹ thuật cụ thể
- ✅ **Kiến trúc rõ ràng:** Client-Server 3 tầng, backend theo Layered Architecture
- ✅ **CSDL hoàn chỉnh:** 12 bảng chuẩn 3NF, 16 indexes, 9 triggers — sẵn sàng triển khai
- ✅ **API chuẩn RESTful:** 14 nhóm endpoint với format response thống nhất

Dự án đã sẵn sàng chuyển sang giai đoạn **lập trình** từ tuần 2.
