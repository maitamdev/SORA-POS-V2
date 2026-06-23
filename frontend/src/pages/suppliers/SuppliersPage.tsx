import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { catalogAPI } from '../../services/catalog.api';
import { aiAPI } from '../../services/ai.api';
import { Supplier } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';
import {
  FiSliders,
  FiSearch,
  FiX,
  FiPlus,
  FiRefreshCw,
  FiPhone,
  FiMail,
  FiEdit,
  FiMoreVertical,
  FiUser,
  FiMapPin,
  FiSettings,
  FiCheckCircle,
  FiAlertCircle,
  FiLock,
  FiCpu,
  FiGlobe
} from 'react-icons/fi';

const parseSupplierStatus = (supplier: Supplier): 'active' | 'suspended' | 'inactive' => {
  if (!supplier.is_active) return 'inactive';
  if (supplier.tax_code && supplier.tax_code.startsWith('[SUSPENDED]')) return 'suspended';
  return 'active';
};

const getDisplayTaxCode = (taxCode?: string | null): string => {
  if (!taxCode) return '';
  if (taxCode.startsWith('[SUSPENDED]')) {
    return taxCode.replace('[SUSPENDED]', '').trim();
  }
  return taxCode;
};

// Curated list of Vietnamese and global brand official logos
const getSupplierLogo = (name: string, email?: string | null): string => {
  const cleanName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (cleanName.includes('vinamilk') || cleanName.includes('sua viet nam')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Vinamilk_logo_2023.svg';
  }
  if (cleanName.includes('pepsi') || cleanName.includes('giai khat sai gon')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Pepsi_logo_2014.svg';
  }
  if (cleanName.includes('nestle')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Nestl%C3%A9_logo.svg';
  }
  if (cleanName.includes('sabeco') || cleanName.includes('bia sai gon')) {
    return 'https://upload.wikimedia.org/wikipedia/vi/f/f6/Logo_Sabeco.png';
  }
  if (cleanName.includes('acecook') || cleanName.includes('hao hao')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Acecook_Logo.png';
  }
  if (cleanName.includes('masan')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Masan_Group_logo.svg';
  }
  if (cleanName.includes('elmich')) {
    return 'https://logo.clearbit.com/elmich.vn';
  }
  if (cleanName.includes('sunhouse')) {
    return 'https://logo.clearbit.com/sunhouse.com.vn';
  }
  if (cleanName.includes('lock')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Lock_%26_Lock_logo.svg';
  }
  if (cleanName.includes('mayora')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Mayora_logo.svg';
  }
  if (cleanName.includes('minh long')) {
    return 'https://logo.clearbit.com/minhlong.com';
  }
  if (cleanName.includes('kinh do') || cleanName.includes('mondelez')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/0/07/Mondelez_International_logo.svg';
  }
  if (cleanName.includes('trung nguyen')) {
    return 'https://logo.clearbit.com/trungnguyenlegend.com';
  }
  if (cleanName.includes('unilever')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Unilever.svg';
  }
  if (cleanName.includes('heineken')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Heineken_Logo.svg';
  }
  if (cleanName.includes('coca')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Coca-Cola_logo.svg';
  }

  // Domain extraction from email
  if (email && email.includes('@')) {
    const domain = email.split('@')[1].trim();
    const genericDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'mail.com'];
    if (!genericDomains.includes(domain)) {
      return `https://logo.clearbit.com/${domain}`;
    }
  }

  return '';
};

