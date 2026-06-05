import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiRefreshCw, FiX, FiZap } from 'react-icons/fi';
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

const alertLabel = {
  out_of_stock: 'Hết hàng',
  low_stock: 'Tồn thấp',
  needs_restock: 'Sắp thiếu',
  healthy: 'An toàn',
};

const statusLabel = {
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

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

  return (
    <div className="space-y-5 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800 sm:text-2xl">AI nhập hàng & cảnh báo tồn kho</h1>
          <p className="text-sm font-medium text-slate-500">
            Phân tích tồn kho, tốc độ bán 30 ngày và đề xuất số lượng cần nhập.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs font-black uppercase text-slate-400" htmlFor="target-days">
            Mục tiêu ngày
          </label>
          <input
            id="target-days"
            value={targetDays}
            onChange={(event) => setTargetDays(Number(event.target.value))}
            type="number"
            min={1}
            max={90}
            className="h-10 w-24 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400"
          />
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <FiZap />
            {generating ? 'Đang phân tích...' : 'Tạo gợi ý nhập'}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-black uppercase text-red-500">Hết hàng</p>
          <p className="mt-2 text-2xl font-black text-red-700">{summary?.out_of_stock || 0}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase text-amber-600">Tồn thấp</p>
          <p className="mt-2 text-2xl font-black text-amber-700">{summary?.low_stock || 0}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-black uppercase text-orange-600">Sắp thiếu</p>
          <p className="mt-2 text-2xl font-black text-orange-700">{summary?.needs_restock || 0}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-black uppercase text-blue-600">Cần nhập</p>
          <p className="mt-2 text-2xl font-black text-blue-700">
            {formatNumber(summary?.total_recommended_quantity || 0)}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase text-emerald-600">An toàn</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{summary?.healthy || 0}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-slate-800">AI cảnh báo tồn kho</h2>
            <p className="text-xs font-semibold text-slate-500">
              Cửa sổ bán hàng {analysis?.sales_window_days || 30} ngày, mục tiêu tồn {analysis?.target_days || targetDays} ngày.
            </p>
          </div>
          <button
            onClick={() => setShowAllProducts((value) => !value)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600"
          >
            {showAllProducts ? 'Chỉ xem cảnh báo' : 'Xem tất cả'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-400">Sản phẩm</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-400">Cảnh báo</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Tồn</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Tối thiểu</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Bán TB/ngày</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase text-slate-400">Đề xuất nhập</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-slate-400">AI nhận định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleAnalysisItems.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-800">{item.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{item.sku}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${priorityClass[item.priority]}`}>
                      {alertLabel[item.alert_status]} · {priorityLabel[item.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-black text-slate-800">{formatNumber(item.stock_quantity)}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-600">{formatNumber(item.min_stock_level)}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-600">{Number(item.average_daily_sales).toFixed(2)}</td>
                  <td className="px-4 py-4 text-right font-black text-blue-700">{formatNumber(item.recommended_quantity)}</td>
                  <td className="max-w-md px-4 py-4 font-semibold leading-relaxed text-slate-600">{item.ai_insight}</td>
                </tr>
              ))}
              {visibleAnalysisItems.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center font-bold text-slate-400" colSpan={7}>
                    Không có sản phẩm cần cảnh báo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-black text-slate-800">Gợi ý nhập hàng đã lưu</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-100">
          {items.map((item) => (
            <article key={item.id} className="p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-800">{item.products?.name || item.product_id}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${priorityClass[item.priority]}`}>
                      {priorityLabel[item.priority]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
                      {statusLabel[item.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                    {item.ai_insight || item.reason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
                    <span>Tồn: {formatNumber(item.current_stock)}</span>
                    <span>Tối thiểu: {formatNumber(item.min_stock_level)}</span>
                    <span>Bán TB/ngày: {Number(item.average_daily_sales).toFixed(2)}</span>
                    <span className="text-blue-700">Đề xuất nhập: {formatNumber(item.recommended_quantity)}</span>
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => updateStatus(item.id, 'rejected')}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600"
                    >
                      <FiX />
                      Từ chối
                    </button>
                    <button
                      onClick={() => updateStatus(item.id, 'approved')}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white"
                    >
                      <FiCheck />
                      Duyệt
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="p-10 text-center font-bold text-slate-400">Chưa có gợi ý nhập hàng đã lưu.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AIRecommendationsPage;
