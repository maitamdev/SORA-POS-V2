import { env } from '../config/env';
import { supabase } from '../config/supabase';

export class NotificationService {
  /**
   * Gửi tin nhắn đến Telegram qua Bot API
   */
  static async sendTelegramMessage(text: string): Promise<boolean> {
    const token = env.telegramBotToken;
    const chatId = env.telegramChatId;

    console.log(`[NotificationService.sendTelegramMessage] token: ${token ? 'exists' : 'missing'}, chatId: ${chatId || 'missing'}`);

    if (!token || !chatId) {
      console.log('[NotificationService] Telegram credentials missing (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), skipping notification.');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      console.log(`[NotificationService.sendTelegramMessage] sending request to: ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NotificationService] Failed to send Telegram alert: ${response.statusText}`, errorText);
        return false;
      }

      console.log('[NotificationService] Telegram notification sent successfully.');
      return true;
    } catch (error) {
      console.error('[NotificationService] Error sending Telegram message:', error);
      return false;
    }
  }

  /**
   * Gửi cảnh báo tồn kho thấp cho một sản phẩm cụ thể
   */
  static async sendStockAlertNotification(
    productId: string, 
    currentStock: number, 
    minStock: number, 
    status: 'low_stock' | 'out_of_stock'
  ) {
    console.log(`[NotificationService.sendStockAlertNotification] Triggered for product: ${productId}, stock: ${currentStock}, min: ${minStock}, status: ${status}`);
    try {
      // Lấy thông tin sản phẩm từ Database
      const { data: product, error } = await supabase
        .from('products')
        .select('name, sku, unit')
        .eq('id', productId)
        .single();

      if (error || !product) {
        console.error(`[NotificationService] Product ${productId} not found to send alert. Error:`, error);
        return;
      }

      console.log(`[NotificationService.sendStockAlertNotification] Found product: ${product.name}, SKU: ${product.sku}`);

      const statusEmoji = status === 'out_of_stock' ? '🔴 HẾT HÀNG' : '⚠️ TỒN KHO THẤP';
      const statusText = status === 'out_of_stock' ? 'Đã hết sạch hàng trong kho' : 'Đã dưới ngưỡng tồn kho tối thiểu';
      const timeStr = new Date().toLocaleString('vi-VN');

      const message = `
<b>${statusEmoji}</b>
--------------------------------------------
📦 <b>Sản phẩm:</b> ${product.name}
🔖 <b>Mã SKU:</b> <code>${product.sku}</code>
📉 <b>Trạng thái:</b> ${statusText}
🔢 <b>Số lượng hiện tại:</b> <code>${currentStock}</code> ${product.unit || 'cái'}
📋 <b>Ngưỡng tối thiểu:</b> <code>${minStock}</code> ${product.unit || 'cái'}
⏰ <b>Thời gian:</b> ${timeStr}

🛒 <i>Vui lòng kiểm tra và lên kế hoạch nhập hàng!</i>
      `.trim();

      await this.sendTelegramMessage(message);
    } catch (err) {
      console.error('[NotificationService] Error triggering stock alert notification:', err);
    }
  }

  /**
   * Gửi nhật ký kiểm toán (Audit Log) lên Telegram
   */
  static async sendAuditLogNotification(auditLog: any) {
    try {
      let actorName = 'Hệ thống';
      if (auditLog.actor_id) {
        const { data: user } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', auditLog.actor_id)
          .single();
        if (user) actorName = user.full_name;
      }

      const timeStr = new Date(auditLog.created_at || new Date()).toLocaleString('vi-VN');
      let actionEmoji = '📝';
      let actionName = auditLog.action;
      let detailsText = '';

      const metadata = auditLog.metadata || {};

      switch (auditLog.action) {
        case 'order.create':
          actionEmoji = '🛒 ĐƠN HÀNG MỚI';
          actionName = `Tạo hóa đơn ${metadata.order_number || ''}`;
          detailsText = `
💰 <b>Tổng tiền:</b> <code>${Number(metadata.final_amount || 0).toLocaleString('vi-VN')} đ</code>
🔢 <b>Số lượng mặt hàng:</b> <code>${metadata.item_count || 0}</code>
💳 <b>Thanh toán:</b> <code>${metadata.payment_method || 'mặt đất'}</code>
          `.trim();
          break;
        case 'order.cancel':
          actionEmoji = '❌ HỦY ĐƠN HÀNG';
          actionName = `Hủy hóa đơn ${metadata.order_number || ''}`;
          detailsText = `
💰 <b>Hoàn tiền:</b> <code>${Number(metadata.final_amount || 0).toLocaleString('vi-VN')} đ</code>
🔄 <b>Hoàn kho hàng:</b> <code>${metadata.restock ? 'Có' : 'Không'}</code>
          `.trim();
          break;
        case 'goods_receipt.create':
          actionEmoji = '📥 NHẬP KHO HÀNG';
          actionName = `Nhập kho mã ${metadata.receipt_number || ''}`;
          detailsText = `
💰 <b>Giá trị nhập:</b> <code>${Number(metadata.total_amount || 0).toLocaleString('vi-VN')} đ</code>
💳 <b>Đã thanh toán:</b> <code>${Number(metadata.paid_amount || 0).toLocaleString('vi-VN')} đ</code>
📦 <b>Tổng số mặt hàng:</b> <code>${metadata.item_count || 0}</code>
          `.trim();
          break;
        case 'stock_alert.resolve':
          actionEmoji = '✅ GIẢI QUYẾT CẢNH BÁO';
          actionName = 'Xử lý cảnh báo tồn kho';
          detailsText = `
📦 <b>Sản phẩm:</b> ${metadata.product_name || 'N/A'}
🔢 <b>Tồn kho hiện tại:</b> <code>${metadata.current_stock || 0}</code>
          `.trim();
          break;
        default:
          detailsText = `<code>${JSON.stringify(metadata)}</code>`;
          break;
      }

      const message = `
<b>${actionEmoji}</b>
--------------------------------------------
🧑‍💼 <b>Người thực hiện:</b> ${actorName}
🛠️ <b>Hành động:</b> ${actionName}
⏰ <b>Thời gian:</b> ${timeStr}

${detailsText}
      `.trim();

      await this.sendTelegramMessage(message);
    } catch (err) {
      console.error('[NotificationService] Error sending audit log notification:', err);
    }
  }
}
