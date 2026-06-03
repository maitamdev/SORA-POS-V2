import { FormEvent, useEffect, useState } from 'react';
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
} from 'react-icons/hi';
import { staffAPI, StaffPayload } from '../../services/staff.api';
import { StaffUser } from '../../types/domain.type';

const emptyForm = {
  password: '',
  full_name: '',
  phone: '',
  role: 'cashier' as const,
  is_active: true,
};

const StaffPage = () => {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [lastCreated, setLastCreated] = useState<{ code: string; password: string; name: string } | null>(null);

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

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const startEdit = (item: StaffUser) => {
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

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Quản lý nhân viên</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Tạo tài khoản thu ngân bằng mã đăng nhập 6 số và mật khẩu.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
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
      </header>

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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
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
                  <th className="px-4 py-3 text-right font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-semibold text-slate-400">Đang tải...</td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-semibold text-slate-400">Chưa có nhân viên</td>
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
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(item)} className="mr-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                          <HiOutlinePencil className="h-4 w-4" />
                          Sửa
                        </button>
                        {item.is_active && (
                          <button onClick={() => deactivate(item)} className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                            <HiOutlineXCircle className="h-4 w-4" />
                            Khóa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StaffPage;
