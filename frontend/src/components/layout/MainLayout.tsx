import { memo, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import NetworkStatusBar from '../common/NetworkStatusBar';
import { startAutoSync, stopAutoSync } from '../../services/offlineSync';
import { startRealtimeSubscriptions, stopRealtimeSubscriptions } from '../../services/realtimeService';
import { useAuthStore } from '../../stores/auth.store';
import { HiOutlineCalendar } from 'react-icons/hi';

/**
 * PageTransitionLoader — Loading hiển thị khi lazy page đang load
 */
const PageTransitionLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="text-center space-y-3">
      <div className="w-8 h-8 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
      <p className="text-xs font-medium text-slate-400">Đang tải trang...</p>
    </div>
  </div>
);

/**
 * LiveClock — Component đồng hồ tách riêng để isolate re-render mỗi giây
 * Chỉ component này re-render mỗi 1s, KHÔNG lan ra TopHeader
 */
const LiveClock = memo(() => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('vi-VN', { hour12: false });

  return (
    <div className="flex items-center gap-2 bg-slate-950 text-white rounded-xl px-3 py-1.5 text-[11px] font-black shadow-sm select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="font-mono tracking-wider">{formattedTime}</span>
    </div>
  );
});
LiveClock.displayName = 'LiveClock';

/**
 * TopHeader — Thanh trạng thái hiển thị ngày, giờ, tài khoản toàn cục
 */
const TopHeader = () => {
  const { user } = useAuthStore();

  const getDisplayDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getUserInitials = (user: any) => {
    if (!user?.full_name) return 'U';
    const parts = user.full_name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return user.full_name.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = (role?: string) => {
    if (role === 'admin') return 'Quản trị viên';
    if (role === 'manager') return 'Quản lý';
    return 'Nhân viên';
  };

  return (
    <header className="bg-white border-b border-slate-200/80 h-14 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Left: Empty spacer (hamburger sits on top of this on mobile) */}
      <div className="w-10 h-10 lg:hidden shrink-0" />

      {/* Right: Date, Time & Profile Info */}
      <div className="flex items-center gap-2 sm:gap-3.5 ml-auto">
        {/* Date Display */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 text-[11px] font-black text-slate-600 shadow-xs select-none">
          <HiOutlineCalendar className="w-4 h-4 text-slate-400" />
          <span>{getDisplayDate()}</span>
        </div>

        {/* Real-time Clock — isolated re-render */}
        <LiveClock />
      </div>
    </header>
  );
};

/**
 * MainLayout - Layout chính sau khi đăng nhập
 */
const MainLayout = () => {
  const location = useLocation();
  const isPosPage = location.pathname === '/pos';

  // Khởi chạy auto-sync + realtime subscriptions khi mount
  useEffect(() => {
    startAutoSync();
    startRealtimeSubscriptions();

    return () => {
      stopAutoSync();
      stopRealtimeSubscriptions();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Network Status Banner (offline/online) */}
      <NetworkStatusBar />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - offset by sidebar width on desktop, full width on mobile */}
      <main className="flex-1 min-w-0 lg:ml-64 min-h-screen transition-all duration-300 flex flex-col">
        {!isPosPage && <TopHeader />}
        <div className={isPosPage ? "" : "flex-1 p-3 sm:p-4 md:p-6"}>
          <Suspense fallback={<PageTransitionLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
