import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/dashboard', ReportController.dashboard);
router.get('/revenue', roleMiddleware('admin', 'manager'), ReportController.revenue);
router.get('/top-products', roleMiddleware('admin', 'manager'), ReportController.topProducts);

export default router;
