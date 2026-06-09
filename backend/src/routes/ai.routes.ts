import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { aiRecommendSchema, aiStatusSchema } from '../validations/ai.validation';

const router = Router();

router.use(authMiddleware);
router.get('/restock-analysis', roleMiddleware('admin', 'manager'), AIController.restockAnalysis);
router.get('/recommendations', roleMiddleware('admin', 'manager'), AIController.list);
router.post(
  '/recommend-restock',
  rateLimitMiddleware({ keyPrefix: 'ai-restock', windowMs: 60_000, max: 10 }),
  roleMiddleware('admin', 'manager'),
  validateMiddleware(aiRecommendSchema),
  AIController.generate
);
router.patch('/recommendations/:id', roleMiddleware('admin', 'manager'), validateMiddleware(aiStatusSchema), AIController.updateStatus);
router.get(
  '/identify-product/:barcode',
  rateLimitMiddleware({ keyPrefix: 'ai-barcode', windowMs: 60_000, max: 60 }),
  roleMiddleware('admin', 'manager', 'cashier'),
  AIController.identifyProductByBarcode
);
router.post(
  '/generate-description',
  rateLimitMiddleware({ keyPrefix: 'ai-description', windowMs: 60_000, max: 30 }),
  roleMiddleware('admin', 'manager'),
  AIController.generateDescription
);
router.post(
  '/suggest-category',
  rateLimitMiddleware({ keyPrefix: 'ai-category', windowMs: 60_000, max: 30 }),
  roleMiddleware('admin', 'manager'),
  AIController.suggestCategory
);
router.post(
  '/suggest-category-image',
  rateLimitMiddleware({ keyPrefix: 'ai-category-image', windowMs: 60_000, max: 30 }),
  roleMiddleware('admin', 'manager'),
  AIController.suggestCategoryImage
);

export default router;
