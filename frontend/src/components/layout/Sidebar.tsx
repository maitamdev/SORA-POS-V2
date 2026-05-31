import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import {
  HiOutlineViewGrid,
  HiOutlineLogout,
  HiOutlineShoppingCart,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineClipboardList,
  HiOutlineChartBar,
  HiOutlineTruck,
  HiOutlineUserGroup,
  HiOutlineExclamationCircle,
  HiOutlineLightBulb,
  HiOutlineCog,
} from 'react-icons/hi';

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
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Bán hàng (POS)',
    icon: HiOutlineShoppingCart,
    path: '/pos',
    roles: ['admin', 'manager', 'cashier'],
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
    roles: ['admin', 'manager'],
  },
  {
    label: 'Cảnh báo tồn kho',
    icon: HiOutlineExclamationCircle,
    path: '/stock/alerts',
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Khách hàng',
    icon: HiOutlineUserGroup,
    path: '/customers',
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    label: 'Báo cáo',
    icon: HiOutlineChartBar,
    path: '/reports',
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

  // Lọc menu theo role
  const filteredMenu = menuItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  // Role label
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Quản trị viên';
      case 'manager': return 'Quản lý';
      case 'cashier': return 'Thu ngân';
      default: return role;
    }
  };

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      logout();
    }
  };

  return (
    <aside className="w-64 h-screen bg-sidebar-bg flex flex-col fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Sora POS</h1>
            <p className="text-slate-500 text-xs mt-0.5">Quản lý bán hàng</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu chính</p>
        </div>
        <ul className="space-y-0.5">
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info + Logout */}
      <div className="border-t border-slate-700/50 p-4">
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <div className="w-10 h-10 bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">
              {user?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user?.full_name || 'User'}
            </p>
            <p className="text-slate-500 text-xs truncate">
              {user ? getRoleLabel(user.role) : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all duration-200"
        >
          <HiOutlineLogout className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