const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-emerald-50 text-emerald-700 border-emerald-250',
    'bg-blue-50 text-blue-700 border-blue-250',
    'bg-indigo-50 text-indigo-700 border-indigo-250',
    'bg-purple-50 text-purple-700 border-purple-250',
    'bg-rose-50 text-rose-700 border-rose-250',
    'bg-amber-50 text-amber-700 border-amber-250'
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Component helper for displaying official supplier logos with initials fallback
const SupplierAvatar = ({ name, email }: { name: string; email?: string | null }) => {
  const [imgError, setImgError] = useState(false);
  const logoUrl = useMemo(() => getSupplierLogo(name, email), [name, email]);

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  if (logoUrl && !imgError) {
    return (
      <div className="w-10 h-10 rounded-2xl border border-slate-200/60 bg-white p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
        <img
          src={logoUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center text-xs font-black shrink-0 shadow-inner ${getAvatarColor(name)}`}>
      {getInitials(name)}
    </div>
  );
};

const SuppliersPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const canManageSuppliers = user?.role === 'admin' || user?.role === 'manager';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Global search & filters from sidebar
  const [searchTerm, setSearchTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchContact, setSearchContact] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchStatus, setSearchStatus] = useState<string>('all');

  // Active filters applied (for displaying filter list or resetting)
  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    contact: '',
    phone: '',
    email: '',
    status: 'all'
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal form states
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formTaxCode, setFormTaxCode] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'suspended' | 'inactive'>('active');

  // AI suggestion state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWebsite, setAiWebsite] = useState('');

  // Menu dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await catalogAPI.suppliers.list({ limit: 500 });
      setSuppliers(res.data.data.items);
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải danh sách nhà cung cấp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters({
      name: searchName,
      contact: searchContact,
      phone: searchPhone,
      email: searchEmail,
      status: searchStatus
    });
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchName('');
    setSearchContact('');
    setSearchPhone('');
    setSearchEmail('');
    setSearchStatus('all');
    setSearchTerm('');
    setAppliedFilters({
      name: '',
      contact: '',
      phone: '',
      email: '',
      status: 'all'
    });
    setCurrentPage(1);
    toast.success('Đã đặt lại bộ lọc');
  };

  // Calculate filtered list
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const status = parseSupplierStatus(s);
      const displayTaxCode = getDisplayTaxCode(s.tax_code);

      const matchesName = !appliedFilters.name || s.name.toLowerCase().includes(appliedFilters.name.toLowerCase());
      const matchesContact = !appliedFilters.contact || (s.contact_person && s.contact_person.toLowerCase().includes(appliedFilters.contact.toLowerCase()));
      const matchesPhone = !appliedFilters.phone || (s.phone && s.phone.includes(appliedFilters.phone));
      const matchesEmail = !appliedFilters.email || (s.email && s.email.toLowerCase().includes(appliedFilters.email.toLowerCase()));

      let matchesStatus = true;
      if (appliedFilters.status !== 'all') {
        matchesStatus = status === appliedFilters.status;
      }

      // Global search term from header
      const matchesGlobal = !searchTerm ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.phone && s.phone.includes(searchTerm)) ||
        (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        displayTaxCode.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesName && matchesContact && matchesPhone && matchesEmail && matchesStatus && matchesGlobal;
    });
  }, [suppliers, appliedFilters, searchTerm]);

  // Statistics calculation based on total loaded list
  const stats = useMemo(() => {
    const total = suppliers.length;
    let active = 0;
    let suspended = 0;
    let inactive = 0;

    suppliers.forEach((s) => {
      const status = parseSupplierStatus(s);
      if (status === 'active') active++;
      else if (status === 'suspended') suspended++;
      else if (status === 'inactive') inactive++;
    });

    return { total, active, suspended, inactive };
  }, [suppliers]);

  // Pagination slice
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormContact('');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormTaxCode('');
    setFormStatus('active');
    setAiWebsite('');
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormName(supplier.name);
    setFormContact(supplier.contact_person || '');
    setFormEmail(supplier.email || '');
    setFormPhone(supplier.phone || '');
    setFormAddress(supplier.address || '');
    setFormTaxCode(getDisplayTaxCode(supplier.tax_code));
    setFormStatus(parseSupplierStatus(supplier));
    setAiWebsite('');
    setShowModal(true);
    setOpenDropdownId(null);
  };

  // Debounced auto-fill supplier info from AI in background
  useEffect(() => {
    if (editingSupplier || !formName.trim() || formName.trim().length < 4) {
      setAiWebsite('');
      return;
    }

    const timer = setTimeout(async () => {
      setAiLoading(true);
      try {
        const res = await aiAPI.suggestSupplier(formName.trim());
        const data = res.data.data;
        if (data) {
          if (data.name && formName.trim() !== data.name) {
            setFormName(data.name);
          }
          if (data.email && !formEmail) setFormEmail(data.email);
          if (data.phone && !formPhone) setFormPhone(data.phone);
          if (data.address && !formAddress) setFormAddress(data.address);
          if (data.tax_code && !formTaxCode) setFormTaxCode(data.tax_code);
          if (data.website) setAiWebsite(data.website);
          
          toast.success(`AI nhận diện đối tác: ${data.name || formName.trim()}`);
        }
      } catch (err) {
        console.error('AI auto-suggest error:', err);
      } finally {
        setAiLoading(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Tên nhà cung cấp là bắt buộc');
      return;
    }

    setSaving(true);
    
    // Prepare status prefix for tax_code
    let finalTaxCode = formTaxCode.trim();
    if (formStatus === 'suspended') {
      finalTaxCode = `[SUSPENDED] ${finalTaxCode}`;
    }

    const payload: Partial<Supplier> = {
      name: formName.trim(),
      contact_person: formContact.trim() || null,
      email: formEmail.trim() || null,
      phone: formPhone.trim() || null,
      address: formAddress.trim() || null,
      tax_code: finalTaxCode || null,
      is_active: formStatus !== 'inactive'
    };

    try {
      if (editingSupplier) {
        await catalogAPI.suppliers.update(editingSupplier.id, payload);
        toast.success('Cập nhật nhà cung cấp thành công!');
      } else {
        await catalogAPI.suppliers.create(payload);
        toast.success('Tạo nhà cung cấp mới thành công!');
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      toast.error(editingSupplier ? 'Cập nhật thất bại' : 'Thêm mới thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ngưng hợp tác với nhà cung cấp "${name}"?`)) return;
    try {
      await catalogAPI.suppliers.remove(id);
      toast.success('Đã ngưng hợp tác với nhà cung cấp');
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      toast.error('Không thể thực hiện ngưng hợp tác');
    }
    setOpenDropdownId(null);
  };

  const handleHardDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA HOÀN TOÀN nhà cung cấp "${name}" khỏi hệ thống? Hành động này sẽ không thể hoàn tác.`)) return;
    try {
      const res = await catalogAPI.suppliers.remove(id, { hard: true });
      const msg = res.data?.data?.message || 'Đã xóa hoàn toàn nhà cung cấp khỏi hệ thống.';
      toast.success(msg);
      fetchSuppliers();
    } catch (error: any) {
      console.error(error);
      const errMsg = error.response?.data?.message || 'Không thể xóa hoàn toàn nhà cung cấp';
      toast.error(errMsg);
    }
    setOpenDropdownId(null);
  };

  const handleToggleActive = async (supplier: Supplier) => {
    const currentStatus = parseSupplierStatus(supplier);
    const newActive = currentStatus === 'inactive';
    try {
      await catalogAPI.suppliers.update(supplier.id, { is_active: newActive });
      toast.success(newActive ? 'Đã kích hoạt lại nhà cung cấp' : 'Đã dừng hoạt động nhà cung cấp');
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      toast.error('Không thể cập nhật trạng thái');
    }
    setOpenDropdownId(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Page Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            Nhà cung cấp
            <span className="inline-flex items-center justify-center p-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/50 cursor-pointer hover:bg-emerald-100 hover:text-emerald-700 transition" title="Cấu hình nhà cung cấp">
              <FiSettings size={14} className="animate-spin-slow" />
            </span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">
            Quản lý thông tin đối tác cung ứng hàng hóa cho hệ thống cửa hàng.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Header Search Field */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm nhà cung cấp..."
              className="w-full sm:w-72 h-10 rounded-xl border border-slate-200 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none focus:border-slate-400 bg-slate-50/50 focus:bg-white transition-all shadow-inner"
            />
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          </div>
          {/* Add Supplier Button */}
          {canManageSuppliers && (
            <button
              onClick={openCreateModal}
              className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 text-xs sm:text-sm font-black text-white transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
            >
              <FiPlus size={16} className="stroke-[3]" />
              Thêm nhà cung cấp
            </button>
          )}
        </div>
      </header>

      {/* 2. Overview Stats Cards Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Suppliers */}
        <div className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiUser size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tổng nhà cung cấp</p>
            <h4 className="text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.total} <span className="text-xs text-slate-400 font-bold">Đối tác</span></h4>
          </div>
        </div>

        {/* Active Suppliers */}
        <div className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-blue-200 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiCheckCircle size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Đang hoạt động</p>
            <h4 className="text-2xl font-black text-blue-600 mt-0.5 tracking-tight">{stats.active} <span className="text-xs text-slate-400 font-bold">Nhà cung cấp</span></h4>
          </div>
        </div>

        {/* Suspended Suppliers */}
        <div className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-amber-250 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiAlertCircle size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tạm ngưng</p>
            <h4 className="text-2xl font-black text-amber-600 mt-0.5 tracking-tight">{stats.suspended} <span className="text-xs text-slate-400 font-bold">Nhà cung cấp</span></h4>
          </div>
        </div>

        {/* Inactive Suppliers */}
        <div className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-rose-250 transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
            <FiX size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Ngừng hợp tác</p>
            <h4 className="text-2xl font-black text-rose-600 mt-0.5 tracking-tight">{stats.inactive} <span className="text-xs text-slate-400 font-bold">Nhà cung cấp</span></h4>
          </div>
        </div>
      </section>

      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6 items-start">
        {/* 3.1 Search & Filter Sidebar */}
        <aside className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black uppercase text-slate-750 flex items-center gap-2">
              <FiSliders className="text-slate-500" />
              Bộ lọc tìm kiếm
            </h3>
            {(appliedFilters.name || appliedFilters.contact || appliedFilters.phone || appliedFilters.email || appliedFilters.status !== 'all' || searchTerm) && (
              <button
                onClick={handleResetFilters}
                className="text-[10px] font-black text-rose-600 hover:text-rose-700 transition"
              >
                Đặt lại
              </button>
            )}
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            {/* Filter Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-slate-400">Tên nhà cung cấp</label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Nhập tên nhà cung cấp"
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50/30 focus:bg-white transition"
              />
            </div>

            {/* Filter Contact Person */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-slate-400">Người liên hệ</label>
              <input
                type="text"
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                placeholder="Nhập người liên hệ"
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50/30 focus:bg-white transition"
              />
            </div>

            {/* Filter Phone */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-slate-400">Số điện thoại</label>
              <input
                type="text"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50/30 focus:bg-white transition"
              />
            </div>

            {/* Filter Email */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-slate-400">Email</label>
              <input
                type="text"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Nhập email"
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400 bg-slate-50/30 focus:bg-white transition"
              />
            </div>

            {/* Filter Status */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-slate-400">Trạng thái</label>
              <select
                value={searchStatus}
                onChange={(e) => setSearchStatus(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400 bg-white cursor-pointer"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="suspended">Tạm ngưng</option>
                <option value="inactive">Ngừng hợp tác</option>
              </select>
            </div>

            {/* Submit & Reset Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-black text-white transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <FiSearch size={12} />
                Tìm kiếm
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex-1 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-black text-slate-650 transition flex items-center justify-center gap-1.5"
              >
                Đặt lại
              </button>
            </div>
          </form>
        </aside>

        {/* 3.2 Suppliers List Table Area */}
        <section className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-55/60 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200/80 tracking-wider">
                <tr>
                  <th className="px-5 py-4 w-[35%]">Nhà cung cấp</th>
                  <th className="px-5 py-4 w-[20%]">Người liên hệ</th>
                  <th className="px-5 py-4 w-[15%]">Liên hệ</th>
                  <th className="px-5 py-4 w-[15%]">Email</th>
                  <th className="px-5 py-4 w-[10%] text-center">Trạng thái</th>
                  {canManageSuppliers && <th className="px-5 py-4 w-[5%] text-center">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={canManageSuppliers ? 6 : 5} className="py-20 text-center text-slate-400 font-bold">
                      <FiRefreshCw className="inline animate-spin mr-2 text-emerald-650" size={18} />
                      Đang tải danh sách đối tác...
                    </td>
                  </tr>
                ) : paginatedSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={canManageSuppliers ? 6 : 5} className="py-20 text-center text-slate-400 font-bold">
                      Không tìm thấy nhà cung cấp nào.
                    </td>
                  </tr>
                ) : (
                  paginatedSuppliers.map((supplier) => {
                    const status = parseSupplierStatus(supplier);
                    const displayTaxCode = getDisplayTaxCode(supplier.tax_code);

                    return (
                      <tr key={supplier.id} className="hover:bg-slate-55/30 transition duration-150">
                        {/* 1. Supplier Name, Logo & Tax Code */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3.5">
                            {/* Brand Logo Avatar (with initials fallback) */}
                            <SupplierAvatar name={supplier.name} email={supplier.email} />
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-900 leading-snug truncate" title={supplier.name}>
                                {supplier.name}
                              </p>
                              {displayTaxCode && (
                                <span className="inline-block text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-200/50 mt-1 uppercase tracking-wide">
                                  MST: {displayTaxCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Contact Person */}
                        <td className="px-5 py-4 text-slate-650">
                          {supplier.contact_person || (
                            <span className="text-slate-350 font-medium italic">Chưa cập nhật</span>
                          )}
                        </td>

                        {/* 3. Phone */}
                        <td className="px-5 py-4">
                          {supplier.phone ? (
                            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                              <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-150">
                                <FiPhone size={10} className="stroke-[2.5]" />
                              </span>
                              {supplier.phone}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-medium italic">Chưa có</span>
                          )}
                        </td>

                        {/* 4. Email */}
                        <td className="px-5 py-4">
                          {supplier.email ? (
                            <div className="flex items-center gap-1.5 text-slate-500 font-medium max-w-[180px] truncate" title={supplier.email}>
                              <span className="w-5 h-5 rounded-md bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 border border-slate-150">
                                <FiMail size={10} className="stroke-[2.5]" />
                              </span>
                              {supplier.email}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-medium italic">Chưa có</span>
                          )}
                        </td>

                        {/* 5. Status Badges */}
                        <td className="px-5 py-4 text-center">
                          {status === 'active' && (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 shadow-2xs">
                              Hoạt động
                            </span>
                          )}
                          {status === 'suspended' && (
                            <span className="inline-flex rounded-full border border-amber-250 bg-amber-50 px-2.5 py-0.5 text-xs font-extrabold text-amber-700 shadow-2xs">
                              Tạm ngưng
                            </span>
                          )}
                          {status === 'inactive' && (
                            <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-extrabold text-rose-700 shadow-2xs">
                              Ngừng hợp tác
                            </span>
                          )}
                        </td>

                        {/* 6. Operations */}
                        {canManageSuppliers && (
                          <td className="px-5 py-4 text-center relative">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Fast Edit Button */}
                              <button
                                onClick={() => openEditModal(supplier)}
                                className="p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg border border-slate-100 hover:border-emerald-150 transition"
                                title="Sửa nhanh"
                              >
                                <FiEdit size={13} className="stroke-[2.5]" />
                              </button>
                              
                              {/* Dropdown Toggle */}
                              <div className="relative">
                                <button
                                  onClick={() => setOpenDropdownId(openDropdownId === supplier.id ? null : supplier.id)}
                                  className={`p-1.5 rounded-lg border transition ${
                                    openDropdownId === supplier.id 
                                      ? 'bg-slate-900 border-slate-950 text-white' 
                                      : 'bg-slate-50 border-slate-100 hover:bg-slate-150 text-slate-450'
                                  }`}
                                >
                                  <FiMoreVertical size={13} className="stroke-[2.5]" />
                                </button>
                                
                                {/* Dropdown Menu */}
                                {openDropdownId === supplier.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
                                    <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-150 rounded-xl shadow-lg py-1.5 z-20 animate-fadeIn">
                                      <button
                                        onClick={() => openEditModal(supplier)}
                                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
                                      >
                                        <FiEdit size={12} />
                                        Sửa thông tin
                                      </button>
                                      <button
                                        onClick={() => handleToggleActive(supplier)}
                                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
                                      >
                                        <FiLock size={12} />
                                        {status === 'inactive' ? 'Kích hoạt lại' : 'Tạm khóa'}
                                      </button>
                                      <hr className="my-1 border-slate-100" />
                                      <button
                                        onClick={() => handleDelete(supplier.id, supplier.name)}
                                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition flex items-center gap-2"
                                      >
                                        <FiX size={12} />
                                        Ngừng hợp tác
                                      </button>
                                      {isAdmin && (
                                        <>
                                          <hr className="my-1 border-slate-100" />
                                          <button
                                            onClick={() => handleHardDelete(supplier.id, supplier.name)}
                                            className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-650 hover:bg-rose-50 transition flex items-center gap-2"
                                            title="Xóa vĩnh viễn nhà cung cấp khỏi hệ thống"
                                          >
                                            <FiX size={12} className="text-rose-500 stroke-[2.5]" />
                                            Xóa vĩnh viễn
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 3.3 Table Pagination Footer */}
          {filteredSuppliers.length > 0 && (
            <footer className="p-4 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs font-bold text-slate-500 bg-slate-50/50">
              <div>
                Hiển thị <span className="text-slate-800 font-extrabold">{filteredSuppliers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)}</span> trong <span className="text-slate-800 font-extrabold">{filteredSuppliers.length}</span> nhà cung cấp
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {/* Size list selector */}
                <div className="flex items-center gap-2">
                  <span>Hiển thị</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-extrabold text-slate-700 outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>mục/trang</span>
                </div>
                {/* Pages navigation numbers */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-650 hover:bg-slate-50 transition disabled:opacity-40 disabled:hover:bg-white"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                          currentPage === pageNum
                            ? 'bg-emerald-600 border-emerald-650 text-white font-extrabold'
                            : 'border-slate-200 bg-white text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-650 hover:bg-slate-50 transition disabled:opacity-40 disabled:hover:bg-white"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </footer>
          )}
        </section>
      </div>

      {/* 4. Beautiful Form Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col animate-slideUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                {/* Logo Preview inside modal */}
                <SupplierAvatar name={formName} email={formEmail || (aiWebsite ? `info@${aiWebsite}` : null)} />
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                    {editingSupplier ? 'Cập nhật thông tin đối tác' : 'Thêm nhà cung cấp mới'}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    {editingSupplier ? 'Thay đổi thông tin liên hệ và trạng thái hợp tác.' : 'Thêm đối tác cung ứng mới vào cơ sở dữ liệu.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 transition font-black text-lg p-1.5 hover:bg-slate-50 rounded-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="flex-1 space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* Supplier Name (with AI assist button) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
                  <span>Tên nhà cung cấp <span className="text-rose-500">*</span></span>
                  {aiLoading && (
                    <span className="text-[10px] font-black text-emerald-650 flex items-center gap-1 animate-pulse">
                      <FiRefreshCw className="animate-spin text-emerald-600" size={10} />
                      AI đang tự động nhận diện...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ví dụ: Công ty TNHH Mayora"
                    required
                    className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-slate-400 transition pr-20"
                  />
                  {aiWebsite && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded flex items-center gap-1 max-w-[120px] truncate" title={`Website: ${aiWebsite}`}>
                      <FiGlobe size={8} />
                      {aiWebsite}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid 2 Columns (Contact Person & Phone) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-500">Người liên hệ</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Ông/Bà..."
                    className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-slate-400 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-500">Số điện thoại</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Nhập số điện thoại liên hệ"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              {/* Grid 2 Columns (Email & Tax Code) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-500">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="contact@company.com"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-slate-400 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-500">Mã số thuế</label>
                  <input
                    type="text"
                    value={formTaxCode}
                    onChange={(e) => setFormTaxCode(e.target.value)}
                    placeholder="Nhập mã số thuế công ty"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              {/* Address Area */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-slate-500">Địa chỉ văn phòng trụ sở chính</label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-slate-400 transition resize-none"
                />
              </div>

              {/* Status Select dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-slate-500">Trạng thái hợp tác</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-400 bg-white cursor-pointer"
                >
                  <option value="active">Hoạt động (Khai thác bình thường)</option>
                  <option value="suspended">Tạm ngưng (Tạm khóa nhập hàng)</option>
                  <option value="inactive">Ngừng hợp tác (Dừng hẳn hoạt động)</option>
                </select>
              </div>

              {/* Modal Buttons Footer */}
              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-650 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-black text-white transition disabled:opacity-60 shadow-sm"
                >
                  {saving ? 'Đang lưu...' : 'Lưu lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
