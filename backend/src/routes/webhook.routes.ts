import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';

const router = Router();

/**
 * Endpoint tiếp nhận Webhook từ Database Supabase khi có dòng audit_logs mới
 */
router.post(
  '/supabase-audit',
  rateLimitMiddleware({ keyPrefix: 'webhook-supabase-audit', windowMs: 60_000, max: 120 }),
  asyncHandler(async (req: Request, res: Response) => {
  const { record, type, table } = req.body;
  const authorization = req.header('Authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  const webhookToken =
    bearerToken ||
    req.header('X-Sora-Webhook-Secret') ||
    req.header('X-Webhook-Secret');

  const expectedToken = env.supabaseWebhookSecret;
  if (!expectedToken) {
    res.status(503).json({
      success: false,
      message: 'SUPABASE_WEBHOOK_SECRET is not configured',
    });
    return;
  }

  if (webhookToken !== expectedToken) {
    console.warn('[Webhook] Unauthorized webhook call attempt.');
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  if (type === 'INSERT' && table === 'audit_logs' && record) {
    if (env.nodeEnv !== 'production') {
      console.log('[Webhook] New audit log detected via Supabase Webhook:', {
        type,
        table,
        recordId: typeof record.id === 'string' ? record.id : undefined,
      });
    }
    // Gửi thông báo định dạng đẹp lên Telegram
    await NotificationService.sendAuditLogNotification(record);
  }

  successResponse(res, null, 'Webhook processed successfully');
  }),
);

export default router;
