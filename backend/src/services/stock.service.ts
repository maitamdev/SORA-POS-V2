import { supabase } from '../config/supabase';
import { CatalogService } from './catalog.service';
import { parsePagination } from '../utils/query';

export class StockService {
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

    const { data, error, count } = await query;
    if (error) throw { status: 500, message: error.message };
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
    if (error) throw { status: 500, message: error.message };
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
    if (error) throw { status: 500, message: error.message };
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async importStock(productId: string, quantity: number, userId: string, note?: string | null) {
    const { data: product, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (error || !product) throw { status: 404, message: 'Không tìm thấy sản phẩm' };

    const previousStock = Number(product.stock_quantity);
    const newStock = previousStock + quantity;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);
    if (updateError) throw { status: 400, message: updateError.message };

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
    if (transactionError) throw { status: 400, message: transactionError.message };

    await CatalogService.syncStockAlert(productId);
    return transaction;
  }

  static async adjustStock(productId: string, newStock: number, userId: string, note?: string | null) {
    const { data: product, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (error || !product) throw { status: 404, message: 'Không tìm thấy sản phẩm' };

    const previousStock = Number(product.stock_quantity);
    const delta = newStock - previousStock;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);
    if (updateError) throw { status: 400, message: updateError.message };

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
    if (transactionError) throw { status: 400, message: transactionError.message };

    await CatalogService.syncStockAlert(productId);
    return transaction;
  }

  static async resolveAlert(id: string, userId: string) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw { status: 400, message: error.message };
    return data;
  }
}
