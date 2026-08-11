import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiRefreshCw, FiX, FiZap, FiTrendingUp, FiTrendingDown, FiMinus, FiAlertTriangle, FiPackage, FiShoppingCart } from 'react-icons/fi';
import { aiAPI } from '../../services/ai.api';
import { AIRecommendation, RestockAnalysis } from '../../types/domain.type';

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

const alertLabel: Record<string, string> = {
  out_of_stock: 'Hết hàng',
  low_stock: 'Tồn thấp',
  needs_restock: 'Sắp thiếu',
  healthy: 'An toàn',
};

const alertColorClass: Record<string, string> = {
  out_of_stock: 'bg-red-600 text-white',
  low_stock: 'bg-amber-500 text-white',
  needs_restock: 'bg-orange-500 text-white',
  healthy: 'bg-emerald-500 text-white',
};

const statusLabel: Record<string, string> = {
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

const statusColorClass: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
};

const confidenceLabel: Record<string, string> = {
  high: 'Tin cậy cao',
  medium: 'Tin cậy vừa',
  low: 'Cần kiểm tra',
};

const confidenceClass: Record<string, string> = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-blue-200 bg-blue-50 text-blue-700',
  low: 'border-amber-200 bg-amber-50 text-amber-700',
};

const dataQualityLabel: Record<string, string> = {
  ready: 'Dữ liệu đủ',
  low_confidence: 'Dữ liệu hạn chế',
  insufficient_demand: 'Chưa đủ nhu cầu',
  missing_policy: 'Dùng mặc định',
};

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const money = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;

const TrendBadge = ({ trend }: { trend?: string }) => {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
        <FiTrendingUp className="w-3 h-3" /> Tăng
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold border border-red-200">
        <FiTrendingDown className="w-3 h-3" /> Giảm
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
      <FiMinus className="w-3 h-3" /> Ổn định
    </span>
  );
};

