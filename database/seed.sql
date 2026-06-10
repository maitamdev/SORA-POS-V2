-- ============================================
-- Sora POS - Clean Seed Data
-- ============================================

-- 1. Xóa dữ liệu cũ (chạy ngược thứ tự để tránh lỗi khóa ngoại)
DELETE FROM ai_recommendations;
DELETE FROM stock_alerts;
DELETE FROM stock_transactions;
DELETE FROM order_details;
DELETE FROM payments;
DELETE FROM orders;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM suppliers;
DELETE FROM customers;
DELETE FROM users;
DELETE FROM roles;

-- 2. Khởi tạo Roles (BẮT BUỘC)
INSERT INTO roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin', 'Quản trị viên toàn quyền hệ thống'),
  ('a0000000-0000-0000-0000-000000000002', 'manager', 'Quản lý cửa hàng/kho'),
  ('a0000000-0000-0000-0000-000000000003', 'cashier', 'Nhân viên thu ngân');

-- 3. Khởi tạo Tài khoản Admin mặc định (BẮT BUỘC)
-- Password: password123 (Đã được băm bằng bcrypt: $2a$10$... )
INSERT INTO users (id, email, password_hash, full_name, role_id) VALUES
  (
    'b0000000-0000-0000-0000-000000000001', 
    'admin@sorapos.com', 
    '$2a$10$ditiME.VIYSrorje5JDnoegUmDQjo.kOTja8OJgFGWBPytxeQlnrq', 
    'Quản Trị Hệ Thống', 
    'a0000000-0000-0000-0000-000000000001'
  );


