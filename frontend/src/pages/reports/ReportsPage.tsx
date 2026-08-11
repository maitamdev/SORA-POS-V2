import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import {
  reportAPI,
  RevenuePoint,
  TopProduct,
  AiAnalysisResult,
  AiAnalysisReportSummary,
  AiInventoryAnalysisResult,
  AiInventoryReportSummary,
  InventorySkuRow,
} from '../../services/report.api';
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
import { downloadCsv } from '../../utils/exportCsv';
import { useNavigate } from 'react-router-dom';

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

const escapeHtml = (value: unknown) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const pdfMoney = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')} VND`;

const pdfPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;

const COLORS = ['#2563eb', '#0f766e', '#f59e0b', '#e11d48', '#64748b', '#38bdf8', '#059669', '#fb7185', '#334155', '#14b8a6'];

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

const statusLabelInv: Record<string, string> = {
  out_of_stock: 'Hết hàng',
  low_stock: 'Tồn thấp',
  needs_restock: 'Sắp thiếu',
  dead_stock: 'Dead stock',
  overstock: 'Dư tồn',
  healthy: 'An toàn',
};

const priorityLabelInv: Record<string, string> = {
  critical: 'Khẩn',
  high: 'Cao',
  medium: 'TB',
  low: 'Thấp',
};

