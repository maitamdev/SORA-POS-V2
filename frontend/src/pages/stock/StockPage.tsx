import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiCheck, FiRefreshCw, FiX, FiZap, FiChevronDown, FiChevronUp,
  FiAlertCircle, FiTrendingDown, FiArrowDown, FiBox, FiShield,
} from 'react-icons/fi';
import { stockAPI } from '../../services/stock.api';
import { aiAPI } from '../../services/ai.api';
import { Product, StockAlert, StockTransaction, AIRecommendation, RestockAnalysis } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';

const priorityClass = {
  high: 'bg-red-50 text-red-700 border-red-200',
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

/** Render markdown bold **text** → <strong>text</strong> */
const renderInsight = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

const StockPage = () => {
  const { user } = useAuthStore();
  const [inventory, setInventory] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [mode, setMode] = useState<'import' | 'adjust'>('import');
  const [loading, setLoading] = useState(false);

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
      toast.success(mode === 'import' ? 'Đã nhập kho' : 'Đã điều chỉnh tồn kho');
      formEl.reset();
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
      toast.success('Đã xử lý cảnh báo');
      await loadData();
    } catch { toast.error('Không xử lý được cảnh báo'); }
  };

  // ═══════════ AI ═══════════
  const loadAIData = async () => {
    setAiLoading(true);
    try {
      const [aRes, rRes] = await Promise.all([
        aiAPI.restockAnalysis({ target_days: targetDays }),
        aiAPI.list({ limit: 100 }),
      ]);
      setAnalysis(aRes.data.data);
      setAiItems(rRes.data.data.items);
    } catch { toast.error('Không tải được dữ liệu AI'); }
    finally { setAiLoading(false); }
  };

  const handleOpenAI = () => { setShowAIPanel(true); loadAIData(); };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const r = await aiAPI.generate({ target_days: targetDays });
      toast.success(`Đã tạo ${r.data.data.generated} gợi ý nhập hàng`);
      await loadAIData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tạo được gợi ý');
    } finally { setGenerating(false); }
  };

  const updateRecommendationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await aiAPI.updateStatus(id, status);
      toast.success(status === 'approved' ? 'Đã duyệt gợi ý' : 'Đã từ chối gợi ý');
      await loadAIData();
    } catch { toast.error('Không cập nhật được trạng thái'); }
  };

  const visibleAnalysisItems = useMemo(() => {
    const all = analysis?.items || [];
    return showAllProducts ? all : all.filter((i) => i.alert_status !== 'healthy');
  }, [analysis, showAllProducts]);

  const summary = analysis?.summary;

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Kho hàng</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            {canManageStock
              ? 'Theo dõi tồn kho, cảnh báo và lịch sử giao dịch realtime.'
              : 'Theo dõi tồn kho và cảnh báo hàng sắp hết.'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {canManageStock && (
            <button
              onClick={showAIPanel ? () => setShowAIPanel(false) : handleOpenAI}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all duration-200 border ${
                showAIPanel
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              <FiZap size={15} />
              AI Phân tích
            </button>
          )}
          <button onClick={loadData} className="flex-1 sm:flex-none rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">
            {loading ? 'Đang tải...' : 'Tải lại'}
          </button>
        </div>
      </header>

      {/* ═══════════ AI PANEL ═══════════ */}
      {showAIPanel && (
        <div className="animate-fadeIn rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FiZap className="text-slate-500" size={16} />
                Phân tích tồn kho thông minh
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Dữ liệu bán hàng 30 ngày — đề xuất số lượng nhập cho {targetDays} ngày tới
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500" htmlFor="ai-target-days">
                Mục tiêu
              </label>
              <input
                id="ai-target-days"
                value={targetDays}
                onChange={(e) => setTargetDays(Number(e.target.value))}
                type="number"
                min={1}
                max={90}
                className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-bold text-slate-700 outline-none focus:border-slate-500"
              />
              <span className="text-xs font-medium text-slate-500">ngày</span>
              <button
                onClick={loadAIData}
                disabled={aiLoading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                title="Làm mới"
              >
                <FiRefreshCw className={aiLoading ? 'animate-spin' : ''} size={14} />
              </button>
              <button
                onClick={generateRecommendations}
                disabled={generating}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                <FiZap size={13} />
                {generating ? 'Đang xử lý...' : 'Tạo gợi ý'}
              </button>
            </div>
          </div>

          {/* Stats */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-slate-200">
              <div className="p-4 text-center border-r border-slate-100">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 mb-2">
                  <FiAlertCircle className="text-red-600" size={16} />
                </div>
                <p className="text-2xl font-black text-slate-800">{summary.out_of_stock}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 tracking-wide">Hết hàng</p>
              </div>
              <div className="p-4 text-center border-r border-slate-100">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 mb-2">
                  <FiTrendingDown className="text-amber-600" size={16} />
                </div>
                <p className="text-2xl font-black text-slate-800">{summary.low_stock}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 tracking-wide">Tồn thấp</p>
              </div>
              <div className="p-4 text-center border-r border-slate-100">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 mb-2">
                  <FiArrowDown className="text-orange-600" size={16} />
                </div>
                <p className="text-2xl font-black text-slate-800">{summary.needs_restock}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 tracking-wide">Sắp thiếu</p>
              </div>
              <div className="p-4 text-center border-r border-slate-100">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 mb-2">
                  <FiBox className="text-blue-600" size={16} />
                </div>
                <p className="text-2xl font-black text-slate-800">{formatNumber(summary.total_recommended_quantity)}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 tracking-wide">Cần nhập</p>
              </div>
              <div className="p-4 text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 mb-2">
                  <FiShield className="text-emerald-600" size={16} />
                </div>
                <p className="text-2xl font-black text-slate-800">{summary.healthy}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 tracking-wide">An toàn</p>
              </div>
            </div>
          )}

          {/* Analysis Table */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-700">
                Bảng phân tích ({visibleAnalysisItems.length} sản phẩm)
              </h3>
              <button
                onClick={() => setShowAllProducts((v) => !v)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                {showAllProducts ? 'Chỉ xem cảnh báo' : 'Xem tất cả'}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-400">Sản phẩm</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-400">Cảnh báo</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Tồn</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Tối thiểu</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Bán TB/ngày</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Đề xuất nhập</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-400">Nhận định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aiLoading ? (
                    <tr>
                      <td className="px-4 py-10 text-center font-bold text-slate-400" colSpan={7}>
                        <FiRefreshCw className="inline animate-spin mr-2" size={14} />
                        Đang phân tích dữ liệu kho...
                      </td>
                    </tr>
                  ) : visibleAnalysisItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center font-bold text-slate-400" colSpan={7}>
                        Không có sản phẩm cần cảnh báo.
                      </td>
                    </tr>
                  ) : (
                    visibleAnalysisItems.map((item) => (
                      <tr key={item.id} className="align-top hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-800">{item.name}</p>
                          <p className="text-xs font-semibold text-slate-400">{item.sku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-black ${priorityClass[item.priority]}`}>
                            {alertLabel[item.alert_status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">{formatNumber(item.stock_quantity)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-500">{formatNumber(item.min_stock_level)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-500">{Number(item.average_daily_sales).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-black text-blue-700">{formatNumber(item.recommended_quantity)}</td>
                        <td className="max-w-xs px-4 py-3">
                          <button
                            onClick={() => setExpandedInsight(expandedInsight === item.id ? null : item.id)}
                            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                          >
                            {expandedInsight === item.id ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                            {expandedInsight === item.id ? 'Thu gọn' : 'Chi tiết'}
                          </button>
                          {expandedInsight === item.id && (
                            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600 animate-fadeIn">
                              {renderInsight(item.ai_insight)}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saved Recommendations */}
          {aiItems.length > 0 && (
            <div className="border-t border-slate-200 px-5 py-4">
              <h3 className="text-sm font-black text-slate-700 mb-3">
                Gợi ý nhập hàng ({aiItems.length})
              </h3>
              <div className="space-y-2">
                {aiItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-black text-slate-800 text-sm">{item.products?.name || item.product_id}</h4>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${priorityClass[item.priority]}`}>
                          {priorityLabel[item.priority]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {statusLabel[item.status] || item.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-slate-500 leading-relaxed line-clamp-2">
                        {renderInsight(item.ai_insight || item.reason || '')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400">
                        <span>Tồn: {formatNumber(item.current_stock)}</span>
                        <span>Bán TB: {Number(item.average_daily_sales).toFixed(2)}/ngày</span>
                        <span className="text-blue-600">Đề xuất: +{formatNumber(item.recommended_quantity)}</span>
                      </div>
                    </div>
                    {item.status === 'pending' && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => updateRecommendationStatus(item.id, 'rejected')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
                        >
                          <FiX size={13} />
                          Từ chối
                        </button>
                        <button
                          onClick={() => updateRecommendationStatus(item.id, 'approved')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 transition"
                        >
                          <FiCheck size={13} />
                          Duyệt
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ STOCK CONTENT ═══════════ */}
      <section className={`grid grid-cols-1 gap-6 ${canManageStock ? 'xl:grid-cols-[360px_1fr]' : ''}`}>
        {canManageStock && (
          <form onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => setMode('import')} className={`flex-1 rounded-lg py-2 text-sm font-black ${mode === 'import' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                Nhập kho
              </button>
              <button type="button" onClick={() => setMode('adjust')} className={`flex-1 rounded-lg py-2 text-sm font-black ${mode === 'adjust' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                Điều chỉnh
              </button>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Sản phẩm</span>
              <select name="product_id" required className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none">
                <option value="">Chọn sản phẩm</option>
                {inventory.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name} (tồn {product.stock_quantity})
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-400">
                {mode === 'import' ? 'Số lượng nhập' : 'Tồn kho mới'}
              </span>
              <input name="quantity" type="number" min={mode === 'import' ? 1 : 0} required className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Ghi chú</span>
              <textarea name="note" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none" />
            </label>
            <button disabled={loading} className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white disabled:opacity-50 transition-opacity">
              {loading ? 'Đang xử lý...' : 'Lưu kho'}
            </button>
          </form>
        )}

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase text-slate-700">Cảnh báo tồn kho thấp</h2>
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-sm font-semibold text-slate-400">Không có cảnh báo đang mở</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-800">{alert.products?.name || alert.product_id}</p>
                        <p className="text-xs font-semibold text-red-600">Tồn {alert.current_stock} / ngưỡng {alert.min_stock_level}</p>
                      </div>
                      <span className="text-xs font-black uppercase text-red-600">{alert.status}</span>
                    </div>
                    {canManageStock && (
                      <button onClick={() => resolveAlert(alert.id)} className="mt-3 text-xs font-bold text-slate-700">Đánh dấu đã xử lý</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-black">Sản phẩm</th>
                    <th className="px-4 py-3 font-black">Tồn</th>
                    <th className="px-4 py-3 font-black">Ngưỡng</th>
                    <th className="px-4 py-3 font-black">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((product) => (
                    <tr key={product.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-bold">{product.name}</td>
                      <td className="px-4 py-3">{product.stock_quantity} {product.unit}</td>
                      <td className="px-4 py-3">{product.min_stock_level}</td>
                      <td className={`px-4 py-3 font-black ${product.stock_quantity <= product.min_stock_level ? 'text-red-600' : 'text-emerald-600'}`}>
                        {product.stock_quantity <= product.min_stock_level ? 'Cần nhập' : 'An toàn'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canManageStock && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-black uppercase text-slate-700">Lịch sử kho gần đây</h2>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="py-6 text-center text-sm font-semibold text-slate-400">Chưa có giao dịch kho</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3 rounded-xl bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm">
                      <span className="font-bold">{tx.products?.name || tx.product_id}</span>
                      <span className="font-black">{tx.type}: {tx.quantity > 0 ? '+' : ''}{tx.quantity}</span>
                      <span className="text-slate-400">{new Date(tx.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default StockPage;
