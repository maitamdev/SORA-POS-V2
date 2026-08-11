import { Router, Request, Response } from 'express';
import { PayOSService } from '../services/payos.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';

const router = Router();

/**
 * POST /api/payos/create
 * Tạo payment link PayOS cho đơn hàng
 */
router.post('/create', rateLimitMiddleware({ keyPrefix: 'payos-create', windowMs: 60_000, max: 30 }), authMiddleware, roleMiddleware('admin', 'manager', 'cashier'), async (req: Request, res: Response) => {
  try {
    if (!PayOSService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'PayOS chưa được cấu hình. Vui lòng thêm PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY vào .env',
      });
    }

    const { amount, description } = req.body;

    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0 || numericAmount > 100_000_000_000) {
      return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
    }

    const orderCode = PayOSService.generateOrderCode();
    const safeDescription = String(description || 'SORA POS').trim().slice(0, 25) || 'SORA POS';

    const result = await PayOSService.createPaymentLink({
      orderCode,
      amount: numericAmount,
      description: safeDescription,
    });

    await PayOSService.savePaymentIntent({
      orderCode,
      amount: numericAmount,
      description: safeDescription,
      paymentLinkId: result.paymentLinkId,
      checkoutUrl: result.checkoutUrl,
      qrCode: result.qrCode,
      createdBy: req.user?.userId || null,
    });

    return res.json({
      success: true,
      data: {
        orderCode,
        checkoutUrl: result.checkoutUrl,
        qrCode: result.qrCode,
        paymentLinkId: result.paymentLinkId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'PayOS request failed';
    console.error('[PayOS] Lỗi tạo payment link:', message);
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Lỗi tạo link thanh toán PayOS' : message,
    });
  }
});

/**
 * GET /api/payos/status/:orderCode
 * Kiểm tra trạng thái thanh toán
 */
router.get('/status/:orderCode', rateLimitMiddleware({ keyPrefix: 'payos-status', windowMs: 60_000, max: 120 }), authMiddleware, roleMiddleware('admin', 'manager', 'cashier'), async (req: Request, res: Response) => {
  try {
    const orderCode = Number(req.params.orderCode);
    if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
      return res.status(400).json({ success: false, message: 'orderCode không hợp lệ' });
    }

    const result = await PayOSService.getPaymentStatus(orderCode);

    return res.json({
      success: true,
      data: {
        orderCode: result.orderCode,
        status: result.status, // PENDING, PROCESSING, PAID, CANCELLED
        amount: result.amount,
        amountPaid: result.amountPaid,
        amountRemaining: result.amountRemaining,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'PayOS status request failed';
    console.error('[PayOS] Lỗi check status:', message);
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Lỗi kiểm tra trạng thái' : message,
    });
  }
});

/**
 * POST /api/payos/webhook
 * Nhận webhook từ PayOS khi thanh toán thành công
 * Route này KHÔNG cần auth (PayOS gọi trực tiếp)
 */
router.post('/webhook', rateLimitMiddleware({ keyPrefix: 'payos-webhook', windowMs: 60_000, max: 120 }), async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PayOS Webhook] Nhận webhook');
    }

    const webhookData = await PayOSService.verifyWebhook(req.body);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PayOS Webhook] Verified');
    }

    await PayOSService.updatePaymentIntentFromWebhook(webhookData);

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed';
    console.error('[PayOS Webhook] Lỗi verify:', message);
    return res.status(400).json({ success: false, message: 'Webhook verification failed' });
  }
});

export default router;
