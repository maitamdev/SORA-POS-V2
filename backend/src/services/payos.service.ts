// eslint-disable-next-line @typescript-eslint/no-var-requires
const PayOSModule = require('@payos/node');
const PayOS = PayOSModule.PayOS || PayOSModule.default || PayOSModule;
import { env } from '../config/env';

// Khởi tạo PayOS SDK
const payos = new PayOS({
  clientId: env.payosClientId,
  apiKey: env.payosApiKey,
  checksumKey: env.payosChecksumKey,
});

export class PayOSService {
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

  /**
   * Kiểm tra PayOS đã được cấu hình chưa
   */
  static isConfigured(): boolean {
    return !!(env.payosClientId && env.payosApiKey && env.payosChecksumKey);
  }
}
