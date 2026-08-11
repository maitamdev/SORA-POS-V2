import { Router } from 'express';
import { PurchaseOrderController } from '../controllers/purchaseOrder.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import {
  purchaseOrderCreateSchema,
  purchaseOrderReceiveSchema,
  purchaseOrderStatusSchema,
} from '../validations/purchaseOrder.validation';

const router = Router();

router.use(authMiddleware, roleMiddleware('admin', 'manager'));
router.get('/', PurchaseOrderController.list);
router.get('/:id', PurchaseOrderController.getById);
router.post('/', validateMiddleware(purchaseOrderCreateSchema), PurchaseOrderController.create);
router.patch('/:id/status', validateMiddleware(purchaseOrderStatusSchema), PurchaseOrderController.updateStatus);
router.post('/:id/receive', validateMiddleware(purchaseOrderReceiveSchema), PurchaseOrderController.receive);

export default router;
