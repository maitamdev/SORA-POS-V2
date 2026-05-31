# 📋 Tài Liệu Đặc Tả Yêu Cầu Phần Mềm (SRS)
# Hệ Thống Quản Lý Bán Hàng Tại Quầy - Sora POS

**Phiên bản:** 1.0  
**Ngày tạo:** 31/05/2026  
**Tác giả:** [Tên sinh viên]  
**MSSV:** [Mã số sinh viên]  
**GVHD:** [Tên giảng viên]  

---

## 1. Giới Thiệu

### 1.1 Mục đích
Tài liệu này mô tả chi tiết các yêu cầu chức năng và phi chức năng của hệ thống **Sora POS** — một phần mềm quản lý bán hàng tại quầy (Point of Sale) dành cho các cửa hàng bán lẻ nhỏ và vừa.

### 1.2 Phạm vi dự án
Sora POS là ứng dụng web full-stack cung cấp các chức năng:
- Quản lý đăng nhập, phân quyền người dùng
- Bán hàng tại quầy (POS)
- Quản lý sản phẩm, danh mục, nhà cung cấp
- Quản lý khách hàng
- Tạo hóa đơn, xuất PDF
- Quản lý kho hàng, cảnh báo tồn kho thấp
- Thống kê, báo cáo doanh thu
- Gợi ý nhập hàng thông minh bằng AI

### 1.3 Đối tượng sử dụng
| Vai trò | Mô tả |
|---------|-------|
| **Admin** (Quản trị viên) | Toàn quyền quản lý hệ thống, người dùng, sản phẩm, kho, báo cáo |
| **Manager** (Quản lý) | Quản lý sản phẩm, kho, hóa đơn, khách hàng, xem báo cáo |
| **Cashier** (Thu ngân) | Bán hàng tại quầy, tạo hóa đơn, xem cảnh báo tồn kho |

### 1.4 Thuật ngữ & Viết tắt
| Thuật ngữ | Giải thích |
|-----------|-----------|
| POS | Point of Sale — Điểm bán hàng |
| SKU | Stock Keeping Unit — Mã đơn vị lưu kho |
| CRUD | Create, Read, Update, Delete |
| JWT | JSON Web Token — Token xác thực |
| API | Application Programming Interface |
| SPA | Single Page Application |
| ORM | Object-Relational Mapping |

---

## 2. Mô Tả Tổng Quan Hệ Thống

### 2.1 Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         React + TypeScript + Tailwind CSS             │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────────────┐   │  │
│  │  │  Pages   │ │  Stores  │ │  Services (Axios)   │   │  │
│  │  │ (Views)  │ │(Zustand) │ │  (API Calls)        │   │  │
│  │  └──────────┘ └──────────┘ └──────────┬──────────┘   │  │
│  └────────────────────────────────────────┼──────────────┘  │
│                                           │ HTTP/HTTPS      │
└───────────────────────────────────────────┼─────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────┐
│                     SERVER (Backend)                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            Express.js + TypeScript                      │ │
│  │  ┌────────────┐ ┌──────────────┐ ┌──────────────────┐  │ │
│  │  │   Routes   │→│ Controllers  │→│    Services      │  │ │
│  │  │            │ │              │ │  (Business Logic) │  │ │
│  │  └────────────┘ └──────────────┘ └────────┬─────────┘  │ │
│  │  ┌────────────────────────────────────────┐│            │ │
│  │  │  Middlewares (Auth, Role, Validate)    ││            │ │
│  │  └────────────────────────────────────────┘│            │ │
│  └────────────────────────────────────────────┼────────────┘ │
│                                               │              │
└───────────────────────────────────────────────┼──────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    DATABASE (Supabase)                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               PostgreSQL Database                       │ │
│  │   roles │ users │ products │ categories │ orders │ ...  │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────┐  ┌──────────────────────────────────┐   │
│  │  Supabase Auth   │  │  Supabase Storage (images)      │   │
│  └─────────────────┘  └──────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Mô hình triển khai

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   Frontend     │     │   Backend      │     │   Database     │
│   (Vercel)     │────▶│   (Vercel      │────▶│  (Supabase     │
│   React SPA    │     │   Serverless)  │     │  PostgreSQL)   │
│   Port: 5173   │     │   Port: 3001   │     │  Cloud         │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

