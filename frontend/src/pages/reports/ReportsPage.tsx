import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { reportAPI, RevenuePoint, TopProduct } from '../../services/report.api';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const ReportsPage = () => {
  const [days, setDays] = useState(30);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  const loadData = async () => {
    try {
      const [revenueRes, topRes] = await Promise.all([
        reportAPI.revenue(days),
        reportAPI.topProducts(days, 10),
      ]);
      setRevenue(revenueRes.data.data);
      setTopProducts(topRes.data.data);
    } catch {
      toast.error('Không tải được báo cáo');
    }
  };

  useEffect(() => {
    loadData();
  }, [days]);

  const totalRevenue = revenue.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = revenue.reduce((sum, item) => sum + item.orders, 0);
  const maxRevenue = Math.max(...revenue.map((item) => item.revenue), 1);

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Báo cáo</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">Doanh thu và sản phẩm bán chạy lấy từ hóa đơn thật.</p>
        </div>
        <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold w-full sm:w-auto">
          <option value={7}>7 ngày</option>
          <option value={30}>30 ngày</option>
          <option value={90}>90 ngày</option>
        </select>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tổng doanh thu</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{money(totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Tổng đơn</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{totalOrders}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400">Giá trị TB/đơn</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{money(totalOrders ? totalRevenue / totalOrders : 0)}</p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-black uppercase text-slate-700">Doanh thu theo ngày</h2>
          <div className="overflow-x-auto">
          <div className="flex h-72 items-end gap-2 border-b border-slate-200 min-w-[500px]">
            {revenue.map((item) => (
              <div key={item.date} className="flex flex-1 flex-col items-center justify-end gap-2">
                <div className="w-full rounded-t-lg bg-blue-600" style={{ height: `${Math.max((item.revenue / maxRevenue) * 240, item.revenue ? 8 : 2)}px` }} />
                <span className="mb-2 rotate-[-45deg] text-[10px] font-bold text-slate-400">{item.date.slice(5)}</span>
              </div>
            ))}
          </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-black uppercase text-slate-700">Top sản phẩm bán chạy</h2>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="py-10 text-center text-sm font-semibold text-slate-400">Chưa có dữ liệu bán hàng</p>
            ) : (
              topProducts.map((item) => (
                <div key={item.product_id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-black text-slate-800">{item.product_name}</p>
                    <p className="font-black text-blue-600">{item.quantity}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Doanh thu {money(item.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReportsPage;
