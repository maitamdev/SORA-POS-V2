import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import NetworkStatusBar from '../common/NetworkStatusBar';
import { startAutoSync } from '../../services/offlineSync';
import { startRealtimeSubscriptions, stopRealtimeSubscriptions } from '../../services/realtimeService';

/**
 * PageTransitionLoader — Loading hiển thị khi lazy page đang load
 * Nhẹ hơn PageLoader ở App.tsx vì chỉ hiện trong content area
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
 * MainLayout - Layout chính sau khi đăng nhập
 * Sidebar (fixed, 256px) bên trái + Nội dung bên phải
 * Responsive: trên mobile sidebar ẩn, main content full width
 */
const MainLayout = () => {
  const location = useLocation();
  const isPosPage = location.pathname === '/pos';

  // Khởi chạy auto-sync + realtime subscriptions khi mount
  useEffect(() => {
    startAutoSync();
    startRealtimeSubscriptions();

    return () => {
      stopRealtimeSubscriptions();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Network Status Banner (offline/online) */}
      <NetworkStatusBar />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - offset by sidebar width on desktop, full width on mobile */}
      <main className="lg:ml-64 min-h-screen transition-all duration-300">
        <div className={isPosPage ? "" : "p-3 sm:p-4 md:p-6 pt-14 lg:pt-6"}>
          <Suspense fallback={<PageTransitionLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