## 3. Yêu Cầu Chức Năng

### 3.1 Module Xác Thực (Authentication)

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| AUTH-01 | Đăng nhập | Xác thực bằng email/password, trả về JWT token | Tất cả |
| AUTH-02 | Đăng xuất | Xóa token, redirect về trang login | Tất cả |
| AUTH-03 | Xác thực token | Verify JWT khi reload trang (GET /auth/me) | Tất cả |
| AUTH-04 | Phân quyền | Giới hạn truy cập dựa trên role (admin/manager/cashier) | Tất cả |
| AUTH-05 | Protected Route | Redirect về login nếu chưa xác thực | Tất cả |

**Luồng xử lý đăng nhập (JWT Flow):**
```
1. User nhập email/password → Frontend gửi POST /api/auth/login
2. Backend tìm user trong DB → So sánh password (bcrypt)
3. Nếu hợp lệ → Tạo JWT token (chứa userId, email, role)
4. Trả về { user, token } → Frontend lưu vào Zustand store (localStorage)
5. Mỗi request tiếp theo → Axios interceptor gắn token vào header Authorization
6. Backend middleware verify token → Cho phép hoặc từ chối
```

### 3.2 Module Dashboard

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| DASH-01 | Thống kê tổng quan | Card hiển thị: doanh thu hôm nay, tổng đơn hàng, SP bán chạy | Admin, Manager |
| DASH-02 | Biểu đồ doanh thu | Line chart doanh thu theo ngày/tuần/tháng | Admin, Manager |
| DASH-03 | Top sản phẩm | Bar chart top 10 sản phẩm bán chạy | Admin, Manager |
| DASH-04 | Cảnh báo tồn kho | Danh sách SP sắp hết hàng | Tất cả |

### 3.3 Module POS (Bán Hàng Tại Quầy)

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| POS-01 | Hiển thị sản phẩm | Grid view sản phẩm, filter theo danh mục | Tất cả |
| POS-02 | Tìm kiếm | Tìm theo tên, SKU, barcode | Tất cả |
| POS-03 | Giỏ hàng | Thêm/xóa/sửa số lượng sản phẩm trong giỏ | Tất cả |
| POS-04 | Tính tiền | Tính tổng, giảm giá, tiền thừa real-time | Tất cả |
| POS-05 | Thanh toán | Hỗ trợ: tiền mặt, thẻ, chuyển khoản, MoMo, ZaloPay | Tất cả |
| POS-06 | Chọn khách hàng | Gắn khách hàng thành viên vào đơn | Tất cả |

### 3.4 Module Quản Lý Sản Phẩm

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| PROD-01 | Danh sách SP | Bảng hiển thị, phân trang, tìm kiếm, filter | Tất cả (xem) |
| PROD-02 | Thêm SP | Form tạo mới: tên, SKU, barcode, giá nhập, giá bán, danh mục, NCC | Admin, Manager |
| PROD-03 | Sửa SP | Chỉnh sửa thông tin sản phẩm | Admin, Manager |
| PROD-04 | Xóa SP | Soft delete (đánh dấu is_active = false) | Admin |
| PROD-05 | Quản lý danh mục | CRUD danh mục sản phẩm | Admin, Manager |

