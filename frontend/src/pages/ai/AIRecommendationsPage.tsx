import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { aiAPI } from '../../services/ai.api';
import { AIRecommendation } from '../../types/domain.type';

const priorityClass = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-emerald-50 text-emerald-600',
};

const AIRecommendationsPage = () => {
  const [items, setItems] = useState<AIRecommendation[]>([]);
  const [targetDays, setTargetDays] = useState(14);
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    const response = await aiAPI.list({ limit: 100 });
    setItems(response.data.data.items);
  };

  useEffect(() => {
    loadItems().catch(() => toast.error('Không tải được gợi ý AI'));
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await aiAPI.generate({ target_days: targetDays });
      toast.success(`Đã tạo ${response.data.data.generated} gợi ý từ dữ liệu tồn kho`);
      await loadItems();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tạo được gợi ý');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await aiAPI.updateStatus(id, status);
      toast.success(status === 'approved' ? 'Đã duyệt gợi ý' : 'Đã từ chối gợi ý');
      await loadItems();
    } catch {
      toast.error('Không cập nhật được trạng thái');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">AI gợi ý nhập hàng</h1>
          <p className="text-sm font-medium text-slate-500">
            Phân tích tồn kho thấp, doanh số thật và tạo khuyến nghị nhập hàng.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <label className="text-xs font-black uppercase text-slate-400">Mục tiêu ngày</label>
          <input
            value={targetDays}
            onChange={(event) => setTargetDays(Number(event.target.value))}
            type="number"
            min={1}
            max={90}
            className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none"
          />
          <button onClick={generate} disabled={loading} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
            {loading ? 'Đang phân tích...' : 'Tạo gợi ý'}
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-bold text-slate-500">Chưa có gợi ý AI.</p>
          <p className="mt-1 text-sm text-slate-400">Bấm “Tạo gợi ý” để phân tích sản phẩm tồn thấp từ dữ liệu hiện tại.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">{item.products?.sku}</p>
                  <h2 className="mt-1 text-lg font-black text-slate-800">{item.products?.name || item.product_id}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${priorityClass[item.priority]}`}>
                  {item.priority}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">Tồn</p>
                  <p className="text-lg font-black text-slate-800">{item.current_stock}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">Bán TB/ngày</p>
                  <p className="text-lg font-black text-slate-800">{Number(item.average_daily_sales).toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-[10px] font-black uppercase text-blue-500">Đề xuất nhập</p>
                  <p className="text-lg font-black text-blue-700">{item.recommended_quantity}</p>
                </div>
              </div>

              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-600">
                {item.ai_insight || item.reason}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400">Trạng thái: {item.status}</span>
                {item.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(item.id, 'rejected')} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                      Từ chối
                    </button>
                    <button onClick={() => updateStatus(item.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">
                      Duyệt
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIRecommendationsPage;
