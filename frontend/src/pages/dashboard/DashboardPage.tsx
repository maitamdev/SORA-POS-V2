import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  HiOutlineChartBar, 
  HiOutlineCube, 
  HiOutlineExclamationCircle, 
  HiOutlineShoppingCart,
  HiOutlineSearch,
  HiOutlineCalendar,
  HiOutlineBell,
  HiOutlineArrowNarrowUp,
  HiOutlineTrendingUp,
  HiOutlineArrowNarrowDown
} from 'react-icons/hi';
import { useAuthStore } from '../../stores/auth.store';
import { DashboardData, reportAPI } from '../../services/report.api';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const DashboardPage = () => {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredRevenueIdx, setHoveredRevenueIdx] = useState<number | null>(null);
  
  // Date Input Ref for programmatic showPicker trigger
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Real-time Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Date Selector State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10); // YYYY-MM-DD format
  });

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async (dateStr?: string) => {
    setLoading(true);
    try {
      const response = await reportAPI.dashboard(dateStr);
      setData(response.data.data);
    } catch {
      toast.error('Không tải được dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Reload data whenever selectedDate changes
  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  const handleDateDivClick = () => {
    if (dateInputRef.current) {
      try {
        // Modern programmatic way to open browser native date picker
        dateInputRef.current.showPicker();
      } catch (err) {
        // Fallback for older browsers
        dateInputRef.current.click();
      }
    }
  };

  if (!data) {
    return (
      <div className="flex h-[85vh] items-center justify-center font-sans" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#1b4d8e] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-slate-500 tracking-wide animate-pulse">Đang tải dữ liệu dashboard thực tế...</p>
        </div>
      </div>
    );
  }

  const summary = data.summary;
  const revenuePoints = data.revenue || [];
  const categorySales = data.category_sales || [];
  const paymentStats = data.payment_stats || [];

  // Custom SVG line chart calculations
  const chartHeight = 150;
  const chartWidth = 500;
  const paddingX = 40;
  const paddingY = 25;
  const maxRevenue = Math.max(...revenuePoints.map((item) => item.revenue), 100000);
  
  const getCoords = (idx: number, rev: number) => {
    const x = paddingX + idx * ((chartWidth - 2 * paddingX) / (revenuePoints.length - 1 || 1));
    const y = chartHeight - paddingY - (rev / maxRevenue) * (chartHeight - 2 * paddingY);
    return { x, y };
  };

  // Generate SVG Path
  let linePath = '';
  let areaPath = '';
  if (revenuePoints.length > 0) {
    const start = getCoords(0, revenuePoints[0].revenue);
    linePath = `M ${start.x} ${start.y}`;
    areaPath = `M ${start.x} ${chartHeight - paddingY} L ${start.x} ${start.y}`;
    
    for (let i = 1; i < revenuePoints.length; i++) {
      const coords = getCoords(i, revenuePoints[i].revenue);
      linePath += ` L ${coords.x} ${coords.y}`;
      areaPath += ` L ${coords.x} ${coords.y}`;
    }
    
    const endCoords = getCoords(revenuePoints.length - 1, revenuePoints[revenuePoints.length - 1].revenue);
    areaPath += ` L ${endCoords.x} ${chartHeight - paddingY} Z`;
  }

  // Double chart category sales calculations
  const maxCatSales = Math.max(...categorySales.map((item) => item.value), 100000);

  // Donut chart calculations
  const totalOrders = paymentStats.reduce((sum, item) => sum + item.count, 0);
  const donutRadius = 45;
  const donutCircumference = 2 * Math.PI * donutRadius;
  
  let currentOffset = 0;
  const donutColors = ['#1b4d8e', '#0ea5e9', '#a855f7']; // Navy blue, sky blue, purple

  const formattedTime = currentTime.toLocaleTimeString('vi-VN', { hour12: false });

  return (
    <div className="space-y-6 animate-fadeIn font-sans" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* HEADER SECTION */}
      <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Dashboard Tổng Quan</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Hệ thống POS tích hợp quản lý kho & cảnh báo tồn kho thấp</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-48 md:w-56">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <HiOutlineSearch className="w-4 h-4" />
            </span>
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              className="w-full pl-9 pr-12 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700"
            />
            <span className="absolute inset-y-0 right-0 flex items-center pr-2">
              <kbd className="px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md">Ctrl K</kbd>
            </span>
          </div>

          {/* Clickable Date Selector (Triggers Ref showPicker) */}
          <div 
            onClick={handleDateDivClick}
            className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer select-none"
          >
            <HiOutlineCalendar className="w-4 h-4 text-slate-400 pointer-events-none" />
            <span className="pointer-events-none">{formatDisplayDate(selectedDate)}</span>
            <input 
              ref={dateInputRef}
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute pointer-events-none opacity-0 w-0 h-0"
            />
          </div>

          {/* Real-time clock widget */}
          <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-sm select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono tracking-wider">{formattedTime}</span>
          </div>

          {/* Notification Icon */}
          <button className="relative p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors">
            <HiOutlineBell className="w-4.5 h-4.5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">5</span>
          </button>

          {/* Profile Circle */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-[#1b4d8e] text-white font-black text-xs flex items-center justify-center border border-blue-200 shadow-sm">
              {user?.full_name ? user.full_name.split(' ').pop()?.slice(0,2).toUpperCase() : 'AD'}
            </div>
            <div className="leading-none text-left">
              <p className="text-xs font-black text-slate-800">{user?.full_name || 'Admin'}</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">Quản trị viên</p>
            </div>
          </div>
        </div>
      </header>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Doanh thu hôm nay */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Doanh thu hôm nay</p>
              <p className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{money(summary.today_revenue)}</p>
              <p className="text-[10px] font-bold text-blue-700 flex items-center gap-0.5">
                <HiOutlineTrendingUp className="w-3.5 h-3.5" />
                <span>{summary.today_revenue_growth}% so với hôm qua</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Đơn hàng */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đơn hàng</p>
              <p className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{summary.today_orders} đơn</p>
              <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                <HiOutlineTrendingUp className="w-3.5 h-3.5" />
                <span>{summary.today_orders_growth}% so với hôm qua</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <HiOutlineShoppingCart className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Sản phẩm bán ra */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sản phẩm bán ra</p>
              <p className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{summary.today_sold_products} món</p>
              <p className="text-[10px] font-bold text-blue-700 flex items-center gap-0.5">
                <HiOutlineTrendingUp className="w-3.5 h-3.5" />
                <span>{summary.today_sold_growth}% so với hôm qua</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#e8f2fd] text-[#1b4d8e] flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <HiOutlineCube className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Cảnh báo tồn kho thấp */}
        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group ring-1 ring-rose-100">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cảnh báo tồn kho thấp</p>
              <p className="text-xl md:text-2xl font-black text-rose-600 tracking-tight">{summary.low_stock_count} mặt hàng</p>
              <p className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 animate-pulse">
                <HiOutlineArrowNarrowUp className="w-3.5 h-3.5" />
                <span>{summary.new_low_stock_count} sản phẩm mới chạm ngưỡng</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
              <HiOutlineExclamationCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS GRAPHIC SECTION */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Doanh thu 7 ngày - Line Area Chart */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase text-slate-700 tracking-wide">Doanh thu 7 ngày</h2>
            <select className="border border-slate-200 text-[10px] font-bold text-slate-500 rounded-lg px-2.5 py-1.5 outline-none bg-slate-50">
              <option>7 ngày qua</option>
              <option>Tháng này</option>
            </select>
          </div>
          
          <div className="relative w-full h-44 flex items-center justify-center">
            {revenuePoints.length > 0 && revenuePoints.some(r => r.revenue > 0) ? (
              <div className="relative w-full h-full">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b8fd4" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b8fd4" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line x1={paddingX} y1={20} x2={chartWidth - paddingX} y2={20} stroke="#f1f5f9" strokeWidth="1" />
                  <line x1={paddingX} y1={52} x2={chartWidth - paddingX} y2={52} stroke="#f1f5f9" strokeWidth="1" />
                  <line x1={paddingX} y1={85} x2={chartWidth - paddingX} y2={85} stroke="#f1f5f9" strokeWidth="1" />
                  <line x1={paddingX} y1={117} x2={chartWidth - paddingX} y2={117} stroke="#f1f5f9" strokeWidth="1" />
                  <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#cbd5e1" strokeWidth="1.2" />

                  {/* Shaded Area underneath the line */}
                  <path d={areaPath} fill="url(#areaGrad)" />

                  {/* Main Line stroke */}
                  <path d={linePath} fill="none" stroke="#3b8fd4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Dashed line on Hover */}
                  {hoveredRevenueIdx !== null && (
                    <line 
                      x1={getCoords(hoveredRevenueIdx, revenuePoints[hoveredRevenueIdx].revenue).x}
                      y1={15}
                      x2={getCoords(hoveredRevenueIdx, revenuePoints[hoveredRevenueIdx].revenue).x}
                      y2={chartHeight - paddingY}
                      stroke="#3b8fd4"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Interactive Circles & Labels */}
                  {revenuePoints.map((item, idx) => {
                    const { x, y } = getCoords(idx, item.revenue);
                    const isHovered = hoveredRevenueIdx === idx;
                    return (
                      <g key={item.date}>
                        {/* Interactive Dot */}
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={isHovered ? 6 : 4} 
                          fill={isHovered ? '#1b4d8e' : '#3b8fd4'} 
                          stroke="white" 
                          strokeWidth={isHovered ? 2 : 1.5}
                          className="transition-all duration-150 cursor-pointer"
                        />
                        {/* X Axis Date Label */}
                        <text 
                          x={x} 
                          y={chartHeight - 5} 
                          textAnchor="middle" 
                          className="text-[9px] fill-slate-400 font-bold"
                        >
                          {item.date}
                        </text>
                      </g>
                    );
                  })}

                  {/* Invisible Hover Rectangles */}
                  {revenuePoints.map((_, idx) => {
                    const x = paddingX + idx * ((chartWidth - 2 * paddingX) / (revenuePoints.length - 1 || 1));
                    const rectWidth = (chartWidth - 2 * paddingX) / (revenuePoints.length - 1 || 1);
                    return (
                      <rect 
                        key={idx}
                        x={x - rectWidth / 2}
                        y="10"
                        width={rectWidth}
                        height={chartHeight - paddingY - 10}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredRevenueIdx(idx)}
                        onMouseLeave={() => setHoveredRevenueIdx(null)}
                      />
                    );
                  })}
                </svg>

                {/* Hover Tooltip Overlay */}
                {hoveredRevenueIdx !== null && (
                  <div 
                    className="absolute bg-slate-900/95 text-white p-2.5 rounded-xl shadow-lg border border-slate-700 pointer-events-none text-left z-20 text-[10px] animate-scaleIn leading-tight"
                    style={{
                      left: `${(getCoords(hoveredRevenueIdx, revenuePoints[hoveredRevenueIdx].revenue).x / chartWidth) * 100 - 10}%`,
                      top: `${(getCoords(hoveredRevenueIdx, revenuePoints[hoveredRevenueIdx].revenue).y / chartHeight) * 100 - 32}%`
                    }}
                  >
                    <p className="font-black text-slate-300">{revenuePoints[hoveredRevenueIdx].date}</p>
                    <p className="font-extrabold text-white mt-0.5 text-xs">{money(revenuePoints[hoveredRevenueIdx].revenue)}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-400 py-16">Chưa có dữ liệu doanh thu</p>
            )}
          </div>
        </div>

        {/* Bán hàng theo danh mục - Bar Chart */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase text-slate-700 tracking-wide">Bán hàng theo danh mục</h2>
            <select className="border border-slate-200 text-[10px] font-bold text-slate-500 rounded-lg px-2.5 py-1.5 outline-none bg-slate-50">
              <option>7 ngày qua</option>
              <option>Tháng này</option>
            </select>
          </div>

          <div className="h-44 flex items-end justify-between gap-2 px-1">
            {categorySales.length > 0 ? (
              categorySales.slice(0, 5).map((item) => {
                const percent = (item.value / maxCatSales) * 100;
                return (
                  <div key={item.name} className="flex-1 flex flex-col items-center group cursor-pointer">
                    <span className="text-[9px] font-bold text-slate-700 mb-1 tracking-tight">
                      {item.value >= 1000000 
                        ? `${(item.value / 1000000).toFixed(1)}M` 
                        : `${(item.value / 1000).toFixed(0)}K`}
                    </span>
                    <div className="w-full max-w-[28px] bg-slate-100 rounded-t-lg h-32 flex items-end">
                      <div 
                        style={{ height: `${percent}%` }}
                        className="w-full bg-[#1b4d8e] group-hover:bg-[#3b8fd4] transition-all duration-200 rounded-t-lg shadow-sm"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-extrabold mt-2 text-center w-full truncate block" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="w-full text-center text-xs font-semibold text-slate-400 py-16">Chưa có dữ liệu danh mục</p>
            )}
          </div>
        </div>

        {/* Phương thức thanh toán - Donut Chart */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-black uppercase text-slate-700 tracking-wide">Phương thức thanh toán</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
            {/* SVG circular donut */}
            <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
                {totalOrders === 0 ? (
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#e2e8f0"
                    strokeWidth="15"
                  />
                ) : (
                  paymentStats.map((item, idx) => {
                    const percent = item.percentage;
                    const strokeLength = (percent / 100) * donutCircumference;
                    const strokeOffset = donutCircumference - currentOffset;
                    currentOffset += strokeLength;
                    return (
                      <circle
                        key={item.name}
                        cx="60"
                        cy="60"
                        r={donutRadius}
                        fill="transparent"
                        stroke={donutColors[idx % donutColors.length]}
                        strokeWidth="15"
                        strokeDasharray={`${strokeLength} ${donutCircumference}`}
                        strokeDashoffset={- (donutCircumference - strokeOffset)}
                        className="transition-all duration-300"
                      />
                    );
                  })
                )}
                {/* inner circle mask */}
                <circle cx="60" cy="60" r={donutRadius - 8} fill="white" />
              </svg>
              {/* Center text */}
              <div className="absolute text-center leading-none">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Tổng</span>
                <p className="text-lg font-black text-slate-800 mt-1">{totalOrders}</p>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="flex-1 space-y-2 w-full">
              {totalOrders === 0 ? (
                <p className="text-[10px] font-semibold text-slate-400 text-center">Chưa có giao dịch thanh toán</p>
              ) : (
                paymentStats.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: donutColors[idx % donutColors.length] }}
                      />
                      <span className="font-bold text-slate-600">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-800">{item.percentage}%</span>
                      <p className="text-[9px] font-bold text-slate-400 leading-none">{item.count} đơn</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TABLES ROW */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Giao dịch gần đây */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase text-slate-700 tracking-wide">Giao dịch gần đây</h2>
            <button className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg">Xem tất cả</button>
          </div>

          <div className="overflow-x-auto flex-1 -mx-px">
            {data.recent_orders.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="pb-2.5 font-black">Mã hóa đơn</th>
                    <th className="pb-2.5 font-black">Khách hàng</th>
                    <th className="pb-2.5 font-black">Thanh toán</th>
                    <th className="pb-2.5 font-black">Tổng tiền</th>
                    <th className="pb-2.5 font-black">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {data.recent_orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 font-extrabold text-slate-800">{order.order_number}</td>
                      <td className="py-2.5 font-semibold text-slate-500">{order.customer_name}</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                          {order.payment_method === 'Tiền mặt' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                          {order.payment_method === 'QR Pay' && <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>}
                          {order.payment_method === 'Thẻ Visa' && <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>}
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="py-2.5 font-black text-slate-800">{money(order.total_amount)}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full inline-flex items-center gap-0.5 ${
                          order.status === 'Hoàn thành' 
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' 
                            : 'text-rose-700 bg-rose-50 border border-rose-100'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-xs font-semibold text-slate-400 py-16">Không có giao dịch gần đây</p>
            )}
          </div>
        </div>

        {/* Sản phẩm sắp hết hàng */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase text-slate-700 tracking-wide">Sản phẩm sắp hết hàng</h2>
            <button className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg">Xem tất cả</button>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {data.low_stock_products.length > 0 ? (
              data.low_stock_products.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      className="w-9 h-9 object-contain rounded-lg border border-slate-100 bg-slate-50 flex-shrink-0"
                    />
                    <div className="leading-tight min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate" title={item.name}>{item.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">Tồn kho: <span className="text-rose-600 font-extrabold">{item.stock}</span></p>
                    </div>
                  </div>
                  
                  <span className={`px-2.5 py-0.5 text-[9px] font-black rounded-lg uppercase tracking-wide ${
                    item.alert_status === 'Rất thấp' || item.alert_status === 'Hết hàng'
                      ? 'text-rose-700 bg-rose-50 border border-rose-100' 
                      : 'text-amber-700 bg-amber-50 border border-amber-100'
                  }`}>
                    {item.alert_status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-xs font-semibold text-slate-400 py-16">Tồn kho an toàn</p>
            )}
          </div>
        </div>

        {/* Top sản phẩm bán chạy */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black uppercase text-slate-700 tracking-wide">Top bán chạy</h2>
            <select className="border border-slate-200 text-[10px] font-bold text-slate-500 rounded-lg px-2 py-1 outline-none bg-slate-50">
              <option>7 ngày qua</option>
              <option>Tháng này</option>
            </select>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {data.top_products.length > 0 ? (
              data.top_products.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2.5 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                  <span className="text-xs font-black text-slate-400 w-4 flex-shrink-0 text-center">{idx + 1}</span>
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    className="w-9 h-9 object-contain rounded-lg border border-slate-100 bg-slate-50 flex-shrink-0"
                  />
                  <div className="leading-tight min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-800 truncate" title={item.name}>{item.name}</p>
                    <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-bold">
                      <span>Đã bán: <strong className="text-slate-700">{item.quantity}</strong></span>
                      <span className="text-blue-700 font-extrabold">{money(item.revenue)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs font-semibold text-slate-400 py-16">Chưa có sản phẩm bán chạy</p>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER SECTION */}
      <footer className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-bold pt-4 border-t border-slate-200">
        <p>© 2025 SORA-POS. Tất cả quyền được bảo lưu.</p>
        <p>Phiên bản 1.0.0</p>
      </footer>
    </div>
  );
};

export default DashboardPage;
