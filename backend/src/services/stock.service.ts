import { supabase } from '../config/supabase';
import { CatalogService } from './catalog.service';
import { parsePagination } from '../utils/query';
import { AppError } from '../utils/AppError';
import { appCache } from '../utils/cache';

const PRODUCT_CACHE_PREFIX = 'catalog:products';

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

  static async importStock(productId: string, quantity: number, userId: string, note?: string | null) {
    const { data: product, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (error || !product) throw new AppError(404, 'Không tìm thấy sản phẩm');

    const previousStock = Number(product.stock_quantity);
    const newStock = previousStock + quantity;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);
    if (updateError) {
      console.error('[StockService.importStock] updateError:', updateError);
      throw new AppError(400, updateError.message);
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
        .update({ quantity: Number(latestBatch.quantity) + quantity })
        .eq('id', latestBatch.id);
    } else {
      await supabase
        .from('product_batches')
        .insert({
          product_id: productId,
          batch_number: 'BAT-IMPORTED',
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          original_quantity: quantity,
          quantity: quantity,
        });
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
    return transaction;
  }

  static async adjustStock(productId: string, newStock: number, userId: string, note?: string | null) {
    const { data: product, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (error || !product) throw new AppError(404, 'Không tìm thấy sản phẩm');

    const previousStock = Number(product.stock_quantity);
    const delta = newStock - previousStock;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);
    if (updateError) throw new AppError(400, updateError.message);

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
    if (error) throw new AppError(400, error.message);
    return data;
  }

  static async expiryAlerts(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);
    const currentDate = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('product_batches')
      .select('*, products(id, name, sku, barcode, unit, category_id, categories(id, name))', { count: 'exact' })
      .gt('quantity', 0)
      .range(from, to);

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
      const watchlistDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.gt('expiry_date', watchlistDate);
    }

    query = query.order('expiry_date', { ascending: true });

    const { data, error, count } = await query;
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

    return {
      items: filteredData,
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }
}
