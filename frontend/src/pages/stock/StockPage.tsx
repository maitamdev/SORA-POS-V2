import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { stockAPI } from '../../services/stock.api';
import { Product, StockAlert, StockTransaction } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';

const StockPage = () => {
  const { user } = useAuthStore();
  const [inventory, setInventory] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [mode, setMode] = useState<'import' | 'adjust'>('import');
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadData();
  }, [canManageStock]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageStock) {
      toast.error('Bạn không có quyền cập nhật kho');
      return;
    }
    if (loading) return;

    const form = new FormData(event.currentTarget);
    const productId = String(form.get('product_id') || '');
    const quantity = Number(form.get('quantity') || 0);
    const note = String(form.get('note') || '');

    setLoading(true);
    try {
      if (mode === 'import') await stockAPI.importStock({ product_id: productId, quantity, note });
      else await stockAPI.adjustStock({ product_id: productId, new_stock: quantity, note });
      toast.success(mode === 'import' ? 'Đã nhập kho' : 'Đã điều chỉnh tồn kho');
      event.currentTarget.reset();
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Cập nhật kho thất bại');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (id: string) => {
    if (!canManageStock) {
      toast.error('Bạn không có quyền xử lý cảnh báo');
      return;
    }

    try {
      await stockAPI.resolveAlert(id);
      toast.success('Đã xử lý cảnh báo');
      await loadData();
    } catch {
      toast.error('Không xử lý được cảnh báo');
    }
  };

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
        <button onClick={loadData} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white w-full sm:w-auto">
          {loading ? 'Đang tải...' : 'Tải lại'}
        </button>
      </header>

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