const StockDaysBar = ({ stockDays, targetDays }: { stockDays: number | null; targetDays: number }) => {
  if (stockDays === null) return <span className="text-[10px] text-slate-400 font-medium">N/A</span>;
  const percent = Math.min((stockDays / targetDays) * 100, 100);
  const barColor = stockDays <= 3 ? 'bg-red-500' : stockDays <= targetDays * 0.5 ? 'bg-amber-500' : 'bg-emerald-500';
  
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${stockDays <= 3 ? 'text-red-600' : stockDays <= targetDays * 0.5 ? 'text-amber-600' : 'text-slate-600'}`}>
        {stockDays}d
      </span>
    </div>
  );
};

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-[12px] text-slate-600 font-medium leading-relaxed">
      {lines.map((line, idx) => {
        let cleanLine = line.trim();
        if (!cleanLine) return <div key={idx} className="h-0.5" />;
        
        const isBullet = cleanLine.startsWith('-') || cleanLine.startsWith('*') || cleanLine.startsWith('•');
        if (isBullet) {
          cleanLine = cleanLine.replace(/^[-*•]\s*/, '');
        }

        const parts: (string | React.ReactElement)[] = [];
        let index = 0;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        
        while ((match = boldRegex.exec(cleanLine)) !== null) {
          const before = cleanLine.substring(index, match.index);
          if (before) parts.push(before);
          parts.push(<strong key={match.index} className="font-bold text-slate-800">{match[1]}</strong>);
          index = boldRegex.lastIndex;
        }
        
        const after = cleanLine.substring(index);
        if (after) parts.push(after);

        const content = parts.length > 0 ? parts : cleanLine;

        // Section headers (lines starting with numbers like "1. ", "2. ")
        const isSectionHeader = /^\d+\.\s/.test(cleanLine) && cleanLine.includes(':');
        if (isSectionHeader) {
          return (
            <p key={idx} className="font-bold text-slate-800 text-[11px] uppercase tracking-wide pt-1.5 border-t border-slate-100 mt-1">
              {content}
            </p>
          );
        }

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="mt-1.5 text-[5px] text-blue-500 shrink-0">●</span>
              <span>{content}</span>
            </div>
          );
        }

        return <p key={idx}>{content}</p>;
      })}
    </div>
  );
};

const AIRecommendationsPage = () => {
  const [items, setItems] = useState<AIRecommendation[]>([]);
  const [analysis, setAnalysis] = useState<RestockAnalysis | null>(null);
  const [targetDays, setTargetDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analysisResponse, recommendationsResponse] = await Promise.all([
        aiAPI.restockAnalysis({ target_days: targetDays }),
        aiAPI.list({ limit: 100 }),
      ]);
      setAnalysis(analysisResponse.data.data);
      setItems(recommendationsResponse.data.data.items);
    } catch {
      toast.error('Không tải được dữ liệu AI tồn kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const visibleAnalysisItems = useMemo(() => {
    const allItems = analysis?.items || [];
    return showAllProducts ? allItems : allItems.filter((item) => item.alert_status !== 'healthy');
  }, [analysis, showAllProducts]);

  const generate = async () => {
    setGenerating(true);
    try {
      const response = await aiAPI.generate({ target_days: targetDays });
      toast.success(`Đã tạo/cập nhật ${response.data.data.generated} gợi ý nhập hàng`);
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tạo được gợi ý nhập hàng');
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await aiAPI.updateStatus(id, status);
      toast.success(status === 'approved' ? 'Đã duyệt gợi ý' : 'Đã từ chối gợi ý');
      await loadData();
    } catch {
      toast.error('Không cập nhật được trạng thái');
    }
  };

  const summary = analysis?.summary;

  const totalEstimatedCost = useMemo(() => {
    if (typeof analysis?.summary.estimated_restock_cost === 'number') {
      return analysis.summary.estimated_restock_cost;
    }
    return (analysis?.items || [])
      .filter(i => i.alert_status !== 'healthy')
      .reduce((sum, item) => {
        const cost = Number(item.cost_price || 0);
        return sum + item.recommended_quantity * cost;
      }, 0);
  }, [analysis]);

  const trendingUpCount = useMemo(() => {
    return (analysis?.items || []).filter(i => i.sales_trend === 'up').length;
  }, [analysis]);

  const trendingDownCount = useMemo(() => {
    return (analysis?.items || []).filter(i => i.sales_trend === 'down').length;
  }, [analysis]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* HEADER */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl tracking-tight flex items-center gap-2.5">
            <div className="report-card flex h-9 w-9 items-center justify-center bg-blue-50 text-blue-600 shadow-sm">
              <FiPackage className="w-4 h-4" />
            </div>
            Trợ Lý Chuỗi Cung Ứng AI
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Phân tích xu hướng nhu cầu, dự báo tồn kho, chiến lược giá và đề xuất nhập hàng thông minh.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider" htmlFor="target-days">
            Mục tiêu ngày
          </label>
          <input
            id="target-days"
            value={targetDays}
            onChange={(event) => setTargetDays(Number(event.target.value))}
            type="number"
            min={1}
            max={90}
            className="report-control h-10 w-24 border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={loadData}
            disabled={loading}
            className="report-control inline-flex h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            Làm mới
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="report-control inline-flex h-10 items-center justify-center gap-2 bg-blue-600 px-5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <FiZap size={14} />
            {generating ? 'Đang phân tích AI...' : 'Tạo gợi ý nhập'}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-0 border border-slate-200 bg-white lg:grid-cols-[1.4fr_1fr]">
        <div className="border-b border-slate-200 border-l-4 border-l-blue-600 px-5 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-blue-600 text-white">
              <FiZap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Quyết định nhập hàng</p>
                <span className="border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700">
                  {analysis?.engine_version || 'replenishment-v2'}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-900">Số lượng do hệ thống tính, AI chỉ giải thích</p>
              <p className="mt-1 max-w-2xl text-[11px] font-medium leading-relaxed text-slate-500">
                Công thức dùng tốc độ bán, lead time, tồn an toàn, hàng đang về và quy cách nhập. Các mặt hàng thiếu dữ liệu sẽ được đánh dấu để quản lý duyệt thủ công.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50/60">
          <div className="px-4 py-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tổng cần nhập</p>
            <p className="mt-2 text-xl font-black tabular-nums text-blue-700">{formatNumber(summary?.total_recommended_quantity || 0)}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">đơn vị</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ngân sách dự kiến</p>
            <p className="mt-2 text-sm font-black tabular-nums text-slate-900">{money(totalEstimatedCost)}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">giá vốn</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cần xem xét</p>
            <p className="mt-2 text-xl font-black tabular-nums text-amber-600">{summary?.manual_review_items || 0}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">SKU</p>
          </div>
        </div>
      </section>

      {analysis?.warnings && analysis.warnings.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Cần hoàn thiện dữ liệu để tăng độ chính xác</p>
              <ul className="mt-1 space-y-0.5 text-[11px] font-medium text-amber-800">
                {analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* KPI CARDS */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <div className="report-card border-l-4 border-rose-500 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Hết hàng</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{summary?.out_of_stock || 0}</p>
          <p className="text-[10px] text-red-400 font-medium mt-0.5">sản phẩm</p>
        </div>
        <div className="report-card border-l-4 border-amber-500 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-amber-600 tracking-wider">Tồn thấp</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{summary?.low_stock || 0}</p>
          <p className="text-[10px] text-amber-400 font-medium mt-0.5">sản phẩm</p>
        </div>
        <div className="report-card border-l-4 border-orange-500 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-orange-600 tracking-wider">Sắp thiếu</p>
          <p className="mt-2 text-2xl font-bold text-orange-700">{summary?.needs_restock || 0}</p>
          <p className="text-[10px] text-orange-400 font-medium mt-0.5">sản phẩm</p>
        </div>
        <div className="report-card border-l-4 border-emerald-500 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">An toàn</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary?.healthy || 0}</p>
          <p className="text-[10px] text-emerald-400 font-medium mt-0.5">sản phẩm</p>
        </div>
        <div className="report-card border-l-4 border-blue-500 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Xu hướng</p>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="flex items-center gap-1 text-emerald-600">
              <FiTrendingUp className="w-3.5 h-3.5" />
              <span className="text-lg font-bold">{trendingUpCount}</span>
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <FiTrendingDown className="w-3.5 h-3.5" />
              <span className="text-lg font-bold">{trendingDownCount}</span>
            </span>
          </div>
          <p className="text-[10px] text-blue-400 font-medium mt-0.5">tăng / giảm</p>
        </div>
        <div className="report-card border-l-4 border-rose-400 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-rose-600 tracking-wider">Rủi ro mất doanh thu</p>
          <p className="mt-2 text-sm font-black tabular-nums text-rose-700">{money(summary?.estimated_lost_revenue_7d || 0)}</p>
          <p className="text-[10px] text-rose-400 font-medium mt-0.5">ước tính 7 ngày</p>
        </div>
        <div className="report-card border-l-4 border-slate-400 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Chi phí nhập</p>
          <p className="mt-2 text-lg font-bold text-slate-800 truncate">{money(totalEstimatedCost)}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">ước tính</p>
        </div>
      </section>

      {/* STOCK ANALYSIS TABLE */}
      <section className="report-panel overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="report-card flex h-8 w-8 items-center justify-center bg-blue-50 text-blue-600">
              <FiAlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Phân tích tồn kho & xu hướng</h2>
              <p className="text-[10px] font-medium text-slate-500">
                Cửa sổ bán hàng {analysis?.sales_window_days || 30} ngày · Mục tiêu tồn {analysis?.target_days || targetDays} ngày
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAllProducts((value) => !value)}
            className="report-control h-8 border border-slate-200 px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {showAllProducts ? 'Chỉ xem cảnh báo' : 'Xem tất cả sản phẩm'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-400 tracking-wider">Sản phẩm</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase text-slate-400 tracking-wider">Trạng thái</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">Xu hướng</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tồn</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase text-slate-400 tracking-wider">Min</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tồn (ngày)</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase text-slate-400 tracking-wider">Bán/ngày</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase text-slate-400 tracking-wider">Đề xuất</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-400 tracking-wider">AI nhận định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleAnalysisItems.map((item) => (
                <tr key={item.id} className="align-top hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-slate-800 text-xs">{item.name}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-400">{item.sku}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.forecast_confidence && (
                        <span className={`border px-1.5 py-0.5 text-[9px] font-bold ${confidenceClass[item.forecast_confidence]}`}>
                          {confidenceLabel[item.forecast_confidence]}
                        </span>
                      )}
                      {item.data_quality && item.data_quality !== 'ready' && (
                        <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                          {dataQualityLabel[item.data_quality]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${alertColorClass[item.alert_status] || 'bg-slate-200 text-slate-600'}`}>
                      {alertLabel[item.alert_status]}
                    </span>
                    <span className={`ml-1.5 inline-flex rounded-md border px-2 py-1 text-[10px] font-bold ${priorityClass[item.priority]}`}>
                      {priorityLabel[item.priority]}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <TrendBadge trend={item.sales_trend} />
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs tabular-nums">
                    <span className="font-black text-slate-800">{formatNumber(item.stock_quantity)}</span>
                    {item.available_quantity !== undefined && item.available_quantity !== item.stock_quantity && (
                      <span className="block text-[9px] font-bold text-blue-600">khả dụng {formatNumber(item.available_quantity)}</span>
                    )}
                    {item.incoming_quantity !== undefined && item.incoming_quantity > 0 && (
                      <span className="block text-[9px] font-bold text-emerald-600">đang về +{formatNumber(item.incoming_quantity)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right font-medium text-slate-500 text-xs tabular-nums">{formatNumber(item.min_stock_level)}</td>
                  <td className="px-3 py-3.5">
                    <StockDaysBar stockDays={item.stock_days} targetDays={analysis?.target_days || targetDays} />
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs tabular-nums">
                    <span className="font-bold text-slate-700">{Number(item.average_daily_sales).toFixed(1)}</span>
                    {item.sales_speed_7d !== undefined && (
                      <span className="block text-[9px] text-slate-400 font-medium">(7d: {Number(item.sales_speed_7d).toFixed(1)})</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs tabular-nums">
                    <span className="font-black text-blue-700">{formatNumber(item.recommended_quantity)}</span>
                    {item.restock_cost !== undefined && item.restock_cost > 0 && (
                      <span className="block text-[9px] font-bold text-slate-400">{money(item.restock_cost)}</span>
                    )}
                    {item.manual_review && (
                      <span className="mt-1 block border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Duyệt tay</span>
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-3.5">
                    <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
                      {renderFormattedText(item.ai_insight)}
                      {item.assumptions && item.assumptions.length > 0 && (
                        <div className="mt-2 border-t border-slate-200 pt-2 text-[10px] font-semibold text-slate-500">
                          <span className="font-black text-slate-700">Giả định:</span> {item.assumptions.join(' · ')}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleAnalysisItems.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center font-medium text-slate-400 text-xs" colSpan={9}>
                    Không có sản phẩm cần cảnh báo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SAVED RECOMMENDATIONS */}
      <section className="report-panel overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-200 p-4 bg-slate-50/50">
          <div className="report-card flex h-8 w-8 items-center justify-center bg-blue-50 text-blue-600">
            <FiShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Gợi ý nhập hàng đã lưu</h2>
            <p className="text-[10px] font-medium text-slate-500">Các gợi ý từ AI đang chờ duyệt hoặc đã xử lý</p>
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-50">
          {items.map((item) => (
            <article key={item.id} className="p-4 hover:bg-slate-50/30 transition-colors">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm">{item.products?.name || item.product_id}</h3>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${priorityClass[item.priority]}`}>
                      {priorityLabel[item.priority]}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusColorClass[item.status] || 'bg-slate-100 text-slate-500'}`}>
                      {statusLabel[item.status]}
                    </span>
                  </div>
                  <div className="mt-2.5 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    {item.ai_insight ? renderFormattedText(item.ai_insight) : <p className="font-medium text-slate-600 text-xs">{item.reason}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-slate-500">
                    <span>Tồn: <strong className="text-slate-700">{formatNumber(item.current_stock)}</strong></span>
                    <span>Tối thiểu: <strong className="text-slate-700">{formatNumber(item.min_stock_level)}</strong></span>
                    <span>Bán TB/ngày: <strong className="text-slate-700">{Number(item.average_daily_sales).toFixed(2)}</strong></span>
                    <span className="text-blue-700">Đề xuất nhập: <strong>{formatNumber(item.recommended_quantity)}</strong></span>
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => updateStatus(item.id, 'rejected')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                    >
                      <FiX size={14} />
                      Từ chối
                    </button>
                    <button
                      onClick={() => updateStatus(item.id, 'approved')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 text-[11px] font-bold text-white shadow-sm transition-colors"
                    >
                      <FiCheck size={14} />
                      Duyệt
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="p-10 text-center font-medium text-slate-400 text-xs">Chưa có gợi ý nhập hàng đã lưu.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AIRecommendationsPage;

