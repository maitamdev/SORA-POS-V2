import toast from 'react-hot-toast';
import {
  syncProductsToLocal,
  syncCategoriesToLocal,
  syncCustomersToLocal,
  getPendingOrders,
  markOrderSyncing,
  markOrderFailed,
  removePendingOrder,
} from './offlineDB';
import { orderAPI } from './order.api';

/* ------------------------------------------------------------------ */
/*  syncAllDataToLocal — Tải tất cả dữ liệu cần thiết xuống local   */
/* ------------------------------------------------------------------ */
let isSyncing = false;

/**
 * Tải products, categories, customers từ API xuống IndexedDB.
 * Gọi 1 lần sau khi đăng nhập thành công hoặc khi app khởi động online.
 */
export async function syncAllDataToLocal(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const [productCount, categoryCount, customerCount] = await Promise.all([
      syncProductsToLocal(),
      syncCategoriesToLocal(),
      syncCustomersToLocal(),
    ]);
    console.log(
      `[OfflineSync] Đã đồng bộ: ${productCount} sản phẩm, ${categoryCount} danh mục, ${customerCount} khách hàng`
    );
  } catch (err) {
    console.warn('[OfflineSync] Lỗi đồng bộ dữ liệu xuống local:', err);
  } finally {
    isSyncing = false;
  }
}

/* ------------------------------------------------------------------ */
/*  syncPendingOrdersToServer — Đẩy đơn hàng offline lên server      */
/* ------------------------------------------------------------------ */
let isSyncingOrders = false;

/**
 * Đọc tất cả đơn hàng chờ trong IndexedDB và gửi lần lượt lên API.
 * Đơn thành công → xóa khỏi IndexedDB.
 * Đơn thất bại → đánh dấu 'failed' kèm thông báo lỗi.
 */
export async function syncPendingOrdersToServer(): Promise<{
  synced: number;
  failed: number;
}> {
  if (isSyncingOrders) return { synced: 0, failed: 0 };
  isSyncingOrders = true;

  let synced = 0;
  let failed = 0;

  try {
    const pendingOrders = await getPendingOrders();
    const ordersToSync = pendingOrders.filter(
      (o) => o.syncStatus === 'pending' || o.syncStatus === 'failed'
    );

    if (ordersToSync.length === 0) return { synced: 0, failed: 0 };

    console.log(
      `[OfflineSync] Bắt đầu đồng bộ ${ordersToSync.length} đơn hàng offline...`
    );

    for (const order of ordersToSync) {
      if (!order.id) continue;

      try {
        await markOrderSyncing(order.id);
        await orderAPI.create(order.payload);
        await removePendingOrder(order.id);
        synced++;
        console.log(
          `[OfflineSync] ✓ Đồng bộ thành công: ${order.offlineOrderNumber}`
        );
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Lỗi không xác định khi đồng bộ';
        await markOrderFailed(order.id, errorMessage);
        failed++;
        console.error(
          `[OfflineSync] ✗ Lỗi đồng bộ ${order.offlineOrderNumber}:`,
          errorMessage
        );
      }
    }

    if (synced > 0) {
      toast.success(`Đã đồng bộ ${synced} đơn hàng offline lên hệ thống`, {
        duration: 5000,
        id: 'offline-sync-success',
      });
    }
    if (failed > 0) {
      toast.error(
        `${failed} đơn hàng offline đồng bộ thất bại, vui lòng kiểm tra`,
        {
          duration: 8000,
          id: 'offline-sync-failed',
        }
      );
    }
  } catch (err) {
    console.error('[OfflineSync] Lỗi nghiêm trọng khi đồng bộ đơn hàng:', err);
  } finally {
    isSyncingOrders = false;
  }

  return { synced, failed };
}

/* ------------------------------------------------------------------ */
/*  Auto Sync — tự động đồng bộ khi có mạng trở lại                  */
/* ------------------------------------------------------------------ */
let autoSyncRegistered = false;

/**
 * Đăng ký lắng nghe sự kiện online/offline để tự động đồng bộ.
 * Chỉ gọi 1 lần duy nhất khi app mount.
 */
export function startAutoSync(): void {
  if (autoSyncRegistered) return;
  autoSyncRegistered = true;

  const handleOnline = async () => {
    console.log('[OfflineSync] Đã kết nối lại internet — bắt đầu đồng bộ...');

    // 1. Đồng bộ đơn hàng offline lên server trước
    await syncPendingOrdersToServer();

    // 2. Tải dữ liệu mới nhất từ server xuống local
    await syncAllDataToLocal();
  };

  window.addEventListener('online', handleOnline);

  // Nếu hiện tại đang online, thử đồng bộ đơn hàng pending ngay
  if (navigator.onLine) {
    syncPendingOrdersToServer().catch(() => {});
  }

  console.log('[OfflineSync] Auto-sync đã được đăng ký');
}
