import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/dashboard', roleMiddleware('admin', 'manager'), ReportController.dashboard);
router.get('/revenue', roleMiddleware('admin', 'manager'), ReportController.revenue);
router.get('/top-products', roleMiddleware('admin', 'manager'), ReportController.topProducts);
router.get('/ai-analysis/history', roleMiddleware('admin', 'manager'), ReportController.aiAnalysisHistory);
router.get('/ai-analysis/:id', roleMiddleware('admin', 'manager'), ReportController.aiAnalysisDetail);
router.post(
  '/ai-analysis',
  rateLimitMiddleware({ keyPrefix: 'report-ai-analysis', windowMs: 60_000, max: 5 }),
  roleMiddleware('admin', 'manager'),
  ReportController.aiAnalysis
);
router.delete('/ai-analysis/:id', roleMiddleware('admin'), ReportController.deleteAiAnalysis);

export default router;
