import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';

const router = Router();

/**
 * Endpoint tiếp nhận Webhook từ Database Supabase khi có dòng audit_logs mới
 */
router.post('/supabase-audit', asyncHandler(async (req: Request, res: Response) => {
  const { record, type, table } = req.body;
  const webhookToken = req.query.token;

  // Xác thực token bảo mật đơn giản để tránh người lạ gọi API spam Telegram
  const expectedToken = env.jwtSecret; // Dùng tạm JWT_SECRET làm token bảo mật
  if (webhookToken !== expectedToken) {
    console.warn('[Webhook] Unauthorized webhook call attempt.');
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  if (type === 'INSERT' && table === 'audit_logs' && record) {
    console.log('[Webhook] New audit log detected via Supabase Webhook:', record);
    // Gửi thông báo định dạng đẹp lên Telegram
    await NotificationService.sendAuditLogNotification(record);
  }

  successResponse(res, null, 'Webhook processed successfully');
}));

export default router;
