# Chien luoc kiem thu - Sora POS

## Muc tieu

Bo test tap trung vao cac luong co rui ro cao nhat cua POS:

- Tinh tien hoa don, chiet khau va diem tich luy.
- Tong hop thanh toan theo phuong thuc.
- Doi soat tien dau ca, tien mat trong ca va tien thuc dem.
- Kiem tra OpenAPI contract cho cac endpoint quan trong.
- Kiem tra migration transaction/audit khong bi sua mat cac thanh phan cot loi.
- Kiem tra cache in-memory hoat dong va invalidate dung namespace.

## Test runner

Du an dung Node.js 22 nen co san `node:test`. Backend da co `tsx`, vi vay test TypeScript chay duoc ma khong can cai them Jest trong moi truong offline:

```bash
npm test
npm run test --workspace=backend
```

Neu hoi dong yeu cau Jest, co the chuyen cac file trong `backend/src/tests/*.test.ts` sang Jest rat nhanh vi assert hien tai deu la unit test thuan.

## Cac nhom test da co

| File | Noi dung |
|------|----------|
| `backend/src/tests/posCalculations.test.ts` | Unit test tinh tien ca, thanh toan, loyalty, health score |
| `backend/src/tests/cache.test.ts` | Unit test TTL cache va cache key |
| `backend/src/tests/apiDocs.test.ts` | Contract test cho OpenAPI docs |
| `backend/src/tests/enterpriseSql.test.ts` | Contract test cho transaction SQL va audit trail |

## Luong E2E khuyen nghi khi demo

1. Dang nhap admin/manager.
2. Mo ca cho thu ngan.
3. Dang nhap thu ngan, check-in ca.
4. Mo POS, them san pham vao gio.
5. Thanh toan tien mat/chuyen khoan.
6. Kiem tra hoa don xuat hien trong Orders.
7. Kiem tra stock bi tru va audit log co `order.create`.
8. Huy hoa don boi manager.
9. Kiem tra stock duoc hoan va audit log co `order.cancel`.

## Tieu chi pass

- Backend build pass.
- Frontend build pass.
- Tat ca unit/contract test pass.
- Khong co hard delete hoa don/san pham trong UI van hanh.
- Neu AI loi hoac timeout, he thong van co ket qua fallback rule-based.
