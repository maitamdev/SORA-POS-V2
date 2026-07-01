import { useEffect, useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  HiOutlineTrendingUp as HiTrendUp, 
  HiOutlineCurrencyDollar as HiDollar,
  HiOutlineShoppingCart as HiCart,
  HiOutlineCalculator as HiCalc,
  HiOutlineCalendar as HiCal,
  HiOutlineClock as HiClock,
  HiOutlineDownload,
  HiOutlineEye,
  HiOutlineTrash
} from 'react-icons/hi';
import { FiTrendingUp, FiTrendingDown, FiMinus, FiPackage } from 'react-icons/fi';
import { reportAPI, RevenuePoint, TopProduct, AiAnalysisResult, AiAnalysisReportSummary } from '../../services/report.api';
import { aiAPI } from '../../services/ai.api';
import { stockAPI, StockSummary } from '../../services/stock.api';
import { RestockAnalysis } from '../../types/domain.type';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';
import * as XLSX from 'xlsx';

// Format money to VND (round to integer, no decimals)
const money = (value: number) => {
  return `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;
};

const formatDateLabel = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as RevenuePoint;
    const rev = data.revenue || 0;
    const cogs = data.cogs || 0;
    const profit = data.profit || 0;
    const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0';
    return (
      <div className="rounded-2xl bg-slate-900/95 p-4 text-white shadow-2xl border border-slate-700/80 backdrop-blur-md">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
          {data.date.split('-').reverse().join('/')}
        </p>
        <div className="space-y-1.5 text-xs font-semibold">
          <p className="flex justify-between gap-6">
            <span>Doanh thu:</span>
            <span className="text-blue-400 font-bold">{money(rev)}</span>
          </p>
          <p className="flex justify-between gap-6">
            <span>Giá vốn (COGS):</span>
            <span className="text-rose-400 font-bold">{money(cogs)}</span>
          </p>
          <p className="flex justify-between gap-6 border-b border-slate-800 pb-1.5">
            <span>Lợi nhuận gộp:</span>
            <span className="text-emerald-400 font-bold">{money(profit)}</span>
          </p>
          <p className="flex justify-between gap-6 pt-0.5">
            <span>Tỉ suất LN:</span>
            <span className="text-amber-400 font-bold">{margin}%</span>
          </p>
          <p className="flex justify-between gap-6">
            <span>Đơn hàng:</span>
            <span className="text-indigo-300 font-bold">{data.orders} đơn</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const TrendBadge = ({ trend }: { trend?: string }) => {
  if (trend === 'up') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200"><FiTrendingUp className="w-3 h-3" /> Tăng</span>;
  if (trend === 'down') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold border border-red-200"><FiTrendingDown className="w-3 h-3" /> Giảm</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200"><FiMinus className="w-3 h-3" /> Ổn định</span>;
};

const StockDaysBar = ({ stockDays, targetDays }: { stockDays: number | null; targetDays: number }) => {
  if (stockDays === null) return <span className="text-[10px] text-slate-400 font-medium">N/A</span>;
  const percent = Math.min((stockDays / targetDays) * 100, 100);
  const barColor = stockDays <= 3 ? 'bg-red-500' : stockDays <= targetDays * 0.5 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} /></div>
      <span className={`text-[10px] font-bold tabular-nums ${stockDays <= 3 ? 'text-red-600' : stockDays <= targetDays * 0.5 ? 'text-amber-600' : 'text-slate-600'}`}>{stockDays}d</span>
    </div>
  );
};

const ReportsPage = () => {
  const [days, setDays] = useState(30);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<AiAnalysisResult | null>(null);
  const [activeAiReport, setActiveAiReport] = useState<AiAnalysisReportSummary | null>(null);
  const [aiHistory, setAiHistory] = useState<AiAnalysisReportSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [stockAnalysis, setStockAnalysis] = useState<RestockAnalysis | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [revenueRes, topRes] = await Promise.all([
        reportAPI.revenue(days),
        reportAPI.topProducts(days, 10),
      ]);
      setRevenue(revenueRes.data.data);
      setTopProducts(topRes.data.data);
    } catch {
      toast.error('Không tải được báo cáo');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadAiHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await reportAPI.aiAnalysisHistory({ page: 1, limit: 8 });
      setAiHistory(res.data.data.items);
    } catch {
      toast.error('Khong tai duoc lich su phan tich AI');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleOpenSavedAnalysis = useCallback(async (id: string) => {
    setSelectedHistoryId(id);
    try {
      const res = await reportAPI.aiAnalysisDetail(id);
      const report = res.data.data;
      setAiAnalysisData(report.analysis);
      setActiveAiReport(report);
      toast.success('Da mo lai ban phan tich da luu');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Khong mo duoc ban phan tich da luu');
    } finally {
      setSelectedHistoryId(null);
    }
  }, []);

  const handleDeleteSavedAnalysis = useCallback(async (id: string) => {
    if (!window.confirm('Xoa ban phan tich doanh thu da luu nay?')) return;
    try {
      await reportAPI.deleteAiAnalysis(id);
      setAiHistory((items) => items.filter((item) => item.id !== id));
      if (activeAiReport?.id === id) {
        setActiveAiReport(null);
        setAiAnalysisData(null);
      }
      toast.success('Da xoa ban phan tich da luu');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Khong xoa duoc ban phan tich');
    }
  }, [activeAiReport?.id]);

  const handleAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiAnalysisData(null);
    setActiveAiReport(null);
    try {
      const res = await reportAPI.aiAnalysis(days);
      const data = typeof res.data.data.analysis === 'string' 
        ? JSON.parse(res.data.data.analysis) 
        : res.data.data.analysis;
      setAiAnalysisData(data);
      setActiveAiReport(res.data.data.saved_report);
      await loadAiHistory();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể thực hiện phân tích tài chính AI');
    } finally {
      setAiLoading(false);
    }
  }, [days, loadAiHistory]);

  const loadStockAnalysis = useCallback(async () => {
    setStockLoading(true);
    try {
      const [aiRes, summaryRes] = await Promise.all([
        aiAPI.restockAnalysis({ target_days: 14 }),
        stockAPI.summary(),
      ]);
      setStockAnalysis(aiRes.data.data);
      setStockSummary(summaryRes.data.data);
    } catch {
      // Stock analysis is optional, silently fail
    } finally {
      setStockLoading(false);
    }
  }, []);

  // Auto-load everything on page open
  useEffect(() => {
    loadData();
    loadAiHistory();
    loadStockAnalysis();
  }, [loadData, loadAiHistory, loadStockAnalysis]);

  useEffect(() => {
    setAiAnalysisData(null);
    setActiveAiReport(null);
  }, [days]);

  // Auto-open saved AI analysis first; generate a new one only when no saved report exists for the range.
  useEffect(() => {
    if (revenue.length === 0 || aiAnalysisData || aiLoading || historyLoading) return;

    const savedForCurrentRange = aiHistory.find((item) => item.days === days);
    if (savedForCurrentRange) {
      handleOpenSavedAnalysis(savedForCurrentRange.id);
      return;
    }

    handleAiAnalysis();
  }, [revenue, days, aiAnalysisData, aiLoading, historyLoading, aiHistory, handleOpenSavedAnalysis, handleAiAnalysis]);

  // Aggregate metrics
  const totalRevenue = useMemo(() => revenue.reduce((sum, item) => sum + item.revenue, 0), [revenue]);
  const totalOrders = useMemo(() => revenue.reduce((sum, item) => sum + item.orders, 0), [revenue]);
  const totalCogs = useMemo(() => revenue.reduce((sum, item) => sum + (item.cogs || 0), 0), [revenue]);
  const totalProfit = useMemo(() => revenue.reduce((sum, item) => sum + (item.profit || 0), 0), [revenue]);
  
  const profitMargin = useMemo(() => {
    return totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  }, [totalRevenue, totalProfit]);

  const averageOrderVal = useMemo(() => {
    return totalOrders ? totalRevenue / totalOrders : 0;
  }, [totalRevenue, totalOrders]);

  // Excel exporter
  const handleExportToExcel = () => {
    if (revenue.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    const exportData = revenue.map(item => ({
      'Ngày': item.date.split('-').reverse().join('/'),
      'Doanh thu (VND)': item.revenue,
      'Giá vốn (COGS) (VND)': item.cogs || 0,
      'Lợi nhuận gộp (VND)': item.profit || 0,
      'Số đơn hàng': item.orders,
      'Tỉ suất lợi nhuận (%)': item.revenue > 0 ? (((item.profit || 0) / item.revenue) * 100).toFixed(1) : '0'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo doanh thu');

    XLSX.writeFile(workbook, `Bao_cao_SoraPOS_${days}_ngay.xlsx`);
    toast.success('Xuất file Excel thành công!');
  };

  // Format Y Axis label
  const formatYAxis = (val: number) => {
    if (val === 0) return '0đ';
    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.0', '')}M`;
    if (val >= 1000) return `${(val / 1000).toLocaleString('vi-VN')}k`;
    return `${val}`;
  };

  // Top products calculations for progress bar
  const maxProductQty = useMemo(() => {
    return Math.max(...topProducts.map(p => p.quantity), 1);
  }, [topProducts]);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* HEADER SECTION */}
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Thống kê doanh thu</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Báo cáo tài chính doanh nghiệp: Doanh thu, Giá vốn hàng bán (COGS), Lợi nhuận và Lợi nhuận gộp
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Calendar Selector */}
          <div className="relative flex items-center min-w-[150px]">
            <HiCal className="absolute left-3.5 text-slate-400 pointer-events-none w-4 h-4" />
            <select 
              value={days} 
              onChange={(event) => setDays(Number(event.target.value))} 
              className="w-full h-11 pl-10 pr-8 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none transition-all"
            >
              <option value={7}>Xem 7 ngày gần đây</option>
              <option value={30}>Xem 30 ngày gần đây</option>
              <option value={90}>Xem 90 ngày gần đây</option>
            </select>
          </div>

          {/* Export button */}
          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/10 transition-all active:scale-[0.98]"
          >
            <HiOutlineDownload className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </header>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Doanh thu (Revenue)</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <HiDollar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{money(totalRevenue)}</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <HiTrendUp className="text-emerald-500 w-3.5 h-3.5" />
              Doanh thu phát sinh trong {days} ngày
            </p>
          </div>
        </div>

        {/* Card 2: COGS */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Giá vốn hàng bán (COGS)</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <HiCalc className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{money(totalCogs)}</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              Tổng chi phí nhập hàng đã bán
            </p>
          </div>
        </div>

        {/* Card 3: Gross Profit */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Lợi nhuận gộp (Profit)</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <HiTrendUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{money(totalProfit)}</h3>
            <p className="mt-1 text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <span>Tỷ suất lợi nhuận gộp:</span>
              <span className="font-extrabold">{profitMargin.toFixed(1)}%</span>
            </p>
          </div>
        </div>

        {/* Card 4: Orders & AOV */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Tổng số đơn hàng</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <HiCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{totalOrders.toLocaleString('vi-VN')} đơn</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              Giá trị TB/đơn (AOV): {money(averageOrderVal)}
            </p>
          </div>
        </div>
      </div>

      {/* AI REVENUE REPORT ASSISTANT — AUTO-LOADED */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              Trợ lý Phân tích Doanh thu AI
            </h2>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              Tự động phân tích doanh thu, cơ cấu sản phẩm, sức khỏe tài chính và đề xuất hành động kinh tế cụ thể.
            </p>
          </div>
          <button
            onClick={handleAiAnalysis}
            disabled={aiLoading || loading || revenue.length === 0}
            className="flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            {aiLoading ? 'Đang phân tích...' : 'Phân tích lại'}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-blue-800">
                <HiClock className="h-4 w-4" />
                Ban phan tich da luu trong CSDL
              </h3>
              {activeAiReport ? (
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Dang xem ban #{activeAiReport.id.slice(0, 8)} - Ky {activeAiReport.days} ngay - Tao luc {formatDateTime(activeAiReport.generated_at)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Moi lan phan tich AI thanh cong se duoc luu thanh mot ban ghi rieng.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={loadAiHistory}
              disabled={historyLoading}
              className="h-8 rounded-lg border border-blue-200 bg-white px-3 text-[11px] font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {historyLoading ? 'Dang tai...' : 'Lam moi lich su'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {historyLoading && aiHistory.length === 0 ? (
              <div className="rounded-lg border border-blue-100 bg-white px-3 py-4 text-center text-[11px] font-bold text-slate-400 lg:col-span-2">
                Dang tai lich su phan tich...
              </div>
            ) : aiHistory.length === 0 ? (
              <div className="rounded-lg border border-blue-100 bg-white px-3 py-4 text-center text-[11px] font-bold text-slate-400 lg:col-span-2">
                Chua co ban phan tich nao duoc luu.
              </div>
            ) : (
              aiHistory.map((item) => (
                <div key={item.id} className={`rounded-lg border bg-white p-3 transition-colors ${activeAiReport?.id === item.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-blue-100 hover:border-blue-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">
                          {item.health_score ?? '--'} diem
                        </span>
                        <span className="text-[11px] font-black text-slate-800">Ky {item.days} ngay</span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {formatDateLabel(item.period_start)} - {formatDateLabel(item.period_end)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {money(item.total_revenue)} - {item.total_orders} don - LN {money(item.total_profit)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                        {formatDateTime(item.generated_at)}{item.generated_by_user?.full_name ? ` - ${item.generated_by_user.full_name}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenSavedAnalysis(item.id)}
                        disabled={selectedHistoryId === item.id}
                        title="Mo ban phan tich"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
                      >
                        <HiOutlineEye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedAnalysis(item.id)}
                        title="Xoa ban phan tich"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
                      >
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5">
          {aiLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
                <div className="absolute inset-1.5 rounded-full border-4 border-slate-100 border-b-blue-600 animate-spin [animation-duration:1.5s]" />
              </div>
              <span className="text-xs font-bold text-slate-500 animate-pulse">Trợ lý AI đang tổng hợp số liệu và lập báo cáo tài chính...</span>
            </div>
          ) : aiAnalysisData ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm animate-fadeIn space-y-8">
              {/* Health Score + Summary Header */}
              <div className="flex flex-col md:flex-row items-start gap-6 pb-6 border-b border-slate-100">
                {/* Health Score Gauge */}
                {typeof aiAnalysisData.health_score === 'number' && (
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="relative w-24 h-24">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                        <circle 
                          cx="60" cy="60" r="50" fill="none" 
                          stroke={aiAnalysisData.health_score >= 70 ? '#10b981' : aiAnalysisData.health_score >= 40 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="10" 
                          strokeLinecap="round"
                          strokeDasharray={`${(aiAnalysisData.health_score / 100) * 314} 314`}
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-800">{aiAnalysisData.health_score}</span>
                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">điểm</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      aiAnalysisData.health_score >= 70 ? 'text-emerald-700 bg-emerald-50' :
                      aiAnalysisData.health_score >= 40 ? 'text-amber-700 bg-amber-50' :
                      'text-red-700 bg-red-50'
                    }`}>
                      {aiAnalysisData.health_score >= 70 ? 'Tốt' : aiAnalysisData.health_score >= 40 ? 'Cần cải thiện' : 'Cảnh báo'}
                    </span>
                  </div>
                )}
                {/* Summary Text */}
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 text-white shrink-0 shadow-md">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">Báo cáo Phân tích Kinh doanh</h3>
                  </div>
                  <p className="text-[13px] text-slate-600 font-medium leading-relaxed">{aiAnalysisData.summary}</p>
                </div>
              </div>

              {/* Charts Grid — 5 charts, smart layout */}
              {aiAnalysisData.charts && aiAnalysisData.charts.length > 0 && (
                <div className="space-y-6">
                  {/* First row: 2 charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aiAnalysisData.charts.slice(0, 2).map((chart, idx) => (
                      <div key={idx} className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                        <h4 className="text-[11px] font-bold text-slate-700 mb-3 uppercase tracking-wider">{chart.title}</h4>
                        <div className="h-[260px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {chart.type === 'pie' ? (
                              <PieChart>
                                <Pie data={chart.data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                  {chart.data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(val: any) => money(Number(val))} />
                              </PieChart>
                            ) : chart.type === 'line' ? (
                              <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(val: any) => money(Number(val))} />
                                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                              </LineChart>
                            ) : (
                              <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(val: any) => money(Number(val))} cursor={{ fill: 'rgba(59, 130, 246, 0.04)' }} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                  {chart.data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Second row: 3 charts */}
                  {aiAnalysisData.charts.length > 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {aiAnalysisData.charts.slice(2, 5).map((chart, idx) => (
                        <div key={idx + 2} className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                          <h4 className="text-[11px] font-bold text-slate-700 mb-3 uppercase tracking-wider">{chart.title}</h4>
                          <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              {chart.type === 'pie' ? (
                                <PieChart>
                                  <Pie data={chart.data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                    {chart.data.map((_, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(val: any) => money(Number(val))} />
                                </PieChart>
                              ) : chart.type === 'line' ? (
                                <LineChart data={chart.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                  <Tooltip formatter={(val: any) => money(Number(val))} />
                                  <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
                                </LineChart>
                              ) : (
                                <BarChart data={chart.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                  <Tooltip formatter={(val: any) => money(Number(val))} cursor={{ fill: 'rgba(59, 130, 246, 0.04)' }} />
                                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                    {chart.data.map((_, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Insights & Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                <div className="space-y-4">
                  <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    Phân tích chuyên sâu
                  </h3>
                  <div className="flex flex-col gap-3">
                    {aiAnalysisData.insights?.map((insight, i) => (
                      <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-blue-50/50 border border-blue-100/60">
                        <span className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${
                          ['bg-blue-600','bg-emerald-600','bg-amber-500','bg-purple-600','bg-cyan-600'][i % 5]
                        }`}>{i + 1}</span>
                        <span className="flex-1 text-[13px] font-medium text-slate-700 leading-relaxed">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></div>
                    Chiến lược hành động
                  </h3>
                  <div className="flex flex-col gap-3">
                    {aiAnalysisData.recommendations?.map((rec, i) => (
                      <div key={i} className="flex gap-3 text-[13px] font-medium text-slate-700 items-start p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100/60 hover:bg-emerald-50 transition-colors">
                        <svg className={`w-5 h-5 shrink-0 mt-0.5 ${
                          ['text-blue-500','text-emerald-500','text-amber-500','text-purple-500','text-cyan-500'][i % 5]
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="flex-1 leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/30">
              <p className="text-xs font-medium text-slate-400">
                Đang chờ dữ liệu doanh thu...
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CHARTS AND LISTS SECTION */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* REVENUE VS COGS VS PROFIT CHART */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Xu hướng Tài chính Doanh nghiệp</h2>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Biểu đồ so sánh trực quan giữa Doanh thu, Chi phí vốn (COGS) và Lợi nhuận ròng hàng ngày</p>
          </div>
          
          <div className="relative mt-6 w-full h-[320px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
              </div>
            ) : revenue.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                Không có dữ liệu trong khoảng thời gian này
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenue}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorCogs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDateLabel} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tickFormatter={formatYAxis} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'Inter' }}
                  />
                  <Area 
                    name="Doanh thu" 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#2563eb" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                  <Area 
                    name="Lợi nhuận gộp" 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                  />
                  <Area 
                    name="Giá vốn (COGS)" 
                    type="monotone" 
                    dataKey="cogs" 
                    stroke="#f43f5e" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorCogs)" 
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* TOP PRODUCTS LEADERBOARD */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Top sản phẩm bán chạy</h2>
            <p className="text-[11px] font-bold text-slate-400 mt-1">Các sản phẩm đem lại sản lượng cao trong {days} ngày</p>
          </div>

          <div className="mt-5 flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="w-6 h-6 rounded-full border-3 border-slate-200 border-t-blue-600 animate-spin" />
              </div>
            ) : topProducts.length === 0 ? (
              <p className="py-16 text-center text-xs font-bold text-slate-400">
                Chưa phát sinh dữ liệu bán hàng
              </p>
            ) : (
              topProducts.map((item, idx) => {
                const percentage = (item.quantity / maxProductQty) * 100;
                const rankColor = idx === 0 
                  ? 'bg-amber-100 text-amber-700 border-amber-200' 
                  : idx === 1 
                    ? 'bg-slate-100 text-slate-700 border-slate-200' 
                    : idx === 2 
                      ? 'bg-orange-100 text-orange-700 border-orange-200' 
                      : 'bg-slate-50 text-slate-500 border-slate-100';

                return (
                  <div key={item.product_id} className="relative rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-all hover:bg-slate-50 hover:border-slate-200/80">
                    <div className="flex items-start gap-3">
                      {/* Rank badge */}
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${rankColor}`}>
                        {idx + 1}
                      </span>
                      {/* Product details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="truncate text-xs font-bold text-slate-800 tracking-tight">{item.product_name}</h4>
                          <span className="shrink-0 text-xs font-black text-slate-900">{item.quantity} món</span>
                        </div>
                        <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">Doanh thu: {money(item.revenue)}</p>
                        
                        {/* Progress quantity bar */}
                        <div className="w-full bg-slate-200/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-500' : idx === 2 ? 'bg-orange-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* AI STOCK ANALYSIS + STOCK SUMMARY DASHBOARD */}
      <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 p-5 bg-gradient-to-r from-slate-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 text-white shadow-md">
              <FiPackage className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-base tracking-tight">Báo cáo Tồn kho & Cảnh báo AI</h2>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                Tổng quan giá trị kho, phân tích xu hướng nhu cầu và đề xuất nhập hàng thông minh.
              </p>
            </div>
          </div>
          <button
            onClick={loadStockAnalysis}
            disabled={stockLoading}
            className="flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            {stockLoading ? 'Đang phân tích...' : 'Làm mới'}
          </button>
        </div>

        {stockLoading ? (
          <div className="py-14 flex flex-col items-center justify-center gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-slate-800 animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-4 border-slate-100 border-b-blue-600 animate-spin [animation-duration:1.5s]" />
            </div>
            <span className="text-xs font-bold text-slate-500 animate-pulse">Đang tổng hợp dữ liệu tồn kho và phân tích AI...</span>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-slate-100">
            {/* Stock Summary KPI Cards */}
            {stockSummary && (
              <div className="p-5 space-y-5">
                {/* Row 1: Main KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3.5">
                    <p className="text-[9px] font-black uppercase text-blue-500/80 tracking-wider">Tổng mặt hàng</p>
                    <p className="mt-1.5 text-xl font-black text-blue-800 tracking-tight">{stockSummary.total_products}</p>
                  </div>
                  <div className="rounded-xl border border-red-200/60 bg-red-50/40 p-3.5">
                    <p className="text-[9px] font-black uppercase text-red-500/80 tracking-wider">Hết hàng</p>
                    <p className={`mt-1.5 text-xl font-black tracking-tight ${stockSummary.out_of_stock_count > 0 ? 'text-red-700 animate-pulse' : 'text-slate-600'}`}>{stockSummary.out_of_stock_count}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3.5">
                    <p className="text-[9px] font-black uppercase text-amber-600/80 tracking-wider">Tồn thấp</p>
                    <p className={`mt-1.5 text-xl font-black tracking-tight ${stockSummary.low_stock_count > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{stockSummary.low_stock_count}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3.5">
                    <p className="text-[9px] font-black uppercase text-emerald-500/80 tracking-wider">An toàn</p>
                    <p className="mt-1.5 text-xl font-black text-emerald-700 tracking-tight">{stockSummary.safe_count}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/40 p-3.5">
                    <p className="text-[9px] font-black uppercase text-indigo-500/80 tracking-wider">Giá trị kho (vốn)</p>
                    <p className="mt-1.5 text-lg font-black text-indigo-800 tracking-tight">{money(stockSummary.total_stock_value)}</p>
                  </div>
                  <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3.5">
                    <p className="text-[9px] font-black uppercase text-violet-500/80 tracking-wider">Giá trị bán lẻ</p>
                    <p className="mt-1.5 text-lg font-black text-violet-800 tracking-tight">{money(stockSummary.total_retail_value)}</p>
                  </div>
                </div>

                {/* Row 2: Category Breakdown Donut + Top Low Stock */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Category Breakdown Donut Chart */}
                  {stockSummary.category_breakdown.length > 0 && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
                      <h4 className="text-[11px] font-black text-slate-700 mb-3 uppercase tracking-wider">Phân bố tồn kho theo Danh mục</h4>
                      <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stockSummary.category_breakdown.map(c => ({ name: c.name, value: c.total_stock }))}
                              cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            >
                              {stockSummary.category_breakdown.map((_, index) => (
                                <Cell key={`cat-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: any) => `${Number(val).toLocaleString('vi-VN')} sản phẩm`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Category legend with low stock count */}
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {stockSummary.category_breakdown.map((cat, idx) => (
                          <div key={cat.id} className="flex items-center gap-2 text-[10px]">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="font-semibold text-slate-600 truncate">{cat.name}</span>
                            {cat.low_stock_count > 0 && (
                              <span className="ml-auto text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{cat.low_stock_count} cảnh báo</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top 10 Low Stock Products */}
                  {stockSummary.top_low_stock.length > 0 && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
                      <h4 className="text-[11px] font-black text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Top {stockSummary.top_low_stock.length} sản phẩm cần nhập gấp
                      </h4>
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                        {stockSummary.top_low_stock.map((item, idx) => {
                          const ratio = item.min_stock_level > 0 ? (item.stock_quantity / item.min_stock_level) * 100 : 0;
                          const barColor = item.stock_quantity <= 0 ? 'bg-red-500' : ratio <= 50 ? 'bg-amber-500' : 'bg-emerald-500';
                          return (
                            <div key={item.id} className="group rounded-xl border border-slate-200/60 bg-white p-3 hover:border-slate-300 hover:shadow-sm transition-all">
                              <div className="flex items-start gap-2.5">
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${
                                  idx === 0 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>{idx + 1}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                                      <p className="text-[10px] font-medium text-slate-400">{item.sku}{item.category ? ` • ${item.category}` : ''}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className={`text-xs font-black tabular-nums ${item.stock_quantity <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                                        {item.stock_quantity}
                                      </p>
                                      <p className="text-[9px] text-slate-400 font-semibold">/ {item.min_stock_level}</p>
                                    </div>
                                  </div>
                                  {/* Stock bar */}
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(ratio, 100)}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Restock Analysis Table */}
            {stockAnalysis && (
              <div>
                {/* Stock Summary KPIs from AI */}
                <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
                  <div className="rounded-xl border border-red-200/60 bg-red-50/40 p-3">
                    <p className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Hết hàng</p>
                    <p className="mt-1 text-xl font-bold text-red-700">{stockAnalysis.summary.out_of_stock}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3">
                    <p className="text-[10px] font-bold uppercase text-amber-600 tracking-wider">Tồn thấp</p>
                    <p className="mt-1 text-xl font-bold text-amber-700">{stockAnalysis.summary.low_stock}</p>
                  </div>
                  <div className="rounded-xl border border-orange-200/60 bg-orange-50/40 p-3">
                    <p className="text-[10px] font-bold uppercase text-orange-600 tracking-wider">Sắp thiếu</p>
                    <p className="mt-1 text-xl font-bold text-orange-700">{stockAnalysis.summary.needs_restock}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3">
                    <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">An toàn</p>
                    <p className="mt-1 text-xl font-bold text-emerald-700">{stockAnalysis.summary.healthy}</p>
                  </div>
                </div>
                {/* Stock Alert Table */}
                {stockAnalysis.items.filter(i => i.alert_status !== 'healthy').length > 0 ? (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="min-w-full divide-y divide-slate-50 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-slate-400 tracking-wider">Sản phẩm</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-slate-400 tracking-wider">Trạng thái</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">Xu hướng</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tồn</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tồn (ngày)</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase text-slate-400 tracking-wider">Bán/ngày</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase text-slate-400 tracking-wider">Đề xuất nhập</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {stockAnalysis.items.filter(i => i.alert_status !== 'healthy').map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800 text-xs">{item.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">{item.sku}</p>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                item.alert_status === 'out_of_stock' ? 'bg-red-600 text-white' :
                                item.alert_status === 'low_stock' ? 'bg-amber-500 text-white' :
                                'bg-orange-500 text-white'
                              }`}>
                                {item.alert_status === 'out_of_stock' ? 'Hết hàng' : item.alert_status === 'low_stock' ? 'Tồn thấp' : 'Sắp thiếu'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center"><TrendBadge trend={item.sales_trend} /></td>
                            <td className="px-3 py-3 text-right font-bold text-slate-800 text-xs tabular-nums">{new Intl.NumberFormat('vi-VN').format(item.stock_quantity)}</td>
                            <td className="px-3 py-3"><StockDaysBar stockDays={item.stock_days} targetDays={stockAnalysis.target_days} /></td>
                            <td className="px-3 py-3 text-right text-xs tabular-nums">
                              <span className="font-bold text-slate-700">{Number(item.average_daily_sales).toFixed(1)}</span>
                              {item.sales_speed_7d !== undefined && (
                                <span className="block text-[9px] text-slate-400">(7d: {Number(item.sales_speed_7d).toFixed(1)})</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-blue-700 text-xs tabular-nums">{new Intl.NumberFormat('vi-VN').format(item.recommended_quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs font-medium text-emerald-600 bg-emerald-50/30">
                    Tất cả sản phẩm đều có tồn kho an toàn.
                  </div>
                )}
              </div>
            )}

            {!stockAnalysis && !stockSummary && (
              <div className="p-6 text-center text-xs font-medium text-slate-400">
                Không có dữ liệu tồn kho.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default ReportsPage;
