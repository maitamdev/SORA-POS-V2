import { randomInt } from 'node:crypto';
import { supabase } from '../config/supabase';
import { GoodsReceiptService } from './goodsReceipt.service';
import { AppError } from '../utils/AppError';
import { appCache } from '../utils/cache';
import { parsePagination } from '../utils/query';

type PurchaseOrderQuery = Record<string, unknown>;

export interface CreatePurchaseOrderInput {
  supplier_id: string;
  expected_at?: string | null;
  note?: string | null;
  items: Array<{ product_id: string; quantity: number; unit_cost: number }>;
}
export interface ReceivePurchaseOrderInput {
  receipt_number?: string;
  paid_amount: number;
  note?: string | null;
  items: Array<{
    purchase_order_item_id: string;
    quantity: number;
    unit_price?: number;
    expiry_date: string;
    batch_number: string;
  }>;
}

const PRODUCT_CACHE_PREFIX = 'catalog:products';

const isMissingLifecycleRpc = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('pgrst202')
    || normalized.includes('does not exist')
    || normalized.includes('could not find the function')
    || normalized.includes('schema cache');
};

const throwRpcError = (operation: string, error: { message?: string; code?: string } | null) => {
  if (error && isMissingLifecycleRpc(`${error.code || ''} ${error.message || ''}`)) {
    throw new AppError(503, `Chưa cài migration vòng đời đơn nhập hàng (${operation}). Vui lòng chạy database/purchase_order_lifecycle.sql`);
  }
  throw new AppError(400, error?.message || `Không thể ${operation}`);
};

const makeDocumentNumber = (prefix: 'PO' | 'GR-PO') => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}-${date}-${String(randomInt(100000, 999999))}`;
};

const attachItems = async <T extends { id: string }>(orders: T[]) => {
  if (orders.length === 0) return orders.map((order) => ({ ...order, items: [] }));

  const { data: lineRows, error } = await supabase
    .from('purchase_order_items')
    .select('*, products(id, name, sku, barcode, unit, cost_price, sell_price, image_url)')
    .in('purchase_order_id', orders.map((order) => order.id))
    .order('created_at', { ascending: true });

  if (error) throw new AppError(500, error.message);
  const byOrder = new Map<string, unknown[]>();
  for (const row of lineRows || []) {
    const lines = byOrder.get(row.purchase_order_id) || [];
    lines.push(row);
    byOrder.set(row.purchase_order_id, lines);
  }
  return orders.map((order) => ({ ...order, items: byOrder.get(order.id) || [] }));
};

export class PurchaseOrderService {
  static async list(queryParams: PurchaseOrderQuery) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('purchase_orders')
      .select('*, suppliers(id, name, phone, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (typeof queryParams.status === 'string' && queryParams.status.trim()) query = query.eq('status', queryParams.status.trim());
    if (typeof queryParams.supplier_id === 'string' && queryParams.supplier_id.trim()) query = query.eq('supplier_id', queryParams.supplier_id.trim());
    if (typeof queryParams.date_from === 'string' && queryParams.date_from.trim()) query = query.gte('created_at', queryParams.date_from.trim());
    if (typeof queryParams.date_to === 'string' && queryParams.date_to.trim()) query = query.lte('created_at', `${queryParams.date_to.trim()}T23:59:59.999Z`);

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);

    return {
      items: await attachItems(data || []),
      pagination: { page, limit, total: count || 0 },
    };
  }

  static async getById(id: string) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(id, name, phone, email)')
      .eq('id', id)
      .single();

    if (error || !data) throw new AppError(404, 'Không tìm thấy đơn nhập hàng');
    const [order] = await attachItems([data]);
    return order;
  }

  static async create(input: CreatePurchaseOrderInput, userId: string) {
    const payload = {
      order_number: makeDocumentNumber('PO'),
      supplier_id: input.supplier_id,
      expected_at: input.expected_at || null,
      note: input.note || null,
      items: input.items,
    };
    const { data: orderId, error } = await supabase.rpc('create_purchase_order', {
      p_payload: payload,
      p_user_id: userId,
    });

    if (error || !orderId) {
      if (error) throwRpcError('tạo đơn nhập hàng', error);
      throw new AppError(500, 'Database không trả về mã đơn nhập hàng');
    }
    return this.getById(String(orderId));
  }

  static async updateStatus(id: string, status: string, userId: string) {
    const { data: orderId, error } = await supabase.rpc('set_purchase_order_status', {
      p_purchase_order_id: id,
      p_status: status,
      p_user_id: userId,
    });
    if (error || !orderId) {
      if (error) throwRpcError('cập nhật trạng thái đơn nhập hàng', error);
      throw new AppError(500, 'Database không trả về mã đơn nhập hàng');
    }
    return this.getById(String(orderId));
  }

  static async receive(id: string, input: ReceivePurchaseOrderInput, userId: string) {
    const payload = {
      receipt_number: input.receipt_number || makeDocumentNumber('GR-PO'),
      paid_amount: input.paid_amount,
      note: input.note || null,
      items: input.items,
    };
    const { data: receiptId, error } = await supabase.rpc('receive_purchase_order', {
      p_purchase_order_id: id,
      p_payload: payload,
      p_user_id: userId,
    });
    if (error || !receiptId) {
      if (error) throwRpcError('nhận hàng từ đơn nhập', error);
      throw new AppError(500, 'Database không trả về mã phiếu nhập');
    }

    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    appCache.deletePrefix('report:dashboard');

    const [purchaseOrder, receipt] = await Promise.all([
      this.getById(id),
      GoodsReceiptService.getById(String(receiptId)),
    ]);
    return { purchase_order: purchaseOrder, receipt };
  }
}
