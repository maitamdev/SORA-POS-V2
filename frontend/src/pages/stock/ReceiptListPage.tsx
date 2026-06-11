import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiPlus, FiEye, FiCalendar, FiFilter, FiRefreshCw, FiDollarSign, FiUser, FiX
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
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-red-50 text-red-700 border-red-200',
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

  // Filter states
  const [supplierId, setSupplierId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
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
      if (paymentStatus) params.payment_status = paymentStatus;
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

  const resetFilters = () => {
    setSupplierId('');
    setPaymentStatus('');
    setDateFrom('');
    setDateTo('');
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [supplierId, paymentStatus, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Lịch sử Nhập kho</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Quản lý các đợt nhập hàng từ nhà cung cấp và theo dõi công nợ.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => navigate('/stock/receipts/new')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 transition"
          >
            <FiPlus size={16} />
            Nhập hàng mới
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
          <FiFilter size={16} />
          <span>Bộ lọc tìm kiếm</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {/* Supplier select */}
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Nhà cung cấp</span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-400 bg-white"
            >
              <option value="">Tất cả nhà cung cấp</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </label>

          {/* Payment status select */}
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Thanh toán</span>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-400 bg-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="paid">Đã thanh toán</option>
              <option value="partial">Trả một phần</option>
              <option value="unpaid">Chưa thanh toán</option>
            </select>
          </label>

          {/* Date from */}
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Từ ngày</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-400 bg-white"
            />
          </label>

          {/* Date to */}
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Đến ngày</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-400 bg-white"
            />
          </label>
        </div>

        {(supplierId || paymentStatus || dateFrom || dateTo) && (
          <div className="flex justify-end">
            <button
              onClick={resetFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-black">Mã phiếu</th>
                <th className="px-5 py-3.5 font-black">Nhà cung cấp</th>
                <th className="px-5 py-3.5 font-black">Tổng tiền hàng</th>
                <th className="px-5 py-3.5 font-black">Đã thanh toán</th>
                <th className="px-5 py-3.5 font-black">Thanh toán</th>
                <th className="px-5 py-3.5 font-black">Ngày nhập</th>
                <th className="px-5 py-3.5 font-black">Người nhập</th>
                <th className="px-5 py-3.5 font-black text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    <FiRefreshCw className="inline animate-spin mr-2" size={16} />
                    Đang tải danh sách phiếu nhập...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    Không tìm thấy phiếu nhập kho nào.
                  </td>
                </tr>
              ) : (
                receipts.map((rc) => (
                  <tr key={rc.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-black text-slate-900">{rc.receipt_number}</td>
                    <td className="px-5 py-4">{rc.suppliers?.name || 'Nhà cung cấp vãng lai'}</td>
                    <td className="px-5 py-4 text-slate-900">{formatCurrency(rc.total_amount)}</td>
                    <td className="px-5 py-4 text-emerald-600">{formatCurrency(rc.paid_amount)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-black ${statusColors[rc.payment_status]}`}>
                        {statusLabels[rc.payment_status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-medium">{formatDate(rc.created_at)}</td>
                    <td className="px-5 py-4 font-medium">{rc.users?.full_name}</td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleViewDetails(rc.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                        title="Xem chi tiết"
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

      {/* Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Chi tiết Phiếu Nhập Kho</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Mã phiếu: {selectedReceipt.receipt_number} — Tạo bởi: {selectedReceipt.users?.full_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 transition"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {/* Receipt Stats summary */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <FiDollarSign size={15} />
                    <span className="text-xs font-bold uppercase tracking-wide">Tổng tiền hàng</span>
                  </div>
                  <p className="text-lg font-black text-slate-900">{formatCurrency(selectedReceipt.total_amount)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <FiDollarSign size={15} />
                    <span className="text-xs font-bold uppercase tracking-wide">Đã thanh toán</span>
                  </div>
                  <p className="text-lg font-black text-emerald-700">{formatCurrency(selectedReceipt.paid_amount)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <FiUser size={15} />
                    <span className="text-xs font-bold uppercase tracking-wide">Nhà cung cấp</span>
                  </div>
                  <p className="text-sm font-black text-slate-800 line-clamp-1">
                    {selectedReceipt.suppliers?.name || 'Nhà cung cấp vãng lai'}
                  </p>
                </div>
              </div>

              {/* Note section */}
              {selectedReceipt.note && (
                <div className="rounded-xl border border-slate-200 bg-amber-50/20 p-4 text-sm">
                  <p className="font-bold text-slate-500 mb-1">Ghi chú phiếu nhập:</p>
                  <p className="font-semibold text-slate-700">{selectedReceipt.note}</p>
                </div>
              )}

              {/* Products Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Danh sách sản phẩm ({selectedReceipt.items?.length || 0})</h4>
                <div className="overflow-hidden rounded-xl border border-slate-200 text-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Sản phẩm / SKU</th>
                        <th className="px-4 py-2.5 text-right">Đơn giá nhập</th>
                        <th className="px-4 py-2.5 text-center">Số lượng</th>
                        <th className="px-4 py-2.5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {selectedReceipt.items?.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800">{item.products?.name}</p>
                            <p className="text-[10px] font-semibold text-slate-400">
                              SKU: {item.products?.sku} {item.products?.barcode ? `| Barcode: ${item.products.barcode}` : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-center">{item.quantity} {item.products?.unit || 'cái'}</td>
                          <td className="px-4 py-3 text-right text-slate-900 font-black">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-xs font-bold text-slate-400">
              <div className="flex gap-4">
                <span>Ngày nhập: {formatDate(selectedReceipt.created_at)}</span>
                <span>Trạng thái: <span className="font-black text-slate-700 uppercase">{selectedReceipt.payment_status}</span></span>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 transition"
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
