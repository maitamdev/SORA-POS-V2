# 📡 API Specification - Sora POS

**Base URL:** `http://localhost:3001/api`  
**Authentication:** Bearer Token (JWT)  
**Content-Type:** application/json  

---

## Response Format (Chuẩn chung)

### Thành công
```json
{
  "success": true,
  "message": "Thành công",
  "data": { ... }
}
```

### Thất bại
```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "errors": null
}
```

### Validation Error (422)
```json
{
  "success": false,
  "message": "Dữ liệu không hợp lệ",
  "errors": [
    { "field": "email", "message": "Email không hợp lệ" },
    { "field": "password", "message": "Mật khẩu tối thiểu 6 ký tự" }
  ]
}
```

---

## 1. Health Check

### `GET /api/health`
Kiểm tra server hoạt động.

**Auth:** Không cần

**Response 200:**
```json
{
  "success": true,
  "message": "🚀 Sora POS API is running",
  "timestamp": "2026-05-31T06:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 2. Authentication

### `POST /api/auth/login`
Đăng nhập bằng email/password.

**Auth:** Không cần

**Request Body:**
```json
{
  "email": "admin@sorapos.com",
  "password": "password123"
}
```

**Validation:**
- `email`: string, email format, bắt buộc
- `password`: string, tối thiểu 6 ký tự, bắt buộc

**Response 200:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": "b0000000-0000-0000-0000-000000000001",
      "email": "admin@sorapos.com",
      "full_name": "Quản Trị Hệ Thống",
      "phone": null,
      "avatar_url": null,
      "role": "admin",
      "is_active": true,
      "last_login": "2026-05-31T06:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không đúng"
}
```

---

### `POST /api/auth/logout`
Đăng xuất (JWT stateless, chỉ trả response thành công).

**Auth:** Bearer Token

**Response 200:**
```json
{
  "success": true,
  "message": "Đăng xuất thành công",
  "data": null
}
```

---

### `GET /api/auth/me`
Lấy thông tin user hiện tại (verify token).

**Auth:** Bearer Token

**Response 200:**
```json
{
  "success": true,
  "message": "Xác thực thành công",
  "data": {
    "user": {
      "id": "b0000000-0000-0000-0000-000000000001",
      "email": "admin@sorapos.com",
      "full_name": "Quản Trị Hệ Thống",
      "role": "admin",
      "is_active": true
    }
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "message": "Token không hợp lệ"
}
```

---

## 3. Products (Tuần 3)

### `GET /api/products`
Danh sách sản phẩm (có phân trang, filter).

**Auth:** Bearer Token  
**Roles:** Tất cả

**Query Params:**
| Param | Type | Mô tả |
|-------|------|-------|
| `search` | string | Tìm theo tên, SKU, barcode |
| `category_id` | uuid | Filter theo danh mục |
| `is_active` | boolean | Filter trạng thái |
| `page` | number | Trang (default: 1) |
| `limit` | number | Số item/trang (default: 20) |

### `POST /api/products`
Tạo sản phẩm mới.

**Auth:** Bearer Token  
**Roles:** Admin, Manager

### `PUT /api/products/:id`
Cập nhật sản phẩm.

**Auth:** Bearer Token  
**Roles:** Admin, Manager

### `DELETE /api/products/:id`
Xóa sản phẩm (soft delete).

**Auth:** Bearer Token  
**Roles:** Admin

---

## 4. Categories (Tuần 3)

### `GET /api/categories`
### `POST /api/categories`
### `PUT /api/categories/:id`
### `DELETE /api/categories/:id`

**Roles:** Admin, Manager

---

## 5. Orders (Tuần 5)

### `GET /api/orders`
### `POST /api/orders`
### `GET /api/orders/:id`
### `GET /api/orders/:id/pdf`
### `PATCH /api/orders/:id/cancel`

---

## 6. Stock (Tuần 6)

### `GET /api/stock/alerts`
### `POST /api/stock/import`
### `POST /api/stock/adjust`

---

## 7. Reports (Tuần 8)

### `GET /api/reports/dashboard`
### `GET /api/reports/revenue`
### `GET /api/reports/top-products`

---

## 8. AI Recommendations (Tuần 9)

### `POST /api/ai/recommend-restock`
### `GET /api/ai/recommendations`
### `PATCH /api/ai/recommendations/:id`

---

## HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Bad Request |
| 401 | Unauthorized (chưa đăng nhập / token hết hạn) |
| 403 | Forbidden (không đủ quyền) |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |
