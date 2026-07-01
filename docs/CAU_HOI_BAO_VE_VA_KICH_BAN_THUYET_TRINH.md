# Cau Hoi Bao Ve Va Kich Ban Thuyet Trinh - Sora POS V2

Tai lieu nay gom 2 phan:

1. Kich ban thuyet trinh de ban tap noi.
2. Cac cau hoi thay co the hoi va cach tra loi.

---

## 1. Kich Ban Thuyet Trinh 7-10 Phut

### Phan 1 - Gioi thieu de tai

Em xin trinh bay de tai Sora POS V2, la he thong quan ly ban hang tai quay danh cho cua hang ban le nho va vua. He thong giai quyet cac van de thuong gap nhu ban hang thu cong, quan ly ton kho bang Excel, kho tong hop doanh thu va khong co cong cu phan tich de ra quyet dinh kinh doanh.

Muc tieu cua he thong la xay dung mot ung dung full-stack co cac chuc nang: ban hang POS, quan ly san pham, ton kho, nhap kho, ca lam, hoa don, bao cao doanh thu, audit log va tich hop AI de goi y nhap hang cung nhu phan tich doanh thu.

### Phan 2 - Kien truc he thong

He thong duoc xay dung theo mo hinh client-server 3 tang.

Tang frontend dung React, TypeScript, Vite va Tailwind CSS de tao giao dien. Frontend goi backend bang Axios va quan ly state bang Zustand.

Tang backend dung Express va TypeScript. Backend chiu trach nhiem xac thuc JWT, phan quyen RBAC, validate request bang Zod, xu ly nghiep vu va truy van Supabase PostgreSQL.

Tang database dung PostgreSQL tren Supabase. Cac nghiep vu quan trong nhu tao hoa don, huy hoa don va nhap kho duoc xu ly bang SQL function/RPC de dam bao transaction.

### Phan 3 - Chuc nang chinh

Chuc nang trung tam la POS ban hang. Nguoi dung chon san pham, them vao gio hang, thanh toan. Khi tao don, backend goi function `create_pos_order` trong database. Function nay thuc hien nhieu thao tac trong mot transaction: kiem tra ton kho, tao hoa don, tao chi tiet, tao payment, tru ton kho, ghi stock transaction va audit log.

He thong con co quan ly kho, nhap kho, canh bao ton thap. Moi thay doi kho deu duoc ghi vao `stock_transactions`, giup truy vet lich su.

Phan bao cao tinh doanh thu, gia von, loi nhuan theo ngay. Gia von duoc luu snapshot trong `order_details.cost_price` tai thoi diem ban, nen neu sau nay gia nhap thay doi thi bao cao qua khu van chinh xac.

Phan AI gom hai huong: goi y nhap hang va phan tich doanh thu. AI phan tich doanh thu duoc tao tu du lieu that trong database va ket qua duoc luu vao bang `ai_revenue_analyses`.

### Phan 4 - Diem noi bat

Diem noi bat cua he thong la:

- Su dung transaction database cho checkout, tranh lech du lieu.
- Co RBAC phan quyen admin, manager, cashier.
- Co audit log cho nghiep vu quan trong.
- Co bao cao doanh thu va loi nhuan.
- Co AI phan tich doanh thu va luu lich su vao CSDL.
- Co offline POS bang IndexedDB.
- Co scanner ma vach qua Supabase Realtime.

### Phan 5 - Ket luan

Sora POS V2 khong chi la mot ung dung CRUD, ma co cac luong nghiep vu ban le thuc te: ban hang, kho, ca lam, bao cao, audit va AI. Huong phat trien tiep theo la bo sung test E2E, nang cap bao mat token, toi uu hieu nang frontend va mo rong thuat toan gia von FIFO hoac binh quan gia quyen.

---

## 2. Kich Ban Demo 5-7 Phut

Thu tu demo nen di nhu sau:

1. Dang nhap admin.
2. Gioi thieu dashboard.
3. Vao san pham, chi ra SKU, barcode, gia nhap, gia ban, ton kho.
4. Vao POS, them san pham vao gio.
5. Thanh toan tien mat/chuyen khoan.
6. Xem don hang vua tao.
7. Vao kho, chi ra ton kho da bi tru va stock transaction.
8. Vao bao cao, chi ra revenue/profit.
9. Bam AI phan tich doanh thu, chi ra lich su da luu CSDL.
10. Vao audit log, chi ra hanh dong tao/huy don.

Meo demo:

- Neu Groq API cham, noi rang AI co phu thuoc external API nhung ket qua sau khi tao se luu database.
- Neu du lieu mau it, hay tao 1-2 don truoc khi demo bao cao.
- Nhac ro: frontend an menu theo role, backend moi la noi check quyen that.

