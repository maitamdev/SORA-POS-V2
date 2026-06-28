import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineBell,
  HiOutlineCalendar,
  HiOutlineCash,
  HiOutlineChartBar,
  HiOutlineCube,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiOutlineShoppingCart,
  HiOutlineSparkles,
  HiOutlineTrendingDown,
  HiOutlineTrendingUp,
} from 'react-icons/hi';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardData, reportAPI } from '../../services/report.api';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const compactMoney = (value: number) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}tr`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return money(amount);
};

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
};

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-family='Arial' font-size='12' fill='%2394a3b8'%3ESP%3C/text%3E%3C/svg%3E";

const trendCopy = (growth: number) => {
  if (growth > 0) return { text: `+${growth}%`, tone: 'text-emerald-600', icon: HiOutlineTrendingUp };
  if (growth < 0) return { text: `${growth}%`, tone: 'text-rose-600', icon: HiOutlineTrendingDown };
  return { text: '0%', tone: 'text-slate-400', icon: HiOutlineTrendingUp };
};

const statusTone = (status: string) => {
  const lower = status.toLowerCase();
  if (lower.includes('hoàn') || lower.includes('completed')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (lower.includes('hủy') || lower.includes('cancel')) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
};

const RevenueTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: {
      cumulativeRevenue: number;
      displayDate: string;
      orders: number;
      revenue: number;
    };
  }>;
}) => {
  if (!active || !payload?.[0]?.payload) return null;
  const point = payload[0].payload;

  return (
    <div className="border border-slate-800 bg-slate-950 px-3 py-2 shadow-xl">
      <p className="text-[10px] font-bold text-slate-400">{point.displayDate}</p>
      <p className="mt-1 text-sm font-black text-white">{money(point.revenue)}</p>
      <p className="text-[10px] font-semibold text-blue-200">{point.orders} đơn trong ngày</p>
    </div>
  );
};

const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRange, setSelectedRange] = useState<number>(7);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const loadData = useCallback(async (dateStr?: string, days = 7) => {
    setLoading(true);
    try {
      const response = await reportAPI.dashboard(dateStr, days);
      setData(response.data.data);
    } catch {
      toast.error('Không tải được dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedDate, selectedRange);
  }, [loadData, selectedDate, selectedRange]);

  const revenuePoints = useMemo(() => data?.revenue || [], [data?.revenue]);
  const revenueChartData = useMemo(
    () => {
      const total = revenuePoints.reduce((sum, item) => sum + item.revenue, 0);
      let runningRevenue = 0;

      return revenuePoints.map((item, idx) => {
        runningRevenue += item.revenue;
        return {
          ...item,
          cumulativeRevenue: runningRevenue,
          displayDate: formatDisplayDate(item.date),
          trendRevenue: revenuePoints.length > 1 ? total / revenuePoints.length : item.revenue,
          label: formatShortDate(item.date),
        };
      });
    },
    [revenuePoints],
  );

  const categorySales = data?.category_sales || [];
  const maxCategoryValue = useMemo(
    () => Math.max(...categorySales.map((item) => item.value), 100000),
    [categorySales],
  );

  const paymentConfig = useMemo(() => {
    const stats = data?.payment_stats || [];
    const total = stats.reduce((sum, item) => sum + item.count, 0);
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const colors = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b'];
    let accumulated = 0;

    const segments = stats.map((item, idx) => {
      const length = (item.percentage / 100) * circumference;
      const segment = {
        ...item,
        color: colors[idx % colors.length],
        strokeLength: length,
        strokeOffset: accumulated,
      };
      accumulated += length;
      return segment;
    });

    return { circumference, radius, segments, total };
  }, [data?.payment_stats]);

  if (!data) {
    return (
      <div className="flex h-[75vh] items-center justify-center">
        <div className="border border-slate-300 bg-white px-8 py-7 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
          <p className="text-sm font-semibold text-slate-600">Đang tải dữ liệu dashboard...</p>
        </div>
      </div>
    );
  }

  const summary = data.summary;
  const avgOrderValue = summary.today_orders > 0 ? summary.today_revenue / summary.today_orders : 0;
  const grossProfit = summary.today_profit ?? Math.max(summary.today_revenue - (summary.today_cogs || 0), 0);
  const grossMargin = summary.today_revenue > 0 ? Math.round((grossProfit / summary.today_revenue) * 100) : 0;
  const totalRevenue = revenuePoints.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = revenuePoints.reduce((sum, item) => sum + item.orders, 0);
  const bestDay = revenuePoints.reduce(
    (best, item) => (item.revenue > best.revenue ? item : best),
    revenuePoints[0] || { date: selectedDate, revenue: 0, orders: 0 },
  );

  const kpis = [
    {
      label: 'Doanh thu hôm nay',
      value: money(summary.today_revenue),
      growth: summary.today_revenue_growth,
      icon: HiOutlineCash,
      accent: 'border-l-blue-600',
    },
    {
      label: 'Đơn hàng',
      value: `${summary.today_orders} đơn`,
      growth: summary.today_orders_growth,
      icon: HiOutlineShoppingCart,
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Giá trị TB',
      value: money(avgOrderValue),
      growth: summary.today_orders_growth,
      icon: HiOutlineChartBar,
      accent: 'border-l-sky-500',
    },
    {
      label: 'Sản phẩm bán ra',
      value: `${summary.today_sold_products} món`,
      growth: summary.today_sold_growth,
      icon: HiOutlineCube,
      accent: 'border-l-indigo-500',
    },
    {
      label: 'Lợi nhuận gộp',
      value: `${money(grossProfit)}`,
      growth: summary.today_profit_growth ?? 0,
      icon: HiOutlineSparkles,
      accent: 'border-l-amber-500',
      sub: `${grossMargin}% biên`,
    },
  ];

  return (
    <div className="min-h-full space-y-4 bg-slate-50 text-slate-950">
      <section className="border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-300 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                SORA-POS
              </span>
              <span className="text-[11px] font-semibold text-slate-400">Trung tâm vận hành cửa hàng</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Dashboard Tổng Quan</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Theo dõi doanh thu, đơn hàng, tồn kho và cảnh báo trong một màn hình.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">
              <HiOutlineCalendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                onClick={(event) => event.currentTarget.showPicker?.()}
                className="h-full min-w-[140px] cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-slate-700 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => loadData(selectedDate, selectedRange)}
              className="flex h-10 items-center justify-center gap-2 border border-slate-900 bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <HiOutlineRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Tải lại
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
          {kpis.map((item) => {
            const TrendIcon = trendCopy(item.growth).icon;
            const trend = trendCopy(item.growth);
            const Icon = item.icon;

            return (
              <div key={item.label} className={`border-l-4 ${item.accent} bg-white px-4 py-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                    <p className="mt-2 truncate text-xl font-black tracking-tight text-slate-950">{item.value}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-black ${trend.tone}`}>
                        <TrendIcon className="h-3.5 w-3.5" />
                        {trend.text}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">{item.sub || 'so với hôm qua'}</span>
                    </div>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-slate-50 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="border border-slate-300 bg-white p-4 shadow-sm xl:col-span-8">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Doanh thu theo thời gian</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Tổng {selectedRange} ngày: <span className="text-slate-950">{money(totalRevenue)}</span> · {totalOrders} đơn
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[7, 30].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setSelectedRange(range)}
                  className={`border px-3 py-2 text-[11px] font-black transition ${
                    selectedRange === range
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'
                  }`}
                >
                  {range} ngày
                </button>
              ))}
              <div className="border border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                Ngày tốt nhất: <span className="text-slate-950">{formatShortDate(bestDay.date)}</span>
              </div>
            </div>
          </div>

          <div className="relative h-[360px] overflow-hidden border border-slate-300 bg-white">
            <div className="absolute inset-x-0 top-0 z-10 flex flex-col gap-3 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="border border-slate-300 bg-white px-4 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Hôm nay</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{money(summary.today_revenue)}</p>
                  </div>
                  <div className="border border-slate-300 bg-white px-4 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{selectedRange} ngày qua</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{money(totalRevenue)}</p>
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">Tăng trưởng</p>
                    <p className="mt-1 text-sm font-black text-emerald-700">{summary.today_revenue_growth >= 0 ? '+' : ''}{summary.today_revenue_growth}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-5 bg-blue-600" />
                    Doanh thu
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-0 w-5 border-t border-dashed border-slate-400" />
                    Xu hướng
                  </span>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 top-[94px] px-4 pb-4 pt-4">
                {revenueChartData.length > 0 && revenueChartData.some((item) => item.revenue > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueChartData} margin={{ top: 8, right: 24, bottom: 4, left: 2 }}>
                    <defs>
                      <linearGradient id="revenueAreaFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
                        <stop offset="52%" stopColor="#60a5fa" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5edf7" strokeDasharray="4 8" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      interval={0}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      domain={[0, 'dataMax']}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                      tickFormatter={(value) => compactMoney(Number(value))}
                      tickLine={false}
                      width={54}
                    />
                    <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#0f172a', strokeDasharray: '4 5', strokeWidth: 1 }} />
                    <Area
                      dataKey="trendRevenue"
                      dot={false}
                      fill="transparent"
                      isAnimationActive={false}
                      stroke="#9db4d0"
                      strokeDasharray="4 5"
                      strokeWidth={2}
                      type="linear"
                    />
                    <Area
                      activeDot={{ fill: '#ffffff', r: 5, stroke: '#2563eb', strokeWidth: 3 }}
                      dataKey="revenue"
                      dot={false}
                      fill="url(#revenueAreaFill)"
                      fillOpacity={1}
                      isAnimationActive={false}
                      stroke="#2563eb"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      type="monotone"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">
                  Chưa có dữ liệu doanh thu trong khoảng thời gian này
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="grid gap-4 xl:col-span-4">
          <div className="border border-slate-300 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Cảnh báo vận hành</h2>
              <HiOutlineBell className="h-5 w-5 text-slate-400" />
            </div>

            <div className="space-y-3">
              <Link
                to="/stock?tab=alerts"
                className="block border border-rose-200 bg-rose-50 p-3 transition hover:border-rose-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-rose-800">Tồn kho thấp</p>
                    <p className="mt-1 text-2xl font-black text-rose-700">{summary.low_stock_count}</p>
                    <p className="text-[11px] font-semibold text-rose-600">{summary.new_low_stock_count} mặt hàng mới chạm ngưỡng</p>
                  </div>
                  <HiOutlineExclamationCircle className="h-7 w-7 text-rose-500" />
                </div>
              </Link>

              <Link to="/stock?tab=expiry" className="block border border-amber-200 bg-amber-50 p-3 transition hover:border-amber-300">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-amber-800">Sắp hết hạn</p>
                    <p className="mt-1 text-2xl font-black text-amber-700">HSD</p>
                    <p className="text-[11px] font-semibold text-amber-700">Kiểm tra lô hàng cần ưu tiên bán</p>
                  </div>
                  <HiOutlineCalendar className="h-7 w-7 text-amber-500" />
                </div>
              </Link>

              <div className="border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-emerald-800">Dòng tiền hôm nay</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">{money(summary.today_revenue)}</p>
                    <p className="text-[11px] font-semibold text-emerald-700">Theo doanh thu đã ghi nhận</p>
                  </div>
                  <HiOutlineCash className="h-7 w-7 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-300 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Thanh toán</h2>
              <span className="text-[11px] font-bold text-slate-400">{paymentConfig.total} đơn</span>
            </div>

            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r={paymentConfig.radius} fill="transparent" stroke="#e2e8f0" strokeWidth="14" />
                  {paymentConfig.segments.map((segment) => (
                    <circle
                      key={segment.name}
                      cx="60"
                      cy="60"
                      r={paymentConfig.radius}
                      fill="transparent"
                      stroke={segment.color}
                      strokeDasharray={`${segment.strokeLength} ${paymentConfig.circumference}`}
                      strokeDashoffset={-segment.strokeOffset}
                      strokeLinecap="butt"
                      strokeWidth="14"
                    />
                  ))}
                  <circle cx="60" cy="60" r="34" fill="#ffffff" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Tổng</span>
                  <span className="text-lg font-black text-slate-950">{paymentConfig.total}</span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {paymentConfig.segments.length > 0 ? (
                  paymentConfig.segments.map((segment) => (
                    <div key={segment.name} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: segment.color }} />
                        <span className="truncate font-bold text-slate-600">{segment.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-950">{segment.percentage}%</p>
                        <p className="text-[9px] font-semibold text-slate-400">{segment.count} đơn</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-semibold text-slate-400">Chưa có giao dịch thanh toán</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="border border-slate-300 bg-white p-4 shadow-sm xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Danh mục bán chạy</h2>
            <span className="text-[11px] font-bold text-slate-400">{selectedRange} ngày</span>
          </div>
          <div className="space-y-3">
            {categorySales.length > 0 ? (
              categorySales.slice(0, 5).map((item) => {
                const percent = Math.max(8, (item.value / maxCategoryValue) * 100);
                return (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-bold text-slate-700">{item.name}</span>
                      <span className="text-xs font-black text-slate-950">{compactMoney(item.value)}</span>
                    </div>
                    <div className="h-2 border border-slate-300 bg-slate-100">
                      <div className="h-full bg-blue-600" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-10 text-center text-xs font-semibold text-slate-400">Chưa có dữ liệu danh mục</p>
            )}
          </div>

          <div className="mt-5 border-t border-slate-300 pt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Sắp hết hàng</h2>
              <Link to="/stock?tab=alerts" className="text-[11px] font-black text-blue-700 hover:text-blue-900">
                Xem tất cả
              </Link>
            </div>

            <div className="space-y-3">
              {data.low_stock_products.length > 0 ? (
                data.low_stock_products.slice(0, 2).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        onError={(event) => {
                          event.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                        className="h-9 w-9 shrink-0 border border-slate-300 bg-slate-50 object-contain"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-800" title={item.name}>
                          {item.name}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          Tồn kho: <span className="text-rose-600">{item.stock}</span>
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 border border-rose-200 bg-rose-50 px-2 py-1 text-[9px] font-black uppercase text-rose-700">
                      {item.alert_status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs font-semibold text-slate-400">Tồn kho đang an toàn</p>
              )}
            </div>
          </div>
        </div>

        <div className="border border-slate-300 bg-white p-4 shadow-sm xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Giao dịch gần đây</h2>
            <Link to="/orders" className="border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 hover:border-blue-400">
              Xem tất cả
            </Link>
          </div>

          <div className="overflow-x-auto">
            {data.recent_orders.length > 0 ? (
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <th className="pb-2">Mã hóa đơn</th>
                    <th className="pb-2">Khách hàng</th>
                    <th className="pb-2">Thanh toán</th>
                    <th className="pb-2 text-right">Tổng tiền</th>
                    <th className="pb-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent_orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="text-xs transition hover:bg-slate-50">
                      <td className="py-2.5 font-black text-slate-900">{order.order_number}</td>
                      <td className="py-2.5 font-semibold text-slate-500">{order.customer_name}</td>
                      <td className="py-2.5 font-semibold text-slate-600">{order.payment_method}</td>
                      <td className="py-2.5 text-right font-black text-slate-900">{money(order.total_amount)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex border px-2 py-1 text-[10px] font-black ${statusTone(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-10 text-center text-xs font-semibold text-slate-400">Không có giao dịch gần đây</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:col-span-3">
          <div className="border border-slate-300 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-800">Top bán chạy</h2>
              <Link to="/reports" className="text-[11px] font-black text-blue-700 hover:text-blue-900">
                Xem tất cả
              </Link>
            </div>

            <div className="space-y-3">
              {data.top_products.length > 0 ? (
                data.top_products.slice(0, 4).map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <span className="w-4 text-center text-xs font-black text-slate-400">{idx + 1}</span>
                    <img
                      src={item.image_url}
                      alt={item.name}
                      onError={(event) => {
                        event.currentTarget.src = PLACEHOLDER_IMAGE;
                      }}
                      className="h-10 w-10 shrink-0 border border-slate-300 bg-slate-50 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-slate-800" title={item.name}>
                        {item.name}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold">
                        <span className="text-slate-400">Đã bán: {item.quantity}</span>
                        <span className="text-blue-700">{compactMoney(item.revenue)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-xs font-semibold text-slate-400">Chưa có sản phẩm bán chạy</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
