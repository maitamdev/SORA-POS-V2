import { supabase } from '../config/supabase';
import { parsePagination } from '../utils/query';
import { AppError } from '../utils/AppError';

type OrderItemInput = {
  product_id: string;
  quantity: number;
  discount?: number;
};

type CreateOrderInput = {
  client_order_number?: string;
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

const orderSelect = '*, customers(*), users(id, full_name, email), order_details(*), payments(*)';

const mapRpcError = (message?: string) => {
  const text = message || 'Database transaction failed';

  if (
    text.includes('create_pos_order') ||
    text.includes('cancel_pos_order') ||
    text.includes('Could not find the function') ||
    text.includes('function public.')
  ) {
    return 'Chua chay migration database/enterprise_pos_core.sql tren Supabase';
  }

  return text;
};

export class OrderService {
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
      .select(orderSelect)
      .eq('id', id)
      .single();

    if (error || !order) throw new AppError(404, 'Khong tim thay hoa don');
    return order;
  }

  static async create(input: CreateOrderInput, userId: string) {
    const { data: orderId, error } = await supabase.rpc('create_pos_order', {
      p_payload: input,
      p_user_id: userId,
    });

    if (error || !orderId) {
      throw new AppError(400, mapRpcError(error?.message));
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

    return this.getById(String(orderId));
  }

  static async deleteAll() {
    throw new AppError(
      403,
      'He thong POS doanh nghiep khong cho xoa toan bo hoa don. Hay huy hoa don de giu audit trail.'
    );
  }

  static async delete(_id: string) {
    throw new AppError(
      403,
      'He thong POS doanh nghiep khong cho xoa cung hoa don. Hay dung chuc nang huy/hoan tien.'
    );
  }
}