---

## 3. Cau Hoi Bao Ve Ve Cong Nghe

### 1. Vi sao dung React?

React phu hop cho SPA vi co component model ro rang, de tach UI thanh cac phan nho nhu POS cart, product grid, dashboard cards. React cung co ecosystem lon, ho tro Recharts, Zustand, React Router.

### 2. Vi sao dung TypeScript?

TypeScript giup kiem soat kieu du lieu giua frontend va backend, giam loi runtime. Vi du `Order`, `Product`, `RevenuePoint` co type ro rang, khi sua API se de phat hien loi luc build.

### 3. Vi sao dung Vite?

Vite khoi dong dev server nhanh, build nhanh, phu hop React SPA. No giup qua trinh phat trien nhanh hon so voi cac build tool cu.

### 4. Vi sao dung Tailwind CSS?

Tailwind giup tao UI nhanh bang utility class, khong phai viet nhieu CSS rieng. Phu hop voi ung dung dashboard/POS co nhieu component.

### 5. Vi sao dung Zustand?

Zustand nhe hon Redux, it boilerplate, phu hop de luu auth state va POS cart state. POS can cap nhat gio hang nhanh va nhieu component dung chung state.

### 6. Vi sao dung Express?

Express nhe, pho bien, de to chuc route-controller-service, phu hop REST API cho do an. Ket hop TypeScript giup backend an toan hon.

### 7. Vi sao dung Supabase/PostgreSQL?

PostgreSQL manh ve quan he du lieu, transaction, constraint, JSONB. Supabase cung cap managed PostgreSQL, SDK, realtime va de trien khai nhanh.

### 8. Vi sao dung JWT?

JWT phu hop REST API stateless. Backend khong can luu session server. Moi request gui token, backend verify va xac dinh user/role.

### 9. Vi sao dung Zod?

Zod dung de validate input truoc khi vao service. Neu client gui quantity am, email sai, UUID sai thi backend chan ngay, tranh du lieu loi vao database.

### 10. Vi sao dung Recharts?

Recharts tich hop tot voi React, de ve line/bar/pie chart cho dashboard va bao cao doanh thu.

### 11. Vi sao dung Groq AI?

Groq cung cap API LLM toc do nhanh. He thong dung Groq de bien so lieu kinh doanh thanh phan tich ngon ngu tu nhien va khuyen nghi hanh dong.

### 12. Vi sao dung IndexedDB/Dexie?

IndexedDB cho phep luu du lieu lon hon localStorage va truy van offline. Dexie boc IndexedDB de code de hon. POS co the doc san pham va luu pending order khi mat mang.

---

## 4. Cau Hoi Bao Ve Ve Kien Truc

### 1. Vi sao tach route-controller-service?

Route khai bao URL va middleware. Controller nhan request/response. Service xu ly nghiep vu va database. Tach nhu vay giup code de bao tri, de test va dung layered architecture.

### 2. Backend co phan quyen nhu the nao?

Backend dung `authMiddleware` de verify JWT va gan `req.user`. Sau do `roleMiddleware` kiem tra role co duoc phep vao route khong. Vi du `/reports` chi admin/manager, `/settings` chi admin.

### 3. Frontend co phan quyen chua?

Co. `ProtectedRoute` chan route theo role, `Sidebar` an menu theo role. Tuy nhien frontend chi la lop trai nghiem; bao mat that nam o backend middleware.

### 4. Neu user sua localStorage de doi role thi sao?

Khong duoc. Vi backend khong tin frontend. Backend verify token va nap lai user active tu database trong `authMiddleware`. Neu role khong hop le thi route bi tu choi.

### 5. Vi sao checkout khong viet bang nhieu query trong service?

Checkout can transaction. Neu viet nhieu query rieng o backend, loi giua chung co the lam du lieu lech. Dua vao SQL function trong PostgreSQL giup tat ca thao tac thanh cong cung nhau hoac rollback cung nhau.

### 6. He thong co audit log khong?

Co. Cac hanh dong quan trong nhu tao don, huy don, nhap kho duoc ghi vao `audit_logs` bang function `write_audit_log`.

---

## 5. Cau Hoi Bao Ve Ve POS

### 1. Tao hoa don gom nhung buoc nao?

Frontend tao payload tu gio hang, backend goi `create_pos_order`. Database kiem tra user, ca lam, ton kho, tinh tien, tao order, order_details, payment, tru kho, ghi stock transaction, cap nhat diem khach, ghi audit log.

### 2. Lam sao tranh ban qua ton?

Trong RPC `create_pos_order`, database lay san pham `FOR UPDATE`, kiem tra `stock_quantity < sale_quantity`. Neu khong cho ban qua ton thi raise exception va rollback.

