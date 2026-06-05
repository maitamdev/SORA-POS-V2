import { Router } from 'express';
import { ShiftController } from '../controllers/shift.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { checkInShiftSchema, closeShiftSchema, openShiftSchema } from '../validations/shift.validation';

const router = Router();

router.use(authMiddleware);

router.get('/active', roleMiddleware('cashier'), ShiftController.active);
router.get('/my', roleMiddleware('cashier'), ShiftController.myShifts);
router.post('/active/check-in', roleMiddleware('cashier'), validateMiddleware(checkInShiftSchema), ShiftController.checkIn);
router.post('/active/close', roleMiddleware('cashier'), validateMiddleware(closeShiftSchema), ShiftController.close);

router.get('/', roleMiddleware('admin', 'manager'), ShiftController.list);
router.post('/', roleMiddleware('admin', 'manager'), validateMiddleware(openShiftSchema), ShiftController.open);
router.get('/:id', roleMiddleware('admin', 'manager'), ShiftController.get);
router.post('/:id/close', roleMiddleware('admin', 'manager'), validateMiddleware(closeShiftSchema), ShiftController.closeByManager);

export default router;
