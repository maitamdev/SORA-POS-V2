import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiAward,
  FiEdit2,
  FiMail,
  FiMapPin,
  FiPhone,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { catalogAPI } from '../../services/catalog.api';
import { Customer } from '../../types/domain.type';

type TierFilter = 'all' | 'vip' | 'loyal' | 'new';

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const emptyForm: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
};

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const getCustomerTier = (customer: Customer) => {
  const totalSpent = Number(customer.total_spent || 0);
  const points = Number(customer.points || 0);

  if (totalSpent >= 1_000_000 || points >= 50) {
    return {
      key: 'vip' as const,
      label: 'VIP',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: FiAward,
    };
  }

  if (totalSpent > 0 || points > 0) {
    return {
      key: 'loyal' as const,
      label: 'Thân thiết',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: FiStar,
    };
  }

  return {
    key: 'new' as const,
    label: 'Mới',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
    icon: FiUser,
  };
};

const normalize = (value: string) => value.toLowerCase().trim();

const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await catalogAPI.customers.list({ limit: 500, is_active: true });
      setCustomers(response.data.data.items);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalSpent = customers.reduce((sum, customer) => sum + Number(customer.total_spent || 0), 0);
    const totalPoints = customers.reduce((sum, customer) => sum + Number(customer.points || 0), 0);
    const vipCustomers = customers.filter((customer) => getCustomerTier(customer).key === 'vip').length;

    return { totalCustomers, totalSpent, totalPoints, vipCustomers };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = normalize(search);

    return customers.filter((customer) => {
      const tier = getCustomerTier(customer).key;
      const matchesTier = tierFilter === 'all' || tier === tierFilter;
      const matchesSearch =
        !term ||
        normalize(customer.name || '').includes(term) ||
        normalize(customer.phone || '').includes(term) ||
        normalize(customer.email || '').includes(term) ||
        normalize(customer.address || '').includes(term);

      return matchesTier && matchesSearch;
    });
  }, [customers, search, tierFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingCustomer(null);
    setCustomerModalOpen(false);
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setEditingCustomer(null);
    setCustomerModalOpen(true);
  };

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    });
    setCustomerModalOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    };

    setSaving(true);
    try {
      if (editingCustomer) {
        await catalogAPI.customers.update(editingCustomer.id, payload);
        toast.success('Đã cập nhật khách hàng');
      } else {
        await catalogAPI.customers.create(payload);
        toast.success('Đã tạo khách hàng mới');
      }
      resetForm();
      await loadCustomers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Lưu khách hàng thất bại');
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = async (customer: Customer) => {
    if (!window.confirm(`Xóa khách hàng "${customer.name}"?`)) return;

    try {
      await catalogAPI.customers.remove(customer.id);
      toast.success('Đã xóa khách hàng');
      if (editingCustomer?.id === customer.id) resetForm();
      await loadCustomers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Xóa khách hàng thất bại');
    }
  };

  const tierOptions: Array<{ key: TierFilter; label: string; count: number }> = [
    { key: 'all', label: 'Tất cả', count: customers.length },
    { key: 'vip', label: 'VIP', count: customers.filter((customer) => getCustomerTier(customer).key === 'vip').length },
    { key: 'loyal', label: 'Thân thiết', count: customers.filter((customer) => getCustomerTier(customer).key === 'loyal').length },
    { key: 'new', label: 'Mới', count: customers.filter((customer) => getCustomerTier(customer).key === 'new').length },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Khách hàng</h1>
          <p className="text-sm font-medium text-slate-500">
            Quản lý hồ sơ khách mua hàng, điểm tích lũy và mức chi tiêu.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, SĐT, email..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-blue-500 sm:w-80"
            />
          </div>
          <button
            onClick={loadCustomers}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={15} />
            Tải lại
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase text-slate-400">Tổng khách</p>
            <FiUsers className="text-blue-500" size={18} />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{stats.totalCustomers}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase text-slate-400">Khách VIP</p>
            <FiAward className="text-amber-500" size={18} />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600">{stats.vipCustomers}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase text-slate-400">Tổng điểm</p>
            <FiStar className="text-emerald-500" size={18} />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600">{stats.totalPoints.toLocaleString('vi-VN')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase text-slate-400">Tổng chi</p>
            <FiPlus className="text-rose-500" size={18} />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{money(stats.totalSpent)}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/45 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="app-icon-tile flex h-10 w-10 shrink-0 items-center justify-center bg-blue-600 text-white">
                <FiUsers size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Xây dựng tệp khách hàng thân thiết</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">Thêm hồ sơ để tích điểm và cá nhân hóa trải nghiệm mua hàng.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="app-modal-control inline-flex h-10 items-center justify-center gap-2 bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
            >
              <FiPlus size={16} />
              Thêm khách hàng
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {tierOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setTierFilter(option.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                  tierFilter === option.key
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-black text-slate-800">{filteredCustomers.length} khách hàng đang hiển thị</p>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-black">Khách hàng</th>
                    <th className="px-4 py-3 font-black">Liên hệ</th>
                    <th className="px-4 py-3 font-black">Hạng</th>
                    <th className="px-4 py-3 text-right font-black">Điểm</th>
                    <th className="px-4 py-3 text-right font-black">Tổng chi</th>
                    <th className="px-4 py-3 text-right font-black">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        <FiRefreshCw className="mr-2 inline animate-spin text-blue-500" />
                        Đang tải khách hàng...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Không có khách hàng phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const tier = getCustomerTier(customer);
                      const TierIcon = tier.icon;

                      return (
                        <tr key={customer.id} className="transition hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-sm font-black text-blue-700">
                                {customer.name?.slice(0, 1).toUpperCase() || 'K'}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-black text-slate-900">{customer.name}</p>
                                {customer.address && (
                                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                                    <FiMapPin size={12} />
                                    {customer.address}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1 text-xs">
                              <p className="flex items-center gap-1.5 text-slate-700">
                                <FiPhone size={12} className="text-slate-400" />
                                {customer.phone || 'Chưa có SĐT'}
                              </p>
                              <p className="flex items-center gap-1.5 text-slate-500">
                                <FiMail size={12} className="text-slate-400" />
                                {customer.email || 'Chưa có email'}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${tier.className}`}>
                              <TierIcon size={12} />
                              {tier.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-black">{Number(customer.points || 0).toLocaleString('vi-VN')}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">{money(customer.total_spent || 0)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => startEdit(customer)}
                              className="mr-2 rounded-lg border border-blue-100 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                              title="Sửa khách hàng"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              onClick={() => removeCustomer(customer)}
                              className="rounded-lg border border-rose-100 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                              title="Xóa khách hàng"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-3 lg:hidden">
              {loading ? (
                <div className="rounded-lg border border-slate-200 p-6 text-center text-sm font-bold text-slate-400">
                  <FiRefreshCw className="mr-2 inline animate-spin text-blue-500" />
                  Đang tải khách hàng...
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="rounded-lg border border-slate-200 p-6 text-center text-sm font-bold text-slate-400">
                  Không có khách hàng phù hợp.
                </div>
              ) : (
                filteredCustomers.map((customer) => {
                  const tier = getCustomerTier(customer);
                  const TierIcon = tier.icon;

                  return (
                    <article key={customer.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black text-slate-900">{customer.name}</h3>
                          <div className="mt-1 space-y-1 text-xs font-semibold text-slate-500">
                            <p className="flex items-center gap-1.5">
                              <FiPhone size={12} />
                              {customer.phone || 'Chưa có SĐT'}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <FiMail size={12} />
                              {customer.email || 'Chưa có email'}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${tier.className}`}>
                          <TierIcon size={11} />
                          {tier.label}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                        <div>
                          <p className="font-bold uppercase text-slate-400">Điểm</p>
                          <p className="mt-0.5 font-black text-slate-900">{Number(customer.points || 0).toLocaleString('vi-VN')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold uppercase text-slate-400">Tổng chi</p>
                          <p className="mt-0.5 font-black text-slate-900">{money(customer.total_spent || 0)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => startEdit(customer)}
                          className="flex-1 rounded-lg border border-blue-100 bg-blue-50 py-2 text-xs font-black text-blue-600"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => removeCustomer(customer)}
                          className="flex-1 rounded-lg border border-rose-100 bg-rose-50 py-2 text-xs font-black text-rose-600"
                        >
                          Xóa
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {customerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resetForm();
          }}
        >
          <div className="app-modal-panel w-full max-w-lg overflow-hidden border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
            <div className="border-t-4 border-blue-600 bg-white px-5 pb-4 pt-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-50 text-blue-600">
                    <FiUsers size={19} />
                  </div>
                  <div>
                    <h2 id="customer-modal-title" className="text-base font-black text-slate-900">
                      {editingCustomer ? 'Cập nhật khách hàng' : 'Thêm khách hàng'}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {editingCustomer ? 'Cập nhật thông tin hồ sơ đang chọn.' : 'Tạo hồ sơ mới để tích điểm khi bán hàng.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="app-modal-control flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng cửa sổ"
                >
                  <FiX size={17} />
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="border-t border-slate-100 px-5 py-5 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Tên khách hàng *</span>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                    className="app-modal-control w-full border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Ví dụ: Nguyễn Văn An"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Số điện thoại</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((state) => ({ ...state, phone: event.target.value }))}
                    className="app-modal-control w-full border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="09xx xxx xxx"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
                    className="app-modal-control w-full border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="khach@example.com"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Địa chỉ</span>
                  <textarea
                    value={form.address}
                    onChange={(event) => setForm((state) => ({ ...state, address: event.target.value }))}
                    rows={3}
                    className="app-modal-control w-full resize-none border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Số nhà, đường, phường/xã..."
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="app-modal-control h-10 border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="app-modal-control inline-flex h-10 items-center justify-center gap-2 bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiPlus size={16} />
                  {saving ? 'Đang lưu...' : editingCustomer ? 'Lưu thay đổi' : 'Tạo khách hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
