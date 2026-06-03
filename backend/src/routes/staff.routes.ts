import { Router } from 'express';
import { StaffController } from '../controllers/staff.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { staffCreateSchema, staffUpdateSchema } from '../validations/staff.validation';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('admin', 'manager'));

router.get('/', StaffController.list);
router.post('/', validateMiddleware(staffCreateSchema), StaffController.create);
router.put('/:id', validateMiddleware(staffUpdateSchema), StaffController.update);
router.delete('/:id', StaffController.deactivate);

export default router;
