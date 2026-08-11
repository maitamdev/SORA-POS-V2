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

const formatOrderMeta = (dateStr: string) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  })}`;
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
    <div className="min-h-full space-y-2 bg-slate-50 text-slate-950">
      <section className="flex flex-col gap-2 border-b border-slate-200 pb-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[23px] font-black leading-tight tracking-tight text-slate-950">Tổng quan</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            Theo dõi nhanh doanh thu, đơn hàng, tồn kho và hiệu quả bán hàng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 items-center border border-slate-300 bg-white p-1">
            {[7, 30].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedRange(range)}
                className={`h-6 px-3 text-[10px] font-black transition ${
                  selectedRange === range ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {range} ngày
              </button>
            ))}
          </div>

          <div className="relative flex h-8 items-center gap-2 border border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-700">
            <HiOutlineCalendar className="h-4 w-4 text-blue-600" />
            <span>{formatDisplayDate(selectedDate)}</span>
            <input
              aria-label="Chọn ngày dashboard"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              onClick={(event) => event.currentTarget.showPicker?.()}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>

          <button
            type="button"
            aria-label="Tải lại dashboard"
            title="Tải lại dashboard"
            onClick={() => loadData(selectedDate, selectedRange)}
            className="flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-700 transition hover:border-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            <HiOutlineRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => {
          const TrendIcon = trendCopy(item.growth).icon;
          const trend = trendCopy(item.growth);
          const Icon = item.icon;

          return (
            <article key={item.label} className={`min-h-[110px] border border-slate-200 bg-white p-4`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-slate-700">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 truncate text-[24px] font-black tracking-tight text-slate-950">{item.value}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-black ${trend.tone} ${trend.tone === 'text-emerald-600' ? 'bg-emerald-50' : trend.tone === 'text-rose-600' ? 'bg-rose-50' : 'bg-slate-100'}`}>
                  <TrendIcon className="h-3.5 w-3.5" />
                  {trend.text}
                </span>
                <span className="truncate text-[11px] font-semibold text-slate-400">{item.sub || 'so với hôm qua'}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="min-w-0 border border-slate-200 bg-white p-3 xl:col-span-8">
          <div className="flex flex-col gap-1.5 border-b border-slate-100 pb-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[15px] font-black tracking-tight text-slate-900">Doanh thu theo thời gian</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                {selectedRange} ngày: <span className="font-black text-slate-900">{money(totalRevenue)}</span> / {totalOrders} đơn
              </p>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
              <span>Ngày tốt nhất: <b className="text-slate-700">{formatShortDate(bestDay.date)}</b></span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-4 bg-blue-600" /> Doanh thu</span>
            </div>
          </div>

          <div className="mt-2 h-[245px] min-w-0 sm:h-[265px] xl:h-[275px]">
            {revenueChartData.length > 0 && revenueChartData.some((item) => item.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueChartData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="revenueAreaFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5edf7" strokeDasharray="3 6" vertical={false} />
                  <XAxis axisLine={false} dataKey="label" interval={0} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} tickLine={false} />
                  <YAxis axisLine={false} domain={[0, 'dataMax']} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} tickFormatter={(value) => compactMoney(Number(value))} tickLine={false} width={50} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#0f172a', strokeDasharray: '4 5', strokeWidth: 1 }} />
                  <Area dataKey="trendRevenue" dot={false} fill="transparent" isAnimationActive={false} stroke="#b8c7da" strokeDasharray="4 5" strokeWidth={1.5} type="linear" />
                  <Area
                    activeDot={{ fill: '#ffffff', r: 5, stroke: '#2563eb', strokeWidth: 3 }}
                    dataKey="revenue"
                    dot={{ fill: '#ffffff', r: 3, stroke: '#2563eb', strokeWidth: 2 }}
                    fill="url(#revenueAreaFill)"
                    isAnimationActive={false}
                    stroke="#6aaee0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-slate-200 text-xs font-semibold text-slate-400">
                Chưa có dữ liệu doanh thu trong khoảng thời gian này
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 border border-slate-200 bg-white p-4 xl:col-span-4">
          <div className="mb-1.5 flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-[17px] font-black tracking-tight text-slate-900">Top bán chạy</h2>
              <p className="mt-0.5 text-[12px] font-medium text-slate-400">Trong {selectedRange} ngày gần nhất</p>
            </div>
            <Link to="/reports" className="text-[13px] font-black text-blue-700 hover:text-blue-900">Tất cả</Link>
          </div>

          <div className="space-y-0">
            {data.top_products.length > 0 ? (
              data.top_products.slice(0, 5).map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[12px] font-black ${idx === 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : idx === 1 ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>
                    {idx + 1}
                  </span>
                  <img
                    src={item.image_url}
                    alt={item.name}
                    onError={(event) => {
                      event.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                    className="h-10 w-10 shrink-0 border border-slate-200 bg-slate-50 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-slate-800" title={item.name}>{item.name}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">Đã bán: {item.quantity}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-black text-slate-900">{compactMoney(item.revenue)}</p>
                    <p className="text-[11px] font-semibold text-slate-400">doanh thu</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm font-semibold text-slate-400">Chưa có sản phẩm bán chạy</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="min-w-0 border border-slate-200 bg-white p-4 xl:col-span-4">
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-[17px] font-black tracking-tight text-slate-900">Phương thức thanh toán</h2>
            <span className="text-[13px] font-bold text-slate-400">{paymentConfig.total} đơn</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={paymentConfig.radius} fill="transparent" stroke="#e2e8f0" strokeWidth="14" />
                {paymentConfig.segments.map((segment) => (
                  <circle key={segment.name} cx="60" cy="60" r={paymentConfig.radius} fill="transparent" stroke={segment.color} strokeDasharray={`${segment.strokeLength} ${paymentConfig.circumference}`} strokeDashoffset={-segment.strokeOffset} strokeLinecap="butt" strokeWidth="14" />
                ))}
                <circle cx="60" cy="60" r="34" fill="#ffffff" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Tổng</span>
                <span className="text-lg font-black text-slate-950">{paymentConfig.total}</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              {paymentConfig.segments.length > 0 ? paymentConfig.segments.map((segment) => (
                <div key={segment.name} className="flex items-center justify-between gap-2 text-[13px]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0" style={{ backgroundColor: segment.color }} />
                    <span className="truncate font-bold text-slate-600">{segment.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-950">{segment.percentage}%</p>
                    <p className="text-[11px] font-semibold text-slate-400">{segment.count} đơn</p>
                  </div>
                </div>
              )) : <p className="text-sm font-semibold text-slate-400">Chưa có giao dịch thanh toán</p>}
            </div>
          </div>

        </div>

        <div className="min-w-0 border border-slate-200 bg-white p-4 xl:col-span-4">
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-[17px] font-black tracking-tight text-slate-900">Cảnh báo vận hành</h2>
              <p className="mt-0.5 text-[12px] font-medium text-slate-400">Các việc cần được ưu tiên</p>
            </div>
            <HiOutlineBell className="h-5 w-5 text-slate-400" />
          </div>

          <div className="space-y-2">
            <Link to="/stock?tab=alerts" className="flex items-center justify-between gap-3 border border-rose-200 bg-rose-50 px-3.5 py-2.5 transition hover:border-rose-300">
              <div className="flex min-w-0 items-center gap-3">
                <HiOutlineExclamationCircle className="h-5 w-5 shrink-0 text-rose-500" />
                <div className="min-w-0"><p className="text-[13px] font-black text-rose-800">Tồn kho thấp</p><p className="truncate text-[11px] font-semibold text-rose-600">{summary.new_low_stock_count} mặt hàng mới chạm ngưỡng</p></div>
              </div>
              <span className="text-2xl font-black text-rose-700">{summary.low_stock_count}</span>
            </Link>

            <Link to="/stock?tab=expiry" className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-3.5 py-2.5 transition hover:border-amber-300">
              <div className="flex min-w-0 items-center gap-3">
                <HiOutlineCalendar className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0"><p className="text-[13px] font-black text-amber-800">Lô sắp hết hạn</p><p className="truncate text-[11px] font-semibold text-amber-700">Kiểm tra hàng cần ưu tiên bán</p></div>
              </div>
              <span className="text-[14px] font-black text-amber-700">Xem</span>
            </Link>

            <div className="flex items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <HiOutlineCash className="h-5 w-5 shrink-0 text-emerald-500" />
                <div className="min-w-0"><p className="text-[13px] font-black text-emerald-800">Dòng tiền hôm nay</p><p className="truncate text-[11px] font-semibold text-emerald-700">Theo doanh thu đã ghi nhận</p></div>
              </div>
              <span className="text-[14px] font-black text-emerald-700">{money(summary.today_revenue)}</span>
            </div>
          </div>

        </div>

        <div className="min-w-0 border border-slate-200 bg-white p-4 xl:col-span-4">
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-[17px] font-black tracking-tight text-slate-900">Đơn hàng gần đây</h2>
              <p className="mt-0.5 text-[12px] font-medium text-slate-400">Các giao dịch mới nhất</p>
            </div>
            <Link to="/orders" className="text-[13px] font-black text-blue-700 hover:text-blue-900">Tất cả</Link>
          </div>

          <div className="space-y-0">
            {data.recent_orders.length > 0 ? data.recent_orders.slice(0, 4).map((order) => (
              <div key={order.id} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-blue-50 text-blue-600"><HiOutlineCalendar className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black text-slate-800" title={order.order_number}>{order.order_number}</p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">{formatOrderMeta(order.created_at)} / {order.customer_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-black text-slate-900">{compactMoney(order.total_amount)}</p>
                  <span className={`text-[11px] font-black ${statusTone(order.status).split(' ').pop()}`}>{order.status}</span>
                </div>
              </div>
            )) : <p className="py-10 text-center text-sm font-semibold text-slate-400">Không có giao dịch gần đây</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
