import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  FiCalendar, FiFilter, FiRefreshCw, FiDollarSign, FiUser, FiX, 
  FiEye, FiTrash2, FiFileText, FiShoppingBag, FiTrendingUp, FiCheck,
  FiAlertCircle, FiChevronRight, FiClock, FiTag
} from 'react-icons/fi';
import { orderAPI } from '../../services/order.api';
import { Order } from '../../types/domain.type';

const money = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const statusColors = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-250',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-250',
};

const statusLabels = {
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy đơn',
};

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Bộ lọc ngày tháng và trạng thái
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await orderAPI.list(params);
      setOrders(response.data.data.items);
    } catch {
      toast.error('Không tải được danh sách hóa đơn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [dateFrom, dateTo, statusFilter]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await orderAPI.get(id);
      setSelected(response.data.data);
    } catch {
      toast.error('Không tải được chi tiết hóa đơn');
    } finally {
      setDetailLoading(false);
    }
  };

  const cancel = async (order: Order) => {
    if (!window.confirm(`Hủy hóa đơn ${order.order_number} và hoàn trả lại số lượng tồn kho?`)) return;
    try {
      await orderAPI.cancel(order.id, 'Hủy từ giao diện quản lý hóa đơn');
      toast.success('Đã hủy hóa đơn thành công');
      await loadOrders();
      setSelected(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Hủy hóa đơn thất bại');
    }
  };

  // Tính toán KPIs
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const completedOrders = orders.filter(o => o.status === 'completed');
    const cancelledCount = orders.filter(o => o.status === 'cancelled').length;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
    const aov = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    return { totalCount, cancelledCount, totalRevenue, aov };
  }, [orders]);

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-50 text-blue-600 border-blue-100',
      'bg-indigo-50 text-indigo-600 border-indigo-100',
      'bg-purple-50 text-purple-600 border-purple-100',
      'bg-teal-50 text-teal-600 border-teal-100',
      'bg-emerald-50 text-emerald-600 border-emerald-100',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string) => {
    if (!name) return 'KL';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 1. Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-150 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FiFileText className="text-blue-600" />
            Quản lý Hóa đơn
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Tra cứu lịch sử đơn hàng, xem chi tiết hóa đơn bán lẻ và quản lý hủy đơn hoàn kho từ POS.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={loadOrders}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-slate-700 transition-all duration-200 shadow-sm"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={15} />
            Làm mới dữ liệu
          </button>
        </div>
      </header>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Metric 1: Tổng doanh thu */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50/65 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiDollarSign size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Doanh thu thực tế</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{money(stats.totalRevenue)}</h4>
          </div>
        </div>

        {/* Metric 2: Tổng số đơn */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50/65 border border-blue-100/50 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiShoppingBag size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tổng số đơn hàng</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.totalCount}</h4>
          </div>
        </div>

        {/* Metric 3: Đơn đã hủy */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${
            stats.cancelledCount > 0 
              ? 'bg-rose-50 border border-rose-100 text-rose-600' 
              : 'bg-slate-50 border border-slate-100 text-slate-400'
          }`}>
            <FiAlertCircle size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Hóa đơn đã hủy</p>
            <h4 className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight ${stats.cancelledCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{stats.cancelledCount}</h4>
          </div>
        </div>

        {/* Metric 4: AOV */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50/65 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiTrendingUp size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Giá trị trung bình đơn</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{money(stats.aov)}</h4>
          </div>
        </div>
      </div>

      {/* 3. Filter Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2">
        {/* Quick Filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase tracking-wider">Trạng thái:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
              statusFilter === 'completed'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Đã hoàn thành
          </button>
          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
              statusFilter === 'cancelled'
                ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Đã hủy
          </button>
        </div>

        {/* Date Inputs */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 shadow-xs">
            <FiCalendar className="text-slate-400" />
            <span className="text-slate-400">Từ</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer"
            />
            <span className="text-slate-400">Đến</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer"
            />
          </div>

          {(dateFrom || dateTo || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setStatusFilter('all');
              }}
              className="h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-500 transition"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* 4. Table view */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-55/65 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-5 py-4">Mã hóa đơn</th>
                <th className="px-5 py-4">Khách hàng</th>
                <th className="px-5 py-4 text-right">Tổng thanh toán</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4">Thời gian mua</th>
                <th className="px-5 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold">
                    <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={18} />
                    Đang tải danh sách hóa đơn...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold">
                    <FiFileText className="inline mb-2 text-slate-350 block mx-auto" size={32} />
                    Không tìm thấy hóa đơn nào phù hợp.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const status = (order.status || 'completed') as 'completed' | 'cancelled';
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition duration-150">
                      {/* Order Number */}
                      <td className="px-5 py-4">
                        <span className="font-black text-slate-900 font-mono tracking-tight bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/40 text-xs">
                          {order.order_number}
                        </span>
                      </td>
                      {/* Customer Info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-black shrink-0 shadow-inner ${getAvatarColor(order.customers?.name || 'Khách lẻ')}`}>
                            {getInitials(order.customers?.name || 'Khách lẻ')}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 leading-tight">
                              {order.customers?.name || 'Khách lẻ'}
                            </p>
                            {order.customers?.phone && (
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{order.customers.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Total Amount */}
                      <td className="px-5 py-4 text-right font-black text-slate-900 font-mono text-base">
                        {money(order.final_amount)}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-black ${statusColors[status] || 'bg-slate-50 text-slate-600'}`}>
                          {statusLabels[status] || order.status}
                        </span>
                      </td>
                      {/* Created At */}
                      <td className="px-5 py-4 text-slate-400 font-medium">
                        {formatDate(order.created_at)}
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openDetail(order.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs"
                            title="Xem chi tiết hóa đơn"
                          >
                            <FiEye size={14} />
                          </button>
                          {order.status !== 'cancelled' && (
                            <button
                              onClick={() => cancel(order)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all shadow-xs"
                              title="Hủy đơn hàng"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Drawer Chi tiết Hóa đơn (Thermal Receipt style) */}
      {selected && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setSelected(null)} 
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md transform bg-white shadow-2xl transition duration-500 ease-in-out border-l border-slate-100 flex flex-col h-full animate-slideLeft">
                
                {/* Drawer Header */}
                <div className="bg-slate-950 px-5 py-5 text-white flex items-center justify-between shadow-md shrink-0">
                  <div>
                    <h2 className="text-base font-black flex items-center gap-2 text-white">
                      <FiFileText className="text-blue-500" size={18} />
                      Chi tiết Hóa đơn
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-400 font-semibold font-mono">
                      Số: {selected.order_number}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelected(null)}
                    className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <FiX size={16} />
                  </button>
                </div>

                {/* Drawer Body - Scrollable Thermal Receipt style */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                  {detailLoading ? (
                    <div className="py-20 text-center text-slate-400 font-semibold">
                      <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={16} />
                      Đang lấy chi tiết...
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5 relative overflow-hidden">
                      {/* Top decoration (Receipt design) */}
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                      
                      {/* Logo and Store Name */}
                      <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-200">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">SORA POS</h3>
                        <p className="text-[10px] text-slate-400 font-bold">HÓA ĐƠN BÁN LẺ</p>
                        <div className="flex justify-center items-center gap-1.5 text-xs text-slate-500 font-semibold mt-1">
                          <FiClock size={12} />
                          {formatDate(selected.created_at)}
                        </div>
                      </div>

                      {/* Receipt Metadata */}
                      <div className="space-y-2 text-xs font-semibold text-slate-600 pb-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Khách hàng:</span>
                          <span className="text-slate-800 font-extrabold">{selected.customers?.name || 'Khách lẻ'}</span>
                        </div>
                        {selected.customers?.phone && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Số điện thoại:</span>
                            <span className="text-slate-800 font-extrabold">{selected.customers.phone}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Trạng thái đơn:</span>
                          <span className={`font-black uppercase ${selected.status === 'completed' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {selected.status === 'completed' ? 'Thành công' : 'Đã hủy'}
                          </span>
                        </div>
                        {selected.note && (
                          <div className="pt-2 border-t border-slate-100/50">
                            <p className="text-slate-400 mb-0.5">Ghi chú:</p>
                            <p className="text-slate-700 leading-relaxed font-semibold italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                              "{selected.note}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Products List */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">Danh sách hàng hóa</p>
                        <div className="divide-y divide-slate-100">
                          {selected.order_details?.map((item) => (
                            <div key={item.id} className="py-2.5 flex justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-800 leading-tight truncate">{item.product_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 font-mono">
                                  {item.quantity} x {money(item.unit_price)}
                                </p>
                              </div>
                              <p className="font-black text-slate-900 font-mono text-right shrink-0">{money(item.subtotal)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bill Summary */}
                      <div className="border-t border-dashed border-slate-200 pt-4 space-y-2 text-xs font-semibold text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tổng tiền hàng:</span>
                          <span className="font-bold text-slate-800 font-mono">{money(selected.total_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Chiết khấu / Giảm giá:</span>
                          <span className="font-bold text-rose-600 font-mono">-{money(selected.discount_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                          <span className="font-black text-slate-800">Thanh toán thực tế:</span>
                          <span className="font-black text-slate-900 text-base font-mono">{money(selected.final_amount)}</span>
                        </div>
                      </div>

                      {/* Footer decorative text */}
                      <div className="text-center text-[10px] text-slate-400 font-semibold border-t border-slate-100 pt-4 pb-1">
                        <p>Cảm ơn quý khách và hẹn gặp lại!</p>
                        <p className="mt-0.5 font-mono text-[9px] text-slate-300">Sora POS System v2.0</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Drawer Footer Actions */}
                {selected && selected.status !== 'cancelled' && (
                  <div className="p-4 border-t border-slate-150/40 bg-white shrink-0">
                    <button
                      onClick={() => cancel(selected)}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-sm font-black text-white transition-all shadow-[0_4px_12px_rgba(225,29,72,0.2)]"
                    >
                      <FiTrash2 size={16} />
                      Yêu cầu hủy hóa đơn này
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
