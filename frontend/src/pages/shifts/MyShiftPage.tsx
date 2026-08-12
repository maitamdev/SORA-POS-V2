import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineCash,
  HiOutlineClipboardList,
  HiOutlineClock,
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

const workDuration = (shift: ShiftSession) => {
  if (shift.total_work_minutes !== null && shift.total_work_minutes !== undefined) {
    const minutes = Math.max(0, Number(shift.total_work_minutes));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours > 0 ? `${hours} giờ ${remainder} phút` : `${remainder} phút`;
  }

  const start = shift.started_at || shift.checked_in_at;
  if (!start) return 'Chưa nhận ca';
  const end = shift.closed_at ? new Date(shift.closed_at) : new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours} giờ ${remainder} phút` : `${remainder} phút`;
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
  
  // expectedCash calculated based on opening cash and sales
  const expectedCash = useMemo(() => {
    if (!selectedShift) return 0;
    if (summary?.cash_expected !== undefined) return Number(summary.cash_expected || 0);
    const opening = Number(selectedShift.opening_cash || 0);
    const cashSales = Number(summary?.payments?.cash || 0);
    return opening + cashSales;
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

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-blue-600">Nhân viên bán hàng</p>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Ca của tôi</h1>
          <p className="text-sm font-medium text-slate-500">
             {user?.full_name || 'Nhân viên'} nhận ca, chốt ca và đối soát tiền mặt trong ca làm.
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
                {` · Tổng giờ làm: ${workDuration(selectedShift)}`}
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
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
              <HiOutlineClock className="mb-2 h-5 w-5 text-blue-600" />
              <p className="text-xs font-black uppercase text-blue-500">Tổng giờ làm</p>
              <p className="mt-2 text-2xl font-black text-blue-800">{workDuration(selectedShift)}</p>
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
                  </tr>
                </thead>
                <tbody>
                  {(selectedShift.orders || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center font-semibold text-slate-400">Chưa có đơn hàng</td>
                    </tr>
                  ) : (
                    selectedShift.orders?.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-black text-slate-800">{order.order_number}</td>
                        <td className="px-4 py-3 font-semibold text-slate-500">{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 font-bold text-slate-500">{order.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </>
      )}
    </div>
  );
};

export default MyShiftPage;
