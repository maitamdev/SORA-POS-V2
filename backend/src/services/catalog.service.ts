import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { emptyToNull, parsePagination } from '../utils/query';
import { appCache, stableCacheKey } from '../utils/cache';
import { NotificationService } from './notification.service';
import { JwtPayload } from '../types/user.type';

type Query = Record<string, unknown>;
type Entity = Record<string, unknown>;
const CATALOG_CACHE_TTL_MS = 30_000;
const CATEGORY_CACHE_PREFIX = 'catalog:categories';
const PRODUCT_CACHE_PREFIX = 'catalog:products';
const CUSTOMER_SAFE_SELECT = 'id, name, email, address, points, total_spent, is_active, created_at';
const CUSTOMER_LIMITED_SELECT = 'id, name, points, total_spent, is_active, created_at';

const canManageCustomerData = (currentUser?: JwtPayload) =>
  currentUser?.role === 'admin' || currentUser?.role === 'manager';

const normalizePhone = (value: string) => value.replace(/\D/g, '');

const applySearch = (
  query: any,
  search: unknown,
  columns: string[]
) => {
  if (typeof search !== 'string' || !search.trim()) return query;
  const pattern = search.trim().replace(/[%_]/g, '');
  return query.or(columns.map((column) => `${column}.ilike.%${pattern}%`).join(','));
};

const stripCustomerSystemFields = (data: Entity): Entity => {
  const { points, total_spent, is_active, ...safeData } = data;
  void points;
  void total_spent;
  void is_active;
  return safeData;
};

// Customer phone numbers are write-only. Keep this mapper at the service
// boundary as a final guard even if a cached/legacy query contains `phone`.
const stripCustomerPhone = (customer: Entity): Entity => {
  const { phone: _phone, ...safeCustomer } = customer;
  void _phone;
  return safeCustomer;
};

export class CatalogService {
  /**
   * Đồng bộ cảnh báo tồn kho cho sản phẩm.
   * FIX: Xử lý TẤT CẢ active alerts (không chỉ latest) để ngăn duplicate.
   * Nếu stock đủ → resolve hết. Nếu thiếu → update alert đầu tiên, resolve các alert thừa.
   */
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

    // Lấy TẤT CẢ active alerts (không chỉ 1) để xử lý duplicate, đồng thời lấy cột status để nhận diện chuyển trạng thái
    const { data: activeAlerts } = await supabase
      .from('stock_alerts')
      .select('id, status')
      .eq('product_id', productId)
      .in('status', ['low_stock', 'out_of_stock'])
      .order('created_at', { ascending: false });

    const allActiveAlerts = activeAlerts || [];

    // Stock đã đủ → resolve TẤT CẢ active alerts
    if (!status) {
      if (allActiveAlerts.length > 0) {
        const ids = allActiveAlerts.map(a => a.id);
        await supabase
          .from('stock_alerts')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .in('id', ids);
      }
      return;
    }

    const payload = {
      product_id: productId,
      current_stock: currentStock,
      min_stock_level: minStock,
      status,
    };

    if (allActiveAlerts.length > 0) {
      const oldStatus = allActiveAlerts[0].status;

      // Update alert đầu tiên (mới nhất)
      await supabase.from('stock_alerts').update(payload).eq('id', allActiveAlerts[0].id);

      // Nếu trạng thái chuyển đổi (ví dụ từ low_stock thành out_of_stock), kích hoạt thông báo mới
      if (oldStatus !== status) {
        NotificationService.sendStockAlertNotification(
          productId,
          currentStock,
          minStock,
          status as 'low_stock' | 'out_of_stock'
        ).catch(err => console.error('[NotificationService Error]', err));
      }

      // Resolve các alert thừa (duplicate) nếu có
      if (allActiveAlerts.length > 1) {
        const duplicateIds = allActiveAlerts.slice(1).map(a => a.id);
        await supabase
          .from('stock_alerts')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .in('id', duplicateIds);
      }
    } else {
      // Không có alert nào → tạo mới
      await supabase.from('stock_alerts').insert(payload);

      // Kích hoạt gửi thông báo Telegram
      NotificationService.sendStockAlertNotification(
        productId,
        currentStock,
        minStock,
        status as 'low_stock' | 'out_of_stock'
      ).catch(err => console.error('[NotificationService Error]', err));
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
    const cacheKey = stableCacheKey('catalog:suppliers', queryParams);
    const cached = appCache.get<{ items: unknown[]; pagination: { page: number; limit: number; total: number } }>(cacheKey);
    if (cached) return cached;

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
    const result = { items: data || [], pagination: { page, limit, total: count || 0 } };
    appCache.set(cacheKey, result, 60_000);
    return result;
  }

