import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import {
  categoryRoutes,
  customerRoutes,
  productRoutes,
  supplierRoutes,
} from './catalog.routes';
import orderRoutes from './order.routes';
import stockRoutes from './stock.routes';
import reportRoutes from './report.routes';
import aiRoutes from './ai.routes';
import staffRoutes from './staff.routes';
import settingsRoutes from './settings.routes';
import shiftRoutes from './shift.routes';
import auditRoutes from './audit.routes';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Welcome to Sora POS API',
    endpoints: [
      '/api/health',
      '/api/openapi.json',
      '/api-docs',
      '/api/auth',
      '/api/products',
      '/api/categories',
      '/api/suppliers',
      '/api/customers',
      '/api/orders',
      '/api/stock',
      '/api/reports',
      '/api/ai',
      '/api/staff',
      '/api/settings',
      '/api/shifts',
      '/api/audit-logs',
    ],
  });
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Sora POS API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/orders', orderRoutes);
router.use('/stock', stockRoutes);
router.use('/reports', reportRoutes);
router.use('/ai', aiRoutes);
router.use('/staff', staffRoutes);
router.use('/settings', settingsRoutes);
router.use('/shifts', shiftRoutes);
router.use('/audit-logs', auditRoutes);

export default router;
