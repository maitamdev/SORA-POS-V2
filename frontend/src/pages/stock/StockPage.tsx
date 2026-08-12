import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiCheck, FiRefreshCw, FiX, FiZap, FiChevronDown, FiChevronUp,
  FiAlertCircle, FiBox, FiShield, FiPlus, FiList, FiClock, FiSearch, 
  FiSliders, FiArrowUpRight, FiArrowDownLeft, FiSettings, FiActivity, FiTag, FiTruck, FiCalendar, FiDownload,
  FiBarChart2, FiCheckCircle, FiAlertTriangle, FiTarget, FiArrowRight, FiInfo
} from 'react-icons/fi';
import { stockAPI } from '../../services/stock.api';
import { aiAPI } from '../../services/ai.api';
import { Product, StockAlert, StockTransaction, AIRecommendation, RestockAnalysis, ProductBatch } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';
import ReceiptListPage from './ReceiptListPage';
import { downloadCsv } from '../../utils/exportCsv';

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
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const getLocalDateMs = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day).setHours(0, 0, 0, 0);
  }
  return new Date(dateString).setHours(0, 0, 0, 0);
};

const getRemainingExpiryDays = (dateString: string) => {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  return Math.round((getLocalDateMs(dateString) - todayMs) / MS_PER_DAY);
};

const getExpiryStatusView = (remainingDays: number) => {
  if (remainingDays < 0) {
    return {
      label: `Hết hạn ${Math.abs(remainingDays)} ngày`,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      progressColor: 'bg-rose-500',
      progressPercent: 100,
    };
  }

  if (remainingDays === 0) {
    return {
      label: 'Hết hạn hôm nay',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 animate-pulse',
      progressColor: 'bg-orange-500',
      progressPercent: 5,
    };
  }

  if (remainingDays <= 30) {
    return {
      label: `Còn ${remainingDays} ngày`,
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
      progressColor: 'bg-orange-500',
      progressPercent: Math.max(5, (remainingDays / 30) * 100),
    };
  }

  return {
    label: `Còn ${remainingDays} ngày`,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progressColor: 'bg-emerald-500',
    progressPercent: 100,
  };
};

const renderInsight = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs text-slate-600 font-medium">
      {lines.map((line, idx) => {
        let cleanLine = line.trim();
        if (!cleanLine) return <div key={idx} className="h-0.5" />;
        
        const isBullet = cleanLine.startsWith('-') || cleanLine.startsWith('*') || cleanLine.startsWith('•') || cleanLine.startsWith('+');
        if (isBullet) {
          cleanLine = cleanLine.replace(/^[-*•+]\s*/, '');
        }

        const parts = [];
        let index = 0;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        
        while ((match = boldRegex.exec(cleanLine)) !== null) {
          const before = cleanLine.substring(index, match.index);
          if (before) parts.push(before);
          parts.push(<strong key={match.index} className="font-extrabold text-slate-900">{match[1]}</strong>);
          index = boldRegex.lastIndex;
        }
        
        const after = cleanLine.substring(index);
        if (after) parts.push(after);

        const content = parts.length > 0 ? parts : cleanLine;

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="mt-1.5 text-[5px] text-blue-500 shrink-0">●</span>
              <span className="flex-1">{content}</span>
            </div>
          );
        }

        return <p key={idx}>{content}</p>;
      })}
    </div>
  );
};

