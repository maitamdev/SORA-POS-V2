# SORA POS production runbook

Tài liệu này là checklist triển khai và vận hành ngắn gọn cho mô hình:

`Vercel static frontend + Vercel API function + Supabase PostgreSQL/Realtime`.

## 1. Trước khi deploy

Chạy tại thư mục gốc:

```bash
npm ci
npm run ci
npm audit --audit-level=high
```

Các ngưỡng hiện tại cần giữ:

- Backend: toàn bộ test phải pass.
- Frontend: TypeScript và Vite production build phải pass.
- Scanner: typecheck phải pass.
- Bundle entry hiện tại khoảng 105KB gzip; không đưa Recharts, Supabase, Dexie hoặc html2canvas vào initial modulepreload.

## 2. Biến môi trường

### Vercel / backend

Đặt ở Production Environment, không commit vào Git:

- `NODE_ENV=production`
- `JWT_SECRET` — chuỗi ngẫu nhiên dài, khác dev.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — chỉ backend dùng, tuyệt đối không đặt tên `VITE_`.
- `GROQ_API_KEY` — tùy chọn; hệ thống có deterministic fallback.
- `CORS_ORIGIN` — domain frontend production, không dùng wildcard.
- `SUPABASE_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_SECRET` nếu bật webhook.
- `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` nếu bật PayOS.
- SMTP variables nếu bật gửi hóa đơn email.

### Vercel / frontend

- `VITE_API_URL=/api` khi frontend và API cùng domain.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — chỉ anon key; không dùng service role key.

Sau khi thay secret, tạo deployment mới và kiểm tra lại login/logout. Không in giá trị secret trong log hoặc response.

## 3. Migration Supabase

Chạy từng file trong SQL Editor theo thứ tự ở `database/README.md`, đặc biệt các migration lõi:

1. `schema.sql`
2. `app_settings.sql`
3. `order_details_cost_snapshot.sql`
4. `ai_revenue_analyses.sql`
5. `payment_intents.sql`
6. `hardening.sql`
7. `enterprise_pos_core.sql`
8. `stock_atomic_rpc.sql`
9. `expiry_setup.sql`
10. `lot_expiry_upgrade.sql`
11. `inventory_replenishment_v2.sql`
12. `purchase_order_lifecycle.sql`
13. `stock_summary_rpc.sql`
14. `ai_inventory_analyses.sql`
15. `seed.sql` (chỉ cho database demo mới)

`seed.sql` chỉ chạy trên database demo mới. Không chạy seed trên kho thật.

Sau migration, smoke test trực tiếp trên UI:

1. Tạo sản phẩm có `min_stock_level`, giá vốn và supplier.
2. Tạo phiếu nhập có batch + HSD riêng cho từng dòng.
3. Tạo PO, chuyển trạng thái, nhận một phần rồi nhận phần còn lại.
4. Bán hàng, hủy một đơn thử nghiệm và đối chiếu tồn/transaction.
5. Mở AI nhập hàng và kiểm tra `forecast quality`, `manual review`, incoming quantity.

## 4. Deploy và smoke test

Sau deployment, kiểm tra:

```text
GET /api/health
GET /api/openapi.json
```

Tiếp đó đăng nhập và kiểm tra lần lượt Dashboard, POS, Kho, PO, Báo cáo doanh thu và Báo cáo kho. Khi lỗi API, lấy `X-Request-ID` từ response để tra log Vercel; backend cũng trả `request_id` trong error body.

Các response GET catalog được đánh dấu `private` và `Vary: Authorization`; không đổi thành `public` vì có thể làm lộ dữ liệu giữa tài khoản.

## 5. Hiệu năng và theo dõi

- Frontend route nặng được lazy-load; báo cáo chỉ tải họ dữ liệu đang mở.
- Query report được cache ngắn trong warm instance và invalid khi tạo/hủy đơn.
- Auth vẫn verify JWT và kiểm tra user active/role; context user chỉ cache 15 giây trong warm instance.
- Supabase request có timeout 12 giây; request chậm từ 750ms được ghi log kèm trace ID.
- Không coi local CI là phép đo Vercel. Sau deploy cần đo thêm TTFB, FCP/LCP và API latency bằng URL production thật.

Nếu Vercel vẫn chậm:

1. Kiểm tra cold start và thời gian `GET /api/health`.
2. Kiểm tra API report/AI có bị gọi tự động ngoài tab cần thiết không.
3. Kiểm tra Supabase region có gần người dùng/Vercel region không.
4. Kiểm tra query log và index trước khi tăng timeout.
5. Không bật cache public cho API có Authorization.

## 6. Backup, rollback và sự cố

- Bật backup/PITR của Supabase theo plan đang dùng và định kỳ thử restore sang project staging.
- Trước migration dữ liệu lớn, tạo backup và ghi lại migration/commit tương ứng.
- Rollback frontend/API bằng deployment trước trên Vercel.
- Migration database đi theo hướng forward-only; sửa bằng migration mới, không reset database production.
- Nếu tồn kho lệch: dừng điều chỉnh thủ công hàng loạt, lấy trace/audit log, đối chiếu `orders`, `goods_receipts`, `stock_transactions`, `product_batches` rồi mới chạy adjustment có người duyệt.
- AI chỉ là trợ lý; SKU `low_confidence`, thiếu lịch sử, lệch bias cao hoặc thiếu policy phải được quản lý duyệt tay.
