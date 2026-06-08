import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { emptyToNull, parsePagination } from '../utils/query';

type Query = Record<string, unknown>;
type Entity = Record<string, unknown>;

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
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async createCategory(data: Entity) {
    const { data: created, error } = await supabase
      .from('categories')
      .insert(emptyToNull(data))
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
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
    return updated;
  }

  static async deleteCategory(id: string) {
    const { error } = await supabase.from('categories').update({ is_active: false }).eq('id', id);
    if (error) throw new AppError(400, error.message);
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
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
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
    if (error) throw new AppError(400, error.message);
    await this.syncStockAlert(created.id);
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
    if (error) throw new AppError(400, error.message);
    await this.syncStockAlert(id);
    return updated;
  }

  static async deleteProduct(id: string) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw new AppError(400, error.message);
    return null;
  }

  static async deleteAllProducts() {
    throw new AppError(
      403,
      'He thong POS doanh nghiep khong cho xoa toan bo san pham. Hay dung ngung kinh doanh, import dieu chinh, hoac backup/restore co kiem soat.'
    );
  }
}
