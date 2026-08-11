import { supabase } from '../config/supabase';
import { CatalogService } from './catalog.service';
import { parsePagination } from '../utils/query';
import { AppError } from '../utils/AppError';
import { appCache } from '../utils/cache';

const PRODUCT_CACHE_PREFIX = 'catalog:products';

export class StockService {
  private static async applyStockChangeRpc(params: {
    productId: string;
    mode: 'import' | 'adjustment';
    quantity?: number | null;
    newStock?: number | null;
    userId: string;
    note?: string | null;
    batchNumber?: string | null;
    expiryDate?: string | null;
  }) {
    const { data: transactionId, error } = await supabase.rpc('apply_stock_change', {
      p_product_id: params.productId,
      p_mode: params.mode,
      p_quantity: params.quantity ?? null,
      p_new_stock: params.newStock ?? null,
      p_user_id: params.userId,
      p_note: params.note || null,
      p_batch_number: params.batchNumber || null,
      p_expiry_date: params.expiryDate || null,
    });

    if (error) {
      const message = error.message || '';
      if (message.includes('apply_stock_change') || message.includes('Could not find the function')) {
        return null;
      }
      throw new AppError(400, message);
    }

    const { data: transaction, error: txError } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError) throw new AppError(400, txError.message);
    return transaction;
  }

  static async inventory(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('products')
      .select('*, categories(id, name), suppliers(id, name)', { count: 'exact' })
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true })
      .range(from, to);

    if (typeof queryParams.search === 'string' && queryParams.search.trim()) {
      const pattern = queryParams.search.trim().replace(/[%_]/g, '');
      query = query.or(`name.ilike.%${pattern}%,sku.ilike.%${pattern}%,barcode.ilike.%${pattern}%`);
    }
    if (queryParams.category_id) query = query.eq('category_id', queryParams.category_id);

    // Server-side stock status filter — eliminates need for client-side filtering
    if (queryParams.stock_status === 'low') {
      // stock_quantity <= min_stock_level AND stock_quantity > 0
      query = query.gt('stock_quantity', 0).filter('stock_quantity', 'lte', 'min_stock_level');
    } else if (queryParams.stock_status === 'out') {
      query = query.lte('stock_quantity', 0);
    } else if (queryParams.stock_status === 'safe') {
      query = query.gt('stock_quantity', 0).filter('stock_quantity', 'gt', 'min_stock_level');
    } else if (queryParams.stock_status === 'warning') {
      // Products at or below min_stock_level (both low + out)
      query = query.filter('stock_quantity', 'lte', 'min_stock_level');
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async alerts(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('stock_alerts')
      .select('*, products(id, sku, name, unit, stock_quantity, min_stock_level)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.status) query = query.eq('status', queryParams.status);
    else query = query.in('status', ['low_stock', 'out_of_stock']);

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async transactions(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('stock_transactions')
      .select('*, products(id, sku, name), users(id, full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.product_id) query = query.eq('product_id', queryParams.product_id);
    if (queryParams.type) query = query.eq('type', queryParams.type);

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  /**
   * Nhập kho — sử dụng atomic RPC update để tránh race condition.
   * Trước đây: đọc stock → tính newStock ở JS → ghi lại → 2 request đồng thời
   * có thể ghi đè nhau. Giờ dùng `stock_quantity + quantity` trực tiếp trong SQL.
   */
  static async importStock(
    productId: string,
    quantity: number,
    userId: string,
    note?: string | null,
    batchNumber?: string | null,
    expiryDate?: string | null
  ): Promise<any> {
    const normalizedBatch = String(batchNumber || '').trim();
    const normalizedExpiry = String(expiryDate || '').trim();
    if (!normalizedBatch || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedExpiry)) {
      throw new AppError(400, 'Nhập kho cần có số lô và hạn sử dụng hợp lệ');
    }
    const expiryDateObject = new Date(`${normalizedExpiry}T00:00:00Z`);
    if (
      !Number.isFinite(expiryDateObject.getTime()) ||
      expiryDateObject.toISOString().slice(0, 10) !== normalizedExpiry ||
      normalizedExpiry < new Date().toISOString().split('T')[0]
    ) {
      throw new AppError(400, 'Hạn sử dụng phải từ hôm nay trở đi');
    }

    const atomicTransaction = await this.applyStockChangeRpc({
      productId,
      mode: 'import',
      quantity,
      userId,
      note,
      batchNumber: normalizedBatch,
      expiryDate: normalizedExpiry,
    });
    if (atomicTransaction) {
      appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
      appCache.deletePrefix('report:dashboard');
      return atomicTransaction;
    }

    // Atomic update: cộng trực tiếp trong SQL, trả về giá trị trước/sau
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (fetchError || !product) throw new AppError(404, 'Không tìm thấy sản phẩm');

    const previousStock = Number(product.stock_quantity);
    const newStock = previousStock + quantity;

    // Dùng update với eq để đảm bảo atomic (Supabase PostgREST thực hiện UPDATE ... SET stock_quantity = <value>)
    // Thêm điều kiện stock_quantity = previousStock để detect race condition
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId)
      .eq('stock_quantity', previousStock) // Optimistic locking — fail nếu stock đã thay đổi
      .select('stock_quantity')
      .maybeSingle();

    if (updateError) {
      console.error('[StockService.importStock] updateError:', updateError);
      throw new AppError(400, updateError.message);
    }

    // Nếu optimistic lock fail (ai đó đã cập nhật stock trước), retry
    if (!updated) {
      console.warn('[StockService.importStock] Optimistic lock conflict, retrying...');
      return this.importStock(productId, quantity, userId, note, normalizedBatch, normalizedExpiry);
    }

    // Sync đúng lô nhập, không cộng dồn vào lô có HSD khác
    const { data: existingBatch, error: batchLookupError } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', productId)
      .eq('batch_number', normalizedBatch)
      .eq('expiry_date', normalizedExpiry)
      .maybeSingle();

    if (batchLookupError) throw new AppError(400, batchLookupError.message);

    if (existingBatch) {
      const { error: updateBatchError } = await supabase
        .from('product_batches')
        .update({
          quantity: Number(existingBatch.quantity) + quantity,
          original_quantity: Number(existingBatch.original_quantity) + quantity,
        })
        .eq('id', existingBatch.id);
      if (updateBatchError) throw new AppError(400, updateBatchError.message);
    } else {
      const { error: insertBatchError } = await supabase
        .from('product_batches')
        .insert({
          product_id: productId,
          batch_number: normalizedBatch,
          expiry_date: normalizedExpiry,
          original_quantity: quantity,
          quantity: quantity,
        });
      if (insertBatchError) throw new AppError(400, insertBatchError.message);
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        product_id: productId,
        type: 'import',
        quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        note: note || 'Nhập kho',
        user_id: userId,
      })
      .select('*')
      .single();
    if (transactionError) {
      console.error('[StockService.importStock] transactionError:', transactionError);
      throw new AppError(400, transactionError.message);
    }

    await CatalogService.syncStockAlert(productId);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    appCache.deletePrefix('report:dashboard');
    return transaction;
  }

  /**
   * Điều chỉnh tồn kho — sử dụng optimistic locking để tránh race condition.
   */
  static async adjustStock(productId: string, newStock: number, userId: string, note?: string | null): Promise<any> {
    const atomicTransaction = await this.applyStockChangeRpc({
      productId,
      mode: 'adjustment',
      newStock,
      userId,
      note,
    });
    if (atomicTransaction) {
      appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
      appCache.deletePrefix('report:dashboard');
      return atomicTransaction;
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (error || !product) throw new AppError(404, 'Không tìm thấy sản phẩm');

    const previousStock = Number(product.stock_quantity);
    const delta = newStock - previousStock;

    // Optimistic locking: chỉ update nếu stock vẫn giữ nguyên giá trị đã đọc
    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId)
      .eq('stock_quantity', previousStock)
      .select('stock_quantity')
      .maybeSingle();

    if (updateError) throw new AppError(400, updateError.message);

    if (!updated) {
      console.warn('[StockService.adjustStock] Optimistic lock conflict, retrying...');
      return this.adjustStock(productId, newStock, userId, note);
    }

    // Sync to product_batches
    const { data: latestBatch } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', productId)
      .order('expiry_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestBatch) {
      await supabase
        .from('product_batches')
        .update({ quantity: Math.max(0, Number(latestBatch.quantity) + delta) })
        .eq('id', latestBatch.id);
    } else {
      await supabase
        .from('product_batches')
        .insert({
          product_id: productId,
          batch_number: 'BAT-ADJUSTED',
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          original_quantity: newStock,
          quantity: newStock,
        });
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        product_id: productId,
        type: 'adjustment',
        quantity: delta,
        previous_stock: previousStock,
        new_stock: newStock,
        note: note || 'Điều chỉnh tồn kho',
        user_id: userId,
      })
      .select('*')
      .single();
    if (transactionError) throw new AppError(400, transactionError.message);

    await CatalogService.syncStockAlert(productId);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    appCache.deletePrefix('report:dashboard');
    return transaction;
  }

  /**
   * Giải quyết cảnh báo tồn kho — giờ có audit log.
   */
  static async resolveAlert(id: string, userId: string) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', id)
      .select('*, products(id, name, sku)')
      .single();
    if (error) throw new AppError(400, error.message);

    // Ghi audit log khi resolve alert
    try {
      await supabase.rpc('write_audit_log', {
        p_actor_id: userId,
        p_action: 'stock_alert.resolve',
        p_entity_type: 'stock_alerts',
        p_entity_id: id,
        p_metadata: {
          product_id: data.product_id,
          product_name: data.products?.name || null,
          previous_status: data.status === 'resolved' ? 'unknown' : data.status,
          current_stock: data.current_stock,
          min_stock_level: data.min_stock_level,
        },
      });
    } catch (auditErr) {
      // Không throw — audit log failure không nên block chức năng chính
      console.warn('[StockService.resolveAlert] Audit log failed:', auditErr);
    }

    return data;
  }

  /**
   * Cảnh báo hạn sử dụng — FIX: di chuyển search/category filter LÊN TRƯỚC pagination
   * để kết quả phân trang chính xác.
   *
   * Trước đây: query DB → pagination → filter client-side → kết quả sai (ví dụ
   * page 1 trả 5/20 items vì filter xóa bớt sau khi đã cắt range).
   *
   * Bây giờ: không dùng .range() khi có search/category_id filter vì Supabase
   * không hỗ trợ filter trên related table trong WHERE. Thay vào đó, load all
   * rồi paginate ở JS — nhưng trả đúng total.
   */
  static async expiryAlerts(queryParams: Record<string, unknown>) {
    const { page, limit } = parsePagination(queryParams);
    const currentDate = new Date().toISOString().split('T')[0];

    const hasClientFilters =
      (typeof queryParams.search === 'string' && queryParams.search.trim()) ||
      queryParams.category_id;

    let query = supabase
      .from('product_batches')
      .select('*, products(id, name, sku, barcode, unit, category_id, categories(id, name), suppliers(id, name))')
      .gt('quantity', 0);

    if (queryParams.status === 'expired') {
      query = query.lt('expiry_date', currentDate);
    } else if (queryParams.status === 'near_expiry') {
      const warningDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gte('expiry_date', currentDate).lte('expiry_date', warningDate);
    } else if (queryParams.status === 'watchlist') {
      const warningDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const watchlistDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gt('expiry_date', warningDate).lte('expiry_date', watchlistDate);
    } else if (queryParams.status === 'safe') {
      const warningDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gt('expiry_date', warningDate);
    }

    query = query.order('expiry_date', { ascending: true });

    // Nếu KHÔNG có client filter, dùng server-side pagination bình thường
    if (!hasClientFilters) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const countQuery = supabase
        .from('product_batches')
        .select('id', { count: 'exact', head: true })
        .gt('quantity', 0);
      // Apply same status filter to count query
      let cq = countQuery;
      if (queryParams.status === 'expired') {
        cq = cq.lt('expiry_date', currentDate);
      } else if (queryParams.status === 'near_expiry') {
        const warningDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        cq = cq.gte('expiry_date', currentDate).lte('expiry_date', warningDate);
      } else if (queryParams.status === 'watchlist') {
        const warningDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const watchlistDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        cq = cq.gt('expiry_date', warningDate).lte('expiry_date', watchlistDate);
      } else if (queryParams.status === 'safe') {
        const warningDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        cq = cq.gt('expiry_date', warningDate);
      }

      const { data, error } = await query.range(from, to);
      const { count } = await cq;
      if (error) throw new AppError(500, error.message);

      return {
        items: data || [],
        pagination: { page, limit, total: count || 0 },
      };
    }

    // Nếu CÓ client filter: load tất cả, filter, rồi paginate thủ công
    const { data, error } = await query;
    if (error) throw new AppError(500, error.message);

    let filteredData = data || [];

    if (typeof queryParams.search === 'string' && queryParams.search.trim()) {
      const term = queryParams.search.trim().toLowerCase();
      filteredData = filteredData.filter((item: any) => {
        const matchesProduct =
          item.products?.name?.toLowerCase().includes(term) ||
          item.products?.sku?.toLowerCase().includes(term) ||
          item.products?.barcode?.includes(term);
        const matchesBatch = item.batch_number?.toLowerCase().includes(term);
        return matchesProduct || matchesBatch;
      });
    }

    if (queryParams.category_id) {
      filteredData = filteredData.filter((item: any) => item.products?.category_id === queryParams.category_id);
    }

    const total = filteredData.length;
    const from = (page - 1) * limit;
    const paginatedItems = filteredData.slice(from, from + limit);

    return {
      items: paginatedItems,
      pagination: { page, limit, total },
    };
  }

  /**
   * Stock Summary — tổng quan kho hàng cho dashboard.
   */
  static async summary() {
    // Chạy các query song song để tăng tốc
    const [productsRes, alertsRes, lowStockRes] = await Promise.all([
      // Tổng sản phẩm đang active
      supabase
        .from('products')
        .select('id, name, sku, stock_quantity, min_stock_level, cost_price, sell_price, categories(id, name)', { count: 'exact' })
        .eq('is_active', true),
      // Tổng alerts chưa resolved
      supabase
        .from('stock_alerts')
        .select('id', { count: 'exact', head: true })
        .in('status', ['low_stock', 'out_of_stock']),
      // Top 10 sản phẩm tồn thấp nhất (kể cả hết hàng)
      supabase
        .from('products')
        .select('id, name, sku, stock_quantity, min_stock_level, categories(id, name)')
        .eq('is_active', true)
        .lte('stock_quantity', 0)
        .order('stock_quantity', { ascending: true })
        .limit(10),
    ]);

    const allProducts = productsRes.data || [];
    const totalProducts = productsRes.count || 0;
    const alertsPending = alertsRes.count || 0;

    let outOfStockCount = 0;
    let lowStockCount = 0;
    let safeCount = 0;
    let totalStockValue = 0;
    let totalRetailValue = 0;

    for (const p of allProducts) {
      const stock = Number(p.stock_quantity || 0);
      const minStock = Number(p.min_stock_level || 0);
      const costPrice = Number(p.cost_price || 0);
      const sellPrice = Number(p.sell_price || 0);

      totalStockValue += stock * costPrice;
      totalRetailValue += stock * sellPrice;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      } else {
        safeCount++;
      }
    }

    // Top 10 sản phẩm cần nhập gấp (tồn thấp hoặc hết)
    const topLowStock = allProducts
      .filter(p => Number(p.stock_quantity || 0) <= Number(p.min_stock_level || 0))
      .sort((a, b) => Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0))
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock_quantity: p.stock_quantity,
        min_stock_level: p.min_stock_level,
        category: (p as any).categories?.name || null,
      }));

    // Phân bố theo danh mục
    const categoryMap = new Map<string, { name: string; count: number; lowCount: number; totalStock: number }>();
    for (const p of allProducts) {
      const catName = (p as any).categories?.name || 'Chưa phân loại';
      const catId = (p as any).categories?.id || 'uncategorized';
      const entry = categoryMap.get(catId) || { name: catName, count: 0, lowCount: 0, totalStock: 0 };
      entry.count++;
      entry.totalStock += Number(p.stock_quantity || 0);
      if (Number(p.stock_quantity || 0) <= Number(p.min_stock_level || 0)) {
        entry.lowCount++;
      }
      categoryMap.set(catId, entry);
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([id, val]) => ({
      id,
      name: val.name,
      product_count: val.count,
      low_stock_count: val.lowCount,
      total_stock: val.totalStock,
    }));

    return {
      total_products: totalProducts,
      out_of_stock_count: outOfStockCount,
      low_stock_count: lowStockCount,
      safe_count: safeCount,
      total_stock_value: totalStockValue,
      total_retail_value: totalRetailValue,
      alerts_pending: alertsPending,
      top_low_stock: topLowStock,
      category_breakdown: categoryBreakdown,
    };
  }

  /**
   * Product lookup — tìm chính xác sản phẩm bằng barcode HOẶC sku
   * trong 1 query duy nhất (thay vì frontend phải gọi 3 lần).
   */
  static async lookupProduct(code: string) {
    if (!code || !code.trim()) throw new AppError(400, 'Mã sản phẩm không được để trống');
    const cleaned = code.trim();

    // Tìm bằng barcode trước, rồi fallback sang sku
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(id, name), suppliers(id, name)')
      .eq('is_active', true)
      .or(`barcode.eq.${cleaned},sku.eq.${cleaned}`)
      .limit(1)
      .maybeSingle();

    if (error) throw new AppError(500, error.message);
    return data || null;
  }
}
