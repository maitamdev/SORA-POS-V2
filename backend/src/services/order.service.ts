import { supabase } from '../config/supabase';
import { CatalogService } from './catalog.service';
import { parsePagination, toNumber } from '../utils/query';

type OrderItemInput = {
  product_id: string;
  quantity: number;
  discount?: number;
};

type CreateOrderInput = {
  customer_id?: string | null;
  discount_amount?: number;
  note?: string | null;
  payment?: {
    method?: string;
    received_amount?: number;
    reference_code?: string | null;
  };
  items: OrderItemInput[];
};

const todayKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export class OrderService {
  private static async generateOrderNumber() {
    const prefix = `ORD-${todayKey()}`;
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .like('order_number', `${prefix}%`);
    if (error) throw { status: 500, message: error.message };
    return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
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
    if (error) throw { status: 500, message: error.message };
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async getById(id: string) {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, customers(*), users(id, full_name, email), order_details(*), payments(*)')
      .eq('id', id)
      .single();
    if (error || !order) throw { status: 404, message: 'Không tìm thấy hóa đơn' };
    return order;
  }

  static async create(input: CreateOrderInput, userId: string) {
    const productIds = input.items.map((item) => item.product_id);
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true);

    if (productError) throw { status: 500, message: productError.message };
    if (!products || products.length !== new Set(productIds).size) {
      throw { status: 400, message: 'Một hoặc nhiều sản phẩm không tồn tại hoặc đã ngừng bán' };
    }

    const productMap = new Map<string, any>(products.map((product) => [product.id, product]));
    let totalAmount = 0;

    for (const item of input.items) {
      const product = productMap.get(item.product_id);
      if (!product) throw { status: 400, message: 'Sản phẩm không hợp lệ' };
      if (Number(product.stock_quantity) < item.quantity) {
        throw { status: 400, message: `Sản phẩm "${product.name}" không đủ tồn kho` };
      }
      totalAmount += Number(product.sell_price) * item.quantity - toNumber(item.discount);
    }

    const discountAmount = Math.min(toNumber(input.discount_amount), totalAmount);
    const finalAmount = Math.max(totalAmount - discountAmount, 0);
    const orderNumber = await this.generateOrderNumber();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: input.customer_id || null,
        user_id: userId,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_status: 'paid',
        note: input.note || null,
      })
      .select('*')
      .single();

    if (orderError || !order) throw { status: 400, message: orderError?.message || 'Không tạo được hóa đơn' };

    const details = input.items.map((item) => {
      const product = productMap.get(item.product_id);
      const discount = toNumber(item.discount);
      return {
        order_id: order.id,
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: Number(product.sell_price),
        discount,
        subtotal: Number(product.sell_price) * item.quantity - discount,
      };
    });

    const { error: detailError } = await supabase.from('order_details').insert(details);
    if (detailError) throw { status: 400, message: detailError.message };

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
    if (paymentError) throw { status: 400, message: paymentError.message };

    for (const item of input.items) {
      const product = productMap.get(item.product_id);
      const previousStock = Number(product.stock_quantity);
      const newStock = previousStock - item.quantity;

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', item.product_id);
      if (updateError) throw { status: 400, message: updateError.message };

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

    if (input.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('points, total_spent')
        .eq('id', input.customer_id)
        .maybeSingle();
      if (customer) {
        await supabase
          .from('customers')
          .update({
            total_spent: Number(customer.total_spent || 0) + finalAmount,
            points: Number(customer.points || 0) + Math.floor(finalAmount / 10000),
          })
          .eq('id', input.customer_id);
      }
    }

    return this.getById(order.id);
  }

  static async cancel(id: string, userId: string, restock = true, note?: string | null) {
    const order = await this.getById(id) as any;
    if (order.status === 'cancelled') throw { status: 400, message: 'Hóa đơn đã bị hủy trước đó' };

    if (restock) {
      for (const detail of order.order_details || []) {
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
          note: note || `Hoàn tồn do hủy hóa đơn ${order.order_number}`,
          user_id: userId,
        });
        await CatalogService.syncStockAlert(detail.product_id);
      }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled', payment_status: 'unpaid', note: note || order.note })
      .eq('id', id);
    if (updateError) throw { status: 400, message: updateError.message };

    await supabase.from('payments').update({ status: 'refunded' }).eq('order_id', id);
    return this.getById(id);
  }

  static async delete(id: string) {
    await supabase.from('order_details').delete().eq('order_id', id);
    await supabase.from('payments').delete().eq('order_id', id);
    await supabase.from('stock_transactions').delete().eq('reference_id', id);
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw { status: 400, message: error.message };
    return null;
  }

  static async deleteAll() {
    await supabase.from('order_details').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('stock_transactions').delete().in('type', ['sale', 'return']);
    const { error } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw { status: 400, message: error.message };
    return null;
  }
}
