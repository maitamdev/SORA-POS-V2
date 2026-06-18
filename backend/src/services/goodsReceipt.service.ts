import { supabase } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { parsePagination } from '../utils/query';
import { appCache } from '../utils/cache';

const PRODUCT_CACHE_PREFIX = 'catalog:products';

export interface ReceiptItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  expiry_date?: string | null;
  batch_number?: string | null;
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
      if (error?.code === 'PGRST202') {
        console.warn('[GoodsReceiptService.create] RPC create_goods_receipt not found in database schema cache. Running JS Fallback...');
        const result = await this.createFallbackJS(payload, userId);
        appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
        return result;
      }
      console.error('[GoodsReceiptService.create] RPC error:', error);
      throw new AppError(400, 'Không thể tạo phiếu nhập kho: ' + (error?.message || 'Lỗi không xác định'));
    }

    // Xóa cache sản phẩm để cập nhật tồn kho mới hiển thị ở FE
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);

    return this.getById(String(receiptId));
  }

  /**
   * Fallback method using standard Supabase JS API calls when Postgres RPC is not available
   */
  static async createFallbackJS(payload: any, userId: string) {
    const { receipt_number, supplier_id, note, paid_amount, items } = payload;

    // 1. Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += Number(item.quantity || 0) * Number(item.unit_price || 0);
    }

    // 2. Determine payment status
    let paymentStatus = 'unpaid';
    if (paid_amount >= totalAmount) {
      paymentStatus = 'paid';
    } else if (paid_amount > 0) {
      paymentStatus = 'partial';
    }

    // 3. Insert goods receipt
    const { data: receipt, error: receiptErr } = await supabase
      .from('goods_receipts')
      .insert({
        receipt_number,
        supplier_id: supplier_id || null,
        user_id: userId,
        total_amount: totalAmount,
        paid_amount: Number(paid_amount || 0),
        payment_status: paymentStatus,
        note: note || null,
      })
      .select('*')
      .single();

    if (receiptErr || !receipt) {
      console.error('[GoodsReceiptService.createFallbackJS] receiptErr:', receiptErr);
      throw new AppError(400, 'Lỗi tạo phiếu nhập kho (JS Fallback): ' + (receiptErr?.message || 'Lỗi không xác định'));
    }

    const receiptId = receipt.id;

    // 4. Process each item
    for (const item of items) {
      // Get current product stock for transaction log
      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('stock_quantity, min_stock_level')
        .eq('id', item.product_id)
        .single();

      if (prodErr || !product) {
        console.error('[GoodsReceiptService.createFallbackJS] prodErr:', prodErr);
        throw new AppError(400, `Không tìm thấy sản phẩm ${item.product_id}`);
      }

      const previousStock = Number(product.stock_quantity || 0);
      const newStock = previousStock + Number(item.quantity || 0);

      const batchNumber = item.batch_number || `BAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const expiryDate = item.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Insert detail
      const { error: detailErr } = await supabase
        .from('goods_receipt_details')
        .insert({
          goods_receipt_id: receiptId,
          product_id: item.product_id,
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          subtotal: Number(item.quantity || 0) * Number(item.unit_price || 0),
          expiry_date: expiryDate,
          batch_number: batchNumber,
        });

      if (detailErr) {
        console.error('[GoodsReceiptService.createFallbackJS] detailErr:', detailErr);
        throw new AppError(400, 'Lỗi lưu chi tiết hàng hóa nhập');
      }

      // Insert tracking batch into product_batches
      const { error: batchErr } = await supabase
        .from('product_batches')
        .insert({
          product_id: item.product_id,
          batch_number: batchNumber,
          expiry_date: expiryDate,
          original_quantity: Number(item.quantity || 0),
          quantity: Number(item.quantity || 0),
        });

      if (batchErr) {
        console.error('[GoodsReceiptService.createFallbackJS] batchErr:', batchErr);
      }

      // Update product stock and cost price
      const { error: updateProdErr } = await supabase
        .from('products')
        .update({
          stock_quantity: newStock,
          cost_price: Number(item.unit_price || 0),
        })
        .eq('id', item.product_id);

      if (updateProdErr) {
        console.error('[GoodsReceiptService.createFallbackJS] updateProdErr:', updateProdErr);
        throw new AppError(400, 'Lỗi cập nhật tồn kho sản phẩm');
      }

      // Insert stock transaction
      const { error: txErr } = await supabase
        .from('stock_transactions')
        .insert({
          product_id: item.product_id,
          type: 'import',
          quantity: Number(item.quantity || 0),
          previous_stock: previousStock,
          new_stock: newStock,
          reference_id: receiptId,
          note: `Nhập kho theo phiếu ${receipt_number}`,
          user_id: userId,
        });

      if (txErr) {
        console.error('[GoodsReceiptService.createFallbackJS] txErr:', txErr);
      }

      // Sync stock alerts
      const currentStock = newStock;
      const minStockLevel = Number(product.min_stock_level || 0);
      
      let alertStatus = null;
      if (currentStock <= 0) {
        alertStatus = 'out_of_stock';
      } else if (currentStock <= minStockLevel) {
        alertStatus = 'low_stock';
      }

      // Find active alert
      const { data: activeAlert } = await supabase
        .from('stock_alerts')
        .select('*')
        .eq('product_id', item.product_id)
        .in('status', ['low_stock', 'out_of_stock'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (alertStatus === null) {
        if (activeAlert) {
          await supabase
            .from('stock_alerts')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeAlert.id);
        }
      } else {
        if (activeAlert) {
          await supabase
            .from('stock_alerts')
            .update({
              current_stock: currentStock,
              min_stock_level: minStockLevel,
              status: alertStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeAlert.id);
        } else {
          await supabase
            .from('stock_alerts')
            .insert({
              product_id: item.product_id,
              current_stock: currentStock,
              min_stock_level: minStockLevel,
              status: alertStatus,
            });
        }
      }
    }

    // 5. Write audit log
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: userId,
        action: 'goods_receipt.create',
        entity_type: 'goods_receipts',
        entity_id: receiptId,
        metadata: {
          receipt_number,
          total_amount: totalAmount,
          paid_amount: Number(paid_amount || 0),
          item_count: items.length,
        },
      });

    return this.getById(receiptId);
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
