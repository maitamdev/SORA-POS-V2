import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { cancelOrderSchema, orderCreateSchema } from '../validations/order.validation';

const router = Router();

router.use(authMiddleware);
router.get('/', OrderController.list);
router.post('/', roleMiddleware('admin', 'manager', 'cashier'), validateMiddleware(orderCreateSchema), OrderController.create);
router.get('/:id', OrderController.get);
router.patch('/:id/cancel', roleMiddleware('admin', 'manager'), validateMiddleware(cancelOrderSchema), OrderController.cancel);
router.delete('/all', roleMiddleware('admin'), OrderController.removeAll);
router.delete('/:id', roleMiddleware('admin', 'manager'), OrderController.remove);

export default router;
