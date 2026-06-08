import { Router } from 'express';
import { StaffController } from '../controllers/staff.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { staffCreateSchema, staffUpdateSchema } from '../validations/staff.validation';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware('admin', 'manager'), StaffController.list);
router.post('/', roleMiddleware('admin'), validateMiddleware(staffCreateSchema), StaffController.create);
router.put('/:id', roleMiddleware('admin'), validateMiddleware(staffUpdateSchema), StaffController.update);
router.delete('/:id', roleMiddleware('admin'), StaffController.deactivate);

export default router;
