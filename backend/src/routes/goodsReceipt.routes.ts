import { Router } from 'express';
import { GoodsReceiptController } from '../controllers/goodsReceipt.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { goodsReceiptCreateSchema, goodsReceiptPaymentSchema } from '../validations/goodsReceipt.validation';

const router = Router();

// Yêu cầu đăng nhập cho toàn bộ các route nhập kho
router.use(authMiddleware);

// Chỉ cho phép admin và manager xem danh sách, xem chi tiết và tạo phiếu nhập kho
router.get('/', roleMiddleware('admin', 'manager'), GoodsReceiptController.list);
router.get('/:id', roleMiddleware('admin', 'manager'), GoodsReceiptController.getById);
router.post('/', roleMiddleware('admin', 'manager'), validateMiddleware(goodsReceiptCreateSchema), GoodsReceiptController.create);
router.patch(
  '/:id/payment',
  roleMiddleware('admin', 'manager'),
  validateMiddleware(goodsReceiptPaymentSchema),
  GoodsReceiptController.updatePayment
);

export default router;
