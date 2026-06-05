import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { operationSettingsSchema } from '../validations/settings.validation';

const router = Router();

router.use(authMiddleware);

router.get('/operation', SettingsController.getOperation);
router.get('/operation/defaults', SettingsController.defaults);
router.put('/operation', roleMiddleware('admin'), validateMiddleware(operationSettingsSchema), SettingsController.updateOperation);

export default router;
