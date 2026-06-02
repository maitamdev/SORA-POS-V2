import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

/**
 * MainLayout - Layout chính sau khi đăng nhập
 * Sidebar (fixed, 256px) bên trái + Nội dung bên phải
 * Responsive: trên mobile sidebar ẩn, main content full width
 */
const MainLayout = () => {
  const location = useLocation();
  const isPosPage = location.pathname === '/pos';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - offset by sidebar width on desktop, full width on mobile */}
      <main className="lg:ml-64 min-h-screen transition-all duration-300">
        <div className={isPosPage ? "" : "p-3 sm:p-4 md:p-6 pt-14 lg:pt-6"}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