### 3.5 Module Hóa Đơn

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| ORD-01 | Tạo hóa đơn | Từ giỏ hàng POS → tạo order + order_details + payment | Tất cả |
| ORD-02 | Danh sách hóa đơn | Bảng hiển thị, filter theo ngày, trạng thái | Tất cả |
| ORD-03 | Chi tiết hóa đơn | Xem chi tiết đơn hàng, danh sách SP đã mua | Tất cả |
| ORD-04 | Xuất PDF | In hóa đơn dạng PDF (PDFKit) | Tất cả |
| ORD-05 | Hủy đơn | Hủy đơn hàng, hoàn trả tồn kho | Admin, Manager |

### 3.6 Module Kho Hàng

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| STK-01 | Xem tồn kho | Danh sách SP kèm số lượng tồn | Tất cả |
| STK-02 | Nhập kho | Tạo phiếu nhập kho, cập nhật tồn kho | Admin, Manager |
| STK-03 | Điều chỉnh tồn kho | Tăng/giảm tồn kho (kiểm kê) | Admin, Manager |
| STK-04 | Cảnh báo tồn kho | Tự động cảnh báo khi SP dưới ngưỡng min_stock_level | Tất cả |
| STK-05 | Lịch sử giao dịch kho | Log mọi thay đổi tồn kho | Admin, Manager |

### 3.7 Module Quản Lý Đối Tác

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| CUS-01 | CRUD Khách hàng | Quản lý thông tin khách hàng, điểm tích lũy | Tất cả |
| SUP-01 | CRUD Nhà cung cấp | Quản lý thông tin nhà cung cấp | Admin, Manager |
| EMP-01 | CRUD Nhân viên | Quản lý tài khoản nhân viên, phân quyền | Admin, Manager |

### 3.8 Module Báo Cáo

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| RPT-01 | Báo cáo doanh thu | Doanh thu theo ngày/tuần/tháng, biểu đồ | Admin, Manager |
| RPT-02 | Top SP bán chạy | Xếp hạng sản phẩm theo doanh số | Admin, Manager |
| RPT-03 | Báo cáo tồn kho | Tổng hợp tình trạng kho | Admin, Manager |

### 3.9 Module AI Gợi Ý Nhập Hàng

| ID | Chức năng | Mô tả | Vai trò |
|----|-----------|-------|---------|
| AI-01 | Phân tích doanh số | Tính average_daily_sales cho từng SP | Admin, Manager |
| AI-02 | Gợi ý nhập hàng | Dự báo lượng cần nhập: `avg_sales × 14 - current_stock` | Admin, Manager |
| AI-03 | AI Insight | Gọi Groq API để phân tích xu hướng, đưa lời khuyên | Admin, Manager |
| AI-04 | Duyệt gợi ý | Approve/Reject gợi ý nhập hàng | Admin, Manager |

---

## 4. Yêu Cầu Phi Chức Năng

### 4.1 Hiệu năng
- Thời gian phản hồi API ≤ 500ms cho các thao tác CRUD
- Frontend load lần đầu ≤ 3 giây
- Hỗ trợ tối thiểu 50 người dùng đồng thời

### 4.2 Bảo mật
- Mật khẩu được băm bằng bcrypt (salt rounds = 10)
- Xác thực bằng JWT token (hết hạn sau 7 ngày)
- Phân quyền theo role (RBAC - Role-Based Access Control)
- CORS được cấu hình chặt chẽ
- Dữ liệu nhạy cảm (.env) không được push lên Git

### 4.3 Khả năng sử dụng
- Giao diện responsive (desktop ưu tiên, hỗ trợ tablet)
- Font chữ dễ đọc: Inter
- Có toast notification cho mọi thao tác
- Form validation real-time với thông báo lỗi rõ ràng
- Loading state cho mọi API call

### 4.4 Khả năng mở rộng
- Kiến trúc phân lớp (Layered Architecture) dễ thêm module mới
- API RESTful chuẩn, có thể tích hợp mobile app sau này
- Database schema chuẩn hóa (3NF)

### 4.5 Công nghệ & Nền tảng
- **Runtime:** Node.js ≥ 18
- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS 3
- **Backend:** Express 4, TypeScript 5
- **Database:** PostgreSQL (Supabase)
- **Deploy:** Vercel (Frontend + Backend serverless)

