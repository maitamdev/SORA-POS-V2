import { Router } from 'express';
import { StockController } from '../controllers/stock.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { resolveAlertSchema, stockAdjustSchema, stockImportSchema } from '../validations/stock.validation';

const router = Router();

router.use(authMiddleware);
router.get('/inventory', StockController.inventory);
router.get('/alerts', StockController.alerts);
router.get('/transactions', roleMiddleware('admin', 'manager'), StockController.transactions);
router.post('/import', roleMiddleware('admin', 'manager'), validateMiddleware(stockImportSchema), StockController.importStock);
router.post('/adjust', roleMiddleware('admin', 'manager'), validateMiddleware(stockAdjustSchema), StockController.adjustStock);
router.patch('/alerts/:id/resolve', roleMiddleware('admin', 'manager'), validateMiddleware(resolveAlertSchema), StockController.resolveAlert);

export default router;
