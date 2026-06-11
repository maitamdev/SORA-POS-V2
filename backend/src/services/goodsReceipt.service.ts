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

    // 1. Tính tổng tiền hàng
    let totalAmount = 0;
    for (const item of input.items) {
      if (item.quantity <= 0) throw new AppError(400, 'Số lượng nhập phải lớn hơn 0');
      if (item.unit_price < 0) throw new AppError(400, 'Giá nhập không được nhỏ hơn 0');
      totalAmount += item.quantity * item.unit_price;
    }

    // 2. Xác định trạng thái thanh toán
    let paymentStatus = 'unpaid';
    const paidAmount = Number(input.paid_amount || 0);
    if (paidAmount >= totalAmount) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    }

    const receiptNumber = generateReceiptNumber();

    // 3. Insert phiếu nhập kho (goods_receipts)
    const { data: receipt, error: receiptErr } = await supabase
      .from('goods_receipts')
      .insert({
        receipt_number: receiptNumber,
        supplier_id: input.supplier_id || null,
        user_id: userId,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        payment_status: paymentStatus,
        note: input.note || null,
      })
      .select('*')
      .single();

    if (receiptErr || !receipt) {
      console.error('[GoodsReceiptService.create] receiptErr:', receiptErr);
      throw new AppError(400, 'Không thể tạo phiếu nhập kho: ' + (receiptErr?.message || 'Lỗi không xác định'));
    }

    // 4. Insert chi tiết phiếu nhập (goods_receipt_details)
    const detailsData = input.items.map((item) => ({
      goods_receipt_id: receipt.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price,
    }));

    const { error: detailsErr } = await supabase
      .from('goods_receipt_details')
      .insert(detailsData);

    if (detailsErr) {
      console.error('[GoodsReceiptService.create] detailsErr:', detailsErr);
      // Rollback bằng cách xóa phiếu vừa tạo
      await supabase.from('goods_receipts').delete().eq('id', receipt.id);
      throw new AppError(400, 'Không thể lưu chi tiết phiếu nhập kho: ' + detailsErr.message);
    }

    // 5. Cập nhật tồn kho sản phẩm, giá nhập và ghi giao dịch kho (stock_transactions)
    for (const item of input.items) {
      // Lấy số lượng tồn hiện tại của sản phẩm
      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', item.product_id)
        .single();

      if (prodErr || !product) {
        throw new AppError(404, `Không tìm thấy sản phẩm có ID: ${item.product_id}`);
      }

      const previousStock = Number(product.stock_quantity);
      const newStock = previousStock + item.quantity;

      // Cập nhật stock_quantity và cost_price trong bảng products
      const { error: updErr } = await supabase
        .from('products')
        .update({
          stock_quantity: newStock,
          cost_price: item.unit_price,
        })
        .eq('id', item.product_id);

      if (updErr) {
        throw new AppError(400, `Lỗi cập nhật tồn kho cho sản phẩm: ${updErr.message}`);
      }

      // Ghi nhận lịch sử giao dịch vào bảng stock_transactions
      const { error: txErr } = await supabase
        .from('stock_transactions')
        .insert({
          product_id: item.product_id,
          type: 'import',
          quantity: item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reference_id: receipt.id,
          note: `Nhập kho theo phiếu ${receipt.receipt_number}`,
          user_id: userId,
        });

      if (txErr) {
        console.error(`[GoodsReceiptService.create] Lỗi ghi stock_transaction cho sản phẩm ${item.product_id}:`, txErr);
      }
    }

    // Xóa cache sản phẩm để cập nhật tồn kho mới hiển thị ở FE
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);

    return this.getById(receipt.id);
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