---

## 5. Use Case Diagram

```
                        ┌──────────────────────────────────────┐
                        │          Sora POS System             │
                        │                                      │
  ┌─────────┐          │  ┌─────────────────────────────┐     │
  │         │──────────│──│ Đăng nhập / Đăng xuất       │     │
  │         │          │  └─────────────────────────────┘     │
  │         │          │  ┌─────────────────────────────┐     │
  │ Cashier │──────────│──│ Bán hàng tại quầy (POS)     │     │
  │         │          │  └─────────────────────────────┘     │
  │         │          │  ┌─────────────────────────────┐     │
  │         │──────────│──│ Tạo hóa đơn / Thanh toán    │     │
  └─────────┘          │  └─────────────────────────────┘     │
                        │  ┌─────────────────────────────┐     │
  ┌─────────┐          │  │ Quản lý sản phẩm / Danh mục │     │
  │         │──────────│──│                               │     │
  │         │          │  └─────────────────────────────┘     │
  │         │          │  ┌─────────────────────────────┐     │
  │ Manager │──────────│──│ Quản lý kho hàng             │     │
  │         │          │  └─────────────────────────────┘     │
  │         │          │  ┌─────────────────────────────┐     │
  │         │──────────│──│ Xem báo cáo / Dashboard      │     │
  └─────────┘          │  └─────────────────────────────┘     │
                        │  ┌─────────────────────────────┐     │
  ┌─────────┐          │  │ Quản lý nhân viên            │     │
  │         │──────────│──│                               │     │
  │  Admin  │          │  └─────────────────────────────┘     │
  │         │          │  ┌─────────────────────────────┐     │
  │         │──────────│──│ AI Gợi ý nhập hàng           │     │
  │         │          │  └─────────────────────────────┘     │
  │         │          │  ┌─────────────────────────────┐     │
  │         │──────────│──│ Cài đặt hệ thống             │     │
  └─────────┘          │  └─────────────────────────────┘     │
                        └──────────────────────────────────────┘
```

---

## 6. Giao Diện Người Dùng (Wireframe Mô Tả)

### 6.1 Trang Đăng Nhập
- Layout chia 2 phần: bên trái hiển thị thông tin giới thiệu, bên phải là form đăng nhập
- Form: email, password, nút "Đăng nhập"
- Nút trải nghiệm nhanh (auto-fill demo account)
- Design: Dark theme, glassmorphism

### 6.2 Dashboard
- Sidebar bên trái (fixed, 256px) chứa menu navigation
- Nội dung chính bên phải
- Cards thống kê: doanh thu, tổng đơn, SP bán chạy
- Biểu đồ: Line chart (doanh thu), Bar chart (top SP)

### 6.3 Trang POS
- Chia 2 cột: trái (70%) là grid SP, phải (30%) là giỏ hàng
- Search bar + filter danh mục ở trên
- Giỏ hàng: danh sách item, tăng/giảm SL, tổng tiền, nút thanh toán

### 6.4 Trang Quản Lý (Products, Categories, Customers, etc.)
- Thanh tìm kiếm + nút thêm mới
- Bảng dữ liệu (table) với phân trang
- Modal form cho thêm/sửa
- Confirm dialog cho xóa

---

## 7. Ràng Buộc & Giả Định

### 7.1 Ràng buộc
- Sử dụng Supabase free tier (giới hạn 500MB database, 1GB storage)
- Deploy trên Vercel free tier
- Không hỗ trợ multi-language (chỉ tiếng Việt)
- Không tích hợp thanh toán online thực tế

### 7.2 Giả định
- Người dùng có kết nối internet ổn định
- Cửa hàng có tối đa 1000 sản phẩm
- Tối đa 10 nhân viên sử dụng đồng thời
- Mỗi ngày tạo tối đa 200 hóa đơn
