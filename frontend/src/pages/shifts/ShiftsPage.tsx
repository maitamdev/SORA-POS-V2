import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineEye,
  HiOutlinePlus,
  HiOutlineRefresh,
} from 'react-icons/hi';
import { shiftAPI } from '../../services/shift.api';
import { staffAPI } from '../../services/staff.api';
import { ShiftSession, StaffUser } from '../../types/domain.type';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const today = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const statusLabel = (status: ShiftSession['status']) => {
  if (status === 'opened') return 'Đã mở ca';
  if (status === 'checked_in') return 'Đang bán hàng';
  if (status === 'closed') return 'Đã chốt ca';
  return 'Đã hủy';
};

const statusClass = (status: ShiftSession['status']) => {
  if (status === 'opened') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'checked_in') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'closed') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-red-50 text-red-700 border-red-100';
};

const ShiftsPage = () => {
  const [shifts, setShifts] = useState<ShiftSession[]>([]);
  const [cashiers, setCashiers] = useState<StaffUser[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftSession | null>(null);
  const [closingShift, setClosingShift] = useState<ShiftSession | null>(null);
  const [closingCashInput, setClosingCashInput] = useState('');
  const [managerNoteInput, setManagerNoteInput] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  const handleCloseShift = async (e: FormEvent) => {
    e.preventDefault();
    if (!closingShift) return;

    const closingCash = Number(closingCashInput);
    if (isNaN(closingCash) || closingCash < 0) {
      toast.error('Tiền chốt ca thực tế không hợp lệ');
      return;
    }

    setClosingLoading(true);
    try {
      await shiftAPI.closeByManager(closingShift.id, {
        closing_cash: closingCash,
        note: managerNoteInput.trim() || null,
      });
      toast.success('Chốt ca nhân viên thành công');
      setClosingShift(null);
      setClosingCashInput('');
      setManagerNoteInput('');
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Chốt ca thất bại');
    } finally {
      setClosingLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [shiftRes, staffRes] = await Promise.all([
        shiftAPI.list({ date, limit: 100 }),
        staffAPI.list({ limit: 100, is_active: 'true' }),
      ]);
      setShifts(shiftRes.data.data.items);
      setCashiers(staffRes.data.data.items.filter((item) => item.role === 'cashier'));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được danh sách ca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const totals = useMemo(() => {
    return shifts.reduce(
      (acc, shift) => {
        acc.revenue += shift.summary?.revenue || 0;
        acc.orders += shift.summary?.order_count || 0;
        acc.cash += shift.summary?.payments.cash || 0;
        acc.diff += shift.cash_difference || 0;
        return acc;
      },
      { revenue: 0, orders: 0, cash: 0, diff: 0 }
    );
  }, [shifts]);

  const openShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEmployee) {
      toast.error('Chọn nhân viên thu ngân');
      return;
    }

    setSaving(true);
    try {
      await shiftAPI.open({
        employee_id: selectedEmployee,
        shift_date: date,
        shift_name: shiftName.trim() || null,
      });
      toast.success('Đã mở ca cho nhân viên');
      setSelectedEmployee('');
      setShiftName('');
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Mở ca thất bại');
    } finally {
      setSaving(false);
    }
  };

  const viewShift = async (shift: ShiftSession) => {
    try {
      const response = await shiftAPI.get(shift.id);
      setSelectedShift(response.data.data);
    } catch {
      toast.error('Không tải được chi tiết ca');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Quản lý ca làm</h1>
          <p className="text-sm font-medium text-slate-500">
            Mở ca cho thu ngân, theo dõi doanh thu và đối soát tiền trong ngày.
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
        </div>
      </header>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Doanh thu ngày</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{money(totals.revenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tổng đơn</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{totals.orders}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tiền mặt bán hàng</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{money(totals.cash)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tổng lệch tiền</p>
          <p className={`mt-2 text-2xl font-black ${totals.diff < 0 ? 'text-red-600' : totals.diff > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {money(totals.diff)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={openShift} className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase text-slate-700">Mở ca cho nhân viên</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">Sau khi mở ca, nhân viên có thể đăng nhập và nhận ca.</p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Thu ngân</span>
              <select
                value={selectedEmployee}
                onChange={(event) => setSelectedEmployee(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="">Chọn nhân viên</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.full_name} - {cashier.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Tên ca</span>
              <input
                value={shiftName}
                onChange={(event) => setShiftName(event.target.value)}
                placeholder="Ca sáng, ca chiều..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <button
            disabled={saving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <HiOutlinePlus className="h-4 w-4" />
            {saving ? 'Đang mở ca...' : 'Mở ca'}
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">Nhân viên</th>
                  <th className="px-4 py-3 font-black">Ca làm</th>
                  <th className="px-4 py-3 font-black">Trạng thái</th>
                  <th className="px-4 py-3 font-black">Doanh thu</th>
                  <th className="px-4 py-3 font-black">Thanh toán</th>
                  <th className="px-4 py-3 font-black">Đối soát</th>
                  <th className="px-4 py-3 text-right font-black">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-400">Đang tải...</td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-400">Chưa có ca nào trong ngày này</td>
                  </tr>
                ) : (
                  shifts.map((shift) => (
                    <tr key={shift.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-800">{shift.employee?.full_name || 'Nhân viên'}</p>
                        <p className="text-xs font-semibold text-slate-400">{shift.shift_name || shift.shift_date}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-900">{shift.shift_name || 'Ca bán hàng'}</p>
                        <p className="text-xs font-semibold text-slate-400">{shift.shift_date}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(shift.status)}`}>
                          {statusLabel(shift.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-900">{money(shift.summary?.revenue || 0)}</p>
                        <p className="text-xs font-semibold text-slate-400">{shift.summary?.order_count || 0} đơn</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                        <p>Tiền mặt: {money(shift.summary?.payments.cash || 0)}</p>
                        <p>CK/thẻ: {money((shift.summary?.payments.transfer || 0) + (shift.summary?.payments.card || 0))}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400">Đầu ca {money(shift.opening_cash || 0)}</p>
                        <p className={`font-black ${Number(shift.cash_difference || 0) < 0 ? 'text-red-600' : Number(shift.cash_difference || 0) > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                          Lệch {shift.cash_difference === null || shift.cash_difference === undefined ? '-' : money(shift.cash_difference)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button onClick={() => viewShift(shift)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 transition">
                            <HiOutlineEye className="h-4 w-4" />
                            Xem
                          </button>
                          {shift.status === 'checked_in' && (
                            <button
                              onClick={() => {
                                setClosingShift(shift);
                                setClosingCashInput('');
                                setManagerNoteInput('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 transition"
                            >
                              Chốt ca
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Báo cáo ca làm</p>
                <h3 className="text-lg font-black text-slate-900">
                  {selectedShift.employee?.full_name} - {selectedShift.shift_name || selectedShift.shift_date}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedShift.status === 'checked_in' && (
                  <button
                    onClick={() => {
                      setClosingShift(selectedShift);
                      setSelectedShift(null);
                      setClosingCashInput('');
                      setManagerNoteInput('');
                    }}
                    className="rounded-lg bg-red-650 px-4 py-2 text-sm font-black text-white hover:bg-red-700 transition"
                  >
                    Chốt ca này
                  </button>
                )}
                <button onClick={() => setSelectedShift(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold bg-white text-slate-700 hover:bg-slate-50 transition">
                  Đóng
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <HiOutlineChartBar className="mb-2 h-5 w-5 text-blue-600" />
                  <p className="text-xs font-black uppercase text-slate-400">Doanh thu</p>
                  <p className="text-xl font-black text-slate-900">{money(selectedShift.summary?.revenue || 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <HiOutlineClipboardList className="mb-2 h-5 w-5 text-emerald-600" />
                  <p className="text-xs font-black uppercase text-slate-400">Số đơn</p>
                  <p className="text-xl font-black text-slate-900">{selectedShift.summary?.order_count || 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">Tiền cần có</p>
                  <p className="text-xl font-black text-slate-900">{money(selectedShift.expected_cash || 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">Lệch tiền</p>
                  <p className="text-xl font-black text-slate-900">{selectedShift.cash_difference == null ? '-' : money(selectedShift.cash_difference)}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-black uppercase text-slate-700">Sản phẩm đã bán</h4>
                  <div className="mt-3 space-y-2">
                    {(selectedShift.summary?.top_products || []).length === 0 ? (
                      <p className="py-6 text-center text-sm font-semibold text-slate-400">Chưa có sản phẩm</p>
                    ) : (
                      selectedShift.summary?.top_products.map((item) => (
                        <div key={item.product_id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-bold text-slate-700">{item.product_name}</span>
                          <span className="font-black text-blue-700">{item.quantity} - {money(item.revenue)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-black uppercase text-slate-700">Đơn hàng trong ca</h4>
                  <div className="mt-3 max-h-72 overflow-y-auto">
                    {(selectedShift.orders || []).length === 0 ? (
                      <p className="py-6 text-center text-sm font-semibold text-slate-400">Chưa có đơn hàng</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {selectedShift.orders?.map((order) => (
                          <div key={order.id} className="flex items-center justify-between py-2 text-sm">
                            <div>
                              <p className="font-black text-slate-800">{order.order_number}</p>
                              <p className="text-xs font-semibold text-slate-400">{new Date(order.created_at).toLocaleString('vi-VN')}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-slate-900">{money(order.final_amount)}</p>
                              <p className="text-xs font-bold text-slate-400">{order.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {selectedShift.note && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Ghi chú chốt ca: {selectedShift.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {closingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase text-red-650">Yêu cầu chốt ca nhân viên</p>
                <h3 className="text-base font-black text-slate-900">
                  {closingShift.employee?.full_name}
                </h3>
              </div>
              <button onClick={() => setClosingShift(null)} className="text-slate-450 hover:text-slate-650 text-base font-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 space-y-2.5 text-xs font-bold text-slate-600">
                <div className="flex justify-between items-center">
                  <span>Mã ca / Tên ca:</span>
                  <span className="text-slate-800 font-black">{closingShift.shift_name || 'Ca bán hàng'} ({closingShift.shift_code})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tiền mở ca đầu ca:</span>
                  <span className="text-slate-800">{money(closingShift.opening_cash)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Doanh thu tiền mặt phát sinh:</span>
                  <span className="text-slate-800">{money(closingShift.summary?.payments.cash || 0)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-xs text-slate-500 font-bold">
                  <span>Doanh thu hình thức khác (CK/Thẻ):</span>
                  <span className="text-slate-800">
                    {money((closingShift.summary?.payments.transfer || 0) + (closingShift.summary?.payments.card || 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2.5 text-sm font-extrabold text-slate-800">
                  <span>Tổng tiền mặt hệ thống cần thu hồi:</span>
                  <span className="text-blue-600 font-black">
                    {money(Number(closingShift.opening_cash) + Number(closingShift.summary?.payments.cash || 0))}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase">Tiền mặt thực tế thu hồi</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={closingCashInput}
                  onChange={(e) => setClosingCashInput(e.target.value)}
                  placeholder="VD: 1500000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-base font-black text-slate-800 outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              {closingCashInput.trim() !== '' && (
                <div className={`rounded-xl border p-3 flex justify-between items-center ${
                  Number(closingCashInput) - (Number(closingShift.opening_cash) + Number(closingShift.summary?.payments.cash || 0)) === 0
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                    : 'bg-amber-50 border-amber-100 text-amber-800'
                }`}>
                  <span className="text-xs font-black uppercase">Chênh lệch đối soát:</span>
                  <span className="text-base font-black">
                    {money(Number(closingCashInput) - (Number(closingShift.opening_cash) + Number(closingShift.summary?.payments.cash || 0)))}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase">Ghi chú của quản lý</label>
                <textarea
                  value={managerNoteInput}
                  onChange={(e) => setManagerNoteInput(e.target.value)}
                  placeholder="Nhập lý do lệch tiền hoặc ghi chú kiểm đếm..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-blue-500 min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClosingShift(null)}
                  className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={closingLoading}
                  className="py-2.5 bg-red-650 hover:bg-red-750 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  {closingLoading ? 'Đang chốt ca...' : 'Xác nhận chốt ca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsPage;
