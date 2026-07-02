import { Router, Request, Response } from 'express';
import { PayOSService } from '../services/payos.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

/**
 * POST /api/payos/create
 * Tạo payment link PayOS cho đơn hàng
 */
router.post('/create', authMiddleware, roleMiddleware('admin', 'manager', 'cashier'), async (req: Request, res: Response) => {
  try {
    if (!PayOSService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'PayOS chưa được cấu hình. Vui lòng thêm PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY vào .env',
      });
    }

    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
    }

    const orderCode = PayOSService.generateOrderCode();
    const safeDescription = description || 'SORA POS';

    const result = await PayOSService.createPaymentLink({
      orderCode,
      amount: Math.round(amount),
      description: safeDescription,
    });

    await PayOSService.savePaymentIntent({
      orderCode,
      amount,
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
  } catch (error: any) {
    console.error('[PayOS] Lỗi tạo payment link:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Lỗi tạo link thanh toán PayOS',
    });
  }
});

/**
 * GET /api/payos/status/:orderCode
 * Kiểm tra trạng thái thanh toán
 */
router.get('/status/:orderCode', authMiddleware, roleMiddleware('admin', 'manager', 'cashier'), async (req: Request, res: Response) => {
  try {
    const orderCode = Number(req.params.orderCode);
    if (!orderCode) {
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
  } catch (error: any) {
    console.error('[PayOS] Lỗi check status:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Lỗi kiểm tra trạng thái',
    });
  }
});

/**
 * POST /api/payos/webhook
 * Nhận webhook từ PayOS khi thanh toán thành công
 * Route này KHÔNG cần auth (PayOS gọi trực tiếp)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[PayOS Webhook] Nhận webhook:', JSON.stringify(req.body));

    const webhookData = await PayOSService.verifyWebhook(req.body);
    console.log('[PayOS Webhook] Verified:', JSON.stringify(webhookData));

    await PayOSService.updatePaymentIntentFromWebhook(webhookData);

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[PayOS Webhook] Lỗi verify:', error?.message || error);
    return res.status(400).json({ success: false, message: 'Webhook verification failed' });
  }
});

export default router;
