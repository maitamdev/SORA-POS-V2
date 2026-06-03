import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { operationSettingsSchema } from '../validations/settings.validation';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('admin', 'manager'));

router.get('/operation', SettingsController.getOperation);
router.put('/operation', validateMiddleware(operationSettingsSchema), SettingsController.updateOperation);
router.get('/operation/defaults', SettingsController.defaults);

export default router;
