import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlinePencil,
  HiOutlineLockClosed,
  HiOutlineXCircle,
  HiOutlineCheckCircle,
  HiOutlineIdentification,
  HiOutlineCash,
  HiOutlineShoppingCart,
  HiOutlineCube,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineEye,
  HiOutlineX,
} from 'react-icons/hi';
import { staffAPI, StaffPayload, StaffReportData } from '../../services/staff.api';
import { orderAPI } from '../../services/order.api';
import { StaffUser, Order } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';

const emptyForm = {
  password: '',
  full_name: '',
  phone: '',
  role: 'cashier' as const,
  is_active: true,
};

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

const getTodayDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const StaffPage = () => {
  const { user } = useAuthStore();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [lastCreated, setLastCreated] = useState<{ code: string; password: string; name: string } | null>(null);
  const canManageStaff = user?.role === 'admin';

  // State quản lý doanh thu nhân viên (Revenue / Sales reports)
  const [activeTab, setActiveTab] = useState<'accounts' | 'revenue'>('accounts');
  const [reportDate, setReportDate] = useState(getTodayDateString());
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [reportData, setReportData] = useState<StaffReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const reportableStaff = useMemo(
    () => staff.filter((s) => s.is_active && s.role !== 'admin'),
    [staff],
  );

  const loadStaff = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { search, limit: 100 };
      if (status !== 'all') params.is_active = status === 'active';
      const response = await staffAPI.list(params);
      setStaff(response.data.data.items);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [status]);

  // Chọn nhân viên đầu tiên hoạt động làm mặc định khi tải xong danh sách
  useEffect(() => {
    if (reportableStaff.length > 0 && !selectedStaffId) {
      const firstActive = reportableStaff[0];
      if (firstActive) {
        setSelectedStaffId(firstActive.id);
      }
    }
  }, [reportableStaff, selectedStaffId]);

  const loadStaffReport = async () => {
    if (!selectedStaffId) return;
    setReportLoading(true);
    try {
      const response = await staffAPI.getReport(selectedStaffId, reportDate);
      setReportData(response.data.data);
    } catch {
      toast.error('Không tải được báo cáo doanh thu');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'revenue') {
      loadStaffReport();
    }
  }, [selectedStaffId, reportDate, activeTab]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await orderAPI.get(id);
      setSelectedOrder(response.data.data);
    } catch {
      toast.error('Không tải được chi tiết hóa đơn');
    } finally {
      setDetailLoading(false);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const startEdit = (item: StaffUser) => {
    if (!canManageStaff) {
      toast.error('Chỉ admin mới có quyền cập nhật nhân viên');
      return;
    }
    setEditing(item);
    setLastCreated(null);
    setForm({
      password: '',
      full_name: item.full_name,
      phone: item.phone || '',
      role: item.role as any,
      is_active: item.is_active,
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageStaff) {
      toast.error('Chỉ admin mới có quyền lưu tài khoản nhân viên');
      return;
    }

    if (!form.full_name.trim()) {
      toast.error('Vui lòng nhập họ tên nhân viên');
      return;
    }

    if (!editing && form.password.length < 6) {
      toast.error('Mật khẩu tối thiểu 6 ký tự');
      return;
    }

    const payload: StaffPayload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      role: form.role as 'cashier' | 'manager' | 'admin',
      is_active: form.is_active,
    };

    if (form.password.trim()) payload.password = form.password.trim();

    setSaving(true);
    try {
      if (editing) {
        await staffAPI.update(editing.id, payload);
        toast.success('Đã cập nhật nhân viên');
        setLastCreated(null);
      } else {
        const response = await staffAPI.create(payload);
        const created = response.data.data;
        setLastCreated({ code: created.email, password: form.password.trim(), name: created.full_name });
        toast.success(`Đã tạo mã đăng nhập ${created.email}`);
      }
      resetForm();
      await loadStaff();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Lưu tài khoản thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (item: StaffUser) => {
    if (!canManageStaff) {
      toast.error('Chỉ admin mới có quyền khóa tài khoản nhân viên');
      return;
    }
    if (!window.confirm(`Vô hiệu hóa tài khoản ${item.full_name}? Nhân viên này sẽ không đăng nhập được nữa.`)) return;
    try {
      await staffAPI.deactivate(item.id);
      toast.success('Đã vô hiệu hóa tài khoản');
      await loadStaff();
      if (editing?.id === item.id) resetForm();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Vô hiệu hóa thất bại');
    }
  };

  const activate = async (item: StaffUser) => {
    if (!canManageStaff) {
      toast.error('Chỉ admin mới có quyền mở khóa tài khoản nhân viên');
      return;
    }
    try {
      await staffAPI.update(item.id, { is_active: true });
      toast.success('Đã mở khóa tài khoản');
      await loadStaff();
      if (editing?.id === item.id) resetForm();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Mở khóa thất bại');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* 1. Page Header */}
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <HiOutlineIdentification className="text-blue-600" size={24} />
            Quản lý nhân viên
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Quản trị tài khoản nhân viên và theo dõi chi tiết doanh số bán hàng trong ca trực.
          </p>
        </div>
      </header>

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'accounts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          Tài khoản nhân viên
        </button>
        <button
          onClick={() => setActiveTab('revenue')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'revenue'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          Doanh thu nhân viên
        </button>
      </div>

      {activeTab === 'accounts' ? (
        <>
          {/* Account Tab Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <div className="relative">
              <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') loadStaff();
                }}
                placeholder="Tìm tên, mã, SĐT..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-500 sm:w-72"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã khóa</option>
            </select>
            <button
              onClick={loadStaff}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              <HiOutlineRefresh className="h-4 w-4" />
              Tải lại
            </button>
          </div>

          {/* Account Creation Status Alert */}
          {lastCreated && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-emerald-700">Tài khoản vừa tạo</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">{lastCreated.name} có thể đăng nhập POS ngay.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase text-slate-400">Mã đăng nhập</p>
                    <p className="font-mono text-xl font-black text-slate-900">{lastCreated.code}</p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase text-slate-400">Mật khẩu</p>
                    <p className="font-mono text-xl font-black text-slate-900">{lastCreated.password}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Accounts List & Form Section */}
          <section className={`grid grid-cols-1 gap-6 ${canManageStaff ? 'xl:grid-cols-[380px_1fr]' : ''}`}>
            {canManageStaff && (
              <form onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">
                      {editing ? 'Cập nhật tài khoản' : 'Tạo nhân viên'}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {editing ? `Mã đăng nhập: ${editing.email}` : 'Mã đăng nhập sẽ tự sinh 6 số'}
                    </p>
                  </div>
                  {editing && (
                    <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500 hover:text-slate-900">
                      Hủy
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  {editing && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                      <span className="mb-1 block text-xs font-bold uppercase text-blue-500">Mã đăng nhập</span>
                      <div className="flex items-center gap-2 font-mono text-lg font-black text-blue-700">
                        <HiOutlineIdentification className="h-5 w-5" />
                        {editing.email}
                      </div>
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Họ tên</span>
                    <input
                      value={form.full_name}
                      onChange={(event) => setForm((state) => ({ ...state, full_name: event.target.value }))}
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Số điện thoại</span>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((state) => ({ ...state, phone: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                      {editing ? 'Mật khẩu mới' : 'Mật khẩu'}
                    </span>
                    <input
                      type="password"
                      autoComplete={editing ? 'new-password' : 'current-password'}
                      value={form.password}
                      onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
                      required={!editing}
                      placeholder={editing ? 'Bỏ trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">Vai trò</span>
                    <select
                      value={form.role}
                      onChange={(event) => setForm((state) => ({ ...state, role: event.target.value as any }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="cashier">Thu ngân</option>
                      <option value="manager">Quản lý</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((state) => ({ ...state, is_active: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    Cho phép đăng nhập
                  </label>
                </div>

                <button
                  disabled={saving}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {editing ? <HiOutlineLockClosed className="h-4 w-4" /> : <HiOutlinePlus className="h-4 w-4" />}
                  {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mã đăng nhập'}
                </button>
              </form>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-black">Nhân viên</th>
                      <th className="px-4 py-3 font-black">Mã đăng nhập</th>
                      <th className="px-4 py-3 font-black">Liên hệ</th>
                      <th className="px-4 py-3 font-black">Trạng thái</th>
                      <th className="px-4 py-3 font-black">Đăng nhập gần nhất</th>
                      {canManageStaff && <th className="px-4 py-3 text-right font-black">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={canManageStaff ? 6 : 5} className="px-4 py-8 text-center font-semibold text-slate-400">Đang tải...</td>
                      </tr>
                    ) : staff.length === 0 ? (
                      <tr>
                        <td colSpan={canManageStaff ? 6 : 5} className="px-4 py-8 text-center font-semibold text-slate-400">Chưa có nhân viên</td>
                      </tr>
                    ) : (
                      staff.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3">
                            <p className="font-black text-slate-800">{item.full_name}</p>
                            <p className={`text-xs font-bold uppercase ${item.role === 'admin' ? 'text-purple-600' : item.role === 'manager' ? 'text-amber-600' : 'text-blue-600'}`}>
                              {item.role === 'admin' ? 'Quản trị viên' : item.role === 'manager' ? 'Quản lý' : 'Thu ngân'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-lg font-black text-slate-800">{item.email}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate-400">{item.phone || 'Chưa có SĐT'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                              item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                            }`}>
                              {item.is_active ? <HiOutlineCheckCircle className="h-4 w-4" /> : <HiOutlineXCircle className="h-4 w-4" />}
                              {item.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-500">
                            {item.last_login ? new Date(item.last_login).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                          </td>
                          {canManageStaff && (
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => startEdit(item)} className="mr-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                                <HiOutlinePencil className="h-4 w-4" />
                                Sửa
                              </button>
                              {item.is_active ? (
                                <button onClick={() => deactivate(item)} className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 transition">
                                  <HiOutlineXCircle className="h-4 w-4" />
                                  Khóa
                                </button>
                              ) : (
                                <button onClick={() => activate(item)} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition">
                                  <HiOutlineCheckCircle className="h-4 w-4" />
                                  Mở khóa
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Revenue / Sales Statistics Tab */
        <div className="space-y-6">
          {/* Revenue tab filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Nhân viên:</span>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-705 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Chọn nhân viên...</option>
                  {reportableStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Ngày bán:</span>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
                  <HiOutlineCalendar className="text-slate-400" />
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={loadStaffReport}
              disabled={reportLoading || !selectedStaffId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-xs font-bold text-white px-4 py-2.5 disabled:opacity-60 transition duration-150 shadow-xs"
            >
              <HiOutlineRefresh className={`h-4 w-4 ${reportLoading ? 'animate-spin' : ''}`} />
              Tải báo cáo
            </button>
          </div>

          {/* Revenue Report Render States */}
          {reportLoading ? (
            <div className="py-20 text-center text-slate-400 font-bold bg-white border border-slate-200 rounded-2xl shadow-xs">
              <HiOutlineRefresh className="inline animate-spin mr-2 text-blue-500" size={18} />
              Đang tải dữ liệu doanh số nhân viên...
            </div>
          ) : !selectedStaffId ? (
            <div className="py-20 text-center text-slate-400 font-bold bg-white border border-slate-200 rounded-2xl shadow-xs">
              Vui lòng chọn một nhân viên để xem chi tiết doanh thu.
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              {/* Report Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Metric 1: Doanh thu */}
                <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all duration-300 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <HiOutlineCash size={22} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tổng doanh thu</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">
                      {money(reportData?.summary.total_revenue || 0)}
                    </h4>
                  </div>
                </div>

                {/* Metric 2: Số hóa đơn */}
                <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all duration-300 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <HiOutlineShoppingCart size={22} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Hóa đơn đã chốt</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">
                      {reportData?.summary.orders_count || 0}
                    </h4>
                  </div>
                </div>

                {/* Metric 3: Sản phẩm đã bán */}
                <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all duration-300 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <HiOutlineCube size={22} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Sản phẩm đã bán</p>
                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5 tracking-tight">
                      {reportData?.summary.products_count || 0}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Invoices List and Products Sold Tables Side-by-Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Invoices List Table */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="border-b border-slate-100 px-5 py-4 bg-slate-50/50 flex items-center gap-2">
                    <HiOutlineChartBar className="text-blue-500" size={16} />
                    <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Danh sách hóa đơn đã bán</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Mã đơn</th>
                          <th className="px-4 py-3">Khách hàng</th>
                          <th className="px-4 py-3">Thanh toán</th>
                          <th className="px-4 py-3 text-right">Tổng tiền</th>
                          <th className="px-4 py-3 text-center">Xem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {!reportData?.orders || reportData.orders.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                              Không có hóa đơn nào được bán trong ngày.
                            </td>
                          </tr>
                        ) : (
                          reportData.orders.map((o) => (
                            <tr key={o.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-4 py-3 font-black text-slate-900 font-mono tracking-tight text-xs">
                                {o.order_number}
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-800 text-xs">
                                {o.customer_name}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                  o.payment_method === 'Tiền mặt'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : o.payment_method === 'Thẻ ngân hàng'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                      : 'bg-blue-50 text-blue-750 border-blue-100'
                                }`}>
                                  {o.payment_method}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-900 font-mono text-xs">
                                {money(o.total_amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => openDetail(o.id)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs active:scale-90"
                                  title="Xem chi tiết hóa đơn"
                                >
                                  <HiOutlineEye size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Products Sold Summary Table */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="border-b border-slate-100 px-5 py-4 bg-slate-50/50 flex items-center gap-2">
                    <HiOutlineCube className="text-purple-500" size={16} />
                    <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Mặt hàng nhân viên đã bán</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Tên sản phẩm</th>
                          <th className="px-4 py-3 text-center">Số lượng</th>
                          <th className="px-4 py-3 text-right">Doanh thu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {!reportData?.products_sold || reportData.products_sold.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-12 text-center text-slate-400 font-bold">
                              Chưa bán được sản phẩm nào trong ngày.
                            </td>
                          </tr>
                        ) : (
                          reportData.products_sold.map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition">
                              <td className="px-4 py-3 font-extrabold text-slate-850 text-xs">
                                {p.name}
                              </td>
                              <td className="px-4 py-3 text-center font-black text-slate-900 font-mono text-xs">
                                {p.quantity}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-emerald-600 font-mono text-xs">
                                {money(p.revenue)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Drawer Chi tiết Hóa đơn (Thermal Receipt style) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setSelectedOrder(null)} 
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md transform bg-white shadow-2xl transition duration-500 ease-in-out border-l border-slate-100 flex flex-col h-full animate-slideLeft">
                
                {/* Drawer Header */}
                <div className="bg-slate-950 px-5 py-5 text-white flex items-center justify-between shadow-md shrink-0">
                  <div>
                    <h2 className="text-base font-black flex items-center gap-2 text-white">
                      <HiOutlineChartBar className="text-blue-500" size={18} />
                      Chi tiết Hóa đơn
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-400 font-semibold font-mono">
                      Số: {selectedOrder.order_number}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <HiOutlineX size={16} />
                  </button>
                </div>

                {/* Drawer Body - Scrollable Thermal Receipt style */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                  {detailLoading ? (
                    <div className="py-20 text-center text-slate-400 font-semibold">
                      <HiOutlineRefresh className="inline animate-spin mr-2 text-blue-500" size={16} />
                      Đang lấy chi tiết...
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5 relative overflow-hidden">
                      {/* Top decoration (Receipt design) */}
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                      
                      {/* Logo and Store Name */}
                      <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-200">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">SORA POS</h3>
                        <p className="text-[10px] text-slate-400 font-bold">HÓA ĐƠN BÁN HÀNG</p>
                        <div className="flex justify-center items-center gap-1.5 text-xs text-slate-500 font-semibold mt-1">
                          <HiOutlineCalendar size={12} />
                          {formatDate(selectedOrder.created_at)}
                        </div>
                      </div>

                      {/* Receipt Metadata */}
                      <div className="space-y-2 text-xs font-semibold text-slate-650 pb-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Khách hàng:</span>
                          <span className="text-slate-800 font-extrabold">{selectedOrder.customers?.name || 'Khách lẻ'}</span>
                        </div>
                        {selectedOrder.customers?.phone && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Số điện thoại:</span>
                            <span className="text-slate-800 font-extrabold">{selectedOrder.customers.phone}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Trạng thái đơn:</span>
                          <span className={`font-black uppercase ${selectedOrder.status === 'completed' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {selectedOrder.status === 'completed' ? 'Thành công' : 'Đã hủy'}
                          </span>
                        </div>
                        {selectedOrder.note && (
                          <div className="pt-2 border-t border-slate-100/50">
                            <p className="text-slate-400 mb-0.5">Ghi chú:</p>
                            <p className="text-slate-700 leading-relaxed font-semibold italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                              "{selectedOrder.note}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Products List */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">Danh sách hàng hóa</p>
                        <div className="divide-y divide-slate-100">
                          {selectedOrder.order_details?.map((item) => (
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
                      <div className="border-t border-dashed border-slate-200 pt-4 space-y-2 text-xs font-semibold text-slate-650">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tổng tiền hàng:</span>
                          <span className="font-bold text-slate-800 font-mono">{money(selectedOrder.total_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Chiết khấu / Giảm giá:</span>
                          <span className="font-bold text-rose-600 font-mono">-{money(selectedOrder.discount_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                          <span className="font-black text-slate-800">Thanh toán thực tế:</span>
                          <span className="font-black text-slate-900 text-base font-mono">{money(selectedOrder.final_amount)}</span>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPage;