const ReportsPage = () => {
  const navigate = useNavigate();
  const [activeReportTab, setActiveReportTab] = useState<'revenue' | 'inventory'>('revenue');
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
  const [invAnalysis, setInvAnalysis] = useState<AiInventoryAnalysisResult | null>(null);
  const [invReport, setInvReport] = useState<AiInventoryReportSummary | null>(null);
  const [invHistory, setInvHistory] = useState<AiInventoryReportSummary[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invHistoryLoading, setInvHistoryLoading] = useState(false);
  const [invTableTab, setInvTableTab] = useState<'restock' | 'mismatch' | 'dead' | 'rising'>('restock');
  const lastAutoOpenKey = useRef<string | null>(null);
  const lastInvAutoKey = useRef<string | null>(null);
  const revenueLoadedDays = useRef<number | null>(null);
  const invHistoryReady = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [revenueRes, topRes] = await Promise.all([
        reportAPI.revenue(days),
        reportAPI.topProducts(days, 10),
      ]);
      setRevenue(revenueRes.data.data);
      setTopProducts(topRes.data.data);
      revenueLoadedDays.current = days;
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
      toast.error('Không tải được lịch sử phân tích');
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
      toast.success('Đã khôi phục bản phân tích');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể khôi phục bản phân tích');
    } finally {
      setSelectedHistoryId(null);
    }
  }, []);

  const handleDeleteSavedAnalysis = useCallback(async (id: string) => {
    if (!window.confirm('Xác nhận xóa bản phân tích này khỏi lịch sử?')) return;
    try {
      await reportAPI.deleteAiAnalysis(id);
      setAiHistory((items) => items.filter((item) => item.id !== id));
      if (activeAiReport?.id === id) {
      setActiveAiReport(null);
      setAiAnalysisData(null);
    }
      toast.success('Đã xóa bản phân tích');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa bản phân tích');
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

  const loadInvHistory = useCallback(async () => {
    setInvHistoryLoading(true);
    try {
      const res = await reportAPI.aiInventoryHistory({ page: 1, limit: 6 });
      setInvHistory(res.data.data.items);
    } catch {
      // optional if table not migrated
    } finally {
      setInvHistoryLoading(false);
      invHistoryReady.current = true;
    }
  }, []);

  const handleOpenInvReport = useCallback(async (id: string) => {
    try {
      const res = await reportAPI.aiInventoryDetail(id);
      setInvAnalysis(res.data.data.analysis);
      setInvReport(res.data.data);
      toast.success('Đã mở báo cáo kho đã lưu');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không mở được báo cáo kho');
    }
  }, []);

  const handleDeleteInvReport = useCallback(async (id: string) => {
    if (!window.confirm('Xóa bản báo cáo kho này?')) return;
    try {
      await reportAPI.deleteAiInventoryAnalysis(id);
      setInvHistory((items) => items.filter((x) => x.id !== id));
      if (invReport?.id === id) {
        setInvReport(null);
        setInvAnalysis(null);
      }
      toast.success('Đã xóa báo cáo kho');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không xóa được');
    }
  }, [invReport?.id]);

  const runInventoryAi = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await reportAPI.aiInventoryAnalysis(days);
      setInvAnalysis(res.data.data.analysis);
      setInvReport(res.data.data.saved_report);
      if (res.data.data.save_warning) toast(res.data.data.save_warning, { icon: '⚠️' });
      else toast.success('Đã tạo báo cáo kho AI');
      await loadInvHistory();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không phân tích được kho');
    } finally {
      setInvLoading(false);
    }
  }, [days, loadInvHistory]);

  // Load only the active report family. Inventory AI is intentionally deferred
  // until the user opens its tab because it aggregates 90-day demand and may
  // call the narrative provider.
  useEffect(() => {
    if (activeReportTab !== 'revenue' || revenueLoadedDays.current === days) return;
    loadData();
    loadAiHistory();
  }, [activeReportTab, days, loadData, loadAiHistory]);

  useEffect(() => {
    if (activeReportTab === 'inventory') {
      invHistoryReady.current = false;
      loadInvHistory();
    }
  }, [activeReportTab, loadInvHistory]);

  useEffect(() => {
    setAiAnalysisData(null);
    setActiveAiReport(null);
  }, [days]);

  // Auto-open saved AI analysis first; generate a new one only when no saved report exists for the range.
  useEffect(() => {
    if (activeReportTab !== 'revenue' || revenue.length === 0 || aiAnalysisData || aiLoading || historyLoading) return;

    // Guard against multiple concurrent triggers for the same data state
    const currentKey = `${days}:${revenue.length}:${aiHistory.length}`;
    if (lastAutoOpenKey.current === currentKey) return;
    lastAutoOpenKey.current = currentKey;

    const savedForCurrentRange = aiHistory.find((item) => item.days === days);
    if (savedForCurrentRange) {
      handleOpenSavedAnalysis(savedForCurrentRange.id);
      return;
    }

    // Do not spend a serverless request/LLM call just by opening Reports.
    // If there is no saved snapshot, the user can explicitly run analysis.
  }, [activeReportTab, revenue, days, aiAnalysisData, aiLoading, historyLoading, aiHistory, handleOpenSavedAnalysis]);

  // Auto-load inventory AI: prefer saved for range, else generate once
  useEffect(() => {
    if (activeReportTab !== 'inventory' || !invHistoryReady.current || invAnalysis || invLoading || invHistoryLoading) return;
    const key = `inv:${days}:${invHistory.length}`;
    if (lastInvAutoKey.current === key) return;
    lastInvAutoKey.current = key;

    const saved = invHistory.find((item) => item.days === days);
    if (saved) {
      handleOpenInvReport(saved.id);
      return;
    }
    runInventoryAi();
  }, [activeReportTab, days, invAnalysis, invLoading, invHistoryLoading, invHistory, handleOpenInvReport, runInventoryAi]);

  useEffect(() => {
    setInvAnalysis(null);
    setInvReport(null);
    lastInvAutoKey.current = null;
  }, [days]);

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

  const handleExportToCsv = () => {
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

    downloadCsv(`Bao_cao_SoraPOS_${days}_ngay.csv`, exportData);
    toast.success('Xuất file CSV thành công!');
  };

  const handleExportAiPdf = useCallback(() => {
    if (!aiAnalysisData) {
      toast.error('Chưa có báo cáo AI để xuất PDF');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1120,height=820');
    if (!printWindow) {
      toast.error('Trình duyệt đang chặn popup. Hãy cho phép popup để xuất PDF.');
      return;
    }

    const reportDays = activeAiReport?.days ?? days;
    const generatedAt = activeAiReport?.generated_at ? formatDateTime(activeAiReport.generated_at) : formatDateTime(new Date().toISOString());
    const periodText = activeAiReport?.period_start && activeAiReport?.period_end
      ? `${formatDateLabel(activeAiReport.period_start)} - ${formatDateLabel(activeAiReport.period_end)}`
      : `${reportDays} ngày gần đây`;
    const reportId = activeAiReport?.id ? `#${activeAiReport.id.slice(0, 8).toUpperCase()}` : 'Bản tạm thời';
    const healthScore = typeof aiAnalysisData.health_score === 'number' ? aiAnalysisData.health_score : 0;
    const scoreLabel = healthScore >= 70 ? 'Tốt' : healthScore >= 40 ? 'Cần cải thiện' : 'Cần cảnh báo';
    const scoreColor = healthScore >= 70 ? '#059669' : healthScore >= 40 ? '#d97706' : '#dc2626';

    const metricCards = [
      { label: 'Doanh thu', value: pdfMoney(totalRevenue), note: 'Tổng doanh thu trong kỳ' },
      { label: 'Số đơn hàng', value: totalOrders.toLocaleString('vi-VN'), note: 'Tổng đơn hàng đã ghi nhận' },
      { label: 'Giá vốn COGS', value: pdfMoney(totalCogs), note: 'Chi phí vốn hàng bán' },
      { label: 'Lợi nhuận gộp', value: pdfMoney(totalProfit), note: 'Doanh thu trừ giá vốn' },
      { label: 'Tỷ suất LN', value: pdfPercent(profitMargin), note: 'Biên lợi nhuận gộp' },
      { label: 'AOV', value: pdfMoney(averageOrderVal), note: 'Giá trị trung bình mỗi đơn' },
    ];

    const renderList = (items: string[] = [], type: 'insight' | 'recommendation') => {
      if (items.length === 0) return '<div class="empty">Chưa có dữ liệu.</div>';
      return items.map((item, index) => `
        <div class="list-row ${type}">
          <div class="list-index">${index + 1}</div>
          <div>${escapeHtml(item)}</div>
        </div>
      `).join('');
    };

    const renderCharts = () => {
      if (!aiAnalysisData.charts?.length) return '<div class="empty">Báo cáo AI chưa có bảng dữ liệu biểu đồ.</div>';
      return aiAnalysisData.charts.map((chart) => `
        <section class="chart-box">
          <div class="chart-head">
            <h3>${escapeHtml(chart.title)}</h3>
            <span>${escapeHtml(chart.type.toUpperCase())}</span>
          </div>
          <table>
            <thead><tr><th>Hạng mục</th><th>Giá trị</th></tr></thead>
            <tbody>
              ${chart.data.map((point) => `
                <tr>
                  <td>${escapeHtml(point.name)}</td>
                  <td>${pdfMoney(Number(point.value || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>
      `).join('');
    };

    const reportHtml = `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>Báo cáo AI doanh thu Sora POS</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, Arial, sans-serif; font-size: 12px; line-height: 1.55; }
            .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; padding: 26px; }
            .hero { border-radius: 14px; background: #0f172a; color: #ffffff; padding: 26px; margin-bottom: 22px; border-bottom: 4px solid #2563eb; }
            .brand { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
            .eyebrow { margin: 0 0 8px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .82; }
            h1 { margin: 0; font-size: 25px; line-height: 1.18; letter-spacing: 0; }
            .meta { margin-top: 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
            .meta div { border: 1px solid rgba(255,255,255,.25); border-radius: 12px; padding: 10px; background: rgba(255,255,255,.1); }
            .meta span, .metric span { display: block; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: .08em; }
            .meta strong { display: block; margin-top: 3px; color: #ffffff; font-size: 12px; }
            .score { min-width: 120px; border-radius: 16px; background: rgba(255,255,255,.95); color: #0f172a; padding: 14px; text-align: center; }
            .score-number { color: ${scoreColor}; font-size: 34px; font-weight: 900; line-height: 1; }
            .score-label { margin-top: 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #475569; }
            .section { margin-top: 18px; break-inside: avoid; }
            .section-title { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: #0f172a; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
            .section-title::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: #2563eb; }
            .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .metric { border: 1px solid #e2e8f0; border-radius: 14px; padding: 13px; background: #f8fafc; }
            .metric strong { display: block; margin: 5px 0 3px; font-size: 18px; color: #0f172a; }
            .metric small { color: #64748b; font-weight: 700; }
            .summary { border: 1px solid #dbeafe; border-radius: 14px; background: #eff6ff; padding: 15px; color: #1e293b; font-weight: 650; }
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .list-row { display: grid; grid-template-columns: 28px 1fr; gap: 10px; align-items: start; border: 1px solid #e2e8f0; border-radius: 12px; padding: 11px; margin-bottom: 8px; background: #ffffff; break-inside: avoid; }
            .list-row.insight { border-color: #dbeafe; background: #f8fafc; }
            .list-row.recommendation { border-color: #d1fae5; background: #f8fafc; }
            .list-index { width: 24px; height: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 900; }
            .chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .chart-box { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; break-inside: avoid; }
            .chart-head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
            .chart-head h3 { margin: 0; font-size: 12px; color: #0f172a; }
            .chart-head span { height: 22px; border-radius: 999px; background: #f1f5f9; color: #334155; padding: 4px 8px; font-size: 9px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 10px; }
            th, td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
            th { background: #f1f5f9; color: #475569; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
            td:last-child, th:last-child { text-align: right; font-weight: 800; }
            .empty { border: 1px dashed #cbd5e1; border-radius: 12px; padding: 14px; color: #64748b; font-weight: 700; text-align: center; }
            .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 10px; font-weight: 700; }
            @media print { body { background: #ffffff; } .page { width: auto; min-height: auto; padding: 0; } }
          </style>
        </head>
        <body>
          <main class="page">
            <section class="hero">
              <div class="brand">
                <div>
                  <p class="eyebrow">SORA POS / AI Revenue Intelligence</p>
                  <h1>Báo cáo phân tích doanh thu AI</h1>
                </div>
                <div class="score">
                  <div class="score-number">${escapeHtml(healthScore)}</div>
                  <div class="score-label">${escapeHtml(scoreLabel)}</div>
                </div>
              </div>
              <div class="meta">
                <div><span>Mã báo cáo</span><strong>${escapeHtml(reportId)}</strong></div>
                <div><span>Kỳ báo cáo</span><strong>${escapeHtml(`${reportDays} ngày`)}</strong></div>
                <div><span>Khoảng ngày</span><strong>${escapeHtml(periodText)}</strong></div>
                <div><span>Thời điểm tạo</span><strong>${escapeHtml(generatedAt)}</strong></div>
              </div>
            </section>

            <section class="section">
              <h2 class="section-title">Chỉ số tổng quan</h2>
              <div class="metrics">
                ${metricCards.map((metric) => `
                  <div class="metric">
                    <span>${escapeHtml(metric.label)}</span>
                    <strong>${escapeHtml(metric.value)}</strong>
                    <small>${escapeHtml(metric.note)}</small>
                  </div>
                `).join('')}
              </div>
            </section>

            <section class="section">
              <h2 class="section-title">Tóm tắt điều hành</h2>
              <div class="summary">${escapeHtml(aiAnalysisData.summary)}</div>
            </section>

            <section class="section two-col">
              <div>
                <h2 class="section-title">Phân tích chuyên sâu</h2>
                ${renderList(aiAnalysisData.insights, 'insight')}
              </div>
              <div>
                <h2 class="section-title">Đề xuất hành động</h2>
                ${renderList(aiAnalysisData.recommendations, 'recommendation')}
              </div>
            </section>

            <section class="section">
              <h2 class="section-title">Bảng dữ liệu biểu đồ AI</h2>
              <div class="chart-grid">${renderCharts()}</div>
            </section>

            <div class="footer">
              Báo cáo được tạo từ dữ liệu doanh thu, giá vốn, lợi nhuận và kết quả phân tích đã lưu trong hệ thống Sora POS.
              Khi nộp file, chọn Print / Save as PDF để lưu thành tệp PDF.
            </div>
          </main>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 450);
    toast.success('Đã mở bản in PDF báo cáo AI');
  }, [activeAiReport, aiAnalysisData, averageOrderVal, days, profitMargin, totalCogs, totalOrders, totalProfit, totalRevenue]);

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
    <div className="flex flex-col gap-6 animate-fadeIn pb-10">
      {/* HEADER SECTION */}
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            {activeReportTab === 'revenue' ? 'Báo cáo doanh thu' : 'Báo cáo tồn kho'}
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeReportTab === 'revenue'
              ? 'Theo dõi doanh thu, giá vốn hàng bán (COGS), lợi nhuận và hiệu quả bán hàng.'
              : 'Theo dõi sức khỏe tồn kho, tốc độ bán, kế hoạch nhập và hàng tồn lâu.'}
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

          {activeReportTab === 'revenue' && (
            <button
              onClick={handleExportToCsv}
              className="flex items-center gap-2 h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/10 transition-all active:scale-[0.98]"
            >
              <HiOutlineDownload className="w-4 h-4" />
              <span>Xuất CSV</span>
            </button>
          )}
        </div>
      </header>

      <nav className="flex w-full flex-wrap items-center gap-6 border-b border-slate-200" role="tablist" aria-label="Loại báo cáo">
        <button
          type="button"
          role="tab"
          aria-selected={activeReportTab === 'revenue'}
          onClick={() => setActiveReportTab('revenue')}
          className={`report-control inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 px-1 text-xs font-black transition sm:flex-none ${
            activeReportTab === 'revenue'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <HiTrendUp className="h-4 w-4" />
          Báo cáo doanh thu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeReportTab === 'inventory'}
          onClick={() => setActiveReportTab('inventory')}
          className={`report-control inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 px-1 text-xs font-black transition sm:flex-none ${
            activeReportTab === 'inventory'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <FiPackage className="h-4 w-4" />
          Báo cáo tồn kho
        </button>
      </nav>

      {/* KPI METRIC CARDS */}
      <div className={`${activeReportTab === 'revenue' ? '' : 'hidden'} grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4`}>
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
      <section className={`${activeReportTab === 'revenue' ? '' : 'hidden'} report-panel border border-slate-200 bg-white p-6`}>
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
            type="button"
            onClick={handleExportAiPdf}
            disabled={!aiAnalysisData || aiLoading}
            className="report-control flex items-center justify-center gap-2 h-9 px-4 border border-slate-200 bg-white text-slate-700 text-xs font-bold shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <HiOutlineDownload className="w-4 h-4" />
            <span>Xuất PDF</span>
          </button>
          <button
            onClick={handleAiAnalysis}
            disabled={aiLoading || loading || revenue.length === 0}
            className="report-control flex items-center justify-center gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            {aiLoading ? 'Đang phân tích...' : 'Phân tích lại'}
          </button>
        </div>

        <div className="report-card mt-4 border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-blue-800">
                <HiClock className="h-4 w-4" />
                Lịch sử phân tích doanh thu
              </h3>
              {activeAiReport ? (
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Đang xem bản #{activeAiReport.id.slice(0, 8)} - Kỳ {activeAiReport.days} ngày - Tạo lúc {formatDateTime(activeAiReport.generated_at)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Mỗi lần phân tích thành công sẽ được lưu lại để tra cứu sau.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={loadAiHistory}
              disabled={historyLoading}
              className="report-control h-8 border border-slate-200 bg-white px-3 text-[11px] font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {historyLoading ? 'Đang tải...' : 'Làm mới lịch sử'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {historyLoading && aiHistory.length === 0 ? (
              <div className="rounded-lg border border-blue-100 bg-white px-3 py-4 text-center text-[11px] font-bold text-slate-400 lg:col-span-2">
                Đang tải lịch sử...
              </div>
            ) : aiHistory.length === 0 ? (
              <div className="rounded-lg border border-blue-100 bg-white px-3 py-4 text-center text-[11px] font-bold text-slate-400 lg:col-span-2">
                Chưa có lịch sử phân tích nào.
              </div>
            ) : (
              aiHistory.map((item) => (
                <div key={item.id} className={`report-card border bg-white p-3 transition-colors ${activeAiReport?.id === item.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200 hover:border-blue-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">
                          {item.health_score ?? '--'} điểm
                        </span>
                        <span className="text-[11px] font-black text-slate-800">Kỳ {item.days} ngày</span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {formatDateLabel(item.period_start)} - {formatDateLabel(item.period_end)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {money(item.total_revenue)} - {item.total_orders} đơn - LN {money(item.total_profit)}
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
                        title="Xem chi tiết"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
                      >
                        <HiOutlineEye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedAnalysis(item.id)}
                        title="Xóa khỏi lịch sử"
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
              <div className="report-panel border border-slate-200 bg-white p-6 shadow-sm animate-fadeIn space-y-8 md:p-8">
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
                    <div className="report-card flex h-10 w-10 shrink-0 items-center justify-center bg-blue-50 text-blue-600">
                      <HiTrendUp className="h-5 w-5" />
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
                      <div key={idx} className="report-card flex flex-col border border-slate-200 bg-slate-50/40 p-4">
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
                        <div key={idx + 2} className="report-card flex flex-col border border-slate-200 bg-slate-50/40 p-4">
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
                                  <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3, fill: '#0f766e', stroke: '#fff', strokeWidth: 2 }} />
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
      <section className={`${activeReportTab === 'revenue' ? '' : 'hidden'} grid grid-cols-1 gap-6 lg:grid-cols-3`}>
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

      {/* ═══════════════ AI BÁO CÁO KHO (ENTERPRISE) ═══════════════ */}
      <section className={`${activeReportTab === 'inventory' ? '' : 'hidden'} report-panel overflow-hidden border border-slate-200 bg-white`}>
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="report-card flex h-11 w-11 items-center justify-center bg-blue-50 text-blue-600">
              <FiPackage className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">AI Báo cáo kho</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                KPI · Biểu đồ · Kế hoạch nhập · Xu hướng nhu cầu · Dead stock
                {invReport?.generated_at ? ` · ${formatDateTime(invReport.generated_at)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/stock?tab=alerts')}
              className="report-control h-9 border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Mở cảnh báo kho
            </button>
            <button
              type="button"
              onClick={() => navigate('/stock/receipts/new')}
              className="report-control h-9 border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Tạo phiếu nhập
            </button>
            <button
              type="button"
              onClick={runInventoryAi}
              disabled={invLoading}
              className="report-control h-9 bg-blue-600 px-4 text-[11px] font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {invLoading ? 'Đang phân tích...' : 'Phân tích lại'}
            </button>
          </div>
        </div>

        {invLoading && !invAnalysis ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin" />
            </div>
            <span className="text-xs font-bold text-slate-500 animate-pulse">Đang tổng hợp tồn kho, velocity bán & lập báo cáo...</span>
          </div>
        ) : invAnalysis ? (
          <div className="divide-y divide-slate-100">
            {/* Health + summary */}
            <div className="p-5 flex flex-col md:flex-row gap-5">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={invAnalysis.health_score >= 70 ? '#10b981' : invAnalysis.health_score >= 40 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(invAnalysis.health_score / 100) * 314} 314`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-800">{invAnalysis.health_score}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">điểm kho</span>
                  </div>
                </div>
                <div className="flex gap-1.5 text-[9px] font-bold">
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Sẵn {invAnalysis.score_breakdown.availability}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Vốn {invAnalysis.score_breakdown.capital_efficiency}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Vòng {invAnalysis.score_breakdown.turnover}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 leading-relaxed">{invAnalysis.summary}</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {[
                    { label: 'SKU', v: invAnalysis.kpis.total_products, c: 'text-slate-800' },
                    { label: 'Hết hàng', v: invAnalysis.kpis.out_of_stock, c: 'text-red-600' },
                    { label: 'Tồn thấp', v: invAnalysis.kpis.low_stock, c: 'text-amber-600' },
                    { label: 'Sắp thiếu', v: invAnalysis.kpis.needs_restock, c: 'text-orange-600' },
                    { label: 'Dead', v: invAnalysis.kpis.dead_stock, c: 'text-slate-600' },
                    { label: 'An toàn', v: invAnalysis.kpis.safe, c: 'text-emerald-600' },
                    { label: 'Vốn kho', v: money(invAnalysis.kpis.total_stock_value), c: 'text-indigo-700' },
                    { label: 'Chi phí nhập', v: money(invAnalysis.kpis.estimated_restock_cost), c: 'text-blue-700' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{k.label}</p>
                      <p className={`mt-0.5 text-sm font-black tabular-nums ${k.c}`}>{k.v}</p>
                    </div>
                  ))}
                </div>
                {invAnalysis.forecast_quality && (
                  <div className="mt-3 grid gap-px border border-slate-200 bg-slate-200 sm:grid-cols-3">
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">WAPE dự báo</p>
                      <p className="mt-1 text-sm font-black text-blue-700">{invAnalysis.forecast_quality.average_wape === null ? 'N/A' : `${invAnalysis.forecast_quality.average_wape}%`}</p>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bias dự báo</p>
                      <p className={`mt-1 text-sm font-black ${Math.abs(invAnalysis.forecast_quality.average_bias || 0) > 20 ? 'text-amber-600' : 'text-emerald-700'}`}>{invAnalysis.forecast_quality.average_bias === null ? 'N/A' : `${invAnalysis.forecast_quality.average_bias}%`}</p>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">SKU cần duyệt tay</p>
                      <p className="mt-1 text-sm font-black text-rose-700">{invAnalysis.forecast_quality.high_error_items}</p>
                    </div>
                  </div>
                )}
                {invAnalysis.kpis.estimated_lost_revenue_7d > 0 && (
                  <p className="mt-2 text-[11px] font-bold text-rose-600">
                    Rủi ro mất DT ~{money(invAnalysis.kpis.estimated_lost_revenue_7d)} / 7 ngày nếu không nhập SKU hết hàng
                  </p>
                )}
              </div>
            </div>

            {/* Charts */}
            {invAnalysis.charts?.length > 0 && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {invAnalysis.charts.slice(0, 2).map((chart, idx) => (
                    <div key={idx} className="report-card border border-slate-200 bg-slate-50/40 p-4">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">{chart.title}</h4>
                      <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          {chart.type === 'pie' ? (
                            <PieChart>
                              <Pie data={chart.data} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value"
                                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(val: any) => Number(val).toLocaleString('vi-VN')} />
                            </PieChart>
                          ) : (
                            <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false}
                                tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                              <Tooltip formatter={(val: any) => Number(val).toLocaleString('vi-VN')} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
                {invAnalysis.charts.length > 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {invAnalysis.charts.slice(2, 5).map((chart, idx) => (
                      <div key={idx + 2} className="report-card border border-slate-200 bg-slate-50/40 p-4">
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">{chart.title}</h4>
                        <div className="h-[220px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chart.data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
                              <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false}
                                tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                              <Tooltip formatter={(val: any) => Number(val).toLocaleString('vi-VN')} />
                              <Bar dataKey="value" radius={[5, 5, 0, 0]} fill={COLORS[(idx + 2) % COLORS.length]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Insights + actions — short */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">Nhận định</h3>
                <div className="space-y-2">
                  {invAnalysis.insights?.map((t, i) => (
                    <div key={i} className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-600 text-[10px] font-black text-white">{i + 1}</span>
                      <p className="text-[12px] font-medium text-slate-700 leading-snug">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">Hành động</h3>
                <div className="space-y-2">
                  {invAnalysis.recommendations?.map((t, i) => (
                    <div key={i} className="flex gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-black text-white">{i + 1}</span>
                      <p className="text-[12px] font-medium text-slate-700 leading-snug">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data tables */}
            <div className="p-5 pt-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {([
                  { id: 'restock' as const, label: `Kế hoạch nhập (${invAnalysis.restock_plan?.length || 0})` },
                  { id: 'mismatch' as const, label: `Lệch cầu (${invAnalysis.demand_mismatch?.length || 0})` },
                  { id: 'rising' as const, label: `Nhu cầu tăng (${invAnalysis.rising_demand?.length || 0})` },
                  { id: 'dead' as const, label: `Dead stock (${invAnalysis.dead_stock?.length || 0})` },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInvTableTab(tab.id)}
                    className={`h-8 px-3 rounded-lg text-[11px] font-bold border transition-colors ${
                      invTableTab === tab.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {(() => {
                const tableMap: Record<typeof invTableTab, InventorySkuRow[]> = {
                  restock: invAnalysis.restock_plan || [],
                  mismatch: invAnalysis.demand_mismatch || [],
                  rising: invAnalysis.rising_demand || [],
                  dead: invAnalysis.dead_stock || [],
                };
                const rows = tableMap[invTableTab];
                if (!rows.length) {
                  return (
                    <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs font-semibold text-slate-400">
                      Không có dữ liệu cho bảng này
                    </div>
                  );
                }
                return (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Sản phẩm</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">TT</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">Ưu tiên</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">Xu hướng</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Tồn</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày cover</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Bán/ngày</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Đề xuất</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Chi phí</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">NCC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2.5">
                              <p className="text-xs font-bold text-slate-800">{item.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{item.sku} · {item.category}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                                item.status === 'out_of_stock' ? 'border border-rose-200 bg-rose-50 text-rose-700' :
                                item.status === 'low_stock' ? 'border border-amber-200 bg-amber-50 text-amber-700' :
                                item.status === 'needs_restock' ? 'border border-orange-200 bg-orange-50 text-orange-700' :
                                item.status === 'dead_stock' ? 'border border-slate-200 bg-slate-100 text-slate-600' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {statusLabelInv[item.status] || item.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-[10px] font-black ${
                                item.priority === 'critical' ? 'text-red-600' :
                                item.priority === 'high' ? 'text-orange-600' :
                                item.priority === 'medium' ? 'text-amber-600' : 'text-slate-500'
                              }`}>
                                {priorityLabelInv[item.priority]}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center"><TrendBadge trend={item.sales_trend} /></td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-800">
                              {item.stock_quantity}<span className="text-slate-400 font-semibold">/{item.min_stock_level}</span>
                            </td>
                            <td className="px-3 py-2.5"><StockDaysBar stockDays={item.stock_days} targetDays={invAnalysis.target_days} /></td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-700">
                              {Number(item.avg_daily_sales).toFixed(1)}
                              <span className="block text-[9px] text-slate-400 font-semibold">gần: {Number(item.sales_speed_recent).toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-black tabular-nums text-blue-700">{item.recommended_qty}</td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-700">
                              {item.restock_cost > 0 ? money(item.restock_cost) : item.stock_value > 0 && invTableTab === 'dead' ? money(item.stock_value) : 'N/A'}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 max-w-[100px] truncate">{item.supplier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* History strip */}
            <div className="px-5 pb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Lịch sử báo cáo kho</h3>
                {invHistoryLoading && <span className="text-[10px] text-slate-400">Đang tải...</span>}
              </div>
              {invHistory.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium">Chưa có bản lưu (chạy migration ai_inventory_analyses.sql để lưu lịch sử).</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {invHistory.map((h) => (
                    <div
                      key={h.id}
                      className={`report-card min-w-[180px] border p-2.5 ${invReport?.id === h.id ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="text-[11px] font-black text-slate-800">{h.health_score ?? 'N/A'}/100 · {h.days} ngày</p>
                          <p className="text-[10px] text-slate-400 font-medium">{formatDateTime(h.generated_at)}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                            Hết {h.out_of_stock_count} · Thấp {h.low_stock_count}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => handleOpenInvReport(h.id)} className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:border-blue-300">
                            <HiOutlineEye className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteInvReport(h.id)} className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:border-red-300 hover:text-red-600">
                            <HiOutlineTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-xs font-semibold text-slate-400 mb-3">Chưa có báo cáo kho AI</p>
            <button
              type="button"
              onClick={runInventoryAi}
              disabled={invLoading}
              className="report-control h-9 bg-blue-600 px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              Tạo báo cáo kho
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default ReportsPage;
