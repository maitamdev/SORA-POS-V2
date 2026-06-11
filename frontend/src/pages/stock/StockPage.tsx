import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiCheck, FiRefreshCw, FiX, FiZap, FiChevronDown, FiChevronUp,
  FiAlertCircle, FiBox, FiShield, FiPlus, FiList, FiClock, FiSearch, 
  FiSliders, FiArrowUpRight, FiArrowDownLeft, FiSettings, FiActivity, FiTag
} from 'react-icons/fi';
import { stockAPI } from '../../services/stock.api';
import { aiAPI } from '../../services/ai.api';
import { Product, StockAlert, StockTransaction, AIRecommendation, RestockAnalysis } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';

const priorityClass = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const priorityLabel = {
  high: 'Khẩn cấp',
  medium: 'Cần nhập',
  low: 'Theo dõi',
};

const alertLabel = {
  out_of_stock: 'Hết hàng',
  low_stock: 'Tồn thấp',
  needs_restock: 'Sắp thiếu',
  healthy: 'An toàn',
};

const statusLabel: Record<string, string> = {
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

const renderInsight = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-50/80 text-blue-600 border-blue-100',
    'bg-indigo-50/80 text-indigo-600 border-indigo-100',
    'bg-purple-50/80 text-purple-600 border-purple-100',
    'bg-pink-50/80 text-pink-600 border-pink-100',
    'bg-amber-50/80 text-amber-600 border-amber-100',
    'bg-teal-50/80 text-teal-600 border-teal-100',
    'bg-emerald-50/80 text-emerald-600 border-emerald-100',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getInitials = (name: string) => {
  if (!name) return 'SP';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getStockBarColor = (quantity: number, minLevel: number) => {
  if (quantity <= 0) return 'bg-rose-500';
  if (quantity <= minLevel) return 'bg-rose-500';
  if (quantity <= minLevel * 1.5) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const getStockBarPercentage = (quantity: number, minLevel: number) => {
  if (minLevel <= 0) return 100;
  const percentage = (quantity / (minLevel * 2.5)) * 100; // max out at 2.5x minLevel
  return Math.min(percentage, 100);
};

const StockPage = () => {
  const { user } = useAuthStore();
  const [inventory, setInventory] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [mode, setMode] = useState<'import' | 'adjust'>('import');
  const [loading, setLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'inventory' | 'alerts' | 'transactions'>('inventory');

  // Quick Action Modal state
  const [showActionModal, setShowActionModal] = useState(false);

  // Search and Category Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'safe'>('all');

  // AI Panel
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiItems, setAiItems] = useState<AIRecommendation[]>([]);
  const [analysis, setAnalysis] = useState<RestockAnalysis | null>(null);
  const [targetDays, setTargetDays] = useState(14);
  const [aiLoading, setAiLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const canManageStock = user?.role === 'admin' || user?.role === 'manager';

  const loadData = async () => {
    setLoading(true);
    try {
      const [inventoryRes, alertsRes] = await Promise.all([
        stockAPI.inventory({ limit: 100 }),
        stockAPI.alerts({ limit: 50 }),
      ]);
      setInventory(inventoryRes.data.data.items);
      setAlerts(alertsRes.data.data.items);
      if (canManageStock) {
        const transactionsRes = await stockAPI.transactions({ limit: 50 });
        setTransactions(transactionsRes.data.data.items);
      } else {
        setTransactions([]);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được dữ liệu kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [canManageStock]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageStock) { toast.error('Bạn không có quyền cập nhật kho'); return; }
    if (loading) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const productId = String(form.get('product_id') || '');
    const quantity = Number(form.get('quantity') || 0);
    const note = String(form.get('note') || '');
    
    setLoading(true);
    try {
      if (mode === 'import') await stockAPI.importStock({ product_id: productId, quantity, note });
      else await stockAPI.adjustStock({ product_id: productId, new_stock: quantity, note });
      toast.success(mode === 'import' ? 'Đã nhập kho thành công' : 'Đã điều chỉnh tồn kho thành công');
      formEl.reset();
      setShowActionModal(false);
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Cập nhật kho thất bại');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (id: string) => {
    if (!canManageStock) { toast.error('Bạn không có quyền xử lý cảnh báo'); return; }
    try {
      await stockAPI.resolveAlert(id);
      toast.success('Đã xử lý cảnh báo thành công');
      await loadData();
    } catch { toast.error('Không xử lý được cảnh báo'); }
  };

  // ═══════════ AI ═══════════
  const loadAIData = async () => {
    setAiLoading(true);
    try {
      const [aRes, rRes] = await Promise.all([
        aiAPI.restockAnalysis({ target_days: targetDays }),
        aiAPI.list({ limit: 100, status: 'pending' }),
      ]);
      setAnalysis(aRes.data.data);
      setAiItems(rRes.data.data.items);
    } catch { toast.error('Không tải được dữ liệu AI'); }
    finally { setAiLoading(false); }
  };

  const handleOpenAI = () => {
    setShowAIPanel(true);
    loadAIData();
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const r = await aiAPI.generate({ target_days: targetDays });
      toast.success(`Đã tạo ${r.data.data.generated} gợi ý nhập hàng từ AI`);
      await loadAIData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tạo được gợi ý');
    } finally { setGenerating(false); }
  };

  const updateRecommendationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await aiAPI.updateStatus(id, status);
      toast.success(status === 'approved' ? 'Đã duyệt gợi ý nhập hàng' : 'Đã từ chối gợi ý');
      await loadAIData();
    } catch { toast.error('Không cập nhật được trạng thái'); }
  };

  // Filtered Inventory items based on search, category and stock level filters
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.includes(searchTerm));
      
      const matchesCategory =
        selectedCategory === 'all' || item.category_id === selectedCategory;

      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = item.stock_quantity <= item.min_stock_level;
      } else if (stockFilter === 'safe') {
        matchesStock = item.stock_quantity > item.min_stock_level;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [inventory, searchTerm, selectedCategory, stockFilter]);

  // Unique categories list for filtering
  const categoriesList = useMemo(() => {
    const list = new Map<string, string>();
    inventory.forEach((item) => {
      if (item.category_id && item.categories) {
        list.set(item.category_id, item.categories.name);
      }
    });
    return Array.from(list.entries()).map(([id, name]) => ({ id, name }));
  }, [inventory]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCount = inventory.length;
    const lowStockCount = alerts.filter(a => a.status === 'low_stock' || a.status === 'out_of_stock').length;
    const safeCount = Math.max(totalCount - lowStockCount, 0);
    const txCount = transactions.length;

    return { totalCount, lowStockCount, safeCount, txCount };
  }, [inventory, alerts, transactions]);

  const visibleAnalysisItems = useMemo(() => {
    const all = analysis?.items || [];
    return showAllProducts ? all : all.filter((i) => i.alert_status !== 'healthy');
  }, [analysis, showAllProducts]);

  const summary = analysis?.summary;

  return (
    <div className="space-y-6 animate-fadeIn pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 1. Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-150 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FiBox className="text-blue-600" />
            Quản lý Kho hàng
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Hệ thống kiểm soát tồn thực tế, theo dõi dòng chảy luân chuyển hàng hóa và tối ưu hóa nhập kho thông minh.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto shrink-0">
          {canManageStock && (
            <>
              <button
                onClick={() => setShowActionModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white transition-all duration-200 shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5"
              >
                <FiPlus size={16} className="stroke-[2.5]" />
                Cập nhật kho nhanh
              </button>
              <button
                onClick={showAIPanel ? () => setShowAIPanel(false) : handleOpenAI}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-extrabold transition-all duration-200 border ${
                  showAIPanel
                    ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                }`}
              >
                <FiZap className={showAIPanel ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-slate-400'} size={15} />
                Trợ lý AI
              </button>
            </>
          )}
          <button
            onClick={loadData}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 p-2.5 text-slate-600 transition-all flex items-center justify-center shadow-sm hover:shadow-md"
            title="Làm mới dữ liệu"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          </button>
        </div>
      </header>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50/60 border border-blue-100/50 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
            <FiBox size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tổng mặt hàng</p>
            <h4 className="text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{stats.totalCount}</h4>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner ${
            stats.lowStockCount > 0 
              ? 'bg-rose-50 border border-rose-100 text-rose-600 animate-pulse' 
              : 'bg-slate-50 border border-slate-100 text-slate-400'
          }`}>
            <FiAlertCircle size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tồn thấp / Hết hàng</p>
            <h4 className={`text-2xl font-black mt-0.5 tracking-tight ${stats.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{stats.lowStockCount}</h4>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50/60 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
            <FiShield size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Mức an toàn</p>
            <h4 className="text-2xl font-black text-emerald-700 mt-0.5 tracking-tight">{stats.safeCount}</h4>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50/60 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
            <FiClock size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Giao dịch kho</p>
            <h4 className="text-2xl font-black text-indigo-700 mt-0.5 tracking-tight">{stats.txCount}</h4>
          </div>
        </div>
      </div>

      {/* 3. Tab & Filter Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-2">
        {/* Navigation Tabs (iOS Capsule style) */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200/40 shrink-0">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${
              activeTab === 'inventory'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiList size={14} className="stroke-[2.5]" />
            Tồn thực tế
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${
              activeTab === 'alerts'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiAlertCircle size={14} className="stroke-[2.5]" />
            Cảnh báo
            {alerts.length > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white leading-none">
                {alerts.length}
              </span>
            )}
          </button>
          {canManageStock && (
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${
                activeTab === 'transactions'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FiClock size={14} className="stroke-[2.5]" />
              Nhật ký giao dịch
            </button>
          )}
        </div>

        {/* Quick Stock Filter Chips (only for inventory tab) */}
        {activeTab === 'inventory' && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] font-bold text-slate-400 mr-1 hidden md:inline uppercase tracking-wider">Trạng thái lọc:</span>
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                stockFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tất cả ({inventory.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
                stockFilter === 'low'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Tồn thấp ({inventory.filter(i => i.stock_quantity <= i.min_stock_level).length})
            </button>
            <button
              onClick={() => setStockFilter('safe')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
                stockFilter === 'safe'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              An toàn ({inventory.filter(i => i.stock_quantity > i.min_stock_level).length})
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Content Area */}
      <div className="space-y-6">
        {/* Tab 1: Inventory List */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 border border-slate-200/80 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm sản phẩm theo tên, SKU, barcode..."
                  className="w-full h-10 rounded-xl border border-slate-200 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none focus:border-slate-400 bg-slate-50/50 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="relative">
                  <FiSliders className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 pl-8 pr-8 text-xs sm:text-sm font-semibold outline-none bg-white focus:border-slate-400 cursor-pointer appearance-none shadow-xs"
                  >
                    <option value="all">Tất cả danh mục</option>
                    {categoriesList.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            {/* Inventory Table Container */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-slate-55/60 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 tracking-wider">
                    <tr>
                      <th className="px-5 py-4 w-1/3">Sản phẩm</th>
                      <th className="px-5 py-4">Danh mục</th>
                      <th className="px-5 py-4 text-right">Số lượng tồn</th>
                      <th className="px-5 py-4 text-right">Cảnh báo tồn</th>
                      <th className="px-5 py-4 text-right">Giá nhập vốn</th>
                      <th className="px-5 py-4 text-right">Giá bán lẻ</th>
                      <th className="px-5 py-4 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-slate-400 font-bold">
                          <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={18} />
                          Đang tải dữ liệu tồn kho...
                        </td>
                      </tr>
                    ) : filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-slate-400 font-bold">
                          <FiBox className="inline mb-2 text-slate-300 block mx-auto" size={32} />
                          Không tìm thấy sản phẩm nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map((product) => {
                        const isLowStock = product.stock_quantity <= product.min_stock_level;
                        return (
                          <tr key={product.id} className="hover:bg-slate-50/50 transition duration-150">
                            {/* Product Info with initials Avatar */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-black shrink-0 shadow-inner ${getAvatarColor(product.name)}`}>
                                  {getInitials(product.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-900 leading-snug truncate">{product.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                      {product.sku}
                                    </span>
                                    {product.barcode && (
                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-sm">
                                        {product.barcode}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {/* Category */}
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100/70 rounded-lg px-2.5 py-1 text-xs font-bold border border-slate-200/30">
                                <FiTag size={10} />
                                {product.categories?.name || 'Chưa phân loại'}
                              </span>
                            </td>
                            {/* Stock and Progress bar */}
                            <td className="px-5 py-4 text-right">
                              <span className={`font-black text-base ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                                {formatNumber(product.stock_quantity)}
                              </span>
                              <span className="text-xs text-slate-400 ml-1 font-bold">{product.unit || 'cái'}</span>
                              <div className="flex justify-end mt-1.5">
                                <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden shadow-inner">
                                  <div 
                                    className={`h-full transition-all duration-500 rounded-full ${getStockBarColor(product.stock_quantity, product.min_stock_level)}`}
                                    style={{ width: `${getStockBarPercentage(product.stock_quantity, product.min_stock_level)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            {/* Min Stock level */}
                            <td className="px-5 py-4 text-right text-slate-400 font-bold">
                              {formatNumber(product.min_stock_level)}
                            </td>
                            {/* Cost Price */}
                            <td className="px-5 py-4 text-right text-slate-500 font-mono font-bold">
                              {formatNumber(product.cost_price)}đ
                            </td>
                            {/* Sell Price */}
                            <td className="px-5 py-4 text-right text-slate-900 font-mono font-black">
                              {formatNumber(product.sell_price)}đ
                            </td>
                            {/* Status Badge */}
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-extrabold shadow-2xs ${
                                isLowStock
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {isLowStock ? 'Cần nhập hàng' : 'An toàn'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Stock Alerts */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="bg-white p-6 border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-5">
              <div>
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <FiAlertCircle className="text-rose-500" />
                  Cảnh báo tồn kho khẩn cấp
                </h2>
                <p className="text-xs text-slate-400 font-semibold mt-1">Các sản phẩm có số lượng tồn hiện tại dưới ngưỡng báo động tối thiểu của kho hàng.</p>
              </div>

              {alerts.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <FiShield className="inline mb-3 text-emerald-400" size={40} />
                  <p className="text-slate-800 text-sm font-black">Kho hàng của bạn an toàn</p>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Hiện không ghi nhận bất kỳ cảnh báo tồn thấp nào.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="group rounded-2xl border border-rose-150/60 bg-gradient-to-br from-rose-50/50 to-white p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md hover:border-rose-300 transition-all duration-300">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-extrabold text-slate-800 text-sm leading-snug line-clamp-2">{alert.products?.name || alert.product_id}</p>
                          <span className="rounded-full bg-rose-100 border border-rose-200/50 px-2 py-0.5 text-[9px] font-black text-rose-700 uppercase shrink-0">
                            {alert.status === 'out_of_stock' ? 'Hết hàng' : 'Tồn thấp'}
                          </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-1 text-slate-600">
                          <span className="text-xs font-bold text-slate-400">Tồn kho:</span>
                          <span className="text-sm font-black text-rose-600">{alert.current_stock}</span>
                          <span className="text-xs text-slate-400 font-semibold">/ tối thiểu {alert.min_stock_level}</span>
                        </div>
                        <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <FiClock size={12} />
                          Phát hiện lúc: {new Date(alert.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                      {canManageStock && (
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="w-full py-2 bg-white border border-rose-200 hover:border-rose-300 text-xs font-bold text-rose-700 rounded-xl hover:bg-rose-50/80 transition shadow-xs active:bg-rose-100"
                        >
                          Xác nhận xử lý cảnh báo
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Transactions List */}
        {activeTab === 'transactions' && canManageStock && (
          <div className="bg-white p-6 border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-4">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FiActivity className="text-indigo-500" />
                Nhật ký luân chuyển kho
              </h2>
              <p className="text-xs text-slate-400 font-semibold mt-1">Lịch sử xuất nhập hàng hóa, điều chỉnh chênh lệch tồn kho chi tiết.</p>
            </div>

            {transactions.length === 0 ? (
              <div className="py-20 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <FiClock className="inline mb-3 text-slate-300 animate-pulse" size={32} />
                <p className="text-slate-800 text-sm font-black">Chưa có giao dịch kho</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-150">
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Sản phẩm</th>
                      <th className="px-4 py-3.5 text-center">Loại GD</th>
                      <th className="px-4 py-3.5 text-right">Lượng thay đổi</th>
                      <th className="px-4 py-3.5 text-right">Tồn cũ</th>
                      <th className="px-4 py-3.5 text-right">Tồn mới</th>
                      <th className="px-4 py-3.5">Thời gian</th>
                      <th className="px-4 py-3.5">Người thực hiện</th>
                      <th className="px-4 py-3.5">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {transactions.map((tx) => {
                      const isAddition = tx.quantity > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/30 transition">
                          <td className="px-4 py-3.5">
                            <p className="font-extrabold text-slate-800 text-sm leading-snug">{tx.products?.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">SKU: {tx.products?.sku}</p>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase items-center gap-1 ${
                              tx.type === 'import' ? 'bg-blue-50 text-blue-700 border-blue-200/50' :
                              tx.type === 'sale' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' :
                              tx.type === 'adjustment' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {tx.type === 'import' && <FiArrowUpRight size={10} className="stroke-[2.5]" />}
                              {tx.type === 'sale' && <FiArrowDownLeft size={10} className="stroke-[2.5]" />}
                              {tx.type === 'import' ? 'Nhập kho' :
                               tx.type === 'sale' ? 'Bán hàng' :
                               tx.type === 'adjustment' ? 'Điều chỉnh' : tx.type}
                            </span>
                          </td>
                          <td className={`px-4 py-3.5 text-right font-black text-sm ${isAddition ? 'text-blue-600' : 'text-rose-600'}`}>
                            {isAddition ? '+' : ''}{formatNumber(tx.quantity)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-400 font-bold">{formatNumber(tx.previous_stock)}</td>
                          <td className="px-4 py-3.5 text-right text-slate-900 font-black">{formatNumber(tx.new_stock)}</td>
                          <td className="px-4 py-3.5 text-slate-400 font-medium text-xs">
                            {new Date(tx.created_at).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                            })}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-700 text-xs">{tx.users?.full_name}</td>
                          <td className="px-4 py-3.5 font-medium text-slate-500 text-xs max-w-xs truncate" title={tx.note || ''}>
                            {tx.note || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. AI Assistant Drawer (Bảng trượt từ bên phải) */}
      {showAIPanel && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setShowAIPanel(false)} 
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-lg transform bg-white shadow-2xl transition duration-500 ease-in-out border-l border-slate-100 flex flex-col h-full animate-slideLeft">
                
                {/* Drawer Header */}
                <div className="bg-slate-950 px-5 py-5 text-white flex items-center justify-between shadow-md shrink-0">
                  <div>
                    <h2 className="text-base font-black flex items-center gap-2 text-white">
                      <FiZap className="text-amber-400 fill-amber-400 animate-pulse" size={18} />
                      Trợ lý AI Phân tích Kho
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-400 font-semibold">
                      Dữ liệu bán hàng 30 ngày & dự phòng {targetDays} ngày tới
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowAIPanel(false)}
                    className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <FiX size={16} />
                  </button>
                </div>

                {/* Drawer Settings */}
                <div className="p-4 border-b border-slate-150/40 bg-slate-55/30 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Số ngày dự phòng:</span>
                    <input
                      id="ai-target-days"
                      value={targetDays}
                      onChange={(e) => setTargetDays(Number(e.target.value))}
                      type="number"
                      min={1}
                      max={90}
                      className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-400 text-center shadow-xs"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={loadAIData}
                      disabled={aiLoading}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-350 transition-all disabled:opacity-50 shadow-xs"
                      title="Làm mới phân tích"
                    >
                      <FiRefreshCw className={aiLoading ? 'animate-spin' : ''} size={13} />
                    </button>
                    <button
                      onClick={generateRecommendations}
                      disabled={generating}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 text-xs font-black text-white transition-all disabled:opacity-50 shadow-sm"
                    >
                      <FiZap size={12} />
                      {generating ? 'Đang chạy...' : 'AI Phân tích mới'}
                    </button>
                  </div>
                </div>

                {/* Summary Mini Cards */}
                {summary && (
                  <div className="grid grid-cols-4 border-b border-slate-100 bg-slate-50/20 divide-x divide-slate-100 shrink-0 text-center">
                    <div className="py-2.5">
                      <p className="text-sm font-black text-rose-600">{summary.out_of_stock + summary.low_stock}</p>
                      <p className="text-[9px] font-extrabold uppercase text-slate-400 mt-0.5 tracking-wider">Tồn thấp</p>
                    </div>
                    <div className="py-2.5">
                      <p className="text-sm font-black text-amber-600">{summary.needs_restock}</p>
                      <p className="text-[9px] font-extrabold uppercase text-slate-400 mt-0.5 tracking-wider">Cần chú ý</p>
                    </div>
                    <div className="py-2.5">
                      <p className="text-sm font-black text-blue-600">{formatNumber(summary.total_recommended_quantity)}</p>
                      <p className="text-[9px] font-extrabold uppercase text-slate-400 mt-0.5 tracking-wider">Đề xuất nhập</p>
                    </div>
                    <div className="py-2.5">
                      <p className="text-sm font-black text-emerald-600">{summary.healthy}</p>
                      <p className="text-[9px] font-extrabold uppercase text-slate-400 mt-0.5 tracking-wider">An toàn</p>
                    </div>
                  </div>
                )}

                {/* Drawer Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  
                  {/* AI Recommendation Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Đề xuất nhập kho</h3>
                      <button
                        onClick={() => setShowAllProducts((v) => !v)}
                        className="text-xs font-black text-blue-600 hover:text-blue-700 transition"
                      >
                        {showAllProducts ? 'Chỉ xem cảnh báo' : 'Xem tất cả sản phẩm'}
                      </button>
                    </div>

                    {aiLoading ? (
                      <div className="py-16 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                        <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={16} />
                        Đang lấy phân tích từ AI...
                      </div>
                    ) : visibleAnalysisItems.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                        Chưa có đề xuất nào cần nhập kho.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {visibleAnalysisItems.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm hover:border-slate-300 transition-all flex flex-col gap-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-slate-800 text-sm leading-tight truncate">{item.name}</h4>
                                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">SKU: {item.sku}</p>
                              </div>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black shrink-0 ${priorityClass[item.priority]}`}>
                                {alertLabel[item.alert_status]}
                              </span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 bg-slate-50/70 p-2 rounded-lg border border-slate-100 text-center text-[10px] font-bold text-slate-500">
                              <div>
                                <p className="text-slate-400 font-semibold">Tồn kho</p>
                                <p className="font-extrabold text-slate-800 mt-0.5">{formatNumber(item.stock_quantity)}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 font-semibold">Ngưỡng báo</p>
                                <p className="font-extrabold text-slate-800 mt-0.5">{formatNumber(item.min_stock_level)}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 font-semibold">Bán/ngày</p>
                                <p className="font-extrabold text-slate-800 mt-0.5">{Number(item.average_daily_sales).toFixed(1)}</p>
                              </div>
                              <div>
                                <p className="text-blue-500 font-semibold">Khuyên nhập</p>
                                <p className="font-black text-blue-600 mt-0.5">+{formatNumber(item.recommended_quantity)}</p>
                              </div>
                            </div>

                            <div>
                              <button
                                onClick={() => setExpandedInsight(expandedInsight === item.id ? null : item.id)}
                                className="flex items-center gap-1 text-[11px] font-extrabold text-slate-500 hover:text-slate-900 transition"
                              >
                                {expandedInsight === item.id ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                                {expandedInsight === item.id ? 'Thu gọn phân tích' : 'Xem AI phân tích chi tiết'}
                              </button>
                              {expandedInsight === item.id && (
                                <div className="mt-2 text-xs font-semibold leading-relaxed text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-150/40 animate-fadeIn">
                                  {renderInsight(item.ai_insight)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Saved recommendations items */}
                  {aiItems.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Phiếu đề xuất đang chờ duyệt</h3>
                      <div className="space-y-2.5">
                        {aiItems.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200/80 bg-slate-55/20 p-3.5 flex flex-col gap-3.5 hover:border-slate-300 transition-all">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-slate-800 text-sm truncate">{item.products?.name || item.product_id}</h4>
                                <p className="text-[10px] font-bold text-blue-600 mt-1">Đề xuất nhập: +{formatNumber(item.recommended_quantity)}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black shrink-0 ${priorityClass[item.priority]}`}>
                                {priorityLabel[item.priority]}
                              </span>
                            </div>
                            
                            <p className="text-xs font-semibold text-slate-500 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 line-clamp-3">
                              {renderInsight(item.ai_insight || item.reason || '')}
                            </p>

                            <div className="flex items-center justify-between border-t border-slate-100/60 pt-2 text-[10px] font-bold">
                              <span className="text-slate-400">Trạng thái: Đang chờ</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => updateRecommendationStatus(item.id, 'rejected')}
                                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition font-bold"
                                >
                                  Từ chối
                                </button>
                                <button
                                  onClick={() => updateRecommendationStatus(item.id, 'approved')}
                                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-black"
                                >
                                  Duyệt
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. QUICK ACTION ACTION MODAL (Popup điều chỉnh tồn kho đẹp mắt) */}
      {showActionModal && canManageStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                <FiSettings className="text-blue-500" />
                Cập nhật kho nhanh
              </h3>
              <button
                onClick={() => setShowActionModal(false)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={submit} className="space-y-4">
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setMode('import')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-black transition-all duration-200 ${
                    mode === 'import' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Cộng thêm tồn
                </button>
                <button
                  type="button"
                  onClick={() => setMode('adjust')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-black transition-all duration-200 ${
                    mode === 'adjust' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Điều chỉnh tổng tồn
                </button>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-slate-400 tracking-wider">Chọn sản phẩm *</span>
                <div className="relative">
                  <select
                    name="product_id"
                    required
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-slate-400 bg-white appearance-none cursor-pointer"
                  >
                    <option value="">Chọn sản phẩm cần chỉnh</option>
                    {inventory.map((product) => (
                      <option key={product.id} value={product.id}>
                        [{product.sku}] {product.name} (Tồn hiện tại: {product.stock_quantity})
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-slate-400 tracking-wider">
                  {mode === 'import' ? 'Số lượng cần cộng thêm *' : 'Số lượng tồn mới chính xác *'}
                </span>
                <input
                  name="quantity"
                  type="number"
                  min={mode === 'import' ? 1 : 0}
                  required
                  placeholder={mode === 'import' ? 'Ví dụ: 50' : 'Ví dụ: 120'}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 shadow-inner"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-slate-400 tracking-wider">Lý do / Ghi chú</span>
                <textarea
                  name="note"
                  rows={2}
                  placeholder="Kiểm kho định kỳ, hàng hỏng, hàng khuyến mãi..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-slate-400 shadow-inner"
                />
              </label>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 h-10 rounded-xl border border-slate-350 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xs sm:text-sm font-black text-white transition disabled:opacity-50 shadow-sm"
                >
                  {loading ? 'Đang lưu...' : 'Xác nhận Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPage;
