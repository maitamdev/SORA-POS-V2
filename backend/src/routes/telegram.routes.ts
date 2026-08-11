import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { NotificationService } from '../services/notification.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';

const router = Router();

// Hỗ trợ hàm định dạng thời gian và ngày đầu tiên của ngày
const getVietnamTime = (dateInput: Date | string = new Date()) => {
  const date = new Date(dateInput);
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
};

const startOfDay = (date = new Date()) => {
  const vnDate = getVietnamTime(date);
  vnDate.setHours(0, 0, 0, 0);
  const y = vnDate.getFullYear();
  const m = vnDate.getMonth();
  const d = vnDate.getDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 3600000);
};

/**
 * Route tiếp nhận webhook tương tác từ Telegram Bot
 */
router.post(
  '/telegram',
  rateLimitMiddleware({ keyPrefix: 'webhook-telegram', windowMs: 60_000, max: 120 }),
  asyncHandler(async (req: Request, res: Response) => {
  if (env.telegramWebhookSecret) {
    const providedSecret = req.header('X-Telegram-Bot-Api-Secret-Token') || '';
    if (providedSecret !== env.telegramWebhookSecret) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
  }

  const update = req.body;
  
  if (!update || !update.message) {
    res.status(200).json({ success: true });
    return;
  }

  const message = update.message;
  const chatId = String(message.chat.id);
  const text = message.text ? String(message.text).trim() : '';

  console.log(`[TelegramBot Webhook] Message received from ${chatId}: ${text}`);

  // 1. Kiểm tra quyền truy cập (Access Control)
  // Chỉ phản hồi nếu chat_id trùng khớp với TELEGRAM_CHAT_ID cấu hình trong .env
  if (chatId !== String(env.telegramChatId)) {
    console.warn(`[TelegramBot Webhook] Access Denied for Chat ID: ${chatId}`);
    await NotificationService.sendTelegramMessageTo(
      chatId,
      `❌ <b>Không có quyền truy cập!</b>\nHệ thống POS từ chối phục vụ tài khoản này.`
    );
    res.status(200).json({ success: true });
    return;
  }

  // 2. Phân tích lệnh (Parse Command)
  if (!text.startsWith('/')) {
    // Không phải command, bỏ qua hoặc gửi hướng dẫn nhanh
    res.status(200).json({ success: true });
    return;
  }

  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ').trim();

  // 3. Xử lý các lệnh (Handlers)
  try {
    switch (command) {
      case '/start':
      case '/help': {
        const welcomeMsg = `
🏪 <b>HỆ THỐNG ĐIỀU KHIỂN SORA-POS BOT</b>
--------------------------------------------
Chào mừng bạn! Dưới đây là danh sách lệnh hỗ trợ:

📊 <b>Tra cứu báo cáo:</b>
• <code>/doanhthu today</code> - Doanh số bán hàng hôm nay
• <code>/doanhthu yesterday</code> - Doanh số ngày hôm qua
• <code>/doanhthu week</code> - Doanh số 7 ngày gần nhất
• <code>/doanhthu month</code> - Doanh số 30 ngày gần nhất

🔍 <b>Tra cứu sản phẩm & kho:</b>
• <code>/tonkho</code> - Liệt kê sản phẩm cảnh báo tồn kho
• <code>/timkiem [tên]</code> - Tìm sản phẩm theo tên (ví dụ: <code>/timkiem Nước</code>)
• <code>/check [sku]</code> - Tra cứu chi tiết sản phẩm theo SKU

🧾 <b>Lịch sử bán hàng:</b>
• <code>/donhang [số lượng]</code> - Danh sách đơn hàng mới (mặc định: 5)
        `.trim();
        await NotificationService.sendTelegramMessageTo(chatId, welcomeMsg);
        break;
      }

      case '/doanhthu': {
        const type = arg ? arg.toLowerCase() : 'today';
        const todayStart = startOfDay();
        let startDate = todayStart;
        let endDate = new Date(todayStart.getTime() + 24 * 3600000); // Hết ngày hôm nay
        let timeLabel = 'Hôm nay';

        if (type === 'yesterday') {
          startDate = new Date(todayStart.getTime() - 24 * 3600000);
          endDate = todayStart;
          timeLabel = 'Hôm qua';
        } else if (type === 'week') {
          startDate = new Date(todayStart.getTime() - 6 * 24 * 3600000);
          timeLabel = '7 ngày qua';
        } else if (type === 'month') {
          startDate = new Date(todayStart.getTime() - 29 * 24 * 3600000);
          timeLabel = '30 ngày qua';
        }

        // Truy vấn dữ liệu orders đã hoàn tất
        const { data: orders, error } = await supabase
          .from('orders')
          .select('final_amount, payments(method, amount)')
          .eq('status', 'completed')
          .gte('created_at', startDate.toISOString())
          .lt('created_at', endDate.toISOString());

        if (error) throw error;

        const allOrders = orders || [];
        const orderCount = allOrders.length;
        const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.final_amount), 0);

        // Gom nhóm theo phương thức thanh toán
        const paymentsMap: Record<string, number> = { cash: 0, card: 0, transfer: 0, momo: 0, zalopay: 0 };
        for (const order of allOrders) {
          if (order.payments) {
            const list = Array.isArray(order.payments) ? order.payments : [order.payments];
            for (const pay of list) {
              const method = pay.method || 'cash';
              paymentsMap[method] = (paymentsMap[method] || 0) + Number(pay.amount || 0);
            }
          }
        }

        const reportMsg = `
📊 <b>BÁO CÁO DOANH THU:</b> ${timeLabel.toUpperCase()}
--------------------------------------------
🧾 <b>Tổng số đơn:</b> <code>${orderCount} đơn</code>
💰 <b>Doanh thu:</b> <code>${totalRevenue.toLocaleString('vi-VN')} đ</code>

💳 <b>Chi tiết hình thức thanh toán:</b>
• 💵 Tiền mặt: <code>${(paymentsMap.cash || 0).toLocaleString('vi-VN')} đ</code>
• 💳 Thẻ ngân hàng: <code>${(paymentsMap.card || 0).toLocaleString('vi-VN')} đ</code>
• 📲 Chuyển khoản QR: <code>${(paymentsMap.transfer || 0).toLocaleString('vi-VN')} đ</code>
• 🍑 Ví MoMo: <code>${(paymentsMap.momo || 0).toLocaleString('vi-VN')} đ</code>
• 💚 Ví ZaloPay: <code>${(paymentsMap.zalopay || 0).toLocaleString('vi-VN')} đ</code>
        `.trim();

        await NotificationService.sendTelegramMessageTo(chatId, reportMsg);
        break;
      }

      case '/tonkho': {
        const { data: alerts, error } = await supabase
          .from('stock_alerts')
          .select('current_stock, min_stock_level, status, products(name, sku)')
          .in('status', ['low_stock', 'out_of_stock'])
          .order('status', { ascending: true });

        if (error) throw error;

        const list = alerts || [];
        if (list.length === 0) {
          await NotificationService.sendTelegramMessageTo(chatId, `✅ <b>Kho hàng an toàn!</b> Không có sản phẩm nào chạm ngưỡng tồn kho thấp.`);
          break;
        }

        let listText = '';
        for (const alert of list) {
          const productsData = Array.isArray(alert.products) ? alert.products[0] : alert.products;
          const prodName = (productsData as any)?.name || 'N/A';
          const sku = (productsData as any)?.sku || 'N/A';
          const symbol = alert.status === 'out_of_stock' ? '🔴' : '⚠️';
          listText += `${symbol} <b>${prodName}</b>\n   SKU: <code>${sku}</code> | Tồn: <code>${alert.current_stock}</code> (Ngưỡng: ${alert.min_stock_level})\n\n`;
        }

        const tonKhoMsg = `
⚠️ <b>CẢNH BÁO TỒN KHO THẤP (${list.length} SẢN PHẨM)</b>
--------------------------------------------
${listText.trim()}
        `.trim();

        await NotificationService.sendTelegramMessageTo(chatId, tonKhoMsg);
        break;
      }

      case '/timkiem': {
        if (!arg) {
          await NotificationService.sendTelegramMessageTo(chatId, `ℹ️ Vui lòng cung cấp tên sản phẩm. Ví dụ: <code>/timkiem Nước</code>`);
          break;
        }

        const { data: products, error } = await supabase
          .from('products')
          .select('name, sku, sell_price, stock_quantity, min_stock_level')
          .ilike('name', `%${arg}%`)
          .limit(5);

        if (error) throw error;

        const list = products || [];
        if (list.length === 0) {
          await NotificationService.sendTelegramMessageTo(chatId, `🔍 Không tìm thấy sản phẩm nào khớp với từ khóa: <b>"${arg}"</b>`);
          break;
        }

        let searchRes = '';
        for (const prod of list) {
          const isLow = prod.stock_quantity <= prod.min_stock_level;
          const statusStr = prod.stock_quantity === 0 ? '🔴 Hết hàng' : isLow ? '⚠️ Tồn thấp' : '🟢 Sẵn hàng';
          searchRes += `• <b>${prod.name}</b>\n   SKU: <code>${prod.sku}</code> | Giá: <code>${prod.sell_price.toLocaleString('vi-VN')} đ</code>\n   Tồn kho: <code>${prod.stock_quantity}</code> (${statusStr})\n\n`;
        }

        const searchMsg = `
🔍 <b>KẾT QUẢ TÌM KIẾM CHO:</b> "${arg}"
--------------------------------------------
${searchRes.trim()}
        `.trim();

        await NotificationService.sendTelegramMessageTo(chatId, searchMsg);
        break;
      }

      case '/check': {
        if (!arg) {
          await NotificationService.sendTelegramMessageTo(chatId, `ℹ️ Vui lòng cung cấp mã SKU. Ví dụ: <code>/check GERRY-CRUSH-CHOCO-001</code>`);
          break;
        }

        const { data: product, error } = await supabase
          .from('products')
          .select('name, sku, sell_price, cost_price, stock_quantity, min_stock_level, unit')
          .eq('sku', arg.toUpperCase().trim())
          .single();

        if (error || !product) {
          await NotificationService.sendTelegramMessageTo(chatId, `🔍 Không tìm thấy sản phẩm có mã SKU: <code>${arg.toUpperCase().trim()}</code>`);
          break;
        }

        const isLow = product.stock_quantity <= product.min_stock_level;
        const statusStr = product.stock_quantity === 0 ? '🔴 Hết hàng hoàn toàn' : isLow ? '⚠️ Tồn kho ở mức thấp' : '🟢 Tồn kho an toàn';
        
        const profit = product.sell_price - product.cost_price;
        const margin = product.sell_price > 0 ? (profit / product.sell_price) * 100 : 0;

        const checkMsg = `
📦 <b>CHI TIẾT SẢN PHẨM: ${product.name}</b>
--------------------------------------------
🔖 <b>Mã SKU:</b> <code>${product.sku}</code>
🏷️ <b>Đơn vị tính:</b> ${product.unit || 'Cái'}
💰 <b>Giá bán lẻ:</b> <code>${product.sell_price.toLocaleString('vi-VN')} đ</code>
💸 <b>Giá nhập vốn:</b> <code>${product.cost_price.toLocaleString('vi-VN')} đ</code>
📈 <b>Lợi nhuận/Biên:</b> <code>${profit.toLocaleString('vi-VN')} đ</code> (${margin.toFixed(1)}%)

📉 <b>Tồn kho thực tế:</b> <code>${product.stock_quantity}</code>
📋 <b>Ngưỡng tối thiểu:</b> <code>${product.min_stock_level}</code>
📊 <b>Trạng thái:</b> ${statusStr}
        `.trim();

        await NotificationService.sendTelegramMessageTo(chatId, checkMsg);
        break;
      }

      case '/donhang': {
        let limit = 5;
        if (arg && !isNaN(Number(arg))) {
          limit = Math.min(Math.max(Number(arg), 1), 15); // Giới hạn từ 1 đến 15 đơn
        }

        const { data: orders, error } = await supabase
          .from('orders')
          .select('order_number, final_amount, created_at, status')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        const list = orders || [];
        if (list.length === 0) {
          await NotificationService.sendTelegramMessageTo(chatId, `📭 Chưa có đơn hàng nào hoàn tất hôm nay.`);
          break;
        }

        let orderListText = '';
        for (const order of list) {
          const time = new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          orderListText += `• <b>#${order.order_number}</b> (lúc ${time})\n   Giá trị: <code>${order.final_amount.toLocaleString('vi-VN')} đ</code>\n\n`;
        }

        const donHangMsg = `
🧾 <b>DANH SÁCH LỊCH SỬ ${list.length} ĐƠN HÀNG MỚI NHẤT</b>
--------------------------------------------
${orderListText.trim()}
        `.trim();

        await NotificationService.sendTelegramMessageTo(chatId, donHangMsg);
        break;
      }

      default: {
        await NotificationService.sendTelegramMessageTo(
          chatId,
          `❓ <b>Lệnh không hợp lệ.</b>\nNhập <code>/help</code> hoặc <code>/start</code> để xem danh sách lệnh hỗ trợ.`
        );
        break;
      }
    }
  } catch (err: any) {
    console.error(`[TelegramBot Error] Processing command "${command}":`, err);
    await NotificationService.sendTelegramMessageTo(
      chatId,
      `❌ <b>Đã có lỗi xảy ra!</b>\nKhông thể truy vấn cơ sở dữ liệu để lấy kết quả lúc này.`
    );
  }

  res.status(200).json({ success: true });
  }),
);

export default router;
