# 🏪 Sora POS

**Sora POS** là hệ thống quản lý bán hàng tại quầy (Point of Sale) tích hợp quản lý kho hàng, cảnh báo tồn kho thấp và hỗ trợ gợi ý nhập hàng thông minh bằng AI.

## ✨ Tính năng chính

- 🔐 Đăng nhập/đăng xuất, phân quyền (Admin, Manager, Cashier)
- 📊 Dashboard thống kê doanh thu, sản phẩm bán chạy
- 🛒 Màn hình POS bán hàng tại quầy
- 📦 Quản lý sản phẩm, danh mục, nhà cung cấp
- 👥 Quản lý khách hàng
- 🧾 Tạo hóa đơn, xuất PDF
- 💳 Quản lý thanh toán
- 🏭 Quản lý kho hàng, nhập kho, điều chỉnh tồn kho
- ⚠️ Cảnh báo tồn kho thấp
- 🤖 AI gợi ý nhập hàng thông minh (Groq API)
- 📈 Báo cáo doanh thu, sản phẩm bán chạy, tồn kho
- 📱 Tạo QR sản phẩm

## 🛠 Công nghệ sử dụng

### Frontend
| Công nghệ | Mô tả |
|---|---|
| ReactJS + TypeScript | UI Framework |
| Vite | Build tool |
| Tailwind CSS | Styling |
| React Router | Routing |
| Axios | HTTP Client |
| React Hook Form + Zod | Form & Validation |
| Zustand | State Management |
| Recharts | Charts & Reports |

### Backend
| Công nghệ | Mô tả |
|---|---|
| NodeJS + ExpressJS | Server Framework |
| TypeScript | Language |
| JWT | Authentication |
| Zod | Validation |
| Supabase SDK | Database Client |
| Groq SDK | AI Integration |

### Database
| Công nghệ | Mô tả |
|---|---|
| Supabase PostgreSQL | Database |
| Supabase Auth | Authentication |
| Supabase Storage | File Storage |

## 📁 Cấu trúc thư mục

```
sora-pos/
├── frontend/          # React + Vite frontend
├── backend/           # Express + TypeScript backend
├── database/          # SQL schema & seed data
├── docs/              # Documentation (SRS, ERD, báo cáo)
├── README.md
└── .gitignore
```

## 🚀 Cài đặt & Chạy dự án

### Yêu cầu
- Node.js >= 18
- npm >= 9
- Tài khoản Supabase (https://supabase.com)
- Groq API Key (https://console.groq.com)

### 1. Clone repository
```bash
git clone <repo-url>
cd sora-pos
```

### 2. Cài đặt Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Cập nhật biến môi trường trong .env
npm run dev
```
Frontend chạy tại: `http://localhost:5173`

### 3. Cài đặt Backend
```bash
cd backend
npm install
cp .env.example .env
# Cập nhật biến môi trường trong .env
npm run dev
```
Backend chạy tại: `http://localhost:3001`

### 4. Thiết lập Database
- Tạo project trên Supabase
- Chạy file `database/schema.sql` trong SQL Editor của Supabase
- Chạy file `database/seed.sql` để thêm dữ liệu mẫu

## 🔑 Biến môi trường

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Sora POS
```

### Backend (.env)
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GROQ_API_KEY=your-groq-api-key
CORS_ORIGIN=http://localhost:5173
```

## 📡 API Endpoints chính

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| GET | `/api/products` | Danh sách sản phẩm |
| POST | `/api/products` | Tạo sản phẩm |
| GET | `/api/categories` | Danh sách danh mục |
| GET | `/api/suppliers` | Danh sách nhà cung cấp |
| GET | `/api/customers` | Danh sách khách hàng |
| POST | `/api/orders` | Tạo hóa đơn |
| GET | `/api/orders` | Danh sách hóa đơn |
| GET | `/api/stock/alerts` | Cảnh báo tồn kho |
| POST | `/api/stock/import` | Nhập kho |
| GET | `/api/reports/dashboard` | Dữ liệu dashboard |
| POST | `/api/ai/recommend-restock` | AI gợi ý nhập hàng |

## 👥 Phân quyền

| Vai trò | Quyền hạn |
|---------|-----------|
| **Admin** | Toàn quyền: quản lý người dùng, sản phẩm, kho, báo cáo, phân quyền |
| **Manager** | Quản lý sản phẩm, kho, hóa đơn, khách hàng, xem báo cáo |
| **Cashier** | Bán hàng tại quầy, tạo hóa đơn, xem cảnh báo tồn kho |

## 🤖 Công thức AI gợi ý nhập hàng

```
recommended_quantity = average_daily_sales × target_days - current_stock
```

- `average_daily_sales`: Số lượng bán trung bình mỗi ngày
- `target_days`: Mặc định 14 ngày
- `current_stock`: Tồn kho hiện tại

## 📄 License

MIT License © 2026 Sora POS
