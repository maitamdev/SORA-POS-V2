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
import goodsReceiptRoutes from './goodsReceipt.routes';
import payosRoutes from './payos.routes';
import webhookRoutes from './webhook.routes';
import telegramRoutes from './telegram.routes';
import { promotionRoutes } from './promotion.routes';

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
      '/api/stock/receipts',
      '/api/reports',
      '/api/ai',
      '/api/staff',
      '/api/settings',
      '/api/shifts',
      '/api/audit-logs',
      '/api/payos',
      '/api/webhooks',
      '/api/promotions',
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

import { httpCacheMiddleware } from '../middlewares/cache.middleware';

router.use('/auth', authRoutes);
router.use('/products', httpCacheMiddleware(30, 60), productRoutes);
router.use('/categories', httpCacheMiddleware(60, 120), categoryRoutes);
router.use('/suppliers', httpCacheMiddleware(60, 120), supplierRoutes);
router.use('/customers', httpCacheMiddleware(30, 60), customerRoutes);
router.use('/orders', orderRoutes);
router.use('/stock', stockRoutes);
router.use('/stock/receipts', goodsReceiptRoutes);
router.use('/reports', reportRoutes);
router.use('/ai', aiRoutes);
router.use('/staff', staffRoutes);
router.use('/settings', httpCacheMiddleware(60, 300), settingsRoutes);
router.use('/shifts', shiftRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/payos', payosRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/webhooks', telegramRoutes);
router.use('/promotions', promotionRoutes);

export default router;
