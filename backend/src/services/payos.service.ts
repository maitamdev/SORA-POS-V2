import { PayOS } from '@payos/node';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

// Khởi tạo PayOS SDK
const payos = new PayOS({
  clientId: env.payosClientId,
  apiKey: env.payosApiKey,
  checksumKey: env.payosChecksumKey,
});

export class PayOSService {
  static generateOrderCode(): number {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  /**
   * Tạo payment link để khách chuyển khoản
   */
  static async createPaymentLink(params: {
    orderCode: number;
    amount: number;
    description: string;
    returnUrl?: string;
    cancelUrl?: string;
  }) {
    const { orderCode, amount, description } = params;

    const result = await payos.paymentRequests.create({
      orderCode,
      amount,
      description: description.substring(0, 25), // PayOS giới hạn 25 ký tự
      returnUrl: params.returnUrl || 'https://sorapos.local/success',
      cancelUrl: params.cancelUrl || 'https://sorapos.local/cancel',
    });

    return result;
  }

  /**
   * Kiểm tra trạng thái thanh toán
   */
  static async getPaymentStatus(orderCode: number) {
    const result = await payos.paymentRequests.get(String(orderCode));
    return result;
  }

  /**
   * Xác thực webhook data từ PayOS
   */
  static async verifyWebhook(body: any) {
    return payos.webhooks.verify(body);
  }

  static async savePaymentIntent(params: {
    orderCode: number;
    amount: number;
    description: string;
    paymentLinkId?: string | null;
    checkoutUrl?: string | null;
    qrCode?: string | null;
    createdBy?: string | null;
  }) {
    const { error } = await supabase
      .from('payment_intents')
      .insert({
        order_code: params.orderCode,
        amount: Math.round(params.amount),
        description: params.description,
        payment_link_id: params.paymentLinkId || null,
        checkout_url: params.checkoutUrl || null,
        qr_code: params.qrCode || null,
        status: 'PENDING',
        created_by: params.createdBy || null,
      });

    if (error) {
      console.warn('[PayOS] Could not persist payment intent:', error.message);
    }
  }

  static async updatePaymentIntentFromWebhook(webhookData: any) {
    const data = webhookData?.data || webhookData || {};
    const orderCode = Number(data.orderCode || data.order_code);
    if (!orderCode) return;

    const status =
      data.status ||
      (data.code === '00' || data.desc === 'success' ? 'PAID' : 'UPDATED');

    const { error } = await supabase
      .from('payment_intents')
      .update({
        status,
        webhook_payload: webhookData,
        paid_at: status === 'PAID' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_code', orderCode);

    if (error) {
      console.warn('[PayOS] Could not update payment intent from webhook:', error.message);
    }
  }

  /**
   * Kiểm tra PayOS đã được cấu hình chưa
   */
  static isConfigured(): boolean {
    return !!(env.payosClientId && env.payosApiKey && env.payosChecksumKey);
  }
}
