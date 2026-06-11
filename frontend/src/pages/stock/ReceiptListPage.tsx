import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiPlus, FiEye, FiCalendar, FiFilter, FiRefreshCw, FiDollarSign, FiUser, FiX,
  FiTruck, FiAlertCircle, FiTrendingDown, FiShield, FiSliders, FiClock
} from 'react-icons/fi';
import { goodsReceiptAPI } from '../../services/goodsReceipt.api';
import { catalogAPI } from '../../services/catalog.api';
import { GoodsReceipt, Supplier } from '../../types/domain.type';

const formatCurrency = (value: number) => {
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
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-250',
  partial: 'bg-amber-50 text-amber-700 border-amber-250',
  unpaid: 'bg-rose-50 text-rose-700 border-rose-250',
};

const statusLabels = {
  paid: 'Đã thanh toán',
  partial: 'Thanh toán một phần',
  unpaid: 'Chưa thanh toán (Nợ)',
};

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Debt Payment states
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Filter states
  const [supplierId, setSupplierId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadSuppliers = async () => {
    try {
      const res = await catalogAPI.suppliers.list({ limit: 100 });
      setSuppliers(res.data.data.items);
    } catch (err) {
      console.error('Lỗi tải danh sách nhà cung cấp:', err);
    }
  };

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (supplierId) params.supplier_id = supplierId;
      if (paymentStatus !== 'all') params.payment_status = paymentStatus;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await goodsReceiptAPI.list(params);
      setReceipts(res.data.data.items);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tải danh sách phiếu nhập');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await goodsReceiptAPI.getById(id);
      setSelectedReceipt(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tải chi tiết phiếu nhập');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;
    const amount = Number(payAmountInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Vui lòng nhập số tiền thanh toán hợp lệ');
      return;
    }
    const remaining = selectedReceipt.total_amount - selectedReceipt.paid_amount;
    if (amount > remaining) {
      toast.error(`Số tiền trả thêm vượt quá nợ còn lại (${formatCurrency(remaining)})`);
      return;
    }

    setPayLoading(true);
    try {
      const res = await goodsReceiptAPI.updatePayment(selectedReceipt.id, amount);
      toast.success('Cập nhật thanh toán thành công');
      setSelectedReceipt(res.data.data);
      setPayAmountInput('');
      loadReceipts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật thanh toán');
    } finally {
      setPayLoading(false);
    }
  };

  const resetFilters = () => {
    setSupplierId('');
    setPaymentStatus('all');
    setDateFrom('');
    setDateTo('');
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [supplierId, paymentStatus, dateFrom, dateTo]);

  // Tính toán KPIs
  const stats = useMemo(() => {
    const totalCount = receipts.length;
    const totalAmount = receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const paidAmount = receipts.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
    const debtAmount = Math.max(totalAmount - paidAmount, 0);

    return { totalCount, totalAmount, paidAmount, debtAmount };
  }, [receipts]);

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-50 text-blue-600 border-blue-100',
      'bg-indigo-50 text-indigo-600 border-indigo-100',
      'bg-purple-50 text-purple-600 border-purple-100',
      'bg-orange-50 text-orange-600 border-orange-105',
      'bg-teal-50 text-teal-600 border-teal-100',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string) => {
    if (!name) return 'NCC';
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
            <FiTruck className="text-blue-600" />
            Nhập kho & Công nợ
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Quản lý lịch sử nhập hàng từ Nhà cung cấp, theo dõi chi tiết phiếu nhập và quản lý công nợ NCC.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => navigate('/stock/receipts/new')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white transition-all duration-200 shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5"
          >
            <FiPlus size={16} className="stroke-[2.5]" />
            Lập phiếu nhập mới
          </button>
          <button
            onClick={loadReceipts}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 p-2.5 text-slate-600 transition-all flex items-center justify-center shadow-sm"
            title="Làm mới dữ liệu"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          </button>
        </div>
      </header>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Metric 1: Tổng tiền nhập */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50/65 border border-blue-100/50 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiTruck size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tổng giá trị nhập</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{formatCurrency(stats.totalAmount)}</h4>
          </div>
        </div>

        {/* Metric 2: Đã thanh toán */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50/65 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiDollarSign size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Đã chi thanh toán</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{formatCurrency(stats.paidAmount)}</h4>
          </div>
        </div>

        {/* Metric 3: Nợ nhà cung cấp */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${
            stats.debtAmount > 0 
              ? 'bg-rose-50 border border-rose-100 text-rose-600' 
              : 'bg-slate-50 border border-slate-100 text-slate-400'
          }`}>
            <FiTrendingDown size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Công nợ NCC còn lại</p>
            <h4 className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight ${stats.debtAmount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatCurrency(stats.debtAmount)}</h4>
          </div>
        </div>

        {/* Metric 4: Tổng phiếu nhập */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50/65 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiShield size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tổng số phiếu nhập</p>
            <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.totalCount}</h4>
          </div>
        </div>
      </div>

      {/* 3. Filter Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2">
        {/* Quick Filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase tracking-wider">Thanh toán:</span>
          <button
            onClick={() => setPaymentStatus('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
              paymentStatus === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tất cả ({receipts.length})
          </button>
          <button
            onClick={() => setPaymentStatus('paid')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
              paymentStatus === 'paid'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Đã trả đủ ({receipts.filter(r => r.payment_status === 'paid').length})
          </button>
          <button
            onClick={() => setPaymentStatus('partial')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
              paymentStatus === 'partial'
                ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Nợ một phần ({receipts.filter(r => r.payment_status === 'partial').length})
          </button>
          <button
            onClick={() => setPaymentStatus('unpaid')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
              paymentStatus === 'unpaid'
                ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Nợ toàn bộ ({receipts.filter(r => r.payment_status === 'unpaid').length})
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
        </div>
      </div>

      {/* 4. Dropdowns & Reset row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 border border-slate-200/80 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
        <div className="relative w-full sm:w-72">
          <FiSliders className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 pl-9 pr-8 text-xs sm:text-sm font-semibold outline-none bg-white focus:border-slate-400 appearance-none cursor-pointer shadow-xs"
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>
          <FiX className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-350 cursor-pointer hidden" size={14} />
          <FiEye className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none hidden" size={14} />
        </div>

        {(supplierId || paymentStatus !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={resetFilters}
            className="h-9 px-3.5 rounded-xl border border-slate-250 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-500 transition shadow-2xs self-end sm:self-auto"
          >
            Xóa toàn bộ lọc
          </button>
        )}
      </div>

      {/* 5. List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-55/65 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-5 py-4">Mã phiếu</th>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-5 py-4 text-right">Tổng tiền hàng</th>
                <th className="px-5 py-4 text-right">Đã thanh toán</th>
                <th className="px-5 py-4 text-center">Trạng thái thanh toán</th>
                <th className="px-5 py-4">Ngày nhập</th>
                <th className="px-5 py-4">Người lập phiếu</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 font-bold">
                    <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={18} />
                    Đang tải danh sách phiếu nhập...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 font-bold">
                    <FiTruck className="inline mb-2 text-slate-350 block mx-auto" size={32} />
                    Không tìm thấy phiếu nhập kho nào.
                  </td>
                </tr>
              ) : (
                receipts.map((rc) => (
                  <tr key={rc.id} className="hover:bg-slate-50/50 transition duration-150">
                    {/* Receipt Number */}
                    <td className="px-5 py-4">
                      <span className="font-black text-slate-900 font-mono tracking-tight bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/40 text-xs">
                        {rc.receipt_number}
                      </span>
                    </td>
                    {/* Supplier */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-black shrink-0 shadow-inner ${getAvatarColor(rc.suppliers?.name || 'Vãng lai')}`}>
                          {getInitials(rc.suppliers?.name || 'Vãng lai')}
                        </div>
                        <span className="font-extrabold text-slate-800 truncate max-w-[180px]">
                          {rc.suppliers?.name || 'Nhà cung cấp vãng lai'}
                        </span>
                      </div>
                    </td>
                    {/* Total Amount */}
                    <td className="px-5 py-4 text-right text-slate-900 font-mono font-black">{formatCurrency(rc.total_amount)}</td>
                    {/* Paid Amount */}
                    <td className="px-5 py-4 text-right text-emerald-600 font-mono font-black">{formatCurrency(rc.paid_amount)}</td>
                    {/* Payment Status */}
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-black ${statusColors[rc.payment_status]}`}>
                        {statusLabels[rc.payment_status]}
                      </span>
                    </td>
                    {/* Created At */}
                    <td className="px-5 py-4 text-slate-400 font-medium">{formatDate(rc.created_at)}</td>
                    {/* Creator User */}
                    <td className="px-5 py-4 font-bold text-slate-700 text-xs">{rc.users?.full_name}</td>
                    {/* Actions */}
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleViewDetails(rc.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs"
                        title="Xem chi tiết phiếu & Cập nhật thanh toán"
                      >
                        <FiEye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Debt Payment Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col animate-scaleIn">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <FiTruck className="text-blue-600" />
                  Chi tiết Phiếu Nhập Kho
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Mã số: <span className="font-mono text-slate-600">{selectedReceipt.receipt_number}</span> — Người lập: {selectedReceipt.users?.full_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-750 transition"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {/* Receipt Summary Stats */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <FiDollarSign size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wide">Tổng tiền hàng</span>
                  </div>
                  <p className="text-base font-black text-slate-900 font-mono">{formatCurrency(selectedReceipt.total_amount)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-emerald-50/40 p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <FiDollarSign size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wide">Đã thanh toán</span>
                  </div>
                  <p className="text-base font-black text-emerald-700 font-mono">{formatCurrency(selectedReceipt.paid_amount)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <FiUser size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wide">Nhà cung cấp</span>
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-800 line-clamp-1">
                    {selectedReceipt.suppliers?.name || 'Nhà cung cấp vãng lai'}
                  </p>
                </div>
              </div>

              {/* Note section */}
              {selectedReceipt.note && (
                <div className="rounded-xl border border-slate-200 bg-amber-50/20 p-3.5 text-xs">
                  <p className="font-black text-slate-500 mb-1 uppercase tracking-wide text-[10px]">Ghi chú phiếu nhập:</p>
                  <p className="font-semibold text-slate-700 leading-relaxed italic">"{selectedReceipt.note}"</p>
                </div>
              )}

              {/* Payment Section for Debt */}
              {selectedReceipt.payment_status !== 'paid' && (
                <div className="rounded-xl border border-blue-150 bg-blue-50/40 p-4 space-y-3 shadow-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-blue-900 text-sm">Thanh toán thêm nợ Nhà cung cấp</p>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Còn nợ NCC: <span className="font-black text-rose-600 font-mono">{formatCurrency(selectedReceipt.total_amount - selectedReceipt.paid_amount)}</span>
                      </p>
                    </div>
                  </div>
                  <form onSubmit={handleUpdatePayment} className="flex gap-2 items-end">
                    <label className="block flex-1">
                      <span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Số tiền trả thêm (VND)</span>
                      <input
                        type="number"
                        min={1}
                        max={selectedReceipt.total_amount - selectedReceipt.paid_amount}
                        value={payAmountInput}
                        onChange={(e) => setPayAmountInput(e.target.value)}
                        placeholder="Ví dụ: 200000"
                        className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 bg-white shadow-inner"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={payLoading}
                      className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xs font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {payLoading ? 'Đang lưu...' : 'Xác nhận trả nợ'}
                    </button>
                  </form>
                </div>
              )}

              {/* Products Table */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-400">Danh sách sản phẩm nhập ({selectedReceipt.items?.length || 0})</h4>
                <div className="overflow-hidden rounded-xl border border-slate-200 text-xs shadow-2xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Sản phẩm / SKU</th>
                        <th className="px-4 py-3 text-right">Đơn giá nhập</th>
                        <th className="px-4 py-3 text-center">Số lượng</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 bg-white">
                      {selectedReceipt.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/30">
                          <td className="px-4 py-3">
                            <p className="font-extrabold text-slate-800 leading-snug">{item.products?.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                              SKU: {item.products?.sku} {item.products?.barcode ? `| Barcode: ${item.products.barcode}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-center font-bold">{item.quantity} {item.products?.unit || 'cái'}</td>
                          <td className="px-4 py-3 text-right text-slate-900 font-black font-mono">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-xs font-bold text-slate-400 shrink-0">
              <div className="flex gap-4 items-center">
                <span className="flex items-center gap-1">
                  <FiCalendar size={13} />
                  Thời gian: {formatDate(selectedReceipt.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <FiClock size={13} />
                  Trạng thái: <span className={`font-black uppercase text-[10px] rounded-full border px-2 py-0.5 ${statusColors[selectedReceipt.payment_status]}`}>{statusLabels[selectedReceipt.payment_status]}</span>
                </span>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 active:bg-slate-900 transition shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
