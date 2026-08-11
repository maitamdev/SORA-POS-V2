import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  FiCalendar, FiRefreshCw, FiUser, FiX,
  FiEye, FiTrash2, FiFileText, FiCheck,
  FiAlertCircle, FiClock, FiSearch, FiCreditCard,
  FiCheckCircle, FiMail, FiPackage, FiPhone
} from 'react-icons/fi';
import { orderAPI } from '../../services/order.api';
import { Order } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';

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

const formatOrderTime = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
};

const statusColors = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const statusLabels = {
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy đơn',
};

const getPaymentMethod = (order: Order) => {
  const method = order.payments?.[0]?.method;
  if (method === 'cash') return 'cash';
  if (method === 'card') return 'card';
  if (method === 'transfer' || method === 'momo' || method === 'zalopay') return 'transfer';
  return 'unknown';
};

const paymentLabels = {
  cash: 'Tiền mặt',
  card: 'Thẻ ngân hàng',
  transfer: 'Chuyển khoản',
  unknown: 'Chưa xác định',
};

const paymentStyles = {
  cash: 'bg-sky-50 text-sky-700 border-sky-100',
  card: 'bg-violet-50 text-violet-700 border-violet-100',
  transfer: 'bg-blue-50 text-blue-700 border-blue-100',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
};

