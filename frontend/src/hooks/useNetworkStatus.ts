import { useState, useEffect, useCallback } from 'react';
import { getPendingOrderCount } from '../services/offlineDB';

/**
 * Custom hook theo dõi trạng thái kết nối mạng real-time.
 * 
 * @returns isOnline - true nếu có mạng, false nếu mất mạng
 * @returns pendingCount - số đơn hàng đang chờ đồng bộ
 * @returns refreshPendingCount - hàm refresh lại số đơn pending
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingOrderCount();
      setPendingCount(count);
    } catch {
      // IndexedDB chưa sẵn sàng
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Refresh pending count lúc mount + mỗi khi online status thay đổi
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount]);

  // Poll pending count mỗi 5 giây (để bắt khi có đơn mới hoặc sync xong)
  useEffect(() => {
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return { isOnline, pendingCount, refreshPendingCount };
}
