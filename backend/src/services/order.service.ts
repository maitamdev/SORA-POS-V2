import { supabase } from '../config/supabase';
import { parsePagination } from '../utils/query';
import { AppError } from '../utils/AppError';
import { appCache } from '../utils/cache';
import { JwtPayload } from '../types/user.type';
import { CatalogService } from './catalog.service';
import { PromotionService } from './promotion.service';
import { calculateOrderMargin, formatMarginLossMessage } from '../utils/orderMargin';

const PRODUCT_CACHE_PREFIX = 'catalog:products';

type OrderItemInput = {
  product_id: string;
  quantity: number;
  discount?: number;
};

type CreateOrderInput = {
  client_order_number?: string;
  customer_id?: string | null;
  shift_code?: string;
  discount_amount?: number;
  manual_discount_amount?: number;
  promotion_ids?: string[];
  used_points?: number;
  note?: string | null;
  payment?: {
    method?: string;
    received_amount?: number;
    reference_code?: string | null;
  };
  items: OrderItemInput[];
};

const orderSelect = '*, customers(*), users!orders_user_id_fkey(id, full_name, email), order_details(*), payments(*)';

const mapRpcError = (message?: string) => {
  const text = message || 'Database transaction failed';

  if (
    text.includes('create_pos_order') ||
    text.includes('cancel_pos_order') ||
    text.includes('Could not find the function') ||
    text.includes('function public.')
  ) {
    return 'Chưa chạy migration database/enterprise_pos_core.sql trên Supabase';
  }

  return text;
};

export class OrderService {
  static async list(queryParams: Record<string, unknown>, currentUser?: JwtPayload) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('orders')
      .select('*, customers(id, name, phone), users!orders_user_id_fkey(id, full_name), payments(method, amount)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (currentUser?.role === 'cashier') {
      // Cashiers can only view their own orders created today
      query = query.eq('user_id', currentUser.userId);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      query = query.gte('created_at', startOfToday.toISOString())
                   .lte('created_at', endOfToday.toISOString());
    } else {
      // Admins/Managers can filter arbitrarily
      if (queryParams.status) query = query.eq('status', queryParams.status);
      if (queryParams.payment_status) query = query.eq('payment_status', queryParams.payment_status);
      if (queryParams.date_from) query = query.gte('created_at', `${queryParams.date_from}`);
      if (queryParams.date_to) query = query.lte('created_at', `${queryParams.date_to}T23:59:59.999Z`);
      if (queryParams.employee_id) query = query.eq('user_id', queryParams.employee_id);
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);

    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async getById(id: string, currentUser?: JwtPayload) {
    const { data: order, error } = await supabase
      .from('orders')
      .select(orderSelect)
      .eq('id', id)
      .single();

    if (error || !order) {
      if (error) console.error('[OrderService.getById] Supabase Error:', error);
      throw new AppError(404, 'Không tìm thấy hóa đơn');
    }
    if (currentUser?.role === 'cashier' && order.user_id !== currentUser.userId) {
      throw new AppError(403, 'Cashiers can only view their own orders');
    }

    return order;
  }

  static async create(input: CreateOrderInput, userId: string) {
    const productIds = Array.from(new Set(input.items.map((item) => item.product_id)));
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sell_price, cost_price')
      .in('id', productIds);

    if (productsError) throw new AppError(500, productsError.message);

    const productsById = new Map((products || []).map((product) => [product.id, product]));
    const marginLines = input.items.map((item) => {
      const product = productsById.get(item.product_id);
      if (!product) throw new AppError(400, `Không tìm thấy sản phẩm ${item.product_id}`);

      return {
        product_id: item.product_id,
        product_name: product.name,
        quantity: Number(item.quantity),
        unit_price: Number(product.sell_price || 0),
        cost_price: Number(product.cost_price || 0),
        discount: Number(item.discount || 0),
      };
    });
    const margin = calculateOrderMargin(marginLines, Number(input.discount_amount || 0));
    if (margin.isLoss) {
      throw new AppError(400, formatMarginLossMessage(margin));
    }

    const { data: orderId, error } = await supabase.rpc('create_pos_order', {
      p_payload: input,
      p_user_id: userId,
    });

    if (error || !orderId) {
      throw new AppError(400, mapRpcError(error?.message));
    }

    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    appCache.deletePrefix('report:dashboard');
    appCache.deletePrefix('report:revenue');
    appCache.deletePrefix('report:top-products');

    const promotionIds = Array.from(new Set(
      (Array.isArray(input.promotion_ids) ? input.promotion_ids : [])
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ));
    if (promotionIds.length > 0) {
      await Promise.all(
        promotionIds.map((promotionId) =>
          PromotionService.incrementUsage(promotionId).catch((incrementError) => {
            console.error(`[OrderService.create] Không thể cập nhật lượt dùng khuyến mãi ${promotionId}:`, incrementError);
          })
        )
      );
    }

    // Đồng bộ cảnh báo tồn kho & gửi thông báo Telegram cho các sản phẩm trong hóa đơn
    if (input.items && Array.isArray(input.items)) {
      Promise.all(
        input.items
          .filter((item) => item.product_id)
          .map((item) =>
            CatalogService.syncStockAlert(item.product_id).catch((err) => {
              console.error('[OrderService.create] Lỗi đồng bộ cảnh báo tồn kho:', err);
            })
          )
      );
    }

    return this.getById(String(orderId));
  }

  static async cancel(id: string, userId: string, restock = true, note?: string | null) {
    const { data: orderId, error } = await supabase.rpc('cancel_pos_order', {
      p_order_id: id,
      p_user_id: userId,
      p_restock: restock,
      p_note: note || null,
    });

    if (error || !orderId) {
      throw new AppError(400, mapRpcError(error?.message));
    }

    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    appCache.deletePrefix('report:dashboard');
    appCache.deletePrefix('report:revenue');
    appCache.deletePrefix('report:top-products');

    const cancelledOrder = await this.getById(String(orderId));

    // Đồng bộ lại cảnh báo tồn kho sau khi hoàn trả hàng (để tự động xóa cảnh báo nếu tồn kho tăng)
    if (restock && cancelledOrder && cancelledOrder.order_details) {
      Promise.all(
        cancelledOrder.order_details
          .filter((detail: any) => detail.product_id)
          .map((detail: any) =>
            CatalogService.syncStockAlert(detail.product_id).catch((err) => {
              console.error('[OrderService.cancel] Lỗi đồng bộ cảnh báo tồn kho:', err);
            })
          )
      );
    }

    return cancelledOrder;
  }

  static async deleteAll() {
    throw new AppError(
      403,
      'Hệ thống POS doanh nghiệp không cho xóa toàn bộ hóa đơn. Hãy hủy hóa đơn để giữ audit trail.'
    );
  }

  static async delete(_id: string) {
    throw new AppError(
      403,
      'Hệ thống POS doanh nghiệp không cho xóa cứng hóa đơn. Hãy dùng chức năng hủy/hoàn tiền.'
    );
  }
}
