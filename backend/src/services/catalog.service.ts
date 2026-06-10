import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { emptyToNull, parsePagination } from '../utils/query';
import { appCache, stableCacheKey } from '../utils/cache';

type Query = Record<string, unknown>;
type Entity = Record<string, unknown>;
const CATALOG_CACHE_TTL_MS = 30_000;
const CATEGORY_CACHE_PREFIX = 'catalog:categories';
const PRODUCT_CACHE_PREFIX = 'catalog:products';

const applySearch = (
  query: any,
  search: unknown,
  columns: string[]
) => {
  if (typeof search !== 'string' || !search.trim()) return query;
  const pattern = search.trim().replace(/[%_]/g, '');
  return query.or(columns.map((column) => `${column}.ilike.%${pattern}%`).join(','));
};

export class CatalogService {
  static async syncStockAlert(productId: string) {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, stock_quantity, min_stock_level')
      .eq('id', productId)
      .single();

    if (error || !product) return;

    const currentStock = Number(product.stock_quantity);
    const minStock = Number(product.min_stock_level);
    const status = currentStock <= 0 ? 'out_of_stock' : currentStock <= minStock ? 'low_stock' : null;

    const { data: activeAlert } = await supabase
      .from('stock_alerts')
      .select('id')
      .eq('product_id', productId)
      .in('status', ['low_stock', 'out_of_stock'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!status && activeAlert) {
      await supabase
        .from('stock_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', activeAlert.id);
      return;
    }

    if (!status) return;

    const payload = {
      product_id: productId,
      current_stock: currentStock,
      min_stock_level: minStock,
      status,
    };

    if (activeAlert) {
      await supabase.from('stock_alerts').update(payload).eq('id', activeAlert.id);
    } else {
      await supabase.from('stock_alerts').insert(payload);
    }
  }

  static async listCategories(queryParams: Query) {
    const cacheKey = stableCacheKey(CATEGORY_CACHE_PREFIX, queryParams);
    const cached = appCache.get<{ items: unknown[]; pagination: { page: number; limit: number; total: number } }>(cacheKey);
    if (cached) return cached;

    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('categories')
      .select('*, products(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applySearch(query, queryParams.search, ['name', 'description']);
    if (queryParams.is_active !== undefined) query = query.eq('is_active', queryParams.is_active === 'true');

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    const result = { items: data || [], pagination: { page, limit, total: count || 0 } };
    appCache.set(cacheKey, result, CATALOG_CACHE_TTL_MS);
    return result;
  }

  static async createCategory(data: Entity) {
    const { data: created, error } = await supabase
      .from('categories')
      .insert(emptyToNull(data))
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix(CATEGORY_CACHE_PREFIX);
    return created;
  }

  static async updateCategory(id: string, data: Entity) {
    const { data: updated, error } = await supabase
      .from('categories')
      .update(emptyToNull(data))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix(CATEGORY_CACHE_PREFIX);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    return updated;
  }

  static async deleteCategory(id: string) {
    const { error } = await supabase.from('categories').update({ is_active: false }).eq('id', id);
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix(CATEGORY_CACHE_PREFIX);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    return null;
  }

  static async listSuppliers(queryParams: Query) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('suppliers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applySearch(query, queryParams.search, ['name', 'contact_person', 'email', 'phone']);
    if (queryParams.is_active !== undefined) query = query.eq('is_active', queryParams.is_active === 'true');

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async createSupplier(data: Entity) {
    const { data: created, error } = await supabase
      .from('suppliers')
      .insert(emptyToNull(data))
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
    return created;
  }

  static async updateSupplier(id: string, data: Entity) {
    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(emptyToNull(data))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
    return updated;
  }

  static async deleteSupplier(id: string) {
    const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
    if (error) throw new AppError(400, error.message);
    return null;
  }

  static async listCustomers(queryParams: Query) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applySearch(query, queryParams.search, ['name', 'email', 'phone']);
    if (queryParams.is_active !== undefined) query = query.eq('is_active', queryParams.is_active === 'true');

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async createCustomer(data: Entity) {
    const { data: created, error } = await supabase
      .from('customers')
      .insert(emptyToNull(data))
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
    return created;
  }

  static async updateCustomer(id: string, data: Entity) {
    const { data: updated, error } = await supabase
      .from('customers')
      .update(emptyToNull(data))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
    return updated;
  }

  static async deleteCustomer(id: string) {
    const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', id);
    if (error) throw new AppError(400, error.message);
    return null;
  }

  static async listProducts(queryParams: Query) {
    const cacheKey = stableCacheKey(PRODUCT_CACHE_PREFIX, queryParams);
    const cached = appCache.get<{ items: unknown[]; pagination: { page: number; limit: number; total: number } }>(cacheKey);
    if (cached) return cached;

    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('products')
      .select('*, categories(id, name), suppliers(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applySearch(query, queryParams.search, ['name', 'sku', 'barcode']);
    if (queryParams.category_id) query = query.eq('category_id', queryParams.category_id);
    if (queryParams.supplier_id) query = query.eq('supplier_id', queryParams.supplier_id);
    if (queryParams.is_active !== undefined) query = query.eq('is_active', queryParams.is_active === 'true');

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    const result = { items: data || [], pagination: { page, limit, total: count || 0 } };
    appCache.set(cacheKey, result, CATALOG_CACHE_TTL_MS);
    return result;
  }

  static async getProduct(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(id, name), suppliers(id, name)')
      .eq('id', id)
      .single();
    if (error || !data) throw new AppError(404, 'Không tìm thấy sản phẩm');
    return data;
  }

  static async createProduct(data: Entity) {
    const { data: created, error } = await supabase
      .from('products')
      .insert(emptyToNull(data))
      .select('*')
      .single();
    if (error) this.handleDBError(error);
    await this.syncStockAlert(created.id);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    return created;
  }

  static async createProductsBulk(products: Entity[]) {
    if (!Array.isArray(products) || products.length === 0) {
      return { imported: 0, skipped: 0, skippedSkus: [] };
    }

    const cleanedProducts = products.map((p) => emptyToNull(p));

    const uniqueIncoming: Entity[] = [];
    const incomingSkusSeen = new Set<string>();
    const selfSkippedSkus: string[] = [];

    for (const p of cleanedProducts) {
      const sku = typeof p.sku === 'string' ? p.sku.trim() : '';
      if (!sku) {
        continue;
      }
      if (incomingSkusSeen.has(sku)) {
        selfSkippedSkus.push(sku);
      } else {
        incomingSkusSeen.add(sku);
        uniqueIncoming.push(p);
      }
    }

    const incomingSkus = Array.from(incomingSkusSeen);

    let existingSkus: string[] = [];
    if (incomingSkus.length > 0) {
      const { data: existing, error: fetchError } = await supabase
        .from('products')
        .select('sku')
        .in('sku', incomingSkus);

      if (!fetchError && existing) {
        existingSkus = existing.map((e: any) => e.sku);
      }
    }

    const existingSkusSet = new Set(existingSkus);
    const toInsert = uniqueIncoming.filter((p) => !existingSkusSet.has(p.sku as string));
    const dbSkippedSkus = uniqueIncoming
      .filter((p) => existingSkusSet.has(p.sku as string))
      .map((p) => p.sku as string);

    const skippedSkus = [...selfSkippedSkus, ...dbSkippedSkus];

    if (toInsert.length === 0) {
      return {
        imported: 0,
        skipped: skippedSkus.length,
        skippedSkus,
        items: [],
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('products')
      .insert(toInsert)
      .select('*');

    if (insertError) {
      throw new AppError(400, insertError.message);
    }

    if (inserted) {
      for (const p of inserted) {
        await this.syncStockAlert(p.id);
      }
    }
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);

    return {
      imported: inserted ? inserted.length : 0,
      skipped: skippedSkus.length,
      skippedSkus,
      items: inserted || [],
    };
  }

  static async updateProduct(id: string, data: Entity) {
    const { data: updated, error } = await supabase
      .from('products')
      .update(emptyToNull(data))
      .eq('id', id)
      .select('*')
      .single();
    if (error) this.handleDBError(error);
    await this.syncStockAlert(id);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    return updated;
  }

  static async deleteProduct(id: string) {
    // Lấy SKU hiện tại để tạo SKU mới không trùng
    const { data: product } = await supabase
      .from('products')
      .select('sku')
      .eq('id', id)
      .single();

    const deactivatedSku = product
      ? `${product.sku}_DEL_${Date.now()}`
      : `DELETED_${Date.now()}`;

    // Soft-delete: ẩn sản phẩm + giải phóng barcode/sku để có thể tạo lại
    const { error } = await supabase
      .from('products')
      .update({
        is_active: false,
        barcode: null,
        sku: deactivatedSku,
      })
      .eq('id', id);
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    return null;
  }

  static async deleteAllProducts() {
    throw new AppError(
      403,
      'He thong POS doanh nghiep khong cho xoa toan bo san pham. Hay dung ngung kinh doanh, import dieu chinh, hoac backup/restore co kiem soat.'
    );
  }

  private static handleDBError(error: any): never {
    const msg = error.message || '';
    if (msg.includes('products_sku_key')) {
      throw new AppError(400, 'Mã SKU này đã tồn tại trong hệ thống. Vui lòng nhập mã khác.');
    }
    if (msg.includes('products_barcode_key')) {
      throw new AppError(400, 'Mã vạch (Barcode) này đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.');
    }
    if (msg.includes('categories_name_key')) {
      throw new AppError(400, 'Tên danh mục này đã tồn tại. Vui lòng nhập tên khác.');
    }
    throw new AppError(400, msg);
  }
}