const formatMoney = (value: number | undefined) => `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;

const getInsightPreview = (text: string | null | undefined) => {
  const preview = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^[-*•+]\s*/, '')
    .replace(/\*\*/g, '');
  return preview || 'Chưa có ghi chú giải thích cho quyết định này.';
};

const confidenceMeta: Record<string, { label: string; className: string }> = {
  high: { label: 'Dữ liệu tốt', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  medium: { label: 'Dữ liệu khá', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  low: { label: 'Cần kiểm tra', className: 'border-amber-200 bg-amber-50 text-amber-700' },
};

const getDecisionReasons = (item: RestockAnalysis['items'][number]) => {
  const reasons: string[] = [];
  const available = item.available_quantity ?? item.stock_quantity;
  const reorderPoint = item.reorder_point ?? item.min_stock_level;

  if (item.alert_status === 'out_of_stock') reasons.push(`Tồn khả dụng ${formatNumber(available)} ${item.unit}`);
  else if (item.alert_status === 'low_stock') reasons.push(`Tồn chạm ngưỡng ${formatNumber(available)} ${item.unit}`);
  else reasons.push(`Tồn khả dụng ${formatNumber(available)} ${item.unit}`);

  if (item.average_daily_sales > 0) reasons.push(`Bán ${Number(item.average_daily_sales).toFixed(1)} ${item.unit}/ngày`);
  reasons.push(`Điểm đặt hàng ${formatNumber(reorderPoint)} ${item.unit}`);

  return reasons.slice(0, 3);
};

const AiSignalBar = ({ label, value, percent, tone = 'blue' }: { label: string; value: string; percent: number; tone?: 'blue' | 'red' | 'amber' | 'green' }) => {
  const tones = {
    blue: 'bg-blue-600',
    red: 'bg-rose-500',
    amber: 'bg-amber-500',
    green: 'bg-emerald-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10px] font-bold">
        <span className="text-slate-500">{label}</span>
        <span className="tabular-nums text-slate-800">{value}</span>
      </div>
      <div className="mt-1 h-1.5 bg-slate-100">
        <div className={`h-full ${tones[tone]} transition-all duration-500`} style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
};

const AiDrawerSkeleton = () => (
  <div className="space-y-3 animate-pulse" aria-label="Đang tải phân tích kho">
    <div className="h-28 bg-slate-100" />
    <div className="grid grid-cols-2 gap-2">
      <div className="h-20 bg-slate-100" />
      <div className="h-20 bg-slate-100" />
    </div>
    <div className="h-40 bg-slate-100" />
    <div className="h-40 bg-slate-100" />
  </div>
);

type AIDashboardStats = {
  total: number;
  critical: number;
  confident: number;
  confidencePercent: number;
  coverage: number;
  items: RestockAnalysis['items'];
  visible: RestockAnalysis['items'];
  estimatedCost: number;
  lostRevenue: number;
};

type AIStockDrawerProps = {
  analysis: RestockAnalysis | null;
  aiItems: AIRecommendation[];
  targetDays: number;
  setTargetDays: (value: number) => void;
  aiLoading: boolean;
  aiError: string | null;
  generating: boolean;
  showAllProducts: boolean;
  dashboardStats: AIDashboardStats;
  onToggleShowAll: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onGenerate: () => void;
  onUpdateStatus: (id: string, status: 'approved' | 'rejected') => void;
  onCreateRestock: (productId: string, quantity: number) => void;
};

const AIStockDrawer = ({
  analysis,
  aiItems,
  targetDays,
  setTargetDays,
  aiLoading,
  aiError,
  generating,
  showAllProducts,
  dashboardStats,
  onToggleShowAll,
  onClose,
  onRefresh,
  onGenerate,
  onUpdateStatus,
  onCreateRestock,
}: AIStockDrawerProps) => {
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const summary = analysis?.summary;
  const actionableCount = (summary?.out_of_stock || 0) + (summary?.low_stock || 0) + (summary?.needs_restock || 0);
  const displayedItems = showAllProducts ? dashboardStats.items : dashboardStats.visible;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        <button aria-label="Đóng trợ lý phân tích kho" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
          <aside className="pointer-events-auto flex h-full w-screen max-w-[590px] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl animate-slideLeft">
            <header className="shrink-0 border-b border-slate-800 bg-[#071126] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-600 text-white">
                    <FiBarChart2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="slide-over-title" className="text-[17px] font-black tracking-tight">Trợ lý vận hành kho</h2>
                      <span className="border border-blue-400/40 bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-200">
                        {analysis?.engine_version || 'engine v2'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-slate-300">Số liệu quyết định từ tồn kho và tốc độ bán. AI chỉ diễn giải phần cần hành động.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Đóng"
                  className="shrink-0 border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:bg-slate-900 hover:text-white"
                >
                  <FiX size={16} />
                </button>
              </div>
            </header>

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500" htmlFor="ai-target-days">
                Mục tiêu cover
                <span className="flex items-center border border-slate-200 bg-slate-50">
                  <input
                    id="ai-target-days"
                    value={targetDays}
                    onChange={(event) => setTargetDays(Number(event.target.value))}
                    type="number"
                    min={1}
                    max={90}
                    className="h-8 w-12 bg-transparent px-2 text-center text-xs font-black text-slate-800 outline-none"
                  />
                  <span className="pr-2 text-[10px] font-bold text-slate-400">ngày</span>
                </span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={onRefresh}
                  disabled={aiLoading}
                  aria-label="Làm mới phân tích"
                  className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
                >
                  <FiRefreshCw className={aiLoading ? 'animate-spin' : ''} size={13} />
                </button>
                <button
                  onClick={onGenerate}
                  disabled={generating}
                  className="inline-flex h-8 items-center gap-1.5 border border-blue-600 bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <FiZap size={12} />
                  {generating ? 'Đang cập nhật...' : 'Cập nhật phân tích'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {aiLoading && !analysis ? (
                <div className="p-5"><AiDrawerSkeleton /></div>
              ) : aiError && !analysis ? (
                <div className="p-5">
                  <div className="border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-start gap-3">
                      <FiAlertTriangle className="mt-0.5 shrink-0 text-rose-600" size={18} />
                      <div>
                        <p className="text-sm font-black text-rose-800">Chưa lấy được phân tích</p>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-rose-700">{aiError}</p>
                        <button onClick={onRefresh} className="mt-3 border border-rose-300 bg-white px-3 py-2 text-[11px] font-black text-rose-700 hover:bg-rose-100">Thử lại</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {aiError && (
                    <section className="border-b border-amber-200 bg-amber-50 px-5 py-2.5">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-amber-800">
                        <FiInfo className="shrink-0" size={14} />
                        <span>Đang hiển thị lần phân tích gần nhất. {aiError}</span>
                        <button onClick={onRefresh} className="ml-auto shrink-0 border border-amber-300 bg-white px-2 py-1 text-[10px] font-black text-amber-800 hover:bg-amber-100">Thử lại</button>
                      </div>
                    </section>
                  )}
                  <section className="border-b border-slate-200 bg-white p-5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border-l-4 border-rose-500 bg-rose-50/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Cần xử lý</p>
                          <FiAlertCircle className="text-rose-600" size={15} />
                        </div>
                        <p className="mt-2 text-2xl font-black tabular-nums text-rose-700">{actionableCount}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-rose-600">SKU dưới ngưỡng</p>
                      </div>
                      <div className="border-l-4 border-blue-600 bg-blue-50/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Đề xuất nhập</p>
                          <FiTruck className="text-blue-600" size={15} />
                        </div>
                        <p className="mt-2 text-2xl font-black tabular-nums text-blue-700">{formatNumber(summary?.total_recommended_quantity || 0)}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-blue-600">{formatMoney(dashboardStats.estimatedCost)} vốn dự kiến</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Độ tin cậy</p>
                          <FiTarget className="text-slate-500" size={15} />
                        </div>
                        <p className="mt-2 text-lg font-black tabular-nums text-slate-900">{dashboardStats.confidencePercent}%</p>
                        <AiSignalBar label="SKU có dữ liệu đủ dùng" value={`${dashboardStats.confident}/${dashboardStats.total}`} percent={dashboardStats.confidencePercent} tone="blue" />
                      </div>
                      <div className="border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Độ phủ an toàn</p>
                          <FiShield className="text-emerald-600" size={15} />
                        </div>
                        <p className="mt-2 text-lg font-black tabular-nums text-slate-900">{dashboardStats.coverage}%</p>
                        <AiSignalBar label="SKU đang an toàn" value={`${summary?.healthy || 0}/${dashboardStats.total}`} percent={dashboardStats.coverage} tone="green" />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 border border-slate-200 bg-white">
                      <div className="p-2.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Khẩn cấp</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-rose-600">{dashboardStats.critical}</p>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Rủi ro mất DT</p>
                        <p className="mt-1 truncate text-sm font-black tabular-nums text-slate-800">{formatMoney(dashboardStats.lostRevenue)}</p>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Đã đủ hàng</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-emerald-600">{summary?.healthy || 0}</p>
                      </div>
                    </div>
                  </section>

                  {analysis?.warnings && analysis.warnings.length > 0 && (
                    <section className="border-b border-amber-200 bg-amber-50 px-5 py-3">
                      <div className="flex items-start gap-2.5">
                        <FiInfo className="mt-0.5 shrink-0 text-amber-700" size={15} />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Điều kiện dữ liệu</p>
                          <p className="mt-1 text-[11px] font-medium leading-relaxed text-amber-800">{analysis.warnings.join(' ')}</p>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="border-b border-slate-200 p-5">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Bảng điều phối</p>
                        <h3 className="mt-1 text-base font-black tracking-tight text-slate-900">Xử lý theo thứ tự ưu tiên</h3>
                      </div>
                      <button onClick={onToggleShowAll} className="text-[11px] font-black text-blue-700 hover:text-blue-900">
                        {showAllProducts ? 'Chỉ xem cảnh báo' : `Xem tất cả ${dashboardStats.total} SKU`}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <AiSignalBar label="Hết hàng" value={`${summary?.out_of_stock || 0}`} percent={((summary?.out_of_stock || 0) / Math.max(dashboardStats.total, 1)) * 100} tone="red" />
                      <AiSignalBar label="Tồn thấp" value={`${summary?.low_stock || 0}`} percent={((summary?.low_stock || 0) / Math.max(dashboardStats.total, 1)) * 100} tone="amber" />
                      <AiSignalBar label="Sắp thiếu" value={`${summary?.needs_restock || 0}`} percent={((summary?.needs_restock || 0) / Math.max(dashboardStats.total, 1)) * 100} tone="blue" />
                    </div>
                  </section>

                  <section className="space-y-3 p-5">
                    {displayedItems.length === 0 ? (
                      <div className="border border-emerald-200 bg-emerald-50 p-5 text-center">
                        <FiCheckCircle className="mx-auto text-emerald-600" size={24} />
                        <p className="mt-2 text-sm font-black text-emerald-800">Kho đang trong vùng an toàn</p>
                        <p className="mt-1 text-xs font-medium text-emerald-700">Không có SKU nào vượt qua ngưỡng cảnh báo hiện tại.</p>
                      </div>
                    ) : (
                      displayedItems.map((item) => {
                        const confidence = confidenceMeta[item.forecast_confidence || 'low'];
                        const available = item.available_quantity ?? item.stock_quantity;
                        const reorderPoint = item.reorder_point ?? item.min_stock_level;
                        const coverage = item.stock_days === null ? 0 : Math.min(100, (item.stock_days / Math.max(item.target_cover_days || targetDays, 1)) * 100);
                        const priorityTone = item.priority === 'high' ? 'border-l-rose-500' : item.priority === 'medium' ? 'border-l-amber-500' : 'border-l-blue-500';

                        return (
                          <article key={item.id} className={`border border-slate-200 border-l-4 ${priorityTone} bg-white`}>
                            <div className="flex items-start justify-between gap-3 p-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate text-sm font-black text-slate-900">{item.name}</h4>
                                  <span className={`border px-1.5 py-0.5 text-[9px] font-black ${priorityClass[item.priority]}`}>{alertLabel[item.alert_status]}</span>
                                </div>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.sku} · {item.unit}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Nhập đề xuất</p>
                                <p className="mt-0.5 text-2xl font-black tabular-nums text-blue-700">+{formatNumber(item.recommended_quantity)}</p>
                                {item.restock_cost !== undefined && <p className="text-[10px] font-bold tabular-nums text-slate-500">{formatMoney(item.restock_cost)}</p>}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 bg-slate-50">
                              <div className="p-3">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tồn khả dụng</p>
                                <p className={`mt-1 text-base font-black tabular-nums ${available <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatNumber(available)}</p>
                                {item.incoming_quantity ? <p className="mt-0.5 text-[9px] font-bold text-emerald-600">Đang về +{formatNumber(item.incoming_quantity)}</p> : <p className="mt-0.5 text-[9px] font-medium text-slate-400">Không có hàng đang về</p>}
                              </div>
                              <div className="p-3">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Điểm đặt hàng</p>
                                <p className="mt-1 text-base font-black tabular-nums text-slate-900">{formatNumber(reorderPoint)}</p>
                                <p className="mt-0.5 text-[9px] font-medium text-slate-400">Lead time {item.lead_time_days || 3} ngày</p>
                              </div>
                              <div className="p-3">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tốc độ bán</p>
                                <p className="mt-1 text-base font-black tabular-nums text-slate-900">{Number(item.average_daily_sales).toFixed(1)}</p>
                                <p className="mt-0.5 text-[9px] font-medium text-slate-400">{item.stock_days === null ? 'Chưa đủ dữ liệu' : `${item.stock_days} ngày cover`}</p>
                              </div>
                            </div>

                            <div className="space-y-3 p-4">
                              <div className="grid grid-cols-2 gap-3">
                                <AiSignalBar label="Độ phủ tồn hiện tại" value={item.stock_days === null ? 'N/A' : `${item.stock_days} ngày`} percent={coverage} tone={item.stock_days !== null && item.stock_days <= 3 ? 'red' : 'blue'} />
                                <AiSignalBar label="Độ tin cậy dự báo" value={confidence.label} percent={item.forecast_confidence === 'high' ? 100 : item.forecast_confidence === 'medium' ? 70 : 35} tone={item.forecast_confidence === 'high' ? 'green' : item.forecast_confidence === 'medium' ? 'blue' : 'amber'} />
                              </div>

                              <div className="border border-blue-100 bg-blue-50/70 p-3">
                                <div className="flex items-start gap-2">
                                  <FiArrowRight className="mt-0.5 shrink-0 text-blue-700" size={14} />
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-800">Vì sao hệ thống chọn số lượng này?</p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {getDecisionReasons(item).map((reason) => <span key={reason} className="border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold text-blue-800">{reason}</span>)}
                                    </div>
                                    <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-600">{getInsightPreview(item.ai_insight)}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`border px-1.5 py-0.5 text-[9px] font-black ${confidence.className}`}>{confidence.label}</span>
                                  {item.manual_review && <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">Duyệt tay</span>}
                                  {item.expiring_soon_quantity ? <span className="border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[9px] font-black text-orange-700">HSD gần</span> : null}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onCreateRestock(item.id, item.recommended_quantity)}
                                    className="inline-flex h-8 items-center gap-1.5 bg-blue-600 px-2.5 text-[10px] font-black text-white hover:bg-blue-700"
                                  >
                                    <FiTruck size={12} />
                                    {item.recommended_quantity > 0 ? 'Tạo phiếu nhập' : 'Mở tồn kho'}
                                  </button>
                                  <button
                                    onClick={() => setExpandedInsight(expandedInsight === item.id ? null : item.id)}
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-blue-700"
                                  >
                                    {expandedInsight === item.id ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                                    {expandedInsight === item.id ? 'Thu gọn' : 'Xem phân tích'}
                                  </button>
                                </div>
                              </div>
                              {expandedInsight === item.id && (
                                <div className="border-t border-slate-200 pt-3">{renderInsight(item.ai_insight)}</div>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </section>

                  {aiItems.length > 0 && (
                    <section className="border-t border-slate-200 bg-white p-5">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Hàng đợi phê duyệt</p>
                          <h3 className="mt-1 text-sm font-black text-slate-900">Gợi ý đã lưu</h3>
                        </div>
                        <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">{aiItems.length} chờ duyệt</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {aiItems.map((item) => (
                          <div key={item.id} className="border border-slate-200 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-slate-900">{item.products?.name || item.product_id}</p>
                                <p className="mt-1 text-[10px] font-bold text-blue-700">Nhập +{formatNumber(item.recommended_quantity)} · {formatMoney(item.recommended_quantity * Number(item.products?.cost_price || 0))}</p>
                              </div>
                              <span className={`border px-1.5 py-0.5 text-[9px] font-black ${priorityClass[item.priority]}`}>{priorityLabel[item.priority]}</span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-600">{getInsightPreview(item.ai_insight || item.reason)}</p>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onCreateRestock(item.product_id, item.recommended_quantity)}
                                className="inline-flex items-center gap-1.5 border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700 hover:bg-blue-100"
                              >
                                <FiTruck size={12} />
                                {item.recommended_quantity > 0 ? 'Tạo phiếu nhập' : 'Mở tồn kho'}
                              </button>
                              <button onClick={() => onUpdateStatus(item.id, 'rejected')} className="border border-slate-200 px-3 py-1.5 text-[10px] font-black text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">Từ chối</button>
                              <button onClick={() => onUpdateStatus(item.id, 'approved')} className="bg-slate-950 px-3 py-1.5 text-[10px] font-black text-white hover:bg-blue-700">Duyệt</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
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

const getProductImage = (product: Product) => product.image_url || '/assets/product-placeholder.svg';

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const canManageStock = user?.role === 'admin' || user?.role === 'manager';

  const getInitialTab = (): 'inventory' | 'alerts' | 'transactions' | 'receipts' | 'expiry' | 'audit' => {
    if (tabParam === 'receipts' && canManageStock) return 'receipts';
    if (tabParam === 'alerts') return 'alerts';
    if (tabParam === 'transactions' && canManageStock) return 'transactions';
    if (tabParam === 'expiry') return 'expiry';
    if (tabParam === 'audit' && canManageStock) return 'audit';
    return 'inventory';
  };

  const [activeTab, setActiveTab] = useState<'inventory' | 'alerts' | 'transactions' | 'receipts' | 'expiry' | 'audit'>(getInitialTab());
  const [inventory, setInventory] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ProductBatch[]>([]);

  // Transactions pagination
  const [txPage, setTxPage] = useState(1);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Sync tab with URL parameter
  useEffect(() => {
    if (tabParam !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, tabParam, setSearchParams]);

  // Quick Action Modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionProductId, setActionProductId] = useState('');

  // Search and Category Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'safe'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'near_expiry' | 'safe'>('all');

  // AI Panel
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiItems, setAiItems] = useState<AIRecommendation[]>([]);
  const [analysis, setAnalysis] = useState<RestockAnalysis | null>(null);
  const [targetDays, setTargetDays] = useState(14);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const loadTransactions = useCallback(async (pageToLoad: number) => {
    if (!canManageStock) return;
    try {
      const transactionsRes = await stockAPI.transactions({ page: pageToLoad, limit: 10 });
      setTransactions(transactionsRes.data.data.items);
      setTxPagination(transactionsRes.data.data.pagination);
    } catch (error) {
      console.error('Không tải được nhật ký giao dịch:', error);
    }
  }, [canManageStock]);

  const loadAllExpiryAlerts = async () => {
    const limit = 500;
    let page = 1;
    let total = 0;
    const items: ProductBatch[] = [];

    do {
      const response = await stockAPI.expiryAlerts({ limit, page });
      const payload = response.data.data;
      items.push(...payload.items);
      total = payload.pagination.total;
      page += 1;
      if (payload.items.length === 0) break;
    } while (items.length < total);

    return items;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [inventoryRes, alertsRes, expiryRes] = await Promise.all([
        stockAPI.inventory({ limit: 500 }),
        stockAPI.alerts({ limit: 200 }),
        loadAllExpiryAlerts(),
      ]);
      setInventory(inventoryRes.data.data.items);
      setAlerts(alertsRes.data.data.items);
      setExpiryAlerts(expiryRes);
      await loadTransactions(txPage);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được dữ liệu kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [canManageStock]);

  // Load transactions separately when page changes
  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions(txPage);
    }
  }, [txPage, activeTab, loadTransactions]);

  // Realtime auto-refresh: khi stock_alerts table thay đổi (INSERT/UPDATE từ Supabase)
  useEffect(() => {
    const handleAlertChanged = () => {
      // Chỉ reload nếu đang ở tab alerts hoặc inventory
      if (activeTab === 'alerts' || activeTab === 'inventory') {
        loadData();
      }
    };
    window.addEventListener('stock_alert_changed', handleAlertChanged);
    return () => window.removeEventListener('stock_alert_changed', handleAlertChanged);
  }, [activeTab]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageStock) { toast.error('Bạn không có quyền cập nhật kho'); return; }
    if (loading) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const productId = String(form.get('product_id') || '');
    const quantity = Number(form.get('quantity') || 0);
    const batchNumber = String(form.get('batch_number') || '').trim();
    const expiryDate = String(form.get('expiry_date') || '');
    const note = String(form.get('note') || '');

    if (!batchNumber || !expiryDate) {
      toast.error('Vui lòng nhập số lô và hạn sử dụng');
      return;
    }
    
    setLoading(true);
    try {
      await stockAPI.importStock({ product_id: productId, quantity, batch_number: batchNumber, expiry_date: expiryDate, note });
      toast.success('Đã nhập kho theo lô thành công');
      formEl.reset();
      setShowActionModal(false);
      setTxPage(1);
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
    setAiError(null);
    try {
      const [aRes, rRes] = await Promise.all([
        aiAPI.restockAnalysis({ target_days: targetDays }),
        aiAPI.list({ limit: 100, status: 'pending' }),
      ]);
      setAnalysis(aRes.data.data);
      setAiItems(rRes.data.data.items);
    } catch {
      setAiError('Không tải được dữ liệu phân tích. Kiểm tra kết nối rồi thử lại.');
      toast.error('Không tải được dữ liệu AI');
    }
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

  const openAiRestockAction = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      navigate('/stock?tab=inventory');
      return;
    }
    navigate(`/stock/receipts/new?product_id=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(String(quantity))}`);
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

  const handleExportCsv = useCallback(() => {
    try {
      const exportData = filteredInventory.map((item, idx) => ({
        'STT': idx + 1,
        'Mã SKU': item.sku,
        'Tên sản phẩm': item.name,
        'Barcode': item.barcode || '',
        'Danh mục': (item as any).categories?.name || '',
        'Tồn kho': item.stock_quantity,
        'Mức tối thiểu': item.min_stock_level,
        'Trạng thái': item.stock_quantity <= 0 ? 'Hết hàng' : item.stock_quantity <= item.min_stock_level ? 'Tồn thấp' : 'An toàn',
        'Đơn vị': item.unit || '',
      }));
      downloadCsv(`ton-kho_${new Date().toISOString().split('T')[0]}.csv`, exportData);
      toast.success(`Đã xuất ${exportData.length} sản phẩm ra file CSV`);
    } catch {
      toast.error('Không thể xuất file CSV');
    }
  }, [filteredInventory]);

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
    // KPI phải phản ánh tồn thực tế của sản phẩm. `stock_alerts` có thể chưa
    // được tạo, đã được resolve, hoặc bị lệch dữ liệu nên không dùng để đếm.
    const lowStockCount = inventory.filter((item) =>
      Number(item.stock_quantity ?? 0) <= Number(item.min_stock_level ?? 0)
    ).length;
    const safeCount = Math.max(totalCount - lowStockCount, 0);
    const expiryWarningCount = expiryAlerts.filter((batch) => getRemainingExpiryDays(batch.expiry_date) <= 30).length;
    const txCount = txPagination.total || transactions.length;

    return { totalCount, lowStockCount, safeCount, expiryWarningCount, txCount };
  }, [inventory, transactions, expiryAlerts, txPagination.total]);

  // Expiry statistics calculation
  const expiryStats = useMemo(() => {
    let expired = 0;
    let nearExpiry = 0;
    let safe = 0;
    expiryAlerts.forEach((batch) => {
      const remainingDays = getRemainingExpiryDays(batch.expiry_date);

      if (remainingDays < 0) {
        expired++;
      } else if (remainingDays <= 30) {
        nearExpiry++;
      } else {
        safe++;
      }
    });

    return { expired, nearExpiry, safe };
  }, [expiryAlerts]);

  // Filtered Expiry Batches
  const filteredExpiryAlerts = useMemo(() => {
    return expiryAlerts.filter((batch) => {
      // Search term filter matches product name, sku, barcode or batch number
      const matchesSearch =
        !searchTerm.trim() ||
        batch.products?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.products?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (batch.products?.barcode && batch.products.barcode.includes(searchTerm)) ||
        batch.batch_number?.toLowerCase().includes(searchTerm.toLowerCase());

      // Category filter
      const matchesCategory =
        selectedCategory === 'all' || batch.products?.category_id === selectedCategory;

      // Expiry filter
      const remainingDays = getRemainingExpiryDays(batch.expiry_date);

      let matchesExpiry = true;
      if (expiryFilter === 'expired') {
        matchesExpiry = remainingDays < 0;
      } else if (expiryFilter === 'near_expiry') {
        matchesExpiry = remainingDays >= 0 && remainingDays <= 30;
      } else if (expiryFilter === 'safe') {
        matchesExpiry = remainingDays > 30;
      }

      return matchesSearch && matchesCategory && matchesExpiry;
    });
  }, [expiryAlerts, searchTerm, selectedCategory, expiryFilter]);

  const summary = analysis?.summary;

  const aiDashboardStats = useMemo(() => {
    const items = analysis?.items || [];
    const total = summary?.total_products || items.length;
    const critical = items.filter((item) => item.priority === 'high' && item.alert_status !== 'healthy').length;
    const confident = items.filter((item) => item.forecast_confidence === 'high' || item.forecast_confidence === 'medium').length;
    const coverage = summary && summary.total_products > 0 ? Math.round((summary.healthy / summary.total_products) * 100) : 0;
    const visible = items
      .filter((item) => item.alert_status !== 'healthy')
      .sort((a, b) => {
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.priority] - priority[b.priority] || b.recommended_quantity - a.recommended_quantity;
      });

    return {
      total,
      critical,
      confident,
      confidencePercent: total > 0 ? Math.round((confident / total) * 100) : 0,
      coverage,
      items,
      visible,
      estimatedCost: summary?.estimated_restock_cost || 0,
      lostRevenue: summary?.estimated_lost_revenue_7d || 0,
    };
  }, [analysis, summary]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 animate-fadeIn pb-10">
      {/* 1. Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-[30px] font-black text-slate-950 tracking-tight flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center bg-blue-50 text-blue-600">
              <FiBox size={19} />
            </span>
            Quản lý kho hàng
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">
            Theo dõi tồn kho, lô hạn sử dụng và lịch sử luân chuyển hàng hóa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
          {canManageStock && (
            <>
              {activeTab === 'receipts' && (
                <button
                  onClick={() => navigate('/stock/receipts/new')}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 border border-blue-600 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white transition-all duration-200 shadow-sm active:scale-[0.98]"
                >
                  <FiPlus size={16} className="stroke-[2.5]" />
                  Lập phiếu nhập mới
                </button>
              )}
              {activeTab !== 'receipts' && (
                <button
                  onClick={showAIPanel ? () => setShowAIPanel(false) : handleOpenAI}
                   className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 border px-4 py-2.5 text-xs sm:text-sm font-extrabold transition-all duration-200 ${
                     showAIPanel
                       ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                       : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                   }`}
                >
                  <FiZap className={showAIPanel ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-slate-400'} size={15} />
                  Trợ lý AI
                </button>
              )}
            </>
          )}
          {activeTab === 'inventory' && (
            <button
              onClick={handleExportCsv}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-3 py-2.5 text-slate-700 transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs font-extrabold"
              title="Xuất file CSV tồn kho"
            >
              <FiDownload size={14} />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>
          )}
          <button
            onClick={() => {
              if (activeTab === 'receipts') {
                setRefreshTrigger((prev) => prev + 1);
              } else {
                loadData();
              }
            }}
            className="inline-flex items-center justify-center gap-2 border border-blue-600 bg-blue-600 px-3 py-2.5 text-xs font-extrabold text-white transition-all hover:bg-blue-700 active:scale-[0.98]"
            title="Làm mới dữ liệu"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
            <span className="hidden sm:inline">Làm mới dữ liệu</span>
          </button>
        </div>
      </header>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <div className="group flex items-center gap-4 border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-105">
            <FiBox size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tổng mặt hàng</p>
            <h4 className="mt-0.5 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">{stats.totalCount}</h4>
          </div>
        </div>

        <div className="group flex items-center gap-4 border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center border transition-transform duration-300 group-hover:scale-105 ${
            stats.lowStockCount > 0
              ? 'border-rose-100 bg-rose-50 text-rose-600'
              : 'border-slate-100 bg-slate-50 text-slate-400'
          }`}>
            <FiAlertCircle size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tồn thấp / Hết hàng</p>
            <h4 className={`mt-0.5 text-xl font-black tracking-tight sm:text-2xl ${stats.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{stats.lowStockCount}</h4>
          </div>
        </div>

        <div className="group flex items-center gap-4 border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-emerald-100 bg-emerald-50 text-emerald-600 transition-transform duration-300 group-hover:scale-105">
            <FiShield size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tồn an toàn</p>
            <h4 className="mt-0.5 text-xl font-black tracking-tight text-emerald-700 sm:text-2xl">{stats.safeCount}</h4>
          </div>
        </div>

        <div className="group flex items-center gap-4 border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center border transition-transform duration-300 group-hover:scale-105 ${
            stats.expiryWarningCount > 0
              ? 'border-orange-100 bg-orange-50 text-orange-600'
              : 'border-slate-100 bg-slate-50 text-slate-400'
          }`}>
            <FiCalendar size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Lô cần xử lý</p>
            <h4 className={`mt-0.5 text-xl font-black tracking-tight sm:text-2xl ${stats.expiryWarningCount > 0 ? 'text-orange-600' : 'text-slate-800'}`}>{stats.expiryWarningCount}</h4>
          </div>
        </div>

        <div className="group flex items-center gap-4 border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-105">
            <FiActivity size={22} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Giao dịch kho</p>
            <h4 className="mt-0.5 text-xl font-black tracking-tight text-blue-700 sm:text-2xl">{stats.txCount}</h4>
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation Section */}
      <div className="overflow-x-auto border-b border-slate-200 bg-white" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="flex min-w-max">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.06em] transition-all duration-200 ${
              activeTab === 'inventory'
                ? 'border-blue-600 bg-blue-50/40 text-blue-700'
                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FiList size={14} className="stroke-[2.5]" />
            Tồn kho hiện tại
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.06em] transition-all duration-200 ${
              activeTab === 'alerts'
                ? 'border-blue-600 bg-blue-50/40 text-blue-700'
                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FiAlertCircle size={14} className="stroke-[2.5]" />
            Cảnh báo
            {alerts.length > 0 && (
              <span className={`border px-1.5 py-0.5 text-[9px] font-black leading-none ${
                activeTab === 'alerts' ? 'border-blue-200 bg-white text-blue-700' : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}>
                {alerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('expiry')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.06em] transition-all duration-200 ${
              activeTab === 'expiry'
                ? 'border-blue-600 bg-blue-50/40 text-blue-700'
                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FiCalendar size={14} className="stroke-[2.5]" />
            Cảnh báo HSD
            {expiryAlerts.filter(item => {
              const diff = new Date(item.expiry_date).getTime() - new Date().getTime();
              const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
              return days <= 30;
            }).length > 0 && (
              <span className={`border px-1.5 py-0.5 text-[9px] font-black leading-none ${
                activeTab === 'expiry' ? 'border-blue-200 bg-white text-blue-700' : 'border-orange-200 bg-orange-50 text-orange-700'
              }`}>
                {expiryAlerts.filter(item => {
                  const diff = new Date(item.expiry_date).getTime() - new Date().getTime();
                  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
                  return days <= 30;
                }).length}
              </span>
            )}
          </button>
          {canManageStock && (
            <>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.06em] transition-all duration-200 ${
                  activeTab === 'transactions'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-700'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FiClock size={14} className="stroke-[2.5]" />
                Nhật ký giao dịch
              </button>
              <button
                onClick={() => setActiveTab('receipts')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.06em] transition-all duration-200 ${
                  activeTab === 'receipts'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-700'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FiTruck size={14} className="stroke-[2.5]" />
                Phiếu nhập & Công nợ
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.06em] transition-all duration-200 ${
                  activeTab === 'audit'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-700'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FiSliders size={14} className="stroke-[2.5]" />
                Kiểm kê kho
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. Main Content Area */}
      <div className="space-y-6">
        {/* Tab 1: Inventory List */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Search, Status & Category Toolbar */}
            <div className="border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                <label className="relative block">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm sản phẩm theo tên, SKU, barcode..."
                    className="h-10 w-full border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </label>

                <label className="relative block">
                  <FiSliders className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 w-full appearance-none border border-slate-200 bg-white pl-8 pr-8 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="all">Tất cả danh mục</option>
                    {categoriesList.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                </label>

                {/* Stock status filter */}
                <div className="flex items-center border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={() => setStockFilter('all')}
                  className={`px-3 py-1.5 text-xs font-black transition-all duration-200 ${
                    stockFilter === 'all'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setStockFilter('low')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black transition-all duration-200 ${
                    stockFilter === 'low'
                      ? 'bg-white text-rose-600 shadow-xs'
                      : 'text-slate-500 hover:text-rose-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Tồn thấp
                </button>
                <button
                  onClick={() => setStockFilter('safe')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black transition-all duration-200 ${
                    stockFilter === 'safe'
                      ? 'bg-white text-emerald-600 shadow-xs'
                      : 'text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  An toàn
                </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  Hiển thị <span className="font-black text-slate-800">{filteredInventory.length}</span> sản phẩm
                </p>
                {(searchTerm || selectedCategory !== 'all' || stockFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                      setStockFilter('all');
                    }}
                    className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* Inventory product catalog */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="min-h-[350px] animate-pulse border border-slate-200 bg-white p-4">
                    <div className="h-44 bg-slate-100" />
                    <div className="mt-4 h-3 w-2/3 bg-slate-100" />
                    <div className="mt-2 h-4 w-full bg-slate-100" />
                    <div className="mt-2 h-3 w-1/2 bg-slate-100" />
                    <div className="mt-10 h-5 w-1/3 bg-slate-100" />
                    <div className="mt-4 h-9 w-full bg-slate-100" />
                  </div>
                ))
              ) : filteredInventory.length === 0 ? (
                <div className="col-span-full flex min-h-[350px] flex-col items-center justify-center border border-dashed border-slate-300 bg-white p-10 text-center">
                  <FiBox className="mb-3 text-slate-300" size={38} />
                  <p className="text-sm font-black text-slate-700">Không tìm thấy sản phẩm</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Thử đổi từ khóa hoặc bộ lọc danh mục.</p>
                </div>
              ) : (
                filteredInventory.map((product) => {
                  const isOutOfStock = product.stock_quantity <= 0;
                  const isLowStock = product.stock_quantity <= product.min_stock_level;
                  const stockTone = isOutOfStock
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : isLowStock
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

                  return (
                    <article key={product.id} className="group flex min-h-[350px] flex-col overflow-hidden border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
                      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-slate-50 p-4">
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-600">
                            {product.categories?.name || 'Chưa phân loại'}
                          </p>
                          <span className={`shrink-0 border px-2 py-1 text-[9px] font-black uppercase ${stockTone}`}>
                            {isOutOfStock ? 'Hết hàng' : isLowStock ? 'Tồn thấp' : 'An toàn'}
                          </span>
                        </div>
                        <h3 className="mt-2 min-h-[40px] line-clamp-2 text-sm font-black leading-snug text-slate-900" title={product.name}>
                          {product.name}
                        </h3>
                        <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">SKU: {product.sku}</p>

                        <div className="mt-auto border-t border-slate-100 pt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Giá bán</p>
                              <p className="mt-0.5 text-base font-black text-blue-700">{formatNumber(product.sell_price)} đ</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tồn kho</p>
                              <p className={`mt-0.5 text-sm font-black ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-800'}`}>
                                {formatNumber(product.stock_quantity)} <span className="text-[10px] text-slate-400">{product.unit || 'cái'}</span>
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden bg-slate-100">
                            <div className={`h-full transition-all duration-500 ${getStockBarColor(product.stock_quantity, product.min_stock_level)}`} style={{ width: `${getStockBarPercentage(product.stock_quantity, product.min_stock_level)}%` }} />
                          </div>
                          {canManageStock && (
                            <button
                              onClick={() => {
                                setActionProductId(product.id);
                                setShowActionModal(true);
                              }}
                              className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 border border-blue-600 bg-blue-600 text-[11px] font-black text-white transition hover:bg-blue-700 active:translate-y-px"
                            >
                              <FiPlus size={14} />
                              Nhập kho
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Inventory Table Container (legacy fallback, kept for reference) */}
            <div className="hidden overflow-hidden border border-slate-300 bg-white shadow-sm">
              <div className="scrollbar-none overflow-x-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[13%]" />
                    <col className="w-[14%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="border-b border-slate-300 bg-slate-100 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-4">Sản phẩm</th>
                      <th className="px-4 py-4">Danh mục</th>
                      <th className="px-4 py-4 text-right">Tồn hiện tại</th>
                      <th className="px-4 py-4 text-right">Ngưỡng</th>
                      <th className="px-4 py-4 text-right">Giá vốn</th>
                      <th className="px-4 py-4 text-right">Giá bán</th>
                      <th className="px-4 py-4 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
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
                          <tr key={product.id} className="transition duration-150 hover:bg-slate-50">
                            {/* Product Info with initials Avatar */}
                            <td className="px-4 py-4 align-middle">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center border text-xs font-black shadow-inner ${getAvatarColor(product.name)}`}>
                                  {getInitials(product.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black leading-snug text-slate-950">{product.name}</p>
                                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                    <span className="max-w-[150px] truncate border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-500" title={product.sku}>
                                      SKU: {product.sku}
                                    </span>
                                    {product.barcode && (
                                      <span className="hidden max-w-[120px] truncate border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-400 xl:inline-block" title={product.barcode}>
                                        {product.barcode}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {/* Category */}
                            <td className="px-4 py-4 align-middle">
                              <span className="inline-flex max-w-full items-center gap-1 truncate border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700" title={product.categories?.name || 'Chưa phân loại'}>
                                <FiTag size={10} />
                                <span className="truncate">{product.categories?.name || 'Chưa phân loại'}</span>
                              </span>
                            </td>
                            {/* Stock and Progress bar */}
                            <td className="px-4 py-4 text-right align-middle">
                              <div className="ml-auto w-full max-w-[130px]">
                                <div className="flex items-baseline justify-end gap-1">
                                  <span className={`text-lg font-black ${isLowStock ? 'text-rose-600' : 'text-slate-950'}`}>
                                    {formatNumber(product.stock_quantity)}
                                  </span>
                                  <span className="text-xs font-black text-slate-400">{product.unit || 'cái'}</span>
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
                                  <div 
                                    className={`h-full transition-all duration-500 ${getStockBarColor(product.stock_quantity, product.min_stock_level)}`}
                                    style={{ width: `${getStockBarPercentage(product.stock_quantity, product.min_stock_level)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            {/* Min Stock level */}
                            <td className="px-4 py-4 text-right align-middle">
                              <span className="inline-flex min-w-14 justify-end text-sm font-black text-slate-500">
                                {formatNumber(product.min_stock_level)}
                              </span>
                            </td>
                            {/* Cost Price */}
                            <td className="px-4 py-4 text-right align-middle font-mono text-sm font-bold text-slate-500">
                              {formatNumber(product.cost_price)}đ
                            </td>
                            {/* Sell Price */}
                            <td className="px-4 py-4 text-right align-middle font-mono text-sm font-black text-slate-950">
                              {formatNumber(product.sell_price)}đ
                            </td>
                            {/* Status Badge */}
                            <td className="px-4 py-4 text-center align-middle">
                              <span className={`inline-flex min-w-[92px] justify-center whitespace-nowrap border px-2 py-1 text-xs font-black shadow-2xs ${
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
            <div className="border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-5">
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
                    <div key={alert.id} className="group flex flex-col justify-between gap-4 border border-rose-200 bg-rose-50/30 p-5 shadow-sm transition-all duration-300 hover:border-rose-300 hover:shadow-md">
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActionProductId(alert.product_id);
                              setShowActionModal(true);
                            }}
                            className="flex-1 border border-blue-200 bg-blue-50 py-2 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100/80 active:bg-blue-100 flex items-center justify-center gap-1.5"
                          >
                            <FiPlus size={12} />
                            Nhập kho
                          </button>
                          <button
                            onClick={() => resolveAlert(alert.id)}
                            className="flex-1 border border-rose-200 bg-white py-2 text-xs font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50/80 active:bg-rose-100"
                          >
                            Đã xử lý
                          </button>
                        </div>
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
          <div className="border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-4">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FiActivity className="text-blue-500" />
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
              <>
                <div className="overflow-x-auto border border-slate-200">
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
                
                {/* Pagination Footer */}
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-4 mt-2">
                  <span className="text-[11px] font-bold text-slate-500">
                    Hiển thị {txPagination.total === 0 ? 0 : (txPagination.page - 1) * txPagination.limit + 1} - {Math.min(txPagination.page * txPagination.limit, txPagination.total)} trên {txPagination.total} giao dịch
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTxPage(p => Math.max(1, p - 1))}
                      disabled={txPage === 1}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
                    >
                      ‹
                    </button>
                    {Array.from({ length: Math.ceil(txPagination.total / txPagination.limit) }).map((_, index) => {
                      const pNum = index + 1;
                      if (Math.abs(pNum - txPage) <= 2 || pNum === 1 || pNum === Math.ceil(txPagination.total / txPagination.limit)) {
                        return (
                          <button
                            key={pNum}
                            onClick={() => setTxPage(pNum)}
                            className={`w-8 h-8 rounded-lg text-xs font-black transition ${
                              txPage === pNum
                               ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      }
                      if (pNum === 2 || pNum === Math.ceil(txPagination.total / txPagination.limit) - 1) {
                        return <span key={pNum} className="text-xs text-slate-400 font-bold px-1">...</span>;
                      }
                      return null;
                    })}
                    <button
                      onClick={() => setTxPage(p => Math.min(Math.ceil(txPagination.total / txPagination.limit), p + 1))}
                      disabled={txPage >= Math.ceil(txPagination.total / txPagination.limit)}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 4: Receipts & Debts */}
        {activeTab === 'receipts' && canManageStock && (
          <ReceiptListPage isEmbedded={true} refreshTrigger={refreshTrigger} />
        )}

        {/* Tab 5: Expiration Warnings Dashboard */}
        {activeTab === 'expiry' && (
          <div className="space-y-5">
            {/* Expiry Overview Stats Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {/* Expired Card */}
              <button
                onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
                className={`group flex items-center gap-4.5 p-4 rounded-xl border transition-all duration-200 text-left ${
                  expiryFilter === 'expired'
                    ? 'border-rose-500 bg-rose-50/50 shadow-sm ring-2 ring-rose-500/5'
                    : 'border-slate-200 bg-white shadow-xs hover:shadow-sm hover:border-rose-200 hover:-translate-y-0.5'
                }`}
              >
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-inner ${
                  expiryFilter === 'expired'
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-50 text-rose-600 border border-rose-100/50'
                }`}>
                  <FiAlertCircle size={20} className="stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Đã hết hạn</p>
                  <h4 className="text-xl font-extrabold text-rose-600 mt-0.5 tracking-tight">{expiryStats.expired} Lô</h4>
                </div>
              </button>

              {/* Near Expiry Card */}
              <button
                onClick={() => setExpiryFilter(expiryFilter === 'near_expiry' ? 'all' : 'near_expiry')}
                className={`group flex items-center gap-4.5 p-4 rounded-xl border transition-all duration-200 text-left ${
                  expiryFilter === 'near_expiry'
                    ? 'border-orange-500 bg-orange-50/50 shadow-sm ring-2 ring-orange-500/5'
                    : 'border-slate-200 bg-white shadow-xs hover:shadow-sm hover:border-orange-200 hover:-translate-y-0.5'
                }`}
              >
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-inner ${
                  expiryFilter === 'near_expiry'
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-600 border border-orange-100/50'
                }`}>
                  <FiCalendar size={20} className="stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sắp hết hạn (≤ 30 ngày)</p>
                  <h4 className="text-xl font-extrabold text-orange-600 mt-0.5 tracking-tight">{expiryStats.nearExpiry} Lô</h4>
                </div>
              </button>

              {/* Safe Card */}
              <button
                onClick={() => setExpiryFilter(expiryFilter === 'safe' ? 'all' : 'safe')}
                className={`group flex items-center gap-4.5 p-4 rounded-xl border transition-all duration-200 text-left ${
                  expiryFilter === 'safe'
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/5'
                    : 'border-slate-200 bg-white shadow-xs hover:shadow-sm hover:border-emerald-200 hover:-translate-y-0.5'
                }`}
              >
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-inner ${
                  expiryFilter === 'safe'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                }`}>
                  <FiShield size={20} className="stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">An toàn (&gt; 30 ngày)</p>
                  <h4 className="text-xl font-extrabold text-emerald-600 mt-0.5 tracking-tight">{expiryStats.safe} Lô</h4>
                </div>
              </button>
            </div>

            {/* Search and Category Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm lô theo tên SP, SKU, barcode hoặc số lô..."
                  className="w-full h-9 rounded-lg border border-slate-200 pl-9 pr-4 text-xs sm:text-sm font-semibold outline-none focus:border-slate-400 bg-slate-50/50 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="relative">
                  <FiSliders className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 pl-7 pr-8 text-xs sm:text-sm font-semibold outline-none bg-white focus:border-slate-400 cursor-pointer appearance-none shadow-xs"
                  >
                    <option value="all">Tất cả danh mục</option>
                    {categoriesList.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                </div>

                {(expiryFilter !== 'all' || searchTerm || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setExpiryFilter('all');
                      setSearchTerm('');
                      setSelectedCategory('all');
                    }}
                    className="h-9 px-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 transition shadow-xs flex items-center gap-1.5"
                  >
                    <FiX size={13} />
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* Batches Table / Cards Wrapper */}
            <div className="bg-transparent md:bg-white md:border md:border-slate-200 md:rounded-xl md:shadow-xs overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 w-1/3">Sản phẩm</th>
                      <th className="px-5 py-3.5">Số lô</th>
                      <th className="px-5 py-3.5">Hạn sử dụng (HSD)</th>
                      <th className="px-5 py-3.5 text-center">Trạng thái HSD</th>
                      <th className="px-5 py-3.5 w-40">Mức độ an toàn</th>
                      <th className="px-5 py-3.5 text-right">Tồn kho lô</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                          <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={18} />
                          Đang tải dữ liệu hạn sử dụng...
                        </td>
                      </tr>
                    ) : filteredExpiryAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                          <FiBox className="inline mb-2 text-slate-400 block mx-auto" size={28} />
                          Không tìm thấy lô sản phẩm nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredExpiryAlerts.map((batch) => {
                        const remainingDays = getRemainingExpiryDays(batch.expiry_date);
                        const statusView = getExpiryStatusView(remainingDays);

                        return (
                          <tr key={batch.id} className="hover:bg-slate-50/30 transition duration-150">
                            {/* Product Info */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black shrink-0 shadow-inner ${getAvatarColor(batch.products?.name || '')}`}>
                                  {getInitials(batch.products?.name || '')}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-900 leading-snug truncate">{batch.products?.name}</p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {batch.products?.sku}
                                    </span>
                                    {batch.products?.barcode && (
                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                                        {batch.products.barcode}
                                      </span>
                                    )}
                                    {batch.products?.suppliers?.name && (
                                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                        NCC: {batch.products.suppliers.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Batch Number */}
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5 border border-slate-200/80">
                                {batch.batch_number}
                              </span>
                            </td>

                            {/* Expiry Date */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                                <FiCalendar size={14} className="text-slate-400" />
                                {new Date(batch.expiry_date).toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </div>
                            </td>

                            {/* Remaining Days status badge */}
                            <td className="px-5 py-3.5 text-center">
                              <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-extrabold shadow-2xs whitespace-nowrap ${statusView.badgeClass}`}>
                                {statusView.label}
                              </span>
                            </td>

                            {/* Safety level progress bar */}
                            <td className="px-5 py-3.5">
                              <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden shadow-inner">
                                <div
                                  className={`h-full transition-all duration-500 rounded ${statusView.progressColor}`}
                                  style={{ width: `${statusView.progressPercent}%` }}
                                />
                              </div>
                            </td>

                            {/* Stock Quantity */}
                            <td className="px-5 py-3.5 text-right">
                              <div className="text-right">
                                <span className="font-black text-slate-900 text-sm">
                                  {formatNumber(batch.quantity)}
                                </span>
                                <span className="text-xs text-slate-400 ml-1 font-bold">
                                  {batch.products?.unit || 'cái'}
                                </span>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                  Nhập: {formatNumber(batch.original_quantity)}
                                </p>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden space-y-3.5">
                {loading ? (
                  <div className="bg-white p-8 border border-slate-200 rounded-xl text-center text-slate-400 font-bold shadow-xs">
                    <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={18} />
                    Đang tải dữ liệu hạn sử dụng...
                  </div>
                ) : filteredExpiryAlerts.length === 0 ? (
                  <div className="bg-white p-8 border border-slate-200 rounded-xl text-center text-slate-400 font-bold shadow-xs">
                    <FiBox className="inline mb-2 text-slate-400 block mx-auto" size={28} />
                    Không tìm thấy lô sản phẩm nào phù hợp.
                  </div>
                ) : (
                  filteredExpiryAlerts.map((batch) => {
                    const remainingDays = getRemainingExpiryDays(batch.expiry_date);
                    const statusView = getExpiryStatusView(remainingDays);

                    return (
                      <div key={batch.id} className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs space-y-3">
                        {/* Header: Avatar, Name, Unit */}
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black shrink-0 shadow-inner ${getAvatarColor(batch.products?.name || '')}`}>
                            {getInitials(batch.products?.name || '')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-slate-900 text-sm leading-snug truncate">{batch.products?.name}</h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {batch.products?.sku}
                              </span>
                              {batch.products?.barcode && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                                  {batch.products.barcode}
                                </span>
                              )}
                              {batch.products?.suppliers?.name && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                  NCC: {batch.products.suppliers.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Batch & Expiry Info Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2.5">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Số lô</p>
                            <p className="font-bold text-slate-700 mt-0.5 truncate" title={batch.batch_number}>
                              {batch.batch_number}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hạn sử dụng</p>
                            <div className="flex items-center gap-1 font-bold text-slate-700 mt-0.5">
                              <FiCalendar size={12} className="text-slate-400" />
                              <span>
                                {new Date(batch.expiry_date).toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status, Progress & Stock */}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                          <div className="flex-1 min-w-0">
                            <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-bold shadow-2xs whitespace-nowrap ${statusView.badgeClass}`}>
                              {statusView.label}
                            </span>
                            {/* Progress bar under status */}
                            <div className="w-full bg-slate-100 rounded h-1 mt-2">
                              <div
                                className={`h-full transition-all duration-500 rounded ${statusView.progressColor}`}
                                style={{ width: `${statusView.progressPercent}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tồn kho</p>
                            <p className="mt-0.5">
                              <span className="font-black text-slate-900 text-sm">
                                {formatNumber(batch.quantity)}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-0.5 font-bold">
                                {batch.products?.unit || 'cái'}
                              </span>
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold">
                              Nhập: {formatNumber(batch.original_quantity)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Inventory Audit Workspace */}
        {activeTab === 'audit' && canManageStock && (
          <div className="bg-white p-6 border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-5">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FiSliders className="text-blue-500" />
                Kiểm kê tồn kho thực tế
              </h2>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Nhập số lượng hàng thực tế kiểm đếm được của từng mặt hàng. Hệ thống sẽ tự động đối chiếu chênh lệch và cập nhật vào các lô hàng tương ứng.
              </p>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 border border-slate-200/80 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm sản phẩm cần kiểm kê..."
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

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50/60 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 tracking-wider">
                    <tr>
                      <th className="px-5 py-4 w-1/3">Sản phẩm</th>
                      <th className="px-5 py-4 text-right">Tồn hệ thống</th>
                      <th className="px-5 py-4 text-center" style={{ width: '150px' }}>Tồn thực tế</th>
                      <th className="px-5 py-4 text-right">Chênh lệch</th>
                      <th className="px-5 py-4">Lý do điều chỉnh</th>
                      <th className="px-5 py-4 text-center" style={{ width: '130px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-slate-400 font-bold">
                          <FiRefreshCw className="inline animate-spin mr-2 text-blue-500" size={18} />
                          Đang tải dữ liệu kiểm kho...
                        </td>
                      </tr>
                    ) : filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-slate-400 font-bold">
                          <FiBox className="inline mb-2 text-slate-300 block mx-auto" size={32} />
                          Không tìm thấy sản phẩm nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map((product) => (
                        <AuditRow key={product.id} product={product} onSaveSuccess={loadData} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. AI Assistant Drawer (Bảng trượt từ bên phải) */}
      {showAIPanel && (
        <AIStockDrawer
          analysis={analysis}
          aiItems={aiItems}
          targetDays={targetDays}
          setTargetDays={setTargetDays}
          aiLoading={aiLoading}
          aiError={aiError}
          generating={generating}
          showAllProducts={showAllProducts}
          dashboardStats={aiDashboardStats}
          onToggleShowAll={() => setShowAllProducts((value) => !value)}
          onClose={() => setShowAIPanel(false)}
          onRefresh={loadAIData}
          onGenerate={generateRecommendations}
          onUpdateStatus={updateRecommendationStatus}
          onCreateRestock={openAiRestockAction}
        />
      )}
      {/* 6. QUICK ACTION MODAL */}
      {showActionModal && canManageStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                <FiSettings className="text-blue-500" />
                Nhập kho nhanh theo lô
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


              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-slate-400 tracking-wider">Chọn sản phẩm *</span>
                <div className="relative">
                  <select
                    name="product_id"
                    required
                    value={actionProductId}
                    onChange={(event) => setActionProductId(event.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-slate-400 bg-white appearance-none cursor-pointer"
                  >
                    <option value="">Chọn sản phẩm cần nhập</option>
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
                <span className="mb-1 block text-xs font-black uppercase text-slate-400 tracking-wider">Số lượng nhập thêm *</span>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  required
                  placeholder="Ví dụ: 120"
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 shadow-inner"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-slate-400 tracking-wider">Số lô *</span>
                  <input
                    name="batch_number"
                    required
                    maxLength={100}
                    placeholder="VD: LOT-2026-08"
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 shadow-inner"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-slate-400 tracking-wider">Hạn sử dụng *</span>
                  <input
                    name="expiry_date"
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 shadow-inner"
                  />
                </label>
              </div>

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
                  className="flex-1 h-10 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition"
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

interface AuditRowProps {
  product: Product;
  onSaveSuccess: () => Promise<void>;
}

const AuditRow = ({ product, onSaveSuccess }: AuditRowProps) => {
  const [actualStock, setActualStock] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

  const systemStock = product.stock_quantity;
  const parsedActual = actualStock !== '' ? parseInt(actualStock) : systemStock;
  const deviation = parsedActual - systemStock;

  const handleSave = async () => {
    if (actualStock === '') {
      toast.error('Vui lòng nhập số lượng tồn thực tế trước khi lưu!');
      return;
    }
    const val = parseInt(actualStock);
    if (isNaN(val) || val < 0) {
      toast.error('Số lượng tồn thực tế phải là một số lớn hơn hoặc bằng 0!');
      return;
    }
    setSaving(true);
    try {
      await stockAPI.adjustStock({
        product_id: product.id,
        new_stock: val,
        note: note.trim() || 'Kiểm kê kho hàng định kỳ',
      });
      toast.success(`Cân đối tồn kho thành công cho "${product.name}"!`);
      setActualStock('');
      setNote('');
      await onSaveSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu kiểm kho.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-slate-50/50 transition duration-150">
      {/* Product Info */}
      <td className="px-5 py-4">
        <p className="font-extrabold text-slate-900 leading-snug">{product.name}</p>
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
      </td>

      {/* System Stock */}
      <td className="px-5 py-4 text-right">
        <span className="font-black text-slate-900">{formatNumber(systemStock)}</span>
        <span className="text-xs text-slate-400 ml-1 font-bold">{product.unit || 'cái'}</span>
      </td>

      {/* Actual Stock Input */}
      <td className="px-5 py-4 text-center">
        <input
          type="number"
          min={0}
          value={actualStock}
          onChange={(e) => setActualStock(e.target.value)}
          placeholder={String(systemStock)}
          className="w-24 h-9 rounded-lg border border-slate-200 text-center font-bold text-slate-800 outline-none focus:border-slate-400 shadow-inner"
        />
      </td>

      {/* Deviation */}
      <td className="px-5 py-4 text-right">
        {deviation === 0 ? (
          <span className="text-xs font-bold text-slate-400">-</span>
        ) : deviation > 0 ? (
          <span className="text-sm font-black text-blue-600">+{formatNumber(deviation)}</span>
        ) : (
          <span className="text-sm font-black text-rose-600">{formatNumber(deviation)}</span>
        )}
      </td>

      {/* Note */}
      <td className="px-5 py-4">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Thất thoát, hư hỏng..."
          className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400 shadow-inner bg-slate-50/50 focus:bg-white transition"
        />
      </td>

      {/* Action Button */}
      <td className="px-5 py-4 text-center">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition"
        >
          {saving ? 'Đang lưu...' : 'Lưu kiểm kê'}
        </button>
      </td>
    </tr>
  );
};

export default StockPage;
