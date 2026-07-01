# Huong Dan Hoc Bao Ve Do An Sora POS

Day la muc luc cac tai lieu minh tao rieng cho viec bao ve do an.

## 1. Hoc tong quan he thong truoc

Doc file:

- `docs/BAO_CAO_BAO_VE_DO_AN_SORA_POS.md`

Muc tieu:

- Hieu de tai giai quyet bai toan gi.
- Hieu kien truc frontend/backend/database.
- Hieu cac module chuc nang.
- Nam duoc diem noi bat de noi voi thay.

Nen hoc ky cac phan:

- Kien truc tong the.
- Luong ban hang POS.
- Luong bao cao doanh thu.
- Luong AI phan tich doanh thu.
- Diem noi bat de trinh bay.

## 2. Hoc file code

Doc file:

- `docs/GIAI_THICH_TUNG_FILE_CODE.md`

Muc tieu:

- Khi thay hoi file nao lam gi, ban tra loi duoc.
- Nam duoc route-controller-service.
- Biet frontend page nao goi API nao.
- Biet database SQL file nao dung de lam gi.

Cach hoc:

1. Hoc backend truoc: app, routes, controllers, services, middlewares.
2. Hoc frontend sau: App, pages, services, stores, hooks.
3. Hoc database cuoi: schema, enterprise_pos_core, hardening.

## 3. Hoc chuc nang va thuat toan

Doc file:

- `docs/BANG_CHUC_NANG_THUAT_TOAN_API_CSDL.md`

Muc tieu:

- Giai thich tung chuc nang.
- Biet chuc nang do dung file nao, API nao, bang nao.
- Biet thuat toan/logic nghiep vu.

Nen hoc ky:

- Dang nhap va phan quyen.
- POS checkout.
- Huy hoa don.
- Ton kho va canh bao.
- Bao cao doanh thu.
- AI phan tich doanh thu.
- Offline POS.

## 4. Tap noi va tap tra loi cau hoi

Doc file:

- `docs/CAU_HOI_BAO_VE_VA_KICH_BAN_THUYET_TRINH.md`

Muc tieu:

- Tap thuyet trinh 7-10 phut.
- Tap demo 5-7 phut.
- Hoc cau tra loi ngan gon.
- Chuan bi cau hoi kho.

## 5. Thu tu hoc de khong bi ngop

Ngay 1:

1. Doc bao cao tong hop.
2. Hoc kien truc 3 tang.
3. Hoc luong POS checkout.

Ngay 2:

1. Doc bang chuc nang.
2. Hoc bao cao doanh thu va AI.
3. Hoc kho/nhap kho/ca lam.

Ngay 3:

1. Doc giai thich tung file.
2. Tap noi route-controller-service.
3. Tap chi vao code that tren VS Code.

Ngay 4:

1. Tap demo.
2. Doc cau hoi bao ve.
3. Tu tra loi khong nhin tai lieu.

## 6. 10 Cau Quan Trong Nhat Phai Thuoc

1. Vi sao dung transaction SQL cho checkout?
2. `create_pos_order` lam nhung viec gi?
3. Lam sao tranh ban qua ton?
4. JWT va RBAC hoat dong nhu the nao?
5. Frontend va backend phan quyen khac nhau ra sao?
6. Bao cao doanh thu/loi nhuan tinh nhu the nao?
7. Vi sao can `order_details.cost_price`?
8. AI phan tich doanh thu lay du lieu tu dau va luu o dau?
9. Offline POS hoat dong nhu the nao?
10. Audit log co y nghia gi?

## 7. Cau Chot Khi Bao Ve

Neu can ket luan ngan gon:

> Sora POS V2 khong chi la ung dung CRUD quan ly ban hang, ma co day du nghiep vu cot loi cua mot POS: checkout transaction an toan, quan ly ton kho, ca lam, bao cao loi nhuan, audit log, offline POS va AI phan tich doanh thu duoc luu vao co so du lieu. He thong duoc to chuc theo kien truc frontend-backend-database ro rang, de mo rong va phu hop voi bai toan ban le thuc te.

