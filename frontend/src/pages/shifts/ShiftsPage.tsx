import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineCash,
  HiOutlineEye,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineUser,
  HiOutlineFilter,
  HiOutlineX,
  HiOutlineBan,
  HiOutlineExclamation,
} from 'react-icons/hi';
import { shiftAPI } from '../../services/shift.api';
import { staffAPI } from '../../services/staff.api';
import { ShiftSession, StaffUser } from '../../types/domain.type';

/* ───────── Helpers ───────── */
const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const today = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const nDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const statusLabel = (status: ShiftSession['status']) => {
  if (status === 'opened') return 'Đã mở ca';
  if (status === 'checked_in') return 'Đang bán hàng';
  if (status === 'closed') return 'Đã chốt ca';
  return 'Đã hủy';
};
const statusClass = (status: ShiftSession['status']) => {
  if (status === 'opened') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'checked_in') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'closed') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-red-50 text-red-600 border-red-200';
};
const statusDot = (status: ShiftSession['status']) => {
  if (status === 'opened') return 'bg-blue-500';
  if (status === 'checked_in') return 'bg-emerald-500 animate-pulse';
  if (status === 'closed') return 'bg-slate-400';
  return 'bg-red-400';
};

const formatTime = (isoStr?: string | null) => {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};
const formatDateTime = (isoStr?: string | null) => {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleString('vi-VN');
};
const shiftDuration = (start?: string | null, end?: string | null) => {
  if (!start) return '-';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} phút`;
  return `${h}h ${m}p`;
};

const actualWorkDuration = (shift: ShiftSession) => {
  if (shift.total_work_minutes !== null && shift.total_work_minutes !== undefined) {
    const minutes = Math.max(0, Number(shift.total_work_minutes));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
  }
  return shiftDuration(shift.started_at || shift.checked_in_at, shift.closed_at);
};

const getShiftDurationText = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return { text: '', overnight: false };
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  
  let diffMins = endMins - startMins;
  let overnight = false;
  if (diffMins < 0) {
    diffMins += 24 * 60;
    overnight = true;
  } else if (diffMins === 0) {
    diffMins = 24 * 60;
    overnight = true;
  }
  
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  
  const durationStr = h > 0 
    ? (m > 0 ? `${h}h ${m}p` : `${h}h`) 
    : `${m}p`;
    
  return {
    text: `${durationStr}${overnight ? ' (Qua ngày hôm sau)' : ''}`,
    overnight
  };
};

/* ───────── Component ───────── */
const ShiftsPage = () => {
  const [shifts, setShifts] = useState<ShiftSession[]>([]);
  const [cashiers, setCashiers] = useState<StaffUser[]>([]);
  const [allStaff, setAllStaff] = useState<StaffUser[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Open shift form
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [shiftPreset, setShiftPreset] = useState('ca_sang');
  const [startHour, setStartHour] = useState('08');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('12');
  const [endMinute, setEndMinute] = useState('00');
  const [openShiftModal, setOpenShiftModal] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals
  const [selectedShift, setSelectedShift] = useState<ShiftSession | null>(null);
  const [closingShift, setClosingShift] = useState<ShiftSession | null>(null);
  const [closingCashInput, setClosingCashInput] = useState('');
  const [managerNoteInput, setManagerNoteInput] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [cancellingShift, setCancellingShift] = useState<ShiftSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Detail modal tab
  const [detailTab, setDetailTab] = useState<'overview' | 'orders' | 'cash_drawer'>('overview');

  /* ───────── Data Loading ───────── */
  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (dateFrom === dateTo) {
        params.date = dateFrom;
      } else {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      if (filterEmployee) params.employee_id = filterEmployee;
      if (filterStatus) params.status = filterStatus;

      const [shiftRes, staffRes] = await Promise.all([
        shiftAPI.list(params),
        staffAPI.list({ limit: 100, is_active: 'true' }),
      ]);
      setShifts(shiftRes.data.data.items);
      const staff = staffRes.data.data.items;
      setAllStaff(staff);
      setCashiers(staff.filter((item) => item.role === 'cashier'));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được danh sách ca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo, filterEmployee, filterStatus]);

  /* ───────── Totals ───────── */
  const totals = useMemo(() => {
    return shifts.reduce(
      (acc, shift) => {
        acc.revenue += shift.summary?.revenue || 0;
        acc.orders += shift.summary?.order_count || 0;
        acc.cash += shift.summary?.payments.cash || 0;
        acc.diff += shift.cash_difference || 0;
        acc.activeCount += ['opened', 'checked_in'].includes(shift.status) ? 1 : 0;
        acc.closedCount += shift.status === 'closed' ? 1 : 0;
        return acc;
      },
      { revenue: 0, orders: 0, cash: 0, diff: 0, activeCount: 0, closedCount: 0 }
    );
  }, [shifts]);

  /* ───────── Actions ───────── */
  const openShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEmployee) { toast.error('Chọn nhân viên thu ngân'); return; }

    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    let finalShiftName = '';
    if (shiftPreset === 'ca_sang') finalShiftName = 'Ca sáng (08:00 - 12:00)';
    else if (shiftPreset === 'ca_chieu') finalShiftName = 'Ca chiều (12:00 - 17:00)';
    else if (shiftPreset === 'ca_toi') finalShiftName = 'Ca tối (17:00 - 22:00)';
    else if (shiftPreset === 'ca_ca_ngay') finalShiftName = 'Ca cả ngày (08:00 - 22:00)';
    else {
      finalShiftName = `Ca tự chọn (${startTime} - ${endTime})`;
    }

    setSaving(true);
    try {
      const response = await shiftAPI.open({
        employee_id: selectedEmployee,
        shift_date: dateFrom === dateTo ? dateFrom : today(),
        shift_name: finalShiftName,
      });
      const emailNotification = response.data.data.email_notification;
      toast.success(
        emailNotification === 'sent'
          ? 'Đã mở ca và gửi thông báo email cho nhân viên'
          : 'Đã mở ca cho nhân viên (chưa gửi được email)',
        { duration: 4500 }
      );
      setSelectedEmployee('');
      setShiftPreset('ca_sang');
      setStartHour('08');
      setStartMinute('00');
      setEndHour('12');
      setEndMinute('00');
      setOpenShiftModal(false);
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Mở ca thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseShift = async (e: FormEvent) => {
    e.preventDefault();
    if (!closingShift) return;
    const closingCash = Number(closingCashInput);
    if (isNaN(closingCash) || closingCash < 0) { toast.error('Tiền chốt ca thực tế không hợp lệ'); return; }
    setClosingLoading(true);
    try {
      await shiftAPI.closeByManager(closingShift.id, { closing_cash: closingCash, note: managerNoteInput.trim() || null });
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

  const handleCancelShift = async () => {
    if (!cancellingShift) return;
    setCancelLoading(true);
    try {
      await shiftAPI.cancel(cancellingShift.id, cancelReason.trim() || null);
      toast.success('Đã hủy ca thành công');
      setCancellingShift(null);
      setCancelReason('');
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Hủy ca thất bại');
    } finally {
      setCancelLoading(false);
    }
  };

  const viewShift = async (shift: ShiftSession) => {
    try {
      const response = await shiftAPI.get(shift.id);
      setSelectedShift(response.data.data);
      setDetailTab('overview');
    } catch {
      toast.error('Không tải được chi tiết ca');
    }
  };

  const clearFilters = () => {
    setDateFrom(today());
    setDateTo(today());
    setFilterEmployee('');
    setFilterStatus('');
  };

  const hasActiveFilters = filterEmployee || filterStatus || dateFrom !== today() || dateTo !== today();

  /* ─── Quick date presets ─── */
  const presetToday = () => { setDateFrom(today()); setDateTo(today()); };
  const presetYesterday = () => { const y = nDaysAgo(1); setDateFrom(y); setDateTo(y); };
  const presetWeek = () => { setDateFrom(nDaysAgo(6)); setDateTo(today()); };
  const presetMonth = () => { setDateFrom(nDaysAgo(29)); setDateTo(today()); };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Quản lý ca làm</h1>
          <p className="text-sm font-medium text-slate-500">
            Mở ca cho thu ngân, theo dõi doanh thu, đối soát tiền và lịch sử ca từng nhân viên.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 transition self-start"
        >
          <HiOutlineRefresh className="h-4 w-4" />
          Tải lại
        </button>
      </header>

      {/* ═══════════════ FILTERS ═══════════════ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <HiOutlineFilter className="h-4 w-4 text-slate-400" />
          <h2 className="text-xs font-black uppercase text-slate-500">Bộ lọc</h2>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs font-bold text-blue-600 hover:text-blue-800 transition">
              Xoá bộ lọc
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-400 uppercase">Từ ngày</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-400 uppercase">Đến ngày</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-400 uppercase">Nhân viên</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
            >
              <option value="">Tất cả nhân viên</option>
              {allStaff.filter(s => s.role === 'cashier').map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-400 uppercase">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
            >
              <option value="">Tất cả</option>
              <option value="opened">Đã mở ca</option>
              <option value="checked_in">Đang bán hàng</option>
              <option value="closed">Đã chốt ca</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-400 uppercase">Lọc nhanh</label>
            <div className="grid grid-cols-4 gap-1">
              <button onClick={presetToday} className={`py-2 rounded-lg text-xs font-black transition ${dateFrom === today() && dateTo === today() ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Hôm nay</button>
              <button onClick={presetYesterday} className={`py-2 rounded-lg text-xs font-black transition ${dateFrom === nDaysAgo(1) && dateTo === nDaysAgo(1) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Hôm qua</button>
              <button onClick={presetWeek} className={`py-2 rounded-lg text-xs font-black transition ${dateFrom === nDaysAgo(6) && dateTo === today() ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>7N</button>
              <button onClick={presetMonth} className={`py-2 rounded-lg text-xs font-black transition ${dateFrom === nDaysAgo(29) && dateTo === today() ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>30N</button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ DASHBOARD CARDS ═══════════════ */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tổng ca</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{shifts.length}</p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">{totals.activeCount} đang mở · {totals.closedCount} đã chốt</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Doanh thu</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{money(totals.revenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tổng đơn</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{totals.orders}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tiền mặt bán</p>
          <p className="mt-1.5 text-2xl font-black text-slate-900">{money(totals.cash)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tổng lệch tiền</p>
          <p className={`mt-1.5 text-2xl font-black ${totals.diff < 0 ? 'text-red-600' : totals.diff > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {money(totals.diff)}
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-blue-100/60 p-4 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-500">TB / đơn</p>
          <p className="mt-1.5 text-2xl font-black text-blue-700">
            {totals.orders > 0 ? money(totals.revenue / totals.orders) : '0đ'}
          </p>
        </div>
      </section>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="app-icon-tile flex h-10 w-10 shrink-0 items-center justify-center bg-blue-600 text-white">
              <HiOutlineClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Mở ca cho nhân viên</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Thiết lập ca làm và bàn giao cho thu ngân ngay tại đây.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenShiftModal(true)}
            className="app-modal-control inline-flex h-10 shrink-0 items-center justify-center gap-2 bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
          >
            <HiOutlinePlus className="h-4 w-4" />
            Mở ca mới
          </button>
        </div>

        {openShiftModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpenShiftModal(false);
            }}
          >
            <div className="app-modal-panel w-full max-w-xl overflow-hidden border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="shift-modal-title">
              {/* ─── Open Shift Form ─── */}
              <form onSubmit={openShift} className="p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-50 text-blue-600">
                      <HiOutlineClock className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 id="shift-modal-title" className="text-base font-black text-slate-900">Mở ca cho nhân viên</h2>
                      <p className="mt-1 text-xs font-medium text-slate-500">Sau khi mở ca, nhân viên có thể đăng nhập và nhận ca.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenShiftModal(false)}
                    className="app-modal-control flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    aria-label="Đóng cửa sổ"
                  >
                    <HiOutlineX className="h-5 w-5" />
                  </button>
                </div>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Thu ngân</span>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="app-modal-control w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
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
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Ca làm việc</span>
              <select
                value={shiftPreset}
                onChange={(e) => {
                  const val = e.target.value;
                  setShiftPreset(val);
                  if (val === 'ca_sang') {
                    setStartHour('08');
                    setStartMinute('00');
                    setEndHour('12');
                    setEndMinute('00');
                  } else if (val === 'ca_chieu') {
                    setStartHour('12');
                    setStartMinute('00');
                    setEndHour('17');
                    setEndMinute('00');
                  } else if (val === 'ca_toi') {
                    setStartHour('17');
                    setStartMinute('00');
                    setEndHour('22');
                    setEndMinute('00');
                  } else if (val === 'ca_ca_ngay') {
                    setStartHour('08');
                    setStartMinute('00');
                    setEndHour('22');
                    setEndMinute('00');
                  }
                }}
                className="app-modal-control w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="ca_sang">Ca sáng (08:00 - 12:00)</option>
                <option value="ca_chieu">Ca chiều (12:00 - 17:00)</option>
                <option value="ca_toi">Ca tối (17:00 - 22:00)</option>
                <option value="ca_ca_ngay">Ca cả ngày (08:00 - 22:00)</option>
                <option value="custom">Ca tùy chỉnh</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Giờ bắt đầu</span>
                <div className="flex gap-1">
                  <select
                    value={startHour}
                    onChange={(e) => {
                      setStartHour(e.target.value);
                      setShiftPreset('custom');
                    }}
                    className="app-modal-control w-1/2 border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="self-center font-bold text-slate-400">:</span>
                  <select
                    value={startMinute}
                    onChange={(e) => {
                      setStartMinute(e.target.value);
                      setShiftPreset('custom');
                    }}
                    className="app-modal-control w-1/2 border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Giờ kết thúc</span>
                <div className="flex gap-1">
                  <select
                    value={endHour}
                    onChange={(e) => {
                      setEndHour(e.target.value);
                      setShiftPreset('custom');
                    }}
                    className="app-modal-control w-1/2 border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="self-center font-bold text-slate-400">:</span>
                  <select
                    value={endMinute}
                    onChange={(e) => {
                      setEndMinute(e.target.value);
                      setShiftPreset('custom');
                    }}
                    className="app-modal-control w-1/2 border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {(() => {
              const info = getShiftDurationText(`${startHour}:${startMinute}`, `${endHour}:${endMinute}`);
              return (
                <p className="text-xs font-bold mt-2.5 flex items-center gap-1">
                  <span className="text-slate-400 font-semibold">Tổng thời gian dự kiến:</span>
                  <span className={info.overnight ? 'text-amber-600' : 'text-emerald-600'}>{info.text}</span>
                </p>
              );
            })()}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="app-modal-control mt-5 inline-flex w-full items-center justify-center gap-2 bg-blue-600 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <HiOutlinePlus className="h-4 w-4" />
            {saving ? 'Đang mở ca...' : 'Mở ca'}
          </button>
        </form>
            </div>
          </div>
        )}

        {/* ─── Shift Table ─── */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase text-slate-600">
              Danh sách ca ({shifts.length})
            </h2>
            {dateFrom === dateTo && (
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <HiOutlineCalendar className="h-3.5 w-3.5" />
                {dateFrom}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">Nhân viên</th>
                  <th className="px-4 py-3 font-black">Ca / Ngày</th>
                  <th className="px-4 py-3 font-black">Trạng thái</th>
                  <th className="px-4 py-3 font-black">Thời gian</th>
                  <th className="px-4 py-3 font-black">Doanh thu</th>
                  <th className="px-4 py-3 font-black">Đối soát</th>
                  <th className="px-4 py-3 text-right font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center font-semibold text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                      Đang tải dữ liệu ca...
                    </div>
                  </td></tr>
                ) : shifts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center font-semibold text-slate-400">
                    <HiOutlineCalendar className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    Chưa có ca nào trong khoảng thời gian này
                  </td></tr>
                ) : (
                  shifts.map((shift) => (
                    <tr key={shift.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                            {(shift.employee?.full_name || 'N')[0]}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm">{shift.employee?.full_name || 'Nhân viên'}</p>
                            <p className="text-xs font-semibold text-slate-400">{shift.employee?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{shift.shift_name || 'Ca bán hàng'}</p>
                        <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                          <HiOutlineCalendar className="h-3 w-3" />
                          {shift.shift_date}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(shift.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(shift.status)}`} />
                          {statusLabel(shift.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-500 flex items-center gap-1">
                            <HiOutlineClock className="h-3 w-3" />
                            Mở: {formatTime(shift.created_at)}
                          </p>
                          {shift.checked_in_at && (
                            <p className="font-semibold text-slate-500">Nhận: {formatTime(shift.checked_in_at)}</p>
                          )}
                          {shift.closed_at && (
                            <p className="font-semibold text-slate-500">Chốt: {formatTime(shift.closed_at)}</p>
                          )}
                          {shift.checked_in_at && (
                            <p className="font-bold text-slate-700">
                              ⏱ {actualWorkDuration(shift)}
                            </p>
                          )}
                          {!shift.checked_in_at && shift.closed_at && (
                            <p className="font-bold text-slate-700">⏱ {actualWorkDuration(shift)}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-900">{money(shift.summary?.revenue || 0)}</p>
                        <p className="text-xs font-semibold text-slate-400">{shift.summary?.order_count || 0} đơn</p>
                        <div className="text-xs font-semibold text-slate-400 mt-0.5">
                          <span>TM: {money(shift.summary?.payments.cash || 0)}</span>
                          {' · '}
                          <span>CK: {money((shift.summary?.payments.transfer || 0) + (shift.summary?.payments.card || 0))}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400">Đầu ca {money(shift.opening_cash || 0)}</p>
                        {shift.closing_cash != null && (
                          <p className="text-xs font-semibold text-slate-400">Thực tế {money(shift.closing_cash)}</p>
                        )}
                        <p className={`font-black text-sm ${Number(shift.cash_difference || 0) < 0 ? 'text-red-600' : Number(shift.cash_difference || 0) > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                          {shift.cash_difference == null ? '-' : `Lệch ${money(shift.cash_difference)}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-col items-end gap-1.5">
                          <button onClick={() => viewShift(shift)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 hover:bg-blue-100 transition">
                            <HiOutlineEye className="h-3.5 w-3.5" />
                            Chi tiết
                          </button>
                          {(shift.status === 'checked_in' || shift.status === 'opened') && (
                            <button
                              onClick={() => { setClosingShift(shift); setClosingCashInput(''); setManagerNoteInput(''); }}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-100 transition"
                            >
                              Chốt ca
                            </button>
                          )}
                          {shift.status === 'opened' && (
                            <button
                              onClick={() => { setCancellingShift(shift); setCancelReason(''); }}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 hover:bg-red-100 transition"
                            >
                              <HiOutlineBan className="h-3.5 w-3.5" />
                              Hủy ca
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

      {/* ═══════════════ DETAIL MODAL ═══════════════ */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setSelectedShift(null)}>
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(selectedShift.status)}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot(selectedShift.status)}`} />
                    {statusLabel(selectedShift.status)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    {selectedShift.shift_code}
                  </span>
                </div>
                <h3 className="mt-1.5 text-lg font-black text-slate-900">
                  {selectedShift.employee?.full_name} — {selectedShift.shift_name || 'Ca bán hàng'}
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  Ngày {selectedShift.shift_date} · Mở bởi {selectedShift.opener?.full_name || 'Quản lý'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(selectedShift.status === 'checked_in' || selectedShift.status === 'opened') && (
                  <button
                    onClick={() => {
                      setClosingShift(selectedShift);
                      setSelectedShift(null);
                      setClosingCashInput('');
                      setManagerNoteInput('');
                    }}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700 transition"
                  >
                    Chốt ca này
                  </button>
                )}
                <button onClick={() => setSelectedShift(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                  <HiOutlineX className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 px-6">
              <div className="flex gap-1">
                {[
                  { key: 'overview' as const, label: 'Tổng quan', icon: HiOutlineChartBar },
                  { key: 'orders' as const, label: `Đơn hàng (${selectedShift.orders?.length || 0})`, icon: HiOutlineClipboardList },
                  { key: 'cash_drawer' as const, label: 'Két tiền', icon: HiOutlineCash },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-black uppercase transition border-b-2 ${
                      detailTab === tab.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="overflow-y-auto p-6">
              {/* ── Overview Tab ── */}
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  {/* Time info */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-1"><HiOutlineClock className="h-3 w-3" />Mở ca</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{formatDateTime(selectedShift.created_at)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="text-xs font-bold text-slate-400">Nhận ca</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{formatDateTime(selectedShift.checked_in_at)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="text-xs font-bold text-slate-400">Chốt ca</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{formatDateTime(selectedShift.closed_at)}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3.5">
                      <p className="text-xs font-bold text-blue-500">Tổng thời gian</p>
                      <p className="mt-1 text-sm font-black text-blue-700">{actualWorkDuration(selectedShift)}</p>
                    </div>
                  </div>

                  {/* Revenue cards */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <HiOutlineChartBar className="mb-1.5 h-5 w-5 text-blue-600" />
                      <p className="text-xs font-black uppercase text-slate-400">Doanh thu</p>
                      <p className="mt-1 text-xl font-black text-slate-900">{money(selectedShift.summary?.revenue || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <HiOutlineClipboardList className="mb-1.5 h-5 w-5 text-emerald-600" />
                      <p className="text-xs font-black uppercase text-slate-400">Đơn hàng</p>
                      <p className="mt-1 text-xl font-black text-slate-900">{selectedShift.summary?.order_count || 0}</p>
                      {(selectedShift.summary?.cancelled_count || 0) > 0 && (
                        <p className="text-xs font-semibold text-red-500">{selectedShift.summary?.cancelled_count} đơn hủy</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase text-slate-400">Tiền cần có</p>
                      <p className="mt-1 text-xl font-black text-slate-900">{money(selectedShift.expected_cash || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase text-slate-400">Lệch tiền</p>
                      <p className={`mt-1 text-xl font-black ${Number(selectedShift.cash_difference || 0) < 0 ? 'text-red-600' : Number(selectedShift.cash_difference || 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {selectedShift.cash_difference == null ? '-' : money(selectedShift.cash_difference)}
                      </p>
                    </div>
                  </div>

                  {/* Payment + Products */}
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <h4 className="text-sm font-black uppercase text-slate-700 mb-3">Thanh toán</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                          <span>Tiền mặt</span>
                          <span className="text-slate-900">{money(selectedShift.summary?.payments.cash || 0)}</span>
                        </div>
                        <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                          <span>Chuyển khoản</span>
                          <span className="text-slate-900">{money(selectedShift.summary?.payments.transfer || 0)}</span>
                        </div>
                        <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                          <span>Thẻ</span>
                          <span className="text-slate-900">{money(selectedShift.summary?.payments.card || 0)}</span>
                        </div>
                        <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                          <span>Khác</span>
                          <span className="text-slate-900">{money(selectedShift.summary?.payments.other || 0)}</span>
                        </div>
                        {Number(selectedShift.summary?.cash_drawer_tx_total || 0) !== 0 && (
                          <div className="flex justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold border border-slate-200/50">
                            <span>Điều chỉnh két</span>
                            <span className={`font-extrabold ${Number(selectedShift.summary?.cash_drawer_tx_total || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {Number(selectedShift.summary?.cash_drawer_tx_total || 0) >= 0 ? '+' : ''}{money(selectedShift.summary?.cash_drawer_tx_total || 0)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-slate-200 pt-2 px-3 text-sm font-black text-slate-900">
                          <span>Đầu ca</span>
                          <span>{money(selectedShift.opening_cash)}</span>
                        </div>
                        {selectedShift.closing_cash != null && (
                          <div className="flex justify-between px-3 text-sm font-black text-slate-900">
                            <span>Tiền thực tế</span>
                            <span>{money(selectedShift.closing_cash)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <h4 className="text-sm font-black uppercase text-slate-700 mb-3">Sản phẩm bán chạy</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(selectedShift.summary?.top_products || []).length === 0 ? (
                          <p className="py-6 text-center text-sm font-semibold text-slate-400">Chưa có sản phẩm</p>
                        ) : (
                          selectedShift.summary?.top_products.map((item, idx) => (
                            <div key={item.product_id} className="flex justify-between items-center rounded-lg bg-slate-50 px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded text-xs font-black text-slate-400 bg-white border border-slate-200">{idx + 1}</span>
                                <span className="font-bold text-slate-700">{item.product_name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-blue-700">{money(item.revenue)}</span>
                                <span className="ml-2 text-xs font-semibold text-slate-400">×{item.quantity}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {(selectedShift.note || selectedShift.manager_note) && (
                    <div className="space-y-2">
                      {selectedShift.note && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                          <span className="text-xs font-black uppercase text-amber-700">Ghi chú chốt ca: </span>
                          {selectedShift.note}
                        </div>
                      )}
                      {selectedShift.manager_note && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                          <span className="text-xs font-black uppercase text-blue-700">Ghi chú quản lý: </span>
                          {selectedShift.manager_note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Orders Tab ── */}
              {detailTab === 'orders' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-black">Mã đơn</th>
                        <th className="px-4 py-3 font-black">Thời gian</th>
                        <th className="px-4 py-3 font-black">Trạng thái</th>
                        <th className="px-4 py-3 font-black">Thanh toán</th>
                        <th className="px-4 py-3 text-right font-black">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedShift.orders || []).length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center font-semibold text-slate-400">Chưa có đơn hàng</td></tr>
                      ) : (
                        selectedShift.orders?.map((order) => (
                          <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-black text-slate-800">{order.order_number}</td>
                            <td className="px-4 py-3 font-semibold text-slate-500">{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-black ${
                                order.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                order.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {order.status === 'completed' ? 'Hoàn thành' : order.status === 'cancelled' ? 'Đã hủy' : order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                              {order.payments?.map(p => `${p.method === 'cash' ? 'TM' : p.method === 'transfer' ? 'CK' : p.method}: ${money(p.amount)}`).join(', ') || '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">{money(order.final_amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Cash Drawer Tab ── */}
              {detailTab === 'cash_drawer' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-black">Thời gian</th>
                        <th className="px-4 py-3 font-black">Loại</th>
                        <th className="px-4 py-3 font-black">Số tiền</th>
                        <th className="px-4 py-3 font-black">Lý do</th>
                        <th className="px-4 py-3 font-black">Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedShift.cash_drawer_transactions || []).length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center font-semibold text-slate-400">Chưa có giao dịch két tiền</td></tr>
                      ) : (
                        selectedShift.cash_drawer_transactions?.map((tx) => (
                          <tr key={tx.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-semibold text-slate-500">{new Date(tx.created_at).toLocaleString('vi-VN')}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${tx.type === 'cash_in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                {tx.type === 'cash_in' ? 'Nạp tiền' : 'Rút tiền'}
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CLOSE SHIFT MODAL ═══════════════ */}
      {closingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setClosingShift(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-black uppercase text-amber-600">Chốt ca làm việc</p>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  {closingShift.employee?.full_name} — {closingShift.shift_name || 'Ca bán hàng'}
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  Ngày {closingShift.shift_date} · {statusLabel(closingShift.status)}
                </p>
              </div>
              <button onClick={() => setClosingShift(null)} className="text-slate-400 hover:text-slate-600 p-1 transition">
                <HiOutlineX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="p-6 space-y-4">
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
                  <span>Doanh thu tiền mặt:</span>
                  <span className="text-slate-800">{money(closingShift.summary?.payments.cash || 0)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-xs text-slate-500 font-bold">
                  <span>Doanh thu CK/Thẻ:</span>
                  <span className="text-slate-800">
                    {money((closingShift.summary?.payments.transfer || 0) + (closingShift.summary?.payments.card || 0))}
                  </span>
                </div>
                {Number(closingShift.summary?.cash_drawer_tx_total || 0) !== 0 && (
                  <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                    <span>Điều chỉnh két:</span>
                    <span className={`font-extrabold ${Number(closingShift.summary?.cash_drawer_tx_total || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {Number(closingShift.summary?.cash_drawer_tx_total || 0) >= 0 ? '+' : ''}{money(closingShift.summary?.cash_drawer_tx_total || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 pt-2.5 text-sm font-extrabold text-slate-800">
                  <span>Tổng tiền mặt cần thu hồi:</span>
                  <span className="text-blue-600 font-black">
                    {money(Number(closingShift.opening_cash) + Number(closingShift.summary?.payments.cash || 0) + Number(closingShift.summary?.cash_drawer_tx_total || 0))}
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-base font-black text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                  autoFocus
                />
              </div>

              {closingCashInput.trim() !== '' && (() => {
                const expected = Number(closingShift.opening_cash) + Number(closingShift.summary?.payments.cash || 0) + Number(closingShift.summary?.cash_drawer_tx_total || 0);
                const diff = Number(closingCashInput) - expected;
                return (
                  <div className={`rounded-xl border p-3 flex justify-between items-center ${
                    diff === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                  }`}>
                    <span className="text-xs font-black uppercase">Chênh lệch:</span>
                    <span className="text-base font-black">{money(diff)}</span>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase">Ghi chú quản lý</label>
                <textarea
                  value={managerNoteInput}
                  onChange={(e) => setManagerNoteInput(e.target.value)}
                  placeholder="Nhập lý do lệch tiền hoặc ghi chú kiểm đếm..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white min-h-[60px] transition"
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
                  className="py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  {closingLoading ? 'Đang chốt ca...' : 'Xác nhận chốt ca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ CANCEL SHIFT MODAL ═══════════════ */}
      {cancellingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setCancellingShift(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <HiOutlineExclamation className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-red-600">Hủy ca làm</p>
                  <h3 className="text-sm font-black text-slate-900">{cancellingShift.employee?.full_name}</h3>
                </div>
              </div>
              <button onClick={() => setCancellingShift(null)} className="text-slate-400 hover:text-slate-600 p-1 transition">
                <HiOutlineX className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm font-semibold text-red-800">
                Bạn đang hủy ca <strong>{cancellingShift.shift_name || 'Ca bán hàng'}</strong> ngày <strong>{cancellingShift.shift_date}</strong> cho nhân viên <strong>{cancellingShift.employee?.full_name}</strong>.
                Ca này chưa được nhận nên có thể hủy an toàn.
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase">Lý do hủy (tùy chọn)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do hủy ca..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white min-h-[60px] transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancellingShift(null)}
                  className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
                >
                  Quay lại
                </button>
                <button
                  onClick={handleCancelShift}
                  disabled={cancelLoading}
                  className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <HiOutlineBan className="h-4 w-4" />
                  {cancelLoading ? 'Đang hủy...' : 'Xác nhận hủy ca'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsPage;
