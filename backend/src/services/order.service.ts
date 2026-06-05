import { supabase } from '../config/supabase';
import { CatalogService } from './catalog.service';
import { parsePagination, toNumber } from '../utils/query';
import { AppError } from '../utils/AppError';
import { SettingsService } from './settings.service';
import { ShiftService } from './shift.service';

type OrderItemInput = {
  product_id: string;
  quantity: number;
  discount?: number;
};

type CreateOrderInput = {
  customer_id?: string | null;
  discount_amount?: number;
  used_points?: number;
  note?: string | null;
  payment?: {
    method?: string;
    received_amount?: number;
    reference_code?: string | null;
  };
  items: OrderItemInput[];
};

type Product = {
  id: string;
  name: string;
  sku: string;
  sell_price: number;
  stock_quantity: number;
  min_stock_level: number;
  is_active: boolean;
};

const todayKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export class OrderService {
  /**
   * Sinh mã hóa đơn an toàn — retry tối đa 3 lần nếu bị trùng
   */
  private static async generateOrderNumber(retries = 3): Promise<string> {
    const prefix = `ORD-${todayKey()}`;
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .like('order_number', `${prefix}%`);
    if (error) throw new AppError(500, error.message);

    const seq = (count || 0) + 1;
    const orderNumber = `${prefix}-${String(seq).padStart(4, '0')}`;

    // Kiểm tra trùng lặp
    const { count: existing } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_number', orderNumber);

    if (existing && existing > 0) {
      if (retries <= 0) {
        // Fallback: thêm suffix ngẫu nhiên
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${String(seq).padStart(4, '0')}-${suffix}`;
      }
      // Retry sau 50ms
      await new Promise((r) => setTimeout(r, 50));
      return this.generateOrderNumber(retries - 1);
    }

    return orderNumber;
  }

  static async list(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('orders')
      .select('*, customers(id, name, phone), users(id, full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.status) query = query.eq('status', queryParams.status);
    if (queryParams.payment_status) query = query.eq('payment_status', queryParams.payment_status);
    if (queryParams.date_from) query = query.gte('created_at', `${queryParams.date_from}`);
    if (queryParams.date_to) query = query.lte('created_at', `${queryParams.date_to}T23:59:59.999Z`);

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async getById(id: string) {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, customers(*), users(id, full_name, email), order_details(*), payments(*)')
      .eq('id', id)
      .single();
    if (error || !order) throw new AppError(404, 'Không tìm thấy hóa đơn');
    return order;
  }

  static async create(input: CreateOrderInput, userId: string) {
    // 1. Gộp các sản phẩm trùng lặp product_id để tính toán chính xác
    const groupedItemsMap = new Map<string, { product_id: string; quantity: number; discount: number }>();
    for (const item of input.items) {
      const existing = groupedItemsMap.get(item.product_id);
      const itemDiscount = toNumber(item.discount);
      if (existing) {
        existing.quantity += item.quantity;
        existing.discount += itemDiscount;
      } else {
        groupedItemsMap.set(item.product_id, {
          product_id: item.product_id,
          quantity: item.quantity,
          discount: itemDiscount,
        });
      }
    }
    const aggregatedItems = Array.from(groupedItemsMap.values());

    // 2. Lấy danh sách sản phẩm và validate
    const productIds = aggregatedItems.map((item) => item.product_id);
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true);

    if (productError) throw new AppError(500, productError.message);
    if (!products || products.length !== productIds.length) {
      throw new AppError(400, 'Một hoặc nhiều sản phẩm không tồn tại hoặc đã ngừng bán');
    }

    const productMap = new Map<string, Product>(
      products.map((product) => [product.id, product as Product])
    );

    // Tải cài đặt vận hành để kiểm tra việc cho phép bán vượt tồn
    const settingsData = await SettingsService.getOperationSettings();
    const allowSellOutOfStock = settingsData.settings.allowSellOutOfStock;

    let totalAmount = 0;

    // 3. Kiểm tra tồn kho từng sản phẩm
    for (const item of aggregatedItems) {
      const product = productMap.get(item.product_id);
      if (!product) throw new AppError(400, 'Sản phẩm không hợp lệ');
      if (!allowSellOutOfStock && Number(product.stock_quantity) < item.quantity) {
        throw new AppError(400, `Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.stock_quantity})`);
      }
      totalAmount += Number(product.sell_price) * item.quantity - item.discount;
    }

    // 4. Tính toán giá trị đơn hàng
    const discountAmount = Math.min(toNumber(input.discount_amount), totalAmount);
    const finalAmount = Math.max(totalAmount - discountAmount, 0);
    const orderNumber = await this.generateOrderNumber();
    const shiftId = await ShiftService.requireActiveShiftForOrder(userId);

    // Tính toán ghi nhận điểm thưởng vào ghi chú đơn hàng
    let finalNote = input.note || '';
    const pointsUsed = Number(input.used_points || 0);
    const pointsEarned = Math.floor(finalAmount / 10000);
    if (pointsUsed > 0 || pointsEarned > 0) {
      const pointsLog = `[Tích điểm] Đã sử dụng ${pointsUsed} điểm. Tích lũy thêm +${pointsEarned} điểm.`;
      finalNote = finalNote ? `${finalNote}\n${pointsLog}` : pointsLog;
    }

    // 5. Ghi nhận hóa đơn vào DB
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: input.customer_id || null,
        user_id: userId,
        shift_id: shiftId,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_status: 'paid',
        note: finalNote || null,
      })
      .select('*')
      .single();

    if (orderError || !order) {
      throw new AppError(400, orderError?.message || 'Không tạo được hóa đơn');
    }

    // 6. Tạo chi tiết đơn hàng
    const details = aggregatedItems.map((item) => {
      const product = productMap.get(item.product_id)!;
      return {
        order_id: order.id,
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: Number(product.sell_price),
        discount: item.discount,
        subtotal: Number(product.sell_price) * item.quantity - item.discount,
      };
    });

    const { error: detailError } = await supabase.from('order_details').insert(details);
    if (detailError) {
      // Rollback: xóa order vừa tạo
      await supabase.from('orders').delete().eq('id', order.id);
      throw new AppError(400, detailError.message);
    }

    // 7. Tạo thanh toán
    const payment = input.payment || {};
    const receivedAmount = toNumber(payment.received_amount, finalAmount);
    const { error: paymentError } = await supabase.from('payments').insert({
      order_id: order.id,
      method: payment.method || 'cash',
      amount: finalAmount,
      received_amount: receivedAmount,
      change_amount: Math.max(receivedAmount - finalAmount, 0),
      reference_code: payment.reference_code || null,
      status: 'completed',
    });
    if (paymentError) {
      // Rollback: xóa order_details và order
      await supabase.from('order_details').delete().eq('order_id', order.id);
      await supabase.from('orders').delete().eq('id', order.id);
      throw new AppError(400, paymentError.message);
    }

    // 8. Trừ tồn kho + ghi log giao dịch kho sử dụng danh sách sau khi gộp
    for (const item of aggregatedItems) {
      const product = productMap.get(item.product_id)!;
      const previousStock = Number(product.stock_quantity);
      const newStock = previousStock - item.quantity;

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', item.product_id);

      if (updateError) {
        console.error(`❌ Lỗi trừ kho sản phẩm ${item.product_id}:`, updateError.message);
        // Không throw — đơn hàng đã tạo, sẽ cần kiểm tra thủ công
        continue;
      }

      await supabase.from('stock_transactions').insert({
        product_id: item.product_id,
        type: 'sale',
        quantity: -item.quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_id: order.id,
        note: `Bán hàng theo hóa đơn ${order.order_number}`,
        user_id: userId,
      });
      await CatalogService.syncStockAlert(item.product_id);
    }

    // 9. Cộng điểm khách hàng
    if (input.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('points, total_spent')
        .eq('id', input.customer_id)
        .maybeSingle();
      if (customer) {
        const currentPoints = Number(customer.points || 0);
        const nextPoints = Math.max(0, currentPoints - pointsUsed + pointsEarned);
        await supabase
          .from('customers')
          .update({
            total_spent: Number(customer.total_spent || 0) + finalAmount,
            points: nextPoints,
          })
          .eq('id', input.customer_id);
      }
    }

    return this.getById(order.id);
  }

  static async cancel(id: string, userId: string, restock = true, note?: string | null) {
    const order = await this.getById(id);
    if ((order as { status: string }).status === 'cancelled') {
      throw new AppError(400, 'Hóa đơn đã bị hủy trước đó');
    }

    if (restock) {
      const orderDetails = (order as { order_details?: Array<{ product_id: string; quantity: number }> }).order_details || [];
      for (const detail of orderDetails) {
        const { data: product, error } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', detail.product_id)
          .single();
        if (error || !product) continue;
        const previousStock = Number(product.stock_quantity);
        const newStock = previousStock + Number(detail.quantity);
        await supabase.from('products').update({ stock_quantity: newStock }).eq('id', detail.product_id);
        await supabase.from('stock_transactions').insert({
          product_id: detail.product_id,
          type: 'return',
          quantity: Number(detail.quantity),
          previous_stock: previousStock,
          new_stock: newStock,
          reference_id: id,
          note: note || `Hoàn tồn do hủy hóa đơn ${(order as { order_number: string }).order_number}`,
          user_id: userId,
        });
        await CatalogService.syncStockAlert(detail.product_id);
      }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        payment_status: 'unpaid',
        note: note || (order as { note: string | null }).note,
      })
      .eq('id', id);
    if (updateError) throw new AppError(400, updateError.message);

    await supabase.from('payments').update({ status: 'refunded' }).eq('order_id', id);
    return this.getById(id);
  }

  static async deleteAll() {
    // Xóa các giao dịch kho liên quan đến bán hàng và trả hàng
    await supabase.from('stock_transactions').delete().in('type', ['sale', 'return']);
    
    // Xóa toàn bộ hóa đơn (Cascade delete tự động xóa order_details và payments)
    const { error } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new AppError(400, error.message);
    return null;
  }

  static async delete(id: string) {
    // Kiểm tra đơn hàng tồn tại trước khi xóa
    await this.getById(id);
    await supabase.from('order_details').delete().eq('order_id', id);
    await supabase.from('payments').delete().eq('order_id', id);
    await supabase.from('stock_transactions').delete().eq('reference_id', id);
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw new AppError(400, error.message);
    return null;
  }
}
