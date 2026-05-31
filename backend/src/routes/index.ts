import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: '🚀 Sora POS API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount routes
router.use('/auth', authRoutes);

// Tuần 3: router.use('/products', productRoutes);
// Tuần 3: router.use('/categories', categoryRoutes);
// Tuần 5: router.use('/orders', orderRoutes);
// Tuần 6: router.use('/stock', stockRoutes);
// Tuần 8: router.use('/reports', reportRoutes);
// Tuần 9: router.use('/ai', aiRoutes);

export default router;
