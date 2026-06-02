import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { aiRecommendSchema, aiStatusSchema } from '../validations/ai.validation';

const router = Router();

router.use(authMiddleware);
router.get('/recommendations', roleMiddleware('admin', 'manager'), AIController.list);
router.post('/recommend-restock', roleMiddleware('admin', 'manager'), validateMiddleware(aiRecommendSchema), AIController.generate);
router.patch('/recommendations/:id', roleMiddleware('admin', 'manager'), validateMiddleware(aiStatusSchema), AIController.updateStatus);
router.post('/generate-description', roleMiddleware('admin', 'manager'), AIController.generateDescription);
router.post('/suggest-category', roleMiddleware('admin', 'manager'), AIController.suggestCategory);

export default router;
