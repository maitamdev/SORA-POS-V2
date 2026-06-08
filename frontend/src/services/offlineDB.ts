import Dexie, { type EntityTable } from 'dexie';
import type { Product, Category, Customer } from '../types/domain.type';
import type { CreateOrderPayload } from './order.api';

/* ------------------------------------------------------------------ */
/*  Offline pending order — đơn hàng tạo khi mất mạng                */
/* ------------------------------------------------------------------ */
export interface PendingOrder {
  /** Auto-increment local ID */
  id?: number;
  /** Mã hóa đơn tạm (OFF-xxxxxxxx) */
  offlineOrderNumber: string;
  /** Payload đúng chuẩn API /orders */
  payload: CreateOrderPayload;
  /** Tổng tiền sau giảm giá — dùng hiển thị UI */
  finalAmount: number;
  /** Phương thức thanh toán — dùng hiển thị UI */
  paymentMethod: string;
  /** Thời điểm tạo offline */
  createdAt: string;
  /** Trạng thái đồng bộ: pending | syncing | failed */
  syncStatus: 'pending' | 'syncing' | 'failed';
  /** Thông báo lỗi nếu đồng bộ thất bại */
  syncError?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Dexie Database Definition                                         */
/* ------------------------------------------------------------------ */
class SoraPosOfflineDB extends Dexie {
  products!: EntityTable<Product, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  pendingOrders!: EntityTable<PendingOrder, 'id'>;

