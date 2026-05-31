import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

/**
 * MainLayout - Layout chính sau khi đăng nhập
 * Sidebar (fixed, 256px) bên trái + Nội dung bên phải
 */
const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - offset by sidebar width */}
      <main className="ml-64 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
