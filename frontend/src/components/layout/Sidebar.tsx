import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import {
  HiOutlineViewGrid,
  HiOutlineLogout,
  HiOutlineShoppingCart,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineClipboardList,
  HiOutlineClock,
  HiOutlineChartBar,
  HiOutlineTruck,
  HiOutlineUserGroup,
  HiOutlineIdentification,
  HiOutlineExclamationCircle,
  HiOutlineLightBulb,
  HiOutlineLightningBolt,
  HiOutlineCog,
  HiOutlineMenu,
  HiOutlineX,
} from 'react-icons/hi';
import NotificationCenter from '../common/NotificationCenter';

/**
 * Cấu trúc menu sidebar
 * icon: react-icons HiOutline series
 * roles: vai trò được phép thấy menu item
 */
const menuItems = [
  {
    label: 'Dashboard',
    icon: HiOutlineViewGrid,
    path: '/',
    roles: ['admin', 'manager'],
  },
  {
    label: 'Bán hàng (POS)',
    icon: HiOutlineShoppingCart,
    path: '/pos',
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Ca của tôi',
    icon: HiOutlineClock,
    path: '/my-shift',
    roles: ['cashier'],
  },
  {
    label: 'Sản phẩm',
    icon: HiOutlineCube,
    path: '/products',
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Danh mục',
    icon: HiOutlineTag,
    path: '/categories',
    roles: ['admin', 'manager'],
  },
  {
    label: 'Hóa đơn',
    icon: HiOutlineClipboardList,
    path: '/orders',
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Kho hàng',
    icon: HiOutlineTruck,
    path: '/stock',
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Khách hàng',
    icon: HiOutlineUserGroup,
    path: '/customers',
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Nhà cung cấp',
    icon: HiOutlineTruck,
    path: '/suppliers',
    roles: ['admin', 'manager'],
  },
  {
    label: 'Nhân viên',
    icon: HiOutlineIdentification,
    path: '/staff',
    roles: ['admin', 'manager'],
  },
  {
    label: 'Ca làm',
    icon: HiOutlineClock,
    path: '/shifts',
    roles: ['admin', 'manager'],
  },
  {
    label: 'Báo cáo',
    icon: HiOutlineChartBar,
    path: '/reports',
    roles: ['admin', 'manager'],
  },
  {
    label: 'Audit log',
    icon: HiOutlineClipboardList,
    path: '/audit-logs',
    roles: ['admin', 'manager'],
  },
  {
    label: 'AI Gợi ý',
    icon: HiOutlineLightBulb,
    path: '/ai',
    roles: ['admin', 'manager'],
  },
  {
    label: 'Cài đặt',
    icon: HiOutlineCog,
    path: '/settings',
    roles: ['admin'],
  },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Lọc menu theo role
  const filteredMenu = menuItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      logout();
    }
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/40">
        <div className="flex items-center gap-2.5 flex-1">
          <img
            src="/assets/logo.png"
            alt="Sora POS Logo"
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="text-white font-black text-sm tracking-tight leading-none">Sora POS</h1>
            <p className="text-slate-500 text-[10px] font-semibold mt-0.5 uppercase tracking-wider">Quản lý bán hàng</p>
          </div>
        </div>
        {/* Notification Bell */}
        <NotificationCenter />
        {/* Close button for mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors ml-1"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="space-y-1">
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : item.path === '/stock'
                  ? location.pathname === '/stock'
                  : location.pathname.startsWith(item.path);

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-xs font-bold tracking-wide uppercase">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info + Logout */}
      <div className="border-t border-slate-800/40 p-4 bg-[#090d19]/80">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all duration-200"
        >
          <HiOutlineLogout className="w-3.5 h-3.5" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button - shown only on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-[60] w-10 h-10 bg-[#070a13] text-white rounded-xl flex items-center justify-center shadow-lg border border-slate-700/50 hover:bg-slate-800 transition-colors"
        aria-label="Mở menu"
      >
        <HiOutlineMenu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop: fixed visible, mobile: slide-in */}
      <aside
        className={`
          w-64 h-screen bg-[#070a13] flex flex-col fixed left-0 top-0 border-r border-slate-800/40
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:z-50
          ${mobileOpen ? 'translate-x-0 z-[80]' : '-translate-x-full z-[80]'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
