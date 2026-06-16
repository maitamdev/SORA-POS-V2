import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineCash,
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineRefresh,
  HiOutlineShoppingCart,
} from 'react-icons/hi';
import { shiftAPI } from '../../services/shift.api';
import { ShiftSession } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const today = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const statusLabel = (status?: ShiftSession['status']) => {
  if (status === 'opened') return 'Chờ nhận ca';
  if (status === 'checked_in') return 'Đang bán hàng';
  if (status === 'closed') return 'Đã chốt ca';
  if (status === 'cancelled') return 'Đã hủy';
  return 'Chưa có ca';
};

const statusClass = (status?: ShiftSession['status']) => {
  if (status === 'checked_in') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'opened') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'closed') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const MyShiftPage = () => {
  const { user } = useAuthStore();
  const [date, setDate] = useState(today());
  const [shifts, setShifts] = useState<ShiftSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [closing, setClosing] = useState(false);

  // Cash drawer states
  const [showDrawerModal, setShowDrawerModal] = useState(false);
  const [drawerTxType, setDrawerTxType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [drawerAmount, setDrawerAmount] = useState('');
  const [drawerReason, setDrawerReason] = useState('');
  const [drawerLoading, setDrawerLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await shiftAPI.my({ date, limit: 20 });
      const items = response.data.data.items;
      setShifts(items);
      setSelectedId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return items[0]?.id || '';
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được doanh thu ca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedId) || shifts[0] || null,
    [shifts, selectedId]
  );

  const summary = selectedShift?.summary;
  
  // expectedCash calculated including manual cash ledger transactions
  const expectedCash = useMemo(() => {
    if (!selectedShift) return 0;
    const opening = Number(selectedShift.opening_cash || 0);
    const cashSales = Number(summary?.payments?.cash || 0);
    const drawerTxsTotal = Number(summary?.cash_drawer_tx_total || 0);
    return opening + cashSales + drawerTxsTotal;
  }, [selectedShift, summary]);

  const closeShift = async () => {
    const cash = Number(closingCash || 0);
    if (!Number.isFinite(cash) || cash < 0) {
      toast.error('Tiền chốt ca không hợp lệ');
      return;
    }
    if (!window.confirm('Chốt ca làm và gửi báo cáo cho quản lý?')) return;

    setClosing(true);
    try {
      const response = await shiftAPI.close({ closing_cash: cash, note: closingNote.trim() || null });
      localStorage.removeItem('sora_active_shift');
      toast.success('Đã chốt ca và gửi báo cáo cho quản lý');
      setClosingCash('');
      setClosingNote('');
      await loadData();
      setSelectedId(response.data.data.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Chốt ca thất bại');
    } finally {
      setClosing(false);
    }
  };

  // Submit manual cash ledger transaction
  const handleDrawerTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(drawerAmount);
    if (!amount || amount <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }

    setDrawerLoading(true);
    try {
      await shiftAPI.logCashDrawerTxActive({
        type: drawerTxType,
        amount,
        reason: drawerReason.trim() || null,
      });
      toast.success(drawerTxType === 'cash_in' ? 'Ghi nhận nạp tiền lẻ thành công' : 'Ghi nhận rút tiền mặt thành công');
      setDrawerAmount('');
      setDrawerReason('');
      setShowDrawerModal(false);
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không ghi nhận được giao dịch két tiền');
    } finally {
      setDrawerLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-blue-600">Nhân viên bán hàng</p>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Ca của tôi</h1>
          <p className="text-sm font-medium text-slate-500">
            {user?.full_name || 'Nhân viên'} xem doanh thu, đơn hàng và đối soát trong ca làm.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
          />
          <button
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          >
            <HiOutlineRefresh className="h-4 w-4" />
            Tải lại
          </button>
          <Link
            to="/pos"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
          >
            <HiOutlineShoppingCart className="h-4 w-4" />
            Bán hàng
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center font-semibold text-slate-400">
          Đang tải dashboard ca...
        </div>
      ) : !selectedShift ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-black uppercase text-amber-700">Chưa có ca trong ngày</p>
          <h2 className="mt-2 text-xl font-black text-amber-950">Quản lý chưa mở ca cho bạn</h2>
          <p className="mt-2 text-sm font-semibold text-amber-800">
            Khi quản lý mở ca, bạn đăng nhập lại và vào POS để nhập tiền đầu ca.
          </p>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(selectedShift.status)}`}>
                  {statusLabel(selectedShift.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {selectedShift.shift_name || selectedShift.shift_date}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Nhận ca: {selectedShift.checked_in_at ? new Date(selectedShift.checked_in_at).toLocaleString('vi-VN') : 'Chưa nhận ca'}
                {selectedShift.closed_at ? ` - Chốt ca: ${new Date(selectedShift.closed_at).toLocaleString('vi-VN')}` : ''}
              </p>
            </div>

            {shifts.length > 1 && (
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.shift_name || shift.shift_date} - {statusLabel(shift.status)}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Cash Ledger manual input drawer actions */}
          {selectedShift.status === 'checked_in' && (
            <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-black text-slate-800">Quản lý két tiền mặt (Cash Drawer adjustment)</h2>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Thực hiện nạp thêm tiền lẻ hoặc rút tiền nộp về két lớn</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDrawerTxType('cash_in');
                    setShowDrawerModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-emerald-250 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black transition-all"
                >
                  <HiOutlineCash className="w-4.5 h-4.5" />
                  <span>+ Nạp tiền lẻ</span>
                </button>
                <button
                  onClick={() => {
                    setDrawerTxType('cash_out');
                    setShowDrawerModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-rose-250 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black transition-all"
                >
                  <HiOutlineCash className="w-4.5 h-4.5" />
                  <span>- Rút tiền mặt</span>
                </button>
              </div>
            </section>
          )}

          {selectedShift.status === 'checked_in' && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">Chốt ca</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Nhập tiền thực đếm cuối ca</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Tiền mặt hệ thống cần có: <span className="text-amber-700 font-extrabold">{money(expectedCash)}</span>
                  </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[180px_1fr_auto] lg:w-auto">
                  <input
                    type="number"
                    min="0"
                    value={closingCash}
                    onChange={(event) => setClosingCash(event.target.value)}
                    placeholder="Tiền thực đếm"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                  />
                  <input
                    value={closingNote}
                    onChange={(event) => setClosingNote(event.target.value)}
                    placeholder="Ghi chú chốt ca nếu có lệch tiền"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={closeShift}
                    disabled={closing}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black uppercase text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {closing ? 'Đang chốt...' : 'Chốt ca'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {selectedShift.status === 'closed' && selectedShift.note && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Ghi chú chốt ca: {selectedShift.note}
            </section>
          )}

          <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <HiOutlineChartBar className="mb-2 h-5 w-5 text-blue-600" />
              <p className="text-xs font-black uppercase text-slate-400">Doanh thu ca</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{money(summary?.revenue || 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <HiOutlineClipboardList className="mb-2 h-5 w-5 text-emerald-600" />
              <p className="text-xs font-black uppercase text-slate-400">Số đơn</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{summary?.order_count || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <HiOutlineCash className="mb-2 h-5 w-5 text-amber-600" />
              <p className="text-xs font-black uppercase text-slate-400">Tiền mặt cần có</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{money(selectedShift.expected_cash ?? expectedCash)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-400">Lệch tiền</p>
              <p className={`mt-2 text-2xl font-black ${Number(selectedShift.cash_difference || 0) < 0 ? 'text-red-600' : Number(selectedShift.cash_difference || 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {selectedShift.cash_difference == null ? '-' : money(selectedShift.cash_difference)}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase text-slate-700">Thanh toán</h2>
              <div className="mt-4 space-y-3 text-sm font-bold text-slate-600">
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Tiền mặt</span>
                  <span className="text-slate-900">{money(summary?.payments.cash || 0)}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Chuyển khoản</span>
                  <span className="text-slate-900">{money(summary?.payments.transfer || 0)}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>Thẻ</span>
                  <span className="text-slate-900">{money(summary?.payments.card || 0)}</span>
                </div>
                {Number(summary?.cash_drawer_tx_total || 0) !== 0 && (
                  <div className="flex justify-between rounded-lg bg-slate-100 px-3 py-2 text-slate-800 border border-slate-200/50">
                    <span>Điều chỉnh két (Nạp/Rút)</span>
                    <span className={`font-extrabold ${Number(summary?.cash_drawer_tx_total || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {Number(summary?.cash_drawer_tx_total || 0) >= 0 ? '+' : ''}{money(summary?.cash_drawer_tx_total || 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-black uppercase text-slate-700">Sản phẩm đã bán</h2>
              <div className="mt-4 space-y-2">
                {(summary?.top_products || []).length === 0 ? (
                  <p className="py-8 text-center text-sm font-semibold text-slate-400">Chưa có sản phẩm nào trong ca</p>
                ) : (
                  summary?.top_products.map((item) => (
                    <div key={item.product_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div>
                        <p className="font-black text-slate-800">{item.product_name}</p>
                        <p className="text-xs font-semibold text-slate-400">Số lượng {item.quantity}</p>
                      </div>
                      <p className="font-black text-blue-700">{money(item.revenue)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-black uppercase text-slate-700">Đơn hàng trong ca</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-black">Hóa đơn</th>
                    <th className="px-4 py-3 font-black">Thời gian</th>
                    <th className="px-4 py-3 font-black">Trạng thái</th>
                    <th className="px-4 py-3 text-right font-black">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedShift.orders || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center font-semibold text-slate-400">Chưa có đơn hàng</td>
                    </tr>
                  ) : (
                    selectedShift.orders?.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-black text-slate-800">{order.order_number}</td>
                        <td className="px-4 py-3 font-semibold text-slate-500">{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 font-bold text-slate-500">{order.status}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">{money(order.final_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Cash Ledger History Log Table */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-black uppercase text-slate-700">Nhật ký két tiền mặt (Cash Drawer Ledger)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-black">Thời gian</th>
                    <th className="px-4 py-3 font-black">Loại giao dịch</th>
                    <th className="px-4 py-3 font-black">Số tiền</th>
                    <th className="px-4 py-3 font-black">Lý do điều chỉnh</th>
                    <th className="px-4 py-3 font-black">Người thực hiện</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedShift.cash_drawer_transactions || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center font-semibold text-slate-400">Chưa có giao dịch nạp/rút tiền lẻ</td>
                    </tr>
                  ) : (
                    selectedShift.cash_drawer_transactions?.map((tx) => (
                      <tr key={tx.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-semibold text-slate-500">{new Date(tx.created_at).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 font-bold">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${
                            tx.type === 'cash_in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {tx.type === 'cash_in' ? 'Nạp tiền lẻ (In)' : 'Rút tiền mặt (Out)'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-black ${tx.type === 'cash_in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'cash_in' ? '+' : '-'}{money(tx.amount)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{tx.reason || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-500">{tx.users?.full_name || 'Hệ thống'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Cash Drawer transaction modal */}
      {showDrawerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
            <div className="border-b border-slate-150 px-6 py-4 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-sm uppercase">Giao dịch két tiền mặt</h3>
              <button onClick={() => setShowDrawerModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleDrawerTxSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-400">Loại giao dịch</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDrawerTxType('cash_in')}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all ${
                      drawerTxType === 'cash_in'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Nạp tiền lẻ (Cash In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTxType('cash_out')}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all ${
                      drawerTxType === 'cash_out'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Rút tiền mặt (Cash Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400">Số tiền (VND)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={drawerAmount}
                  onChange={(e) => setDrawerAmount(e.target.value)}
                  placeholder="Nhập số tiền..."
                  className="w-full mt-1.5 h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400">Lý do giao dịch</label>
                <textarea
                  required
                  value={drawerReason}
                  onChange={(e) => setDrawerReason(e.target.value)}
                  placeholder="Nhập lý do (ví dụ: Nạp thêm tiền lẻ 10k, Rút tiền nộp két sắt...)"
                  rows={3}
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDrawerModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={drawerLoading}
                  className={`flex-1 py-3 text-white text-xs font-black rounded-xl transition shadow-md ${
                    drawerTxType === 'cash_in' 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                  } disabled:opacity-60`}
                >
                  {drawerLoading ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyShiftPage;