### 3. Neu hai thu ngan ban cung mot san pham cung luc thi sao?

`FOR UPDATE` khoa dong san pham trong transaction. Giao dich thu hai phai cho giao dich thu nhat xong, sau do doc ton kho moi. Vi vay tranh race condition.

### 4. Vi sao luu `product_name` va `unit_price` trong `order_details`?

Vi ten/gia san pham co the thay doi sau nay. Hoa don qua khu phai giu dung ten va gia tai thoi diem mua.

### 5. Vi sao them `cost_price` vao `order_details`?

De bao cao loi nhuan qua khu chinh xac. Neu chi lay `products.cost_price` hien tai thi khi gia nhap thay doi, loi nhuan lich su se sai.

### 6. Huy don co xoa du lieu khong?

Khong. He thong doi status thanh `cancelled`, payment thanh `refunded`, co the hoan ton kho va ghi audit. Day la cach dung cho he thong doanh nghiep.

---

## 6. Cau Hoi Bao Ve Ve Bao Cao Va AI

### 1. Bao cao doanh thu tinh nhu the nao?

Lay cac order `completed` trong khoang ngay. Gom theo ngay. Revenue la tong `final_amount`. COGS la tong `quantity * cost_price` trong order details. Profit = revenue - COGS.

### 2. AI phan tich doanh thu co lay du lieu that khong?

Co. Backend tong hop revenue trend, top products, category sales, payment stats tu database, sau do dua vao prompt cho AI.

### 3. Bao cao AI co luu CSDL khong?

Co. Sau khi AI tra JSON, backend luu vao bang `ai_revenue_analyses` gom period, days, health_score, totals, analysis JSON va metrics snapshot.

### 4. Tai sao luu AI result dang JSONB?

Noi dung AI co cau truc linh hoat: summary, insights, recommendations, charts. JSONB phu hop de luu cau truc nay ma van co the truy van neu can.

### 5. Neu AI loi thi sao?

Mot so AI module co fallback rule-based. Rieng AI phan tich doanh thu neu Groq loi thi backend tra loi ro rang. Huong phat trien la tao report fallback local.

### 6. AI co tu bia so lieu khong?

Prompt yeu cau AI dung so lieu thuc te backend dua vao va tra ve JSON. Cac chart duoc yeu cau dung data that. Tuy nhien AI van la external model nen he thong luu lai ket qua va co the doi chieu voi metrics snapshot.

---

## 7. Cau Hoi Bao Ve Ve Kho

### 1. Stock transaction dung de lam gi?

Moi thay doi ton kho deu tao mot dong `stock_transactions`: sale, import, adjustment, return. Bang nay giup truy vet vi sao ton kho thay doi.

### 2. Canh bao ton kho tao nhu the nao?

Sau moi lan ban/nhap/dieu chinh, he thong goi sync stock alert. Neu ton <= 0 thi out_of_stock, neu ton <= min_stock_level thi low_stock, nguoc lai resolve alert.

### 3. Nhap kho anh huong gia von nhu the nao?

Khi nhap kho, he thong cong ton va cap nhat `products.cost_price` bang gia nhap moi nhat. Don hang sau do se snapshot gia von nay vao order_details.

### 4. He thong co ho tro han su dung khong?

Co migration `expiry_setup.sql` de quan ly lo/hang het han. Phan nay co the trinh bay la huong mo rong hoac module bo sung neu da chay migration.

---

## 8. Cau Hoi Bao Ve Ve Offline Va Scanner

### 1. Offline POS hoat dong nhu the nao?

Khi online, frontend sync san pham/danh muc/khach hang ve IndexedDB. Khi offline, POS doc tu IndexedDB va luu don pending. Khi co mang lai, `offlineSync` gui don len backend.

### 2. Neu offline ban het hang nhung server da het ton thi sao?

Khi sync len server, backend van kiem tra ton kho that trong transaction. Neu khong du ton, don sync that bai va frontend bao loi. Server database van la nguon dung cuoi cung.

### 3. Scanner ma vach hoat dong nhu the nao?

POS va scanner dung Supabase Realtime channel. Scanner quet barcode va publish event, POS lang nghe event va them/tim san pham tu barcode.

---

## 9. Cau Hoi Bao Ve Ve Bao Mat

### 1. Mat khau luu nhu the nao?

Mat khau khong luu plain text. Backend dung bcrypt hash truoc khi luu. Khi login, so sanh password nhap vao voi hash.

### 2. API co bi goi trai phep khong?

Cac route quan trong co `authMiddleware` va `roleMiddleware`. Neu khong co token hoac role khong dung thi backend tra 401/403.

### 3. Co chong spam API khong?

Co rate limit cho login va cac API AI. Vi AI ton chi phi/quota, API phan tich doanh thu gioi han 5 lan/phut/IP.

