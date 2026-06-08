import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { 
  HiOutlineCurrencyDollar, 
  HiOutlineShoppingCart, 
  HiOutlineCalculator, 
  HiOutlineCalendar,
  HiOutlineTrendingUp,
  HiOutlineClock
} from 'react-icons/hi';
import { reportAPI, RevenuePoint, TopProduct } from '../../services/report.api';

// Format money to VND (round to integer, no decimals)
const money = (value: number) => {
  return `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;
};

const ReportsPage = () => {
  const [days, setDays] = useState(30);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Interactive tooltip state for the SVG chart
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; item: RevenuePoint } | null>(null);

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
  const totalRevenue = revenue.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = revenue.reduce((sum, item) => sum + item.orders, 0);
  const averageOrderVal = totalOrders ? totalRevenue / totalOrders : 0;

  // Chart configuration
  const maxVal = Math.max(...revenue.map(r => r.revenue), 1);
  const maxValRounded = Math.ceil(maxVal / 10000) * 10000; // Round up for clean Y axis intervals

  const svgWidth = 650;
  const svgHeight = 280;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Calculate points for the path
  const points = revenue.map((item, idx) => {
    const x = paddingLeft + (idx / Math.max(revenue.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - (item.revenue / maxValRounded) * chartHeight;
    return { x, y, item };
  });

  // SVG paths
  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  // Gridlines and labels on Y-axis
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = paddingTop + chartHeight - ratio * chartHeight;
    const val = ratio * maxValRounded;
    return { y, val };
  });

  // X-axis label filtering (shows ~5 labels maximum to avoid overlap)
  const getXLabels = () => {
    if (revenue.length === 0) return [];
    const interval = Math.max(Math.ceil(revenue.length / 5), 1);
    return points.filter((_, idx) => idx % interval === 0);
  };

  const formatYAxis = (val: number) => {
    if (val === 0) return '0đ';
    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.0', '')}Mđ`;
    if (val >= 1000) return `${(val / 1000).toLocaleString('vi-VN')}kđ`;
    return `${val}đ`;
  };

  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
  };

  // Top products calculation for progress bar
  const maxProductQty = Math.max(...topProducts.map(p => p.quantity), 1);

  return (
    <div className="space-y-6 animate-fadeIn pb-10" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
      {/* HEADER SECTION */}
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Thống kê doanh thu</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Báo cáo dữ liệu bán hàng đồng bộ từ hóa đơn thực tế
          </p>
        </div>
        <div className="relative flex items-center self-start md:self-auto min-w-[150px]">
          <HiOutlineCalendar className="absolute left-3.5 text-slate-400 pointer-events-none w-4 h-4" />
          <select 
            value={days} 
            onChange={(event) => setDays(Number(event.target.value))} 
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none transition-all"
          >
            <option value={7}>Xem 7 ngày gần đây</option>
            <option value={30}>Xem 30 ngày gần đây</option>
            <option value={90}>Xem 90 ngày gần đây</option>
          </select>
        </div>
      </header>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Tổng doanh thu</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <HiOutlineCurrencyDollar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{money(totalRevenue)}</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <HiOutlineTrendingUp className="text-emerald-500 w-3.5 h-3.5" />
              Doanh thu tích lũy trong {days} ngày
            </p>
          </div>
        </div>

        {/* Card 2: Orders */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Tổng số đơn hàng</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <HiOutlineShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{totalOrders.toLocaleString('vi-VN')} đơn</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <HiOutlineClock className="text-amber-500 w-3.5 h-3.5" />
              Giao dịch hoàn thành
            </p>
          </div>
        </div>

        {/* Card 3: AOV */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Giá trị TB / đơn</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <HiOutlineCalculator className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{money(averageOrderVal)}</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              Giá trị đơn hàng trung bình
            </p>
          </div>
        </div>
      </div>

      {/* CHARTS AND LISTS SECTION */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* REVENUE CHART */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Xu hướng doanh thu</h2>
            <p className="text-[11px] font-bold text-slate-400 mt-1">Biểu đồ biểu diễn doanh thu phát sinh theo từng ngày</p>
          </div>
          
          <div className="relative mt-6 w-full overflow-x-auto select-none">
            {loading ? (
              <div className="flex h-72 items-center justify-center min-w-[550px]">
                <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
              </div>
            ) : revenue.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm font-semibold text-slate-400 min-w-[550px]">
                Không có dữ liệu trong khoảng thời gian này
              </div>
            ) : (
              <div className="relative min-w-[620px] pb-2">
                <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
                  {/* Define Gradients */}
                  <defs>
                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
                  {gridLines.map((line, idx) => (
                    <g key={idx}>
                      <line 
                        x1={paddingLeft} 
                        y1={line.y} 
                        x2={svgWidth - paddingRight} 
                        y2={line.y} 
                        className="stroke-slate-100" 
                        strokeWidth="1" 
                        strokeDasharray={idx === 0 ? "0" : "4 4"}
                      />
                      <text 
                        x={paddingLeft - 12} 
                        y={line.y + 4} 
                        className="fill-slate-400 text-[10px] font-bold text-right"
                        textAnchor="end"
                      >
                        {formatYAxis(line.val)}
                      </text>
                    </g>
                  ))}

                  {/* Area fill */}
                  <path d={areaPath} fill="url(#chartGlow)" />

                  {/* Main Line path */}
                  <path 
                    d={linePath} 
                    fill="none" 
                    className="stroke-blue-600" 
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Points / Markers */}
                  {points.map((p, idx) => (
                    <circle 
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPoint?.item.date === p.item.date ? "5" : "3.5"}
                      className={`transition-all duration-200 cursor-pointer ${
                        hoveredPoint?.item.date === p.item.date 
                          ? 'fill-white stroke-blue-600 stroke-[3px]' 
                          : 'fill-blue-600 stroke-white stroke-[1.5px] hover:fill-white hover:stroke-blue-600 hover:stroke-[3px]'
                      }`}
                    />
                  ))}

                  {/* Interactive vertical hover indicator */}
                  {hoveredPoint && (
                    <line 
                      x1={hoveredPoint.x}
                      y1={paddingTop}
                      x2={hoveredPoint.x}
                      y2={paddingTop + chartHeight}
                      className="stroke-blue-400/50"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* X Axis Date labels */}
                  {getXLabels().map((p, idx) => (
                    <text 
                      key={idx} 
                      x={p.x} 
                      y={svgHeight - 12} 
                      className="fill-slate-400 text-[10px] font-bold"
                      textAnchor="middle"
                    >
                      {formatDateLabel(p.item.date)}
                    </text>
                  ))}
                  
                  {/* Transparent hover capture grid bars */}
                  {points.map((p, idx) => {
                    const barWidth = chartWidth / Math.max(revenue.length - 1, 1);
                    return (
                      <rect 
                        key={idx}
                        x={p.x - barWidth / 2}
                        y={paddingTop}
                        width={barWidth}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </svg>

                {/* Floating Chart Tooltip */}
                {hoveredPoint && (
                  <div 
                    className="absolute z-20 rounded-xl bg-slate-900/95 p-3 text-white shadow-xl border border-slate-700/80 backdrop-blur-sm pointer-events-none transition-all duration-150"
                    style={{
                      left: `${hoveredPoint.x - 70}px`,
                      top: `${hoveredPoint.y - 75}px`
                    }}
                  >
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      {hoveredPoint.item.date.split('-').reverse().join('/')}
                    </p>
                    <p className="text-xs font-bold whitespace-nowrap">
                      Doanh thu: <span className="text-blue-400">{money(hoveredPoint.item.revenue)}</span>
                    </p>
                    <p className="text-[10px] font-bold text-slate-300 mt-0.5">
                      Đơn hàng: <span className="text-amber-400">{hoveredPoint.item.orders} đơn</span>
                    </p>
                  </div>
                )}
              </div>
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
                const isTopThree = idx < 3;
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