const OrdersPage = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Bộ lọc ngày tháng và trạng thái
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Phân trang (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 1000 };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await orderAPI.list(params);
      setOrders(response.data.data.items);
      setCurrentPage(1);
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
      const ord = response.data.data;
      setSelected(ord);
      setEmailInput(ord.customers?.email || '');
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
    const cashCount = completedOrders.filter((order) => getPaymentMethod(order) === 'cash').length;
    const transferCount = completedOrders.filter((order) => getPaymentMethod(order) === 'transfer').length;
    const todayKey = new Date().toLocaleDateString('en-CA');
    const todayCount = orders.filter((order) => new Date(order.created_at).toLocaleDateString('en-CA') === todayKey).length;

    return { totalCount, cancelledCount, totalRevenue, aov, cashCount, transferCount, todayCount };
  }, [orders]);

  // Tính toán phân trang
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi-VN');
    if (!query) return orders;
    return orders.filter((order) => [
      order.order_number,
      order.customers?.name,
      order.customers?.phone,
      order.users?.full_name,
    ].some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(query)));
  }, [orders, searchQuery]);

  const indexOfLastOrder = currentPage * itemsPerPage;
  const indexOfFirstOrder = indexOfLastOrder - itemsPerPage;
  const paginatedOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const itemsStart = filteredOrders.length === 0 ? 0 : indexOfFirstOrder + 1;
  const itemsEnd = Math.min(indexOfLastOrder, filteredOrders.length);

  const renderPaginationControls = () => {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition disabled:opacity-40 disabled:hover:bg-white active:scale-95 duration-150 shadow-xs"
        >
          &lt;
        </button>
        {Array.from({ length: totalPages }).map((_, index) => {
          const pNum = index + 1;
          if (Math.abs(pNum - currentPage) <= 1 || pNum === 1 || pNum === totalPages) {
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => setCurrentPage(pNum)}
                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition text-xs font-bold active:scale-95 duration-150 ${
                  currentPage === pNum
                    ? 'bg-emerald-600 border-emerald-600 text-white font-extrabold shadow-sm shadow-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-650 hover:bg-slate-50'
                }`}
              >
                {pNum}
              </button>
            );
          }
          if (pNum === 2 || pNum === totalPages - 1) {
            return (
              <span key={pNum} className="px-1 text-slate-400 text-xs font-bold">
                ...
              </span>
            );
          }
          return null;
        })}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
          className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition disabled:opacity-40 disabled:hover:bg-white active:scale-95 duration-150 shadow-xs"
        >
          &gt;
        </button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 animate-fadeIn pb-10">
      {/* 1. Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-[30px] font-black text-slate-950 tracking-tight flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center bg-blue-50 text-blue-600">
              <FiFileText size={19} />
            </span>
            Quản lý Hóa đơn
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">
            Tra cứu lịch sử đơn hàng, xem chi tiết hóa đơn bán lẻ và quản lý hủy đơn hoàn kho từ POS.
          </p>
          {user?.role === 'cashier' && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-750 text-[11px] font-bold rounded-xl border border-blue-100/60">
              <FiAlertCircle className="text-blue-500" />
              Bạn đang xem các hóa đơn trong ngày hôm nay do chính bạn thực hiện.
            </div>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={loadOrders}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 border border-blue-600 bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white transition-all duration-200 shadow-sm active:scale-[0.98]"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={15} />
            Làm mới dữ liệu
          </button>
        </div>
      </header>

      {/* 2. KPI Cards */}
      {user?.role !== 'cashier' && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {/* Metric 1: Tổng doanh thu */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50/65 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiFileText size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tổng hóa đơn</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.totalCount}</h4>
          </div>
        </div>

        {/* Metric 2: Tổng số đơn */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50/65 border border-blue-100/50 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiCheck size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Thanh toán tiền mặt</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.cashCount}</h4>
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
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Hóa đơn đã hủy</p>
            <h4 className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight ${stats.cancelledCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{stats.cancelledCount}</h4>
          </div>
        </div>

        {/* Metric 4: AOV */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50/65 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiCreditCard size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Thanh toán chuyển khoản</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.transferCount}</h4>
          </div>
        </div>

        {/* Metric 5: Hóa đơn hôm nay */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50/70 border border-sky-100/60 flex items-center justify-center text-sky-600 shrink-0">
            <FiCalendar size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Hóa đơn hôm nay</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.todayCount}</h4>
          </div>
        </div>
      </div>
      )}

      {/* 3. Filter Section */}
      <div className="space-y-3 border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_180px_auto_auto_auto]">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Tìm mã hóa đơn, tên khách hàng..."
              className="h-10 w-full border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          >
            <option value="all">Tất cả hóa đơn</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <label className="flex h-10 items-center gap-2 border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500">
            <FiCalendar className="shrink-0 text-slate-400" size={14} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="min-w-0 bg-transparent font-bold text-slate-700 outline-none" />
          </label>
          <label className="flex h-10 items-center gap-2 border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500">
            <span className="text-slate-400">đến</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="min-w-0 bg-transparent font-bold text-slate-700 outline-none" />
          </label>
          {(dateFrom || dateTo || statusFilter !== 'all' || searchQuery) ? (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setSearchQuery(''); setCurrentPage(1); }}
              className="h-10 border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Xóa lọc
            </button>
          ) : <div className="hidden lg:block" />}
        </div>
        <div className="hidden">
        {/* Quick Filter chips are kept for keyboard shortcuts but the select above is the primary filter. */}
        <div className="hidden">
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

        {/* Date inputs are rendered in the unified filter row above. */}
        {false && user?.role !== 'cashier' && (
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
        )}
        <div className="text-xs font-semibold text-slate-400">
          {filteredOrders.length} hóa đơn phù hợp
        </div>
        </div>
      </div>

      {/* 3.5 Pagination Bar (Top) */}
      {false && orders.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-xs text-slate-500 shadow-[0_4px_20px_rgba(0,0,0,0.01)] animate-fadeIn">
          <div className="flex flex-wrap items-center gap-4">
            <div className="font-semibold text-slate-600">
              Hiển thị <span className="font-extrabold text-slate-900">{itemsStart} - {itemsEnd}</span> trên <span className="font-extrabold text-slate-900">{orders.length}</span> hóa đơn
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition duration-150 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>mục/trang</span>
            </div>
          </div>
          <div>
            {totalPages > 1 && renderPaginationControls()}
          </div>
        </div>
      )}

      {/* 4. Table view */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">Dòng hóa đơn</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Doanh thu: {money(stats.totalRevenue)} | Trung bình: {money(stats.aov)}</p>
          </div>
          <span className="bg-slate-50 px-3 py-1.5 text-[11px] font-extrabold text-slate-600">
            {filteredOrders.length} dòng
          </span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
              <tr className="h-11">
                <th className="px-5 py-4">Hóa đơn</th>
                <th className="px-5 py-4">Thu ngân</th>
                <th className="px-5 py-4 text-right">Tổng thanh toán</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">
                    <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={18} />
                    Đang tải danh sách hóa đơn...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">
                    <FiFileText className="inline mb-2 text-slate-350 block mx-auto" size={32} />
                    Không tìm thấy hóa đơn nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const status = (order.status || 'completed') as 'completed' | 'cancelled';
                  const paymentMethod = getPaymentMethod(order);
                  return (
                    <tr key={order.id} className="group hover:bg-blue-50/30 transition duration-150">
                      {/* Order Number */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-blue-50 text-blue-600">
                            <FiFileText size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-slate-900 font-mono tracking-tight text-xs">{order.order_number}</span>
                              <span className={`inline-flex border px-2 py-0.5 text-[10px] font-extrabold ${paymentStyles[paymentMethod]}`}>
                                {paymentLabels[paymentMethod]}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs font-extrabold text-slate-700">{order.customers?.name || 'Khách lẻ'}</p>
                            {order.customers?.phone && <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{order.customers.phone}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Customer Info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <FiUser className="text-slate-400" size={14} />
                          <span>{order.users?.full_name || 'Nhân viên bán hàng'}</span>
                        </div>
                      </td>
                      {/* Total Amount */}
                      <td className="px-5 py-4 text-right">
                        <p className="font-black text-slate-900 font-mono text-sm">{money(order.final_amount)}</p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">{formatOrderTime(order.created_at)}</p>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex border px-2.5 py-1 text-[10px] font-black ${statusColors[status] || 'bg-slate-50 text-slate-600'}`}>
                          {statusLabels[status] || order.status}
                        </span>
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
                          {order.status !== 'cancelled' && user?.role !== 'cashier' && (
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

      {/* 4.5 Pagination Bar (Bottom) */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 px-5 py-4 text-xs text-slate-500 mt-2">
          <div className="font-semibold text-slate-650">
            Hiển thị <span className="font-black text-slate-800">{itemsStart} - {itemsEnd}</span> trên <span className="font-black text-slate-800">{filteredOrders.length}</span> hóa đơn
          </div>
          <div>
            {totalPages > 1 && renderPaginationControls()}
          </div>
        </div>
      )}

      {/* 5. Drawer Chi tiết Hóa đơn */}
      {selected && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="order-detail-title" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={() => setSelected(null)}
          />

          <div className="pointer-events-none fixed inset-y-0 right-0 flex w-full justify-end">
            <aside className="order-detail-shell pointer-events-auto flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-slate-50 shadow-[-18px_0_50px_rgba(15,23,42,0.16)] animate-slideLeft">
              {/* Header */}
              <div className="shrink-0 border-b border-slate-200 border-t-4 border-blue-600 bg-white px-5 pb-4 pt-3 text-slate-950 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="order-detail-control flex h-11 w-11 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600">
                      <FiFileText size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Hóa đơn bán lẻ</p>
                      <h2 id="order-detail-title" className="mt-1 text-xl font-black tracking-tight text-slate-950">Chi tiết hóa đơn</h2>
                      <p className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-500">{selected.order_number}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Đóng chi tiết hóa đơn"
                    className="order-detail-control inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                  >
                    <FiX size={17} />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <FiClock size={13} className="text-blue-600" />
                    <span>{formatDate(selected.created_at)}</span>
                  </div>
                  <span className={`order-detail-chip inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${selected.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selected.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {selected.status === 'completed' ? 'Thành công' : 'Đã hủy'}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6">
                {detailLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="order-detail-card h-48 border border-slate-200 bg-white" />
                    <div className="order-detail-card h-64 border border-slate-200 bg-white" />
                    <div className="order-detail-card h-40 border border-blue-100 bg-blue-50/70" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <section className="order-detail-card border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Giao dịch</p>
                          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Biên nhận bán lẻ</h3>
                          <p className="mt-1 text-xs font-semibold text-slate-500">Thông tin đơn hàng và khách mua</p>
                        </div>
                        <div className={`order-detail-control flex h-11 w-11 shrink-0 items-center justify-center border ${selected.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-rose-200 bg-rose-50 text-rose-600'}`}>
                          {selected.status === 'completed' ? <FiCheckCircle size={22} /> : <FiAlertCircle size={22} />}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Khách hàng</p>
                          <p className="mt-1 truncate text-sm font-black text-slate-900">{selected.customers?.name || 'Khách lẻ'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Thanh toán</p>
                          <p className="mt-1 truncate text-sm font-black text-slate-900">{paymentLabels[getPaymentMethod(selected)]}</p>
                        </div>
                        {selected.customers?.phone && (
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><FiPhone size={11} /> Điện thoại</p>
                            <p className="mt-1 text-sm font-black text-slate-900">{selected.customers.phone}</p>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mã hóa đơn</p>
                          <p className="mt-1 truncate font-mono text-[11px] font-bold text-slate-700">{selected.order_number}</p>
                        </div>
                      </div>

                      {selected.note && (
                        <div className="mt-4 border-l-2 border-blue-500 bg-blue-50/70 px-3 py-2.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Ghi chú</p>
                          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-700">"{selected.note}"</p>
                        </div>
                      )}
                    </section>

                    <section className="order-detail-card border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Chi tiết đơn</p>
                          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Danh sách hàng hóa</h3>
                        </div>
                        <span className="order-detail-chip shrink-0 border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                          {selected.order_details?.length || 0} món
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {selected.order_details?.map((item, index) => (
                          <div key={item.id} className="order-detail-card flex items-center gap-3 border border-slate-200 bg-slate-50/70 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                            <div className="order-detail-control flex h-9 w-9 shrink-0 items-center justify-center border border-blue-100 bg-white font-mono text-[10px] font-black text-blue-600">
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black leading-tight text-slate-900">{item.product_name}</p>
                              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                <FiPackage size={11} /> {item.quantity} x {money(item.unit_price)}
                              </p>
                            </div>
                            <p className="shrink-0 text-right font-mono text-sm font-black text-slate-950">{money(item.subtotal)}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="order-detail-card border border-blue-100 bg-blue-50/70 p-5 text-slate-900 shadow-[0_10px_24px_rgba(37,99,235,0.06)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Thanh toán</p>
                          <h3 className="mt-1 text-lg font-black tracking-tight">Tóm tắt giao dịch</h3>
                        </div>
                        <FiCreditCard className="text-blue-600" size={22} />
                      </div>

                      <div className="mt-5 space-y-3 text-xs font-semibold">
                        <div className="flex items-center justify-between gap-4 text-slate-500">
                          <span>Tổng tiền hàng</span>
                          <span className="font-mono font-bold text-slate-700">{money(selected.total_amount || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-500">
                          <span>Chiết khấu / Giảm giá</span>
                          <span className="font-mono font-bold text-rose-600">-{money(selected.discount_amount || 0)}</span>
                        </div>
                        <div className="flex items-end justify-between gap-4 border-t border-blue-100 pt-4">
                          <span className="font-black text-slate-800">Khách thanh toán</span>
                          <span className="font-mono text-xl font-black text-blue-700">{money(selected.final_amount)}</span>
                        </div>
                      </div>
                    </section>

                    <p className="pb-1 text-center text-[11px] font-semibold text-slate-400">Cảm ơn quý khách đã mua hàng tại Sora POS.</p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="mb-3 flex items-center gap-3">
                  <div className="order-detail-control flex h-9 w-9 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600">
                    <FiMail size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Gửi hóa đơn qua email</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Hóa đơn sẽ được gửi đến khách hàng.</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="email"
                      placeholder="Nhập email khách hàng..."
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="order-detail-control h-11 w-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!emailInput.trim()) {
                        toast.error('Vui lòng nhập email');
                        return;
                      }
                      setIsSending(true);
                      try {
                        await orderAPI.sendInvoiceEmail(selected.id, emailInput);
                        toast.success('Đã gửi email hóa đơn thành công!');
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || 'Gửi email thất bại');
                      } finally {
                        setIsSending(false);
                      }
                    }}
                    disabled={isSending}
                    className="order-detail-control inline-flex h-11 min-w-[78px] items-center justify-center gap-1.5 bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSending ? <FiRefreshCw className="animate-spin" size={14} /> : <FiMail size={14} />}
                    <span>{isSending ? 'Đang gửi' : 'Gửi'}</span>
                  </button>
                </div>

                {selected.status !== 'cancelled' && user?.role !== 'cashier' && (
                  <button
                    type="button"
                    onClick={() => cancel(selected)}
                    className="order-detail-control mt-3 inline-flex h-10 w-full items-center justify-center gap-2 border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 transition hover:bg-rose-100 active:translate-y-px"
                  >
                    <FiTrash2 size={14} />
                    Yêu cầu hủy hóa đơn này
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