### 4. RLS trong Supabase dung de lam gi?

RLS la lop bao ve database khi client dung anon/auth key. Backend dung service role nen van co quyen CRUD. Frontend chi nen dung Supabase anon cho realtime, khong CRUD truc tiep.

### 5. Han che bao mat hien tai la gi?

JWT dang luu localStorage, phu hop do an nhung chua toi uu cho production. Huong nang cap la httpOnly cookie va refresh token.

---

## 10. Cau Hoi Bao Ve Ve Database

### 1. Cac bang chinh la gi?

`users`, `roles`, `products`, `categories`, `suppliers`, `customers`, `orders`, `order_details`, `payments`, `shift_sessions`, `goods_receipts`, `stock_transactions`, `stock_alerts`, `ai_recommendations`, `ai_revenue_analyses`, `audit_logs`.

### 2. Vi sao dung UUID?

UUID tranh trung ID, phu hop he thong phan tan/cloud, khong de doan so luong ban ghi nhu auto increment.

### 3. Vi sao dung JSONB?

JSONB phu hop cho du lieu linh hoat nhu app settings, audit metadata, AI analysis result, metrics snapshot.

### 4. Index dung de lam gi?

Index tang toc truy van theo email, role, product category, order created_at, stock alert status, audit log created_at, AI report generated_at.

### 5. Trigger `updated_at` dung de lam gi?

Tu dong cap nhat thoi gian sua ban ghi, tranh quen set o code backend.

---

## 11. Cau Hoi Kho Hon

### 1. Neu database transaction that bai giua luc checkout thi sao?

Vi tat ca nam trong mot SQL function transaction, neu loi xay ra thi PostgreSQL rollback toan bo. Khong co tinh trang da tao order nhung chua tru kho.

### 2. Vi sao khong cho xoa hoa don?

Hoa don la chung tu kinh doanh. Xoa se mat audit trail. He thong chi cho cancel/refund de giu lich su.

### 3. Neu user bi khoa nhung token con han thi sao?

`authMiddleware` khong chi verify JWT, ma con query lai database voi `is_active = true`. Neu user bi khoa, request bi tu choi.

### 4. AI co phai xu ly nghiep vu chinh khong?

Khong. AI chi la lop phan tich/khuyen nghi. Nghiep vu cot loi nhu ban hang, tru kho, tinh tien van do code va database transaction xu ly.

### 5. Du an co the mo rong mobile app khong?

Co. Vi backend da co REST API rieng, frontend web chi la mot client. Mobile app co the dung cung API.

### 6. Neu muon nang cap len doanh nghiep that can lam gi?

- Doi auth sang httpOnly cookie/refresh token.
- Them permission chi tiet.
- Them E2E tests.
- Them CI/CD.
- Them FIFO/weighted average cost.
- Them backup/monitoring/logging.
- Them export PDF bao cao AI.

---

## 12. Cau Tra Loi Ngan De Hoc Thuoc

**Cau:** He thong nay khac CRUD binh thuong o diem nao?

**Tra loi:** He thong co transaction POS, audit log, stock transaction, shift management, offline POS, AI analysis va bao cao loi nhuan co snapshot gia von, nen khong chi la CRUD.

**Cau:** File nao xu ly nghiep vu ban hang quan trong nhat?

**Tra loi:** `database/enterprise_pos_core.sql`, cu the la function `create_pos_order`.

**Cau:** Bao cao AI co luu database khong?

**Tra loi:** Co, luu vao `ai_revenue_analyses` voi analysis JSONB va metrics snapshot.

**Cau:** Phan quyen nam o dau?

**Tra loi:** Frontend co `ProtectedRoute` va menu theo role, backend co `authMiddleware` va `roleMiddleware`. Backend la lop bao ve chinh.

**Cau:** Ton kho co bi sai khi hai nguoi ban cung luc khong?

**Tra loi:** Database dung row lock `FOR UPDATE` trong transaction, nen tranh race condition.

**Cau:** Loi nhuan tinh nhu the nao?

**Tra loi:** Revenue tru COGS. COGS lay tu `order_details.cost_price` snapshot tai thoi diem ban.

---

## 13. Checklist Truoc Khi Bao Ve

- Chay app local duoc.
- Dang nhap admin duoc.
- Tao duoc san pham hoac co san pham seed.
- Tao duoc don hang POS.
- Xem duoc don hang va ton kho bi tru.
- Vao Reports thay bieu do doanh thu.
- Bam AI phan tich va thay lich su da luu.
- Vao Supabase thay bang `ai_revenue_analyses` co ban ghi.
- Mo `/api-docs` thay danh sach API.
- Chuan bi cau tra loi ve transaction, JWT, RBAC, AI, COGS.