  static async createSupplier(data: Entity) {
    const { data: created, error } = await supabase
      .from('suppliers')
      .insert(emptyToNull(data))
      .select('*')
      .single();
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix('catalog:suppliers');
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
    appCache.deletePrefix('catalog:suppliers');
    return updated;
  }

  static async deleteSupplier(id: string, hard?: boolean) {
    if (hard) {
      const [{ data: products }, { data: receipts }] = await Promise.all([
        supabase.from('products').select('id').eq('supplier_id', id).limit(1),
        supabase.from('goods_receipts').select('id').eq('supplier_id', id).limit(1),
      ]);

      if ((products && products.length > 0) || (receipts && receipts.length > 0)) {
        throw new AppError(400, 'Không thể xóa hoàn toàn nhà cung cấp này vì đã có sản phẩm hoặc phiếu nhập liên kết. Vui lòng chọn Ngưng hợp tác.');
      }

      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw new AppError(400, error.message);
      appCache.deletePrefix('catalog:suppliers');
      return { message: 'Đã xóa hoàn toàn nhà cung cấp khỏi hệ thống.' };
    }

    const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix('catalog:suppliers');
    return { message: 'Đã ngưng hợp tác với nhà cung cấp thành công.' };
  }

  static async listCustomers(queryParams: Query, currentUser?: JwtPayload) {
    const canViewContact = canManageCustomerData(currentUser);
    // The response shape differs by role, so the role must be part of the cache key.
    const cacheKey = stableCacheKey('catalog:customers', {
      ...queryParams,
      role: currentUser?.role || 'anonymous',
    });
    const cached = appCache.get<{ items: Entity[]; pagination: { page: number; limit: number; total: number } }>(cacheKey);
    if (cached) {
      return { ...cached, items: cached.items.map(stripCustomerPhone) };
    }

    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('customers')
      .select(canViewContact ? CUSTOMER_SAFE_SELECT : CUSTOMER_LIMITED_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applySearch(query, queryParams.search, ['name', 'email', 'address']);
    if (queryParams.is_active !== undefined) query = query.eq('is_active', queryParams.is_active === 'true');

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    const result = {
      items: (data || []).map((customer) => stripCustomerPhone(customer as unknown as Entity)),
      pagination: { page, limit, total: count || 0 },
    };
    appCache.set(cacheKey, result, 60_000);
    return result;
  }

  /**
   * POS lookup lets any selling role identify a loyalty customer by phone
   * without exposing the stored phone number or the customer directory.
   */
  static async lookupCustomerByPhone(phone: string, currentUser?: JwtPayload) {
    const search = phone.trim();
    if (!search) return null;

    const { data, error } = await supabase
      .from('customers')
      // Read the phone only inside the server to verify the POS lookup; never return it.
      .select('id, name, points, total_spent, is_active, phone')
      .ilike('phone', `%${search.replace(/[%_]/g, '')}%`)
      .eq('is_active', true)
      .limit(25);

    if (error) throw new AppError(500, error.message);

    const normalizedSearch = normalizePhone(search);
    const candidates = (data || []) as any[];
    const matched = candidates.find((customer) => normalizePhone(String(customer.phone || '')) === normalizedSearch);
    if (!matched) return null;

    return {
      id: matched.id,
      name: matched.name,
      points: matched.points,
      total_spent: matched.total_spent,
      is_active: matched.is_active,
    };
  }

  static async createCustomer(data: Entity) {
    const safeData = stripCustomerSystemFields(data);
    const { data: created, error } = await supabase
      .from('customers')
      .insert(emptyToNull(safeData))
      .select(CUSTOMER_SAFE_SELECT)
      .single();
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix('catalog:customers');
    return stripCustomerPhone(created as Entity);
  }

  static async updateCustomer(id: string, data: Entity) {
    const { phone, ...editableData } = stripCustomerSystemFields(data);
    // Admin/manager routes may replace the phone number, but it is still
    // excluded from every response by CUSTOMER_SAFE_SELECT/stripCustomerPhone.
    if (phone !== undefined) editableData.phone = phone;
    const { data: updated, error } = await supabase
      .from('customers')
      .update(emptyToNull(editableData))
      .eq('id', id)
      .select(CUSTOMER_SAFE_SELECT)
      .single();
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix('catalog:customers');
    return stripCustomerPhone(updated as Entity);
  }

  static async deleteCustomer(id: string) {
    const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', id);
    if (error) throw new AppError(400, error.message);
    appCache.deletePrefix('catalog:customers');
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
    // Exact-match cho scanner — tìm chính xác barcode/SKU, không phụ thuộc vào fuzzy search
    if (queryParams.barcode) query = query.eq('barcode', String(queryParams.barcode));
    if (queryParams.sku_exact) query = query.eq('sku', String(queryParams.sku_exact));
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
    const cleanedData = emptyToNull(data);
    const sku = cleanedData.sku as string | null;
    const barcode = cleanedData.barcode as string | null;

    // Dọn dẹp các sản phẩm đã xóa (inactive) còn trùng SKU hoặc barcode
    // Xử lý trường hợp soft-delete không đổi SKU được (RLS block silent)
    await this.cleanupInactiveConflicts(sku, barcode);

    const { data: created, error } = await supabase
      .from('products')
      .insert(cleanedData)
      .select('*')
      .single();
    if (error) this.handleDBError(error);
    await this.syncStockAlert(created.id);
    appCache.deletePrefix(PRODUCT_CACHE_PREFIX);
    return created;
  }

  /**
   * Trước khi tạo sản phẩm mới, tìm và giải phóng bất kỳ SP nào
   * (active hoặc inactive) đang chiếm SKU hoặc barcode trùng.
   * Xử lý trường hợp delete bị kẹt (FK block, RLS...) dẫn đến
   * product vẫn còn trong DB với SKU/barcode cũ.
   */
  private static async cleanupInactiveConflicts(sku: string | null, barcode: string | null) {
    if (!sku && !barcode) return;

    // Tìm TẤT CẢ SP (kể cả active) trùng SKU hoặc barcode
    // Dùng 2 query riêng để tránh vấn đề syntax với or() khi giá trị có ký tự đặc biệt
    const conflictIds = new Set<string>();

    const [bySkuRes, byBarcodeRes] = await Promise.all([
      sku ? supabase.from('products').select('id, is_active').eq('sku', sku) : Promise.resolve({ data: [] }),
      barcode ? supabase.from('products').select('id, is_active').eq('barcode', barcode) : Promise.resolve({ data: [] }),
    ]);

    bySkuRes.data?.forEach((p: any) => conflictIds.add(p.id));
    byBarcodeRes.data?.forEach((p: any) => conflictIds.add(p.id));

    if (conflictIds.size === 0) return;

    const ts = Date.now();
    let i = 0;
    for (const conflictId of conflictIds) {
      // Đổi SKU + null barcode để giải phóng (soft-free)
      // Không hard-delete vì có thể bị FK từ nhiều bảng khác
      await supabase.from('products').update({
        is_active: false,
        sku: `${sku ?? 'DEL'}_FREED_${ts}_${i++}`,
        barcode: null,
      }).eq('id', conflictId);
    }
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
      // Chạy song song thay vì tuần tự — giảm latency O(N) → O(1)
      await Promise.all(inserted.map((p) => this.syncStockAlert(p.id)));
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
    // Luôn soft-delete bằng UPDATE để tránh vi phạm FK constraint
    // từ stock_alerts, stock_transactions, product_batches, goods_receipt_items...
    // UPDATE không bao giờ bị FK constraint (chỉ thay đổi is_active, sku, barcode)
    const { data: product } = await supabase
      .from('products')
      .select('sku')
      .eq('id', id)
      .single();

    const deactivatedSku = product
      ? `${product.sku}_DEL_${Date.now()}`
      : `DELETED_${Date.now()}`;

    // Giải phóng SKU và barcode để có thể thêm lại sản phẩm tương tự
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
      'Hệ thống POS doanh nghiệp không cho xóa toàn bộ sản phẩm. Hãy dùng ngừng kinh doanh, import điều chỉnh, hoặc backup/restore có kiểm soát.'
    );
  }

  private static handleDBError(error: any): never {
    const msg = error.message || '';
    // SKU unique constraint (check both possible names)
    if (msg.includes('products_sku_key') || msg.includes('idx_products_sku_unique')) {
      throw new AppError(400, 'Mã SKU này đã tồn tại trong hệ thống. Vui lòng nhập mã khác.');
    }
    // Barcode unique constraint (check both possible names)
    if (msg.includes('products_barcode_key') || msg.includes('idx_products_barcode_unique')) {
      throw new AppError(400, 'Mã vạch (Barcode) này đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.');
    }
    if (msg.includes('categories_name_key')) {
      throw new AppError(400, 'Tên danh mục này đã tồn tại. Vui lòng nhập tên khác.');
    }
    throw new AppError(400, msg);
  }
}
