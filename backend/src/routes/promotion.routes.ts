import { Router } from 'express';
import { PromotionController } from '../controllers/promotion.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import {
  promotionCreateSchema,
  promotionUpdateSchema,
  promotionValidateSchema,
} from '../validations/promotion.validation';

export const promotionRoutes = Router();
promotionRoutes.use(authMiddleware);

// CRUD — admin/manager only for write operations
promotionRoutes.get('/', PromotionController.list);
promotionRoutes.get('/:id', PromotionController.get);
promotionRoutes.post('/', roleMiddleware('admin', 'manager'), validateMiddleware(promotionCreateSchema), PromotionController.create);
promotionRoutes.put('/:id', roleMiddleware('admin', 'manager'), validateMiddleware(promotionUpdateSchema), PromotionController.update);
promotionRoutes.delete('/:id', roleMiddleware('admin', 'manager'), PromotionController.delete);

// POS integration — all authenticated users can validate codes
promotionRoutes.post('/validate', validateMiddleware(promotionValidateSchema), PromotionController.validate);
promotionRoutes.post('/auto', PromotionController.autoPromotions);
