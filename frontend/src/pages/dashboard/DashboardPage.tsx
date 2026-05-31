import { useAuthStore } from '../../stores/auth.store';
import {
  HiOutlineCash,
  HiOutlineShoppingCart,
  HiOutlineCube,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';

const DashboardPage = () => {
  const { user } = useAuthStore();

  // Placeholder stats
  const stats = [
    {
      label: 'Doanh thu hôm nay',
      value: '0 ₫',
      icon: HiOutlineCash,
      color: 'bg-emerald-50 text-emerald-600',
      iconBg: 'bg-emerald-100',
    },
    {
      label: 'Đơn hàng',
      value: '0',
      icon: HiOutlineShoppingCart,
      color: 'bg-blue-50 text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      label: 'Sản phẩm',
      value: '0',
      icon: HiOutlineCube,
      color: 'bg-violet-50 text-violet-600',
      iconBg: 'bg-violet-100',
    },
    {
      label: 'Cảnh báo tồn kho',
      value: '0',
      icon: HiOutlineExclamationCircle,
      color: 'bg-amber-50 text-amber-600',
      iconBg: 'bg-amber-100',
    },
  ];

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Quản trị viên';
      case 'manager': return 'Quản lý';
      case 'cashier': return 'Thu ngân';
      default: return role;
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Xin chào, {user?.full_name || 'User'} 👋
        </h1>
        <p className="text-slate-500 mt-1">
          Vai trò: <span className="font-medium text-primary-600">{user ? getRoleLabel(user.role) : ''}</span>
          {' · '}
          Chào mừng bạn quay trở lại Sora POS
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white border border-slate-200 p-5 hover:shadow-md transition-shadow duration-200 animate-fadeIn"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color.split(' ')[1]}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart placeholder */}
        <div className="bg-white border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">📈 Biểu đồ doanh thu</h3>
          <div className="h-64 flex items-center justify-center bg-slate-50 border border-dashed border-slate-300">
            <div className="text-center">
              <p className="text-4xl mb-2">📊</p>
              <p className="text-slate-400 text-sm">Biểu đồ sẽ hiển thị ở tuần sau</p>
              <p className="text-slate-300 text-xs mt-1">Khi có dữ liệu đơn hàng</p>
            </div>
          </div>
        </div>

        {/* Top products placeholder */}
        <div className="bg-white border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">🏆 Top sản phẩm bán chạy</h3>
          <div className="h-64 flex items-center justify-center bg-slate-50 border border-dashed border-slate-300">
            <div className="text-center">
              <p className="text-4xl mb-2">🛍️</p>
              <p className="text-slate-400 text-sm">Chưa có dữ liệu sản phẩm</p>
              <p className="text-slate-300 text-xs mt-1">Thêm sản phẩm ở tuần sau</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 bg-white border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">⚡ Thao tác nhanh</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '🛒', label: 'Bán hàng', desc: 'Tuần 5' },
            { icon: '📦', label: 'Nhập kho', desc: 'Tuần 6' },
            { icon: '➕', label: 'Thêm SP', desc: 'Tuần 3' },
            { icon: '📋', label: 'Báo cáo', desc: 'Tuần 8' },
          ].map((action, i) => (
            <button
              key={i}
              className="p-4 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-center group"
              disabled
            >
              <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">{action.icon}</span>
              <p className="text-sm font-medium text-slate-700">{action.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">Sẵn sàng: {action.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
