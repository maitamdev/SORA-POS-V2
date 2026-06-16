import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { 
  HiOutlineTrendingUp as HiTrendUp, 
  HiOutlineCurrencyDollar as HiDollar,
  HiOutlineShoppingCart as HiCart,
  HiOutlineCalculator as HiCalc,
  HiOutlineCalendar as HiCal,
  HiOutlineClock as HiClock,
  HiOutlineDownload
} from 'react-icons/hi';
import { reportAPI, RevenuePoint, TopProduct } from '../../services/report.api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
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

const ReportsPage = () => {
  const [days, setDays] = useState(30);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
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
    </div>
  );
};

export default ReportsPage;
