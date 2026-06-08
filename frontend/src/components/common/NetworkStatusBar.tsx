import { useEffect, useState } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { HiOutlineStatusOffline, HiOutlineStatusOnline, HiOutlineCloudUpload } from 'react-icons/hi';

/**
 * NetworkStatusBar — Thanh trạng thái mạng nổi ở top.
 * - Khi offline: hiển thị cảnh báo vàng + số đơn chờ đồng bộ.
 * - Khi online trở lại: hiển thị thông báo xanh rồi tự ẩn sau 4 giây.
 * - Khi online bình thường: ẩn hoàn toàn.
 */
const NetworkStatusBar = () => {
  const { isOnline, pendingCount } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Theo dõi trạng thái chuyển đổi offline → online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline && isOnline) {
      // Vừa online trở lại
      setShowReconnected(true);
      setWasOffline(false);

      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Khi online bình thường và không có gì cần hiển thị → ẩn
  if (isOnline && !showReconnected && pendingCount === 0) {
    return null;
  }

  // --- Offline Banner ---
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] animate-slideDown">
        <div className="bg-amber-500 text-amber-950 px-4 py-2.5 flex items-center justify-center gap-3 text-xs font-black tracking-wide shadow-lg shadow-amber-500/20">
          <HiOutlineStatusOffline className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>
            ĐANG Ở CHẾ ĐỘ NGOẠI TUYẾN — Dữ liệu sẽ được đồng bộ khi có mạng
          </span>
          {pendingCount > 0 && (
            <span className="bg-amber-950 text-amber-100 px-2 py-0.5 text-[10px] font-black rounded-full">
              {pendingCount} đơn chờ
            </span>
          )}
        </div>
      </div>
    );
  }

  // --- Reconnected Banner (tự ẩn sau 4s) ---
  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] animate-slideDown">
        <div className="bg-emerald-500 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-xs font-black tracking-wide shadow-lg shadow-emerald-500/20">
          <HiOutlineStatusOnline className="w-4 h-4 flex-shrink-0" />
          <span>ĐÃ KẾT NỐI LẠI — Đang đồng bộ dữ liệu...</span>
          <HiOutlineCloudUpload className="w-4 h-4 flex-shrink-0 animate-bounce" />
        </div>
      </div>
    );
  }

  // --- Pending Orders Badge (online nhưng còn đơn chờ) ---
  if (pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100]">
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-3 text-xs font-black tracking-wide">
          <HiOutlineCloudUpload className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>
            Đang đồng bộ {pendingCount} đơn hàng offline lên hệ thống...
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default NetworkStatusBar;
