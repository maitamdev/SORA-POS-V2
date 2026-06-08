import { supabaseClient } from './supabase';
import { useNotificationStore } from '../stores/notification.store';
import { useAuthStore } from '../stores/auth.store';
import type { RealtimeChannel } from '@supabase/supabase-js';

/* ------------------------------------------------------------------ */
/*  Channels registry                                                  */
/* ------------------------------------------------------------------ */
let channels: RealtimeChannel[] = [];
let isSubscribed = false;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

function getUserRole(): string {
  return useAuthStore.getState().user?.role || 'cashier';
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || '';
}

/* ------------------------------------------------------------------ */
/*  Subscription: ORDERS                                               */
/* ------------------------------------------------------------------ */
function subscribeToOrders() {
  // INSERT — đơn hàng mới
  const insertChannel = supabaseClient
    .channel('orders-insert')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const role = getUserRole();
        const userId = getUserId();

        // Cashier không cần thông báo đơn do chính mình tạo
        if (role === 'cashier' && payload.new.user_id === userId) return;

        const orderNumber = payload.new.order_number || 'N/A';
        const finalAmount = payload.new.final_amount || 0;

        useNotificationStore.getState().addNotification(
          'order_new',
          'Đơn hàng mới',
          `#${orderNumber} — ${money(finalAmount)}`
        );
      }
    )
    .subscribe();

  // UPDATE — đơn hàng bị hủy
  const updateChannel = supabaseClient
    .channel('orders-cancel')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        // Chỉ thông báo khi status chuyển thành cancelled
        if (payload.new.status !== 'cancelled') return;
        if (payload.old.status === 'cancelled') return;

        const role = getUserRole();
        if (role === 'cashier') return; // Chỉ manager/admin cần biết

        const orderNumber = payload.new.order_number || 'N/A';

        useNotificationStore.getState().addNotification(
          'order_cancelled',
          'Đơn hàng bị hủy',
          `#${orderNumber} đã bị hủy`
        );
      }
    )
    .subscribe();

  channels.push(insertChannel, updateChannel);
}

/* ------------------------------------------------------------------ */
/*  Subscription: PRODUCTS (stock alerts)                              */
/* ------------------------------------------------------------------ */
function subscribeToProducts() {
  const channel = supabaseClient
    .channel('products-stock')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'products' },
      (payload) => {
        const oldStock = Number(payload.old.stock_quantity ?? Infinity);
        const newStock = Number(payload.new.stock_quantity ?? 0);
        const minStock = Number(payload.new.min_stock_level ?? 0);
        const productName = payload.new.name || 'Sản phẩm';

        // Chỉ thông báo khi tồn kho GIẢM
        if (newStock >= oldStock) return;

        // Hết hàng
        if (newStock === 0 && oldStock > 0) {
          useNotificationStore.getState().addNotification(
            'stock_out',
            'Hết hàng!',
            `${productName} đã hết hàng hoàn toàn`
          );
          return;
        }

        // Sắp hết hàng (vừa rơi xuống dưới mức tối thiểu)
        if (newStock > 0 && newStock <= minStock && oldStock > minStock) {
          useNotificationStore.getState().addNotification(
            'stock_low',
            'Tồn kho thấp',
            `${productName} chỉ còn ${newStock} (tối thiểu: ${minStock})`
          );
        }
      }
    )
    .subscribe();

  channels.push(channel);
}

/* ------------------------------------------------------------------ */
/*  Subscription: SHIFTS                                               */
/* ------------------------------------------------------------------ */
function subscribeToShifts() {
  const channel = supabaseClient
    .channel('shifts-checkin')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'shift_sessions' },
      (payload) => {
        const role = getUserRole();
        if (role === 'cashier') return; // Chỉ manager/admin cần biết

        // Chỉ thông báo khi trạng thái chuyển sang checked_in
        if (payload.new.status !== 'checked_in') return;
        if (payload.old.status === 'checked_in') return;

        const shiftCode = payload.new.shift_code || '';

        useNotificationStore.getState().addNotification(
          'shift_checkin',
          'Nhân viên nhận ca',
          `Ca ${shiftCode} đã được nhận`
        );
      }
    )
    .subscribe();

  channels.push(channel);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Bắt đầu lắng nghe Realtime từ Supabase.
 * Gọi 1 lần duy nhất khi MainLayout mount.
 */
export function startRealtimeSubscriptions(): void {
  if (isSubscribed) return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn('[Realtime] Chưa cấu hình VITE_SUPABASE_URL. Bỏ qua subscriptions.');
    return;
  }

  isSubscribed = true;

  subscribeToOrders();
  subscribeToProducts();
  subscribeToShifts();

  console.log('[Realtime] Đã đăng ký lắng nghe: orders, products, shifts');
}

/**
 * Hủy tất cả Realtime subscriptions.
 * Gọi khi logout hoặc unmount.
 */
export function stopRealtimeSubscriptions(): void {
  channels.forEach((channel) => {
    supabaseClient.removeChannel(channel);
  });
  channels = [];
  isSubscribed = false;
  console.log('[Realtime] Đã hủy tất cả subscriptions');
}