  constructor() {
    super('sora-pos-offline');

    this.version(1).stores({
      // Indexes: id (PK) + barcode + sku + category_id — để tra cứu nhanh
      products: 'id, barcode, sku, category_id, name',
      categories: 'id, name',
      customers: 'id, phone, name',
      pendingOrders: '++id, syncStatus, createdAt',
    });
  }
}

export const offlineDB = new SoraPosOfflineDB();

/* ------------------------------------------------------------------ */
/*  Sync helpers — tải dữ liệu từ API xuống IndexedDB                */
/* ------------------------------------------------------------------ */
import { catalogAPI } from './catalog.api';

/**
 * Tải toàn bộ sản phẩm đang bán từ API rồi upsert vào IndexedDB.
 * Gọi khi online để chuẩn bị dữ liệu cho chế độ offline.
 */
export async function syncProductsToLocal(): Promise<number> {
  try {
    const response = await catalogAPI.products.list({
      is_active: true,
      limit: 10000,
    });
    const items = response.data.data.items;
    if (items.length > 0) {
      await offlineDB.products.clear();
      await offlineDB.products.bulkPut(items);
    }
    return items.length;
  } catch (err) {
    console.warn('[OfflineDB] Không thể đồng bộ sản phẩm:', err);
    return 0;
  }
}

/**
 * Tải toàn bộ danh mục từ API rồi upsert vào IndexedDB.
 */
export async function syncCategoriesToLocal(): Promise<number> {
  try {
    const response = await catalogAPI.categories.list({
      is_active: true,
      limit: 1000,
    });
    const items = response.data.data.items;
    if (items.length > 0) {
      await offlineDB.categories.clear();
      await offlineDB.categories.bulkPut(items);
    }
    return items.length;
  } catch (err) {
    console.warn('[OfflineDB] Không thể đồng bộ danh mục:', err);
    return 0;
  }
}

/**
 * Tải toàn bộ khách hàng từ API rồi upsert vào IndexedDB.
 */
export async function syncCustomersToLocal(): Promise<number> {
  try {
    const response = await catalogAPI.customers.list({
      is_active: true,
      limit: 10000,
    });
    const items = response.data.data.items;
    if (items.length > 0) {
      await offlineDB.customers.clear();
      await offlineDB.customers.bulkPut(items);
    }
    return items.length;
  } catch (err) {
    console.warn('[OfflineDB] Không thể đồng bộ khách hàng:', err);
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Query helpers — truy vấn dữ liệu offline từ IndexedDB            */
/* ------------------------------------------------------------------ */

/**
 * Truy vấn sản phẩm từ IndexedDB với tìm kiếm và lọc danh mục.
 */
export async function getProductsOffline(
  search?: string,
  categoryId?: string,
  page = 1,
  limit = 20
): Promise<{ items: Product[]; total: number }> {
  let collection = offlineDB.products.toCollection();

  // Lọc theo danh mục
  if (categoryId && categoryId !== 'all') {
    collection = offlineDB.products.where('category_id').equals(categoryId);
  }

  let allItems = await collection.toArray();

  // Tìm kiếm theo tên, sku, barcode
  if (search && search.trim()) {
    const keyword = search.trim().toLowerCase();
    allItems = allItems.filter(
      (p) =>
        p.name.toLowerCase().includes(keyword) ||
        p.sku.toLowerCase().includes(keyword) ||
        (p.barcode && p.barcode.toLowerCase().includes(keyword))
    );
  }

  // Sắp xếp mới nhất trước (giả lập server sort)
  allItems.sort((a, b) => (b.id > a.id ? 1 : -1));

  const total = allItems.length;
  const from = (page - 1) * limit;
  const items = allItems.slice(from, from + limit);

  return { items, total };
}

/**
 * Tra cứu sản phẩm theo mã vạch hoặc SKU từ IndexedDB.
 */
export async function getProductByBarcodeOffline(
  code: string
): Promise<Product | undefined> {
  const cleaned = code.trim();
  if (!cleaned) return undefined;

  // Tìm chính xác theo barcode
  let product = await offlineDB.products
    .where('barcode')
    .equals(cleaned)
    .first();
  if (product) return product;

  // Tìm chính xác theo SKU
  product = await offlineDB.products.where('sku').equals(cleaned).first();
  return product;
}

/**
 * Lấy toàn bộ danh mục từ IndexedDB.
 */
export async function getCategoriesOffline(): Promise<Category[]> {
  return offlineDB.categories.toArray();
}

/**
 * Lấy toàn bộ khách hàng từ IndexedDB.
 */
export async function getCustomersOffline(): Promise<Customer[]> {
  return offlineDB.customers.toArray();
}

/* ------------------------------------------------------------------ */
/*  Pending Orders — đơn hàng chờ đồng bộ                            */
/* ------------------------------------------------------------------ */

/** Tạo mã hóa đơn offline duy nhất */
function generateOfflineOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OFF-${timestamp}-${random}`;
}

/**
 * Lưu đơn hàng offline vào IndexedDB.
 * Trả về offlineOrderNumber để hiển thị trên hóa đơn.
 */
export async function savePendingOrder(
  payload: CreateOrderPayload,
  finalAmount: number,
  paymentMethod: string
): Promise<PendingOrder> {
  const order: PendingOrder = {
    offlineOrderNumber: generateOfflineOrderNumber(),
    payload,
    finalAmount,
    paymentMethod,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    syncError: null,
  };
  const id = await offlineDB.pendingOrders.add(order);
  return { ...order, id: id as number };
}

/**
 * Lấy danh sách đơn hàng chờ đồng bộ.
 */
export async function getPendingOrders(): Promise<PendingOrder[]> {
  return offlineDB.pendingOrders.toArray();
}

/**
 * Đếm số lượng đơn hàng chờ đồng bộ.
 */
export async function getPendingOrderCount(): Promise<number> {
  return offlineDB.pendingOrders.count();
}

/**
 * Xóa đơn hàng đã đồng bộ thành công khỏi IndexedDB.
 */
export async function removePendingOrder(id: number): Promise<void> {
  await offlineDB.pendingOrders.delete(id);
}

/**
 * Đánh dấu đơn hàng đang đồng bộ.
 */
export async function markOrderSyncing(id: number): Promise<void> {
  await offlineDB.pendingOrders.update(id, { syncStatus: 'syncing' });
}

/**
 * Đánh dấu đơn hàng đồng bộ thất bại.
 */
export async function markOrderFailed(
  id: number,
  error: string
): Promise<void> {
  await offlineDB.pendingOrders.update(id, {
    syncStatus: 'failed',
    syncError: error,
  });
}

/**
 * Trừ tồn kho local khi bán offline.
 * Cập nhật bản sao sản phẩm trong IndexedDB.
 */
export async function deductLocalStock(
  productId: string,
  quantity: number
): Promise<void> {
  const product = await offlineDB.products.get(productId);
  if (product) {
    const newStock = Math.max(product.stock_quantity - quantity, 0);
    await offlineDB.products.update(productId, { stock_quantity: newStock });
  }
}
