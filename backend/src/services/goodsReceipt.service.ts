import { supabase } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { parsePagination } from '../utils/query';
import { appCache } from '../utils/cache';

const PRODUCT_CACHE_PREFIX = 'catalog:products';

export interface ReceiptItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface CreateReceiptInput {
  supplier_id: string;
  note?: string | null;
  paid_amount: number;
  items: ReceiptItemInput[];
}

const generateReceiptNumber = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900); // 3 chữ số ngẫu nhiên
  return `GR-${y}${m}${d}-${rand}`;
};

export class GoodsReceiptService {
  /**
   * Tạo phiếu nhập kho mới
   */
  static async create(input: CreateReceiptInput, userId: string) {
    if (!input.items || input.items.length === 0) {
      throw new AppError(400, 'Danh sách sản phẩm nhập không được để trống');
    }

    for (const item of input.items) {
      if (item.quantity <= 0) throw new AppError(400, 'Số lượng nhập phải lớn hơn 0');
      if (item.unit_price < 0) throw new AppError(400, 'Giá nhập không được nhỏ hơn 0');
    }

    const receiptNumber = generateReceiptNumber();
    const payload = {
      receipt_number: receiptNumber,
      supplier_id: input.supplier_id || null,
      note: input.note || null,
      paid_amount: Number(input.paid_amount || 0),
      items: input.items,
    };

    const { data: receiptId, error } = await supabase.rpc('create_goods_receipt', {
      p_payload: payload,
      p_user_id: userId,
    });

    if (error || !receiptId) {
      console.error('[GoodsReceiptService.create] RPC error:', error);
      throw new AppError(400, 'Không thể tạo phiếu nhập kho: ' + (error?.message || 'Lỗi không xác định'));
    }

    // Xóa cache sản phẩm để cập nhật tồn kho mới hiển thị ở FE
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);

    return this.getById(String(receiptId));
  }

  /**
   * Lấy danh sách phiếu nhập kho (phân trang, bộ lọc)
   */
  static async list(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);

    let query = supabase
      .from('goods_receipts')
      .select('*, suppliers(id, name), users(id, full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.supplier_id) {
      query = query.eq('supplier_id', queryParams.supplier_id);
    }
    if (queryParams.payment_status) {
      query = query.eq('payment_status', queryParams.payment_status);
    }
    if (queryParams.date_from) {
      query = query.gte('created_at', `${queryParams.date_from}`);
    }
    if (queryParams.date_to) {
      query = query.lte('created_at', `${queryParams.date_to}T23:59:59.999Z`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('[GoodsReceiptService.list] Error:', error);
      throw new AppError(500, error.message);
    }

    return {
      items: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }

  /**
   * Chi tiết 1 phiếu nhập kho
   */
  static async getById(id: string) {
    const { data: receipt, error } = await supabase
      .from('goods_receipts')
      .select('*, suppliers(*), users(id, full_name, email)')
      .eq('id', id)
      .single();

    if (error || !receipt) {
      throw new AppError(404, 'Không tìm thấy phiếu nhập kho');
    }

    // Lấy chi tiết hàng hóa kèm theo thông tin sản phẩm
    const { data: details, error: detailsErr } = await supabase
      .from('goods_receipt_details')
      .select('*, products(id, name, sku, barcode, unit)')
      .eq('goods_receipt_id', id);

    if (detailsErr) {
      console.error('[GoodsReceiptService.getById] detailsErr:', detailsErr);
      throw new AppError(500, 'Lỗi lấy chi tiết hàng hóa phiếu nhập');
    }

    return {
      ...receipt,
      items: details || [],
    };
  }

  /**
   * Cập nhật số tiền đã thanh toán cho phiếu nhập kho (trả nợ thêm)
   */
  static async updatePayment(id: string, payAmount: number, userId: string) {
    if (payAmount <= 0) {
      throw new AppError(400, 'Số tiền thanh toán thêm phải lớn hơn 0');
    }

    // 1. Lấy thông tin phiếu nhập hiện tại
    const { data: receipt, error: getErr } = await supabase
      .from('goods_receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (getErr || !receipt) {
      throw new AppError(404, 'Không tìm thấy phiếu nhập kho');
    }

    const currentPaid = Number(receipt.paid_amount || 0);
    const totalAmount = Number(receipt.total_amount || 0);
    const remaining = totalAmount - currentPaid;

    if (remaining <= 0) {
      throw new AppError(400, 'Phiếu nhập kho này đã được thanh toán đầy đủ');
    }

    if (payAmount > remaining) {
      throw new AppError(400, `Số tiền thanh toán vượt quá số nợ còn lại (${new Intl.NumberFormat('vi-VN').format(remaining)}đ)`);
    }

    const newPaidAmount = currentPaid + payAmount;

    // 2. Xác định trạng thái thanh toán mới
    let paymentStatus = 'partial';
    if (newPaidAmount >= totalAmount) {
      paymentStatus = 'paid';
    }

    // 3. Cập nhật vào DB
    const { data: updatedReceipt, error: updErr } = await supabase
      .from('goods_receipts')
      .update({
        paid_amount: newPaidAmount,
        payment_status: paymentStatus,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr || !updatedReceipt) {
      console.error('[GoodsReceiptService.updatePayment] updErr:', updErr);
      throw new AppError(400, 'Không thể cập nhật thanh toán: ' + (updErr?.message || 'Lỗi không xác định'));
    }

    return this.getById(id);
  }
}
