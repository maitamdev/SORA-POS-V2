import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { env } from '../config/env';
import { appCache, stableCacheKey } from '../utils/cache';
import { parsePagination } from '../utils/query';


const getVietnamTime = (dateInput: Date | string = new Date()) => {
  const date = new Date(dateInput);
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
};

const startOfDay = (date = new Date()) => {
  const vnDate = getVietnamTime(date);
  vnDate.setHours(0, 0, 0, 0);
  const y = vnDate.getFullYear();
  const m = vnDate.getMonth();
  const d = vnDate.getDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 3600000);
};

const getLocalDateString = (dateInput: Date | string) => {
  const vnDate = getVietnamTime(dateInput);
  const y = vnDate.getFullYear();
  const m = String(vnDate.getMonth() + 1).padStart(2, '0');
  const day = String(vnDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 7 * 3600000);
};

type AnalysisHistoryQuery = Record<string, unknown>;

export class ReportService {
  static async dashboard(dateStr?: string, days = 7) {
    const cacheKey = stableCacheKey('report:dashboard', { dateStr, days });
    const cached = appCache.get<any>(cacheKey);
    if (cached) return cached;

    const today = dateStr ? parseLocalDate(dateStr) : startOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const rangeDaysAgo = new Date(today);
    rangeDaysAgo.setDate(rangeDaysAgo.getDate() - (days - 1));

    // 1. Fetch independent data blocks in parallel (Level 1)
    const [
      summaryOrdersData,
      stockCounts,
      revenueTrend,
      categoryAndPaymentRawData,
      recentOrdersResult,
      alertsResult,
      topProductsRaw
    ] = await Promise.all([
      // Task 1: Fetch summary orders for today and yesterday
      supabase
        .from('orders')
        .select('id, final_amount, created_at, status')
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', tomorrow.toISOString()),

      // Task 2: Fetch stock alert counts (active & new today)
      Promise.all([
        supabase
          .from('stock_alerts')
          .select('id', { count: 'exact', head: true })
          .in('status', ['low_stock', 'out_of_stock']),
        supabase
          .from('stock_alerts')
          .select('id', { count: 'exact', head: true })
          .in('status', ['low_stock', 'out_of_stock'])
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString()),
      ]),

      // Task 3: Fetch dynamic range revenue trend
      this.revenue(days, today),

      // Task 4: Fetch completed orders of last N days for Category & Payment
      supabase
        .from('orders')
        .select('id')
        .eq('status', 'completed')
        .gte('created_at', rangeDaysAgo.toISOString())
        .lt('created_at', tomorrow.toISOString()),

      // Task 5: Fetch recent transactions
      supabase
        .from('orders')
        .select('id, order_number, final_amount, created_at, status, customers(name)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5),

      // Task 6: Fetch low stock products list
      supabase
        .from('stock_alerts')
        .select('current_stock, min_stock_level, status, products(id, name, image_url)')
        .in('status', ['low_stock', 'out_of_stock'])
        .order('current_stock', { ascending: true })
        .limit(4),

      // Task 7: Fetch top products (raw list of IDs)
      this.topProducts(days, 5, today)
    ]);

    // Check Level 1 query errors
    if (summaryOrdersData.error) throw new AppError(500, summaryOrdersData.error.message);
    if (stockCounts[0].error) throw new AppError(500, stockCounts[0].error.message);
    if (stockCounts[1].error) throw new AppError(500, stockCounts[1].error.message);
    if (categoryAndPaymentRawData.error) throw new AppError(500, categoryAndPaymentRawData.error.message);
    if (recentOrdersResult.error) throw new AppError(500, recentOrdersResult.error.message);
    if (alertsResult.error) throw new AppError(500, alertsResult.error.message);

    const orders = summaryOrdersData.data || [];
    const rangeOrders = categoryAndPaymentRawData.data || [];
    const recentOrders = recentOrdersResult.data || [];
    const alerts = alertsResult.data || [];

    const todayCompletedOrders = orders.filter(
      (o) => o.status === 'completed' && o.created_at >= today.toISOString()
    );
    const yesterdayCompletedOrders = orders.filter(
      (o) => o.status === 'completed' && o.created_at >= yesterday.toISOString() && o.created_at < today.toISOString()
    );

    const todayRevenue = todayCompletedOrders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0);
    const yesterdayRevenue = yesterdayCompletedOrders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0);

    const todayOrdersCount = todayCompletedOrders.length;
    const yesterdayOrdersCount = yesterdayCompletedOrders.length;

    const todayRevenueGrowth = yesterdayRevenue > 0 
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10 
      : todayRevenue > 0 ? 100 : 0;

    const todayOrdersGrowth = yesterdayOrdersCount > 0 
      ? Math.round(((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 1000) / 10 
      : todayOrdersCount > 0 ? 100 : 0;

    const todayOrderIds = todayCompletedOrders.map((o) => o.id);
    const yesterdayOrderIds = yesterdayCompletedOrders.map((o) => o.id);
    const allCompletedOrderIds = [...todayOrderIds, ...yesterdayOrderIds];
    const rangeOrderIds = rangeOrders.map((o) => o.id);
    const recentOrderIds = recentOrders.map((o) => o.id);
    const topProductIds = topProductsRaw.map((p) => p.product_id);

    // 2. Fetch dependent data blocks in parallel (Level 2)
    const [
      orderDetailsSummaryResult,
      categoryDetailsResult,
      paymentsStatsResult,
      recentPaymentsResult,
      topProductsImagesResult
    ] = await Promise.all([
      // Dependent Task 1: Fetch order details and cost price to compute COGS
      allCompletedOrderIds.length > 0
        ? supabase.from('order_details').select('order_id, quantity, cost_price, products(cost_price)').in('order_id', allCompletedOrderIds)
        : Promise.resolve({ data: null, error: null }),

      // Dependent Task 2: Fetch order details for category sales
      rangeOrderIds.length > 0
        ? supabase.from('order_details').select('product_id, subtotal').in('order_id', rangeOrderIds)
        : Promise.resolve({ data: null, error: null }),

      // Dependent Task 3: Fetch payments for last range days
      rangeOrderIds.length > 0
        ? supabase.from('payments').select('order_id, method, amount').in('order_id', rangeOrderIds)
        : Promise.resolve({ data: null, error: null }),

      // Dependent Task 4: Fetch payments for recent transactions
      recentOrderIds.length > 0
        ? supabase.from('payments').select('order_id, method').in('order_id', recentOrderIds)
        : Promise.resolve({ data: null, error: null }),

      // Dependent Task 5: Fetch images for top products
      topProductIds.length > 0
        ? supabase.from('products').select('id, image_url').in('id', topProductIds)
        : Promise.resolve({ data: null, error: null })
    ]);

    // Check Level 2 query errors
    if (orderDetailsSummaryResult.error) throw new AppError(500, orderDetailsSummaryResult.error.message);
    if (categoryDetailsResult.error) throw new AppError(500, categoryDetailsResult.error.message);
    if (paymentsStatsResult.error) throw new AppError(500, paymentsStatsResult.error.message);
    if (recentPaymentsResult.error) throw new AppError(500, recentPaymentsResult.error.message);
    if (topProductsImagesResult.error) throw new AppError(500, topProductsImagesResult.error.message);

    // Dependent Task 1 parsing: Sold products today vs yesterday & COGS calculations
    let todaySoldProducts = 0;
    let yesterdaySoldProducts = 0;
    let todayCogs = 0;
    let yesterdayCogs = 0;
    const details = orderDetailsSummaryResult.data;
    if (details) {
      for (const d of details) {
        const qty = Number(d.quantity || 0);
        const costPrice = Number(d.cost_price ?? (d.products as any)?.cost_price ?? 0);
        const cogs = costPrice * qty;

        if (todayOrderIds.includes(d.order_id)) {
          todaySoldProducts += qty;
          todayCogs += cogs;
        } else if (yesterdayOrderIds.includes(d.order_id)) {
          yesterdaySoldProducts += qty;
          yesterdayCogs += cogs;
        }
      }
    }

    const todayProfit = todayRevenue - todayCogs;
    const yesterdayProfit = yesterdayRevenue - yesterdayCogs;

    const todayProfitGrowth = yesterdayProfit > 0 
      ? Math.round(((todayProfit - yesterdayProfit) / yesterdayProfit) * 1000) / 10 
      : todayProfit > 0 ? 100 : 0;

    const todaySoldGrowth = yesterdaySoldProducts > 0 
      ? Math.round(((todaySoldProducts - yesterdaySoldProducts) / yesterdaySoldProducts) * 1000) / 10 
      : todaySoldProducts > 0 ? 100 : 0;

    // Dependent Task 2 parsing: Category sales
    const categoryDetails = categoryDetailsResult.data || [];
    const categoryDetailsProductIds = Array.from(new Set(categoryDetails.map((d) => d.product_id)));
    
    // Level 3 query: Fetch categories matching product IDs (only if details exist)
    let productsWithCategories = null;
    if (categoryDetailsProductIds.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('id, categories(name)')
        .in('id', categoryDetailsProductIds);

      if (error) throw new AppError(500, error.message);
      productsWithCategories = data;
    }

    let categorySalesMap = new Map<string, number>();
    if (categoryDetails.length > 0 && productsWithCategories) {
      const prodToCat = new Map<string, string>();
      for (const p of productsWithCategories) {
        const catName = p.categories ? (p.categories as any).name : 'Khác';
        prodToCat.set(p.id, catName);
      }

      for (const d of categoryDetails) {
        const catName = prodToCat.get(d.product_id) || 'Khác';
        categorySalesMap.set(catName, (categorySalesMap.get(catName) || 0) + Number(d.subtotal || 0));
      }
    }
    const category_sales = Array.from(categorySalesMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Dependent Task 3 parsing: Payment stats
    const paymentStats = { cash: 0, transfer: 0, card: 0 };
    const paymentCounts = { cash: 0, transfer: 0, card: 0 };
    const payments = paymentsStatsResult.data || [];
    for (const p of payments) {
      const method = p.method === 'transfer' || p.method === 'momo' || p.method === 'zalopay' 
        ? 'transfer' 
        : p.method === 'card' 
          ? 'card' 
          : 'cash';

      paymentStats[method] += Number(p.amount || 0);
      paymentCounts[method] += 1;
    }
    const totalPaymentCount = paymentCounts.cash + paymentCounts.transfer + paymentCounts.card || 1;
    const payment_stats = [
      { name: 'Tiền mặt', percentage: Math.round((paymentCounts.cash / totalPaymentCount) * 1000) / 10, count: paymentCounts.cash },
      { name: 'QR', percentage: Math.round((paymentCounts.transfer / totalPaymentCount) * 1000) / 10, count: paymentCounts.transfer },
      { name: 'Thẻ', percentage: Math.round((paymentCounts.card / totalPaymentCount) * 1000) / 10, count: paymentCounts.card },
    ];

    // Dependent Task 4 parsing: Recent transactions
    const recentPayments = recentPaymentsResult.data || [];
    let recentPaymentsMap = new Map<string, string>();
    for (const p of recentPayments) {
      recentPaymentsMap.set(p.order_id, p.method);
    }

    const recent_orders = recentOrders.map((o) => {
      let methodLabel = 'Tiền mặt';
      const method = recentPaymentsMap.get(o.id);
      if (method === 'transfer') methodLabel = 'Chuyển khoản/VietQR';
      else if (method === 'momo' || method === 'zalopay') methodLabel = 'Ví điện tử';
      else if (method === 'card') methodLabel = 'Thẻ ngân hàng';

      return {
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customers ? (o.customers as any).name : 'Khách lẻ',
        payment_method: methodLabel,
        total_amount: Number(o.final_amount || 0),
        status: o.status === 'completed' ? 'Hoàn thành' : o.status === 'cancelled' ? 'Đã hủy' : 'Trạng thái khác',
        created_at: o.created_at,
      };
    });

    // Dependent Task 5 parsing: Low stock alert products
    const low_stock_products = alerts.map((a) => {
      const p = a.products as any;
      return {
        id: p?.id || '',
        name: p?.name || 'Sản phẩm không tên',
        stock: a.current_stock,
        alert_status: a.current_stock === 0 ? 'Rất thấp' : a.current_stock <= 5 ? 'Rất thấp' : 'Thấp',
        image_url: p?.image_url || '/assets/logo.png',
      };
    });

    // Dependent Task 6 parsing: Top products
    const topProductsImages = topProductsImagesResult.data || [];
    let topProductsImagesMap = new Map<string, string>();
    for (const pr of topProductsImages) {
      topProductsImagesMap.set(pr.id, pr.image_url || '');
    }

    const top_products = topProductsRaw.map((p, idx) => ({
      rank: idx + 1,
      id: p.product_id,
      name: p.product_name,
      quantity: p.quantity,
      revenue: p.revenue,
      image_url: topProductsImagesMap.get(p.product_id) || '/assets/logo.png',
    }));

    const result = {
      summary: {
        today_revenue: todayRevenue,
        today_revenue_growth: todayRevenueGrowth,
        today_orders: todayOrdersCount,
        today_orders_growth: todayOrdersGrowth,
        today_sold_products: todaySoldProducts,
        today_sold_growth: todaySoldGrowth,
        low_stock_count: stockCounts[0].count || 0,
        new_low_stock_count: stockCounts[1].count || 0,
        today_cogs: todayCogs,
        today_profit: todayProfit,
        today_profit_growth: todayProfitGrowth,
      },
      revenue: revenueTrend,
      category_sales,
      payment_stats,
      recent_orders,
      low_stock_products,
      top_products,
    };
    appCache.set(cacheKey, result, 30_000);
    return result;
  }

  static async revenue(days = 7, endDate = startOfDay()) {
    const fromDate = new Date(endDate);
    fromDate.setDate(fromDate.getDate() - (days - 1));

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, final_amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', fromDate.toISOString())
      .lt('created_at', new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error) throw new AppError(500, error.message);

    const orderIds = (orders || []).map((o) => o.id);
    let details: any[] = [];
    if (orderIds.length > 0) {
      const { data, error: detailsErr } = await supabase
        .from('order_details')
        .select('order_id, quantity, cost_price, products(cost_price)')
        .in('order_id', orderIds);
      if (detailsErr) throw new AppError(500, detailsErr.message);
      details = data || [];
    }

    // Calculate COGS per order
    const orderCogsMap = new Map<string, number>();
    for (const d of details) {
      const costPrice = Number(d.cost_price ?? (d.products as any)?.cost_price ?? 0);
      const qty = Number(d.quantity || 0);
      const cogs = costPrice * qty;
      orderCogsMap.set(d.order_id, (orderCogsMap.get(d.order_id) || 0) + cogs);
    }

    const buckets = new Map<string, { date: string; revenue: number; orders: number; cogs: number; profit: number }>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateString(date);
      buckets.set(dateStr, { date: dateStr, revenue: 0, orders: 0, cogs: 0, profit: 0 });
    }

    for (const order of orders || []) {
      const key = getLocalDateString(order.created_at);
      const bucket = buckets.get(key);
      if (!bucket) continue;

      const rev = Number(order.final_amount || 0);
      const cogs = orderCogsMap.get(order.id) || 0;

      bucket.revenue += rev;
      bucket.orders += 1;
      bucket.cogs += cogs;
      bucket.profit += (rev - cogs);
    }

    return Array.from(buckets.values());
  }

  static async topProducts(days = 7, limit = 10, endDate = startOfDay()) {
    const fromDate = new Date(endDate);
    fromDate.setDate(fromDate.getDate() - (days - 1));

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'completed')
      .gte('created_at', fromDate.toISOString())
      .lt('created_at', new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString());

    if (orderError) throw new AppError(500, orderError.message);
    const orderIds = (orders || []).map((order) => order.id);
    if (orderIds.length === 0) return [];

    const { data: details, error } = await supabase
      .from('order_details')
      .select('product_id, product_name, quantity, subtotal')
      .in('order_id', orderIds);

    if (error) throw new AppError(500, error.message);

    const grouped = new Map<string, { product_id: string; product_name: string; quantity: number; revenue: number }>();
    for (const detail of details || []) {
      const current = grouped.get(detail.product_id) || {
        product_id: detail.product_id,
        product_name: detail.product_name,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += Number(detail.quantity || 0);
      current.revenue += Number(detail.subtotal || 0);
      grouped.set(detail.product_id, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  static async aiAnalysis(days = 30, generatedBy?: string) {
    const today = startOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const rangeDaysAgo = new Date(today);
    rangeDaysAgo.setDate(rangeDaysAgo.getDate() - (days - 1));

    // Parallel fetch
    const [
      revenueTrend,
      topProductsRaw,
      categoryAndPaymentRawData
    ] = await Promise.all([
      this.revenue(days, today),
      this.topProducts(days, 5, today),
      supabase
        .from('orders')
        .select('id')
        .eq('status', 'completed')
        .gte('created_at', rangeDaysAgo.toISOString())
        .lt('created_at', tomorrow.toISOString())
    ]);

    if (categoryAndPaymentRawData.error) throw new AppError(500, categoryAndPaymentRawData.error.message);
    const rangeOrders = categoryAndPaymentRawData.data || [];
    const rangeOrderIds = rangeOrders.map((o) => o.id);

    // Fetch details for category sales
    const [
      categoryDetailsResult,
      paymentsStatsResult
    ] = await Promise.all([
      rangeOrderIds.length > 0
        ? supabase.from('order_details').select('product_id, subtotal').in('order_id', rangeOrderIds)
        : Promise.resolve({ data: null, error: null }),
      rangeOrderIds.length > 0
        ? supabase.from('payments').select('order_id, method, amount').in('order_id', rangeOrderIds)
        : Promise.resolve({ data: null, error: null })
    ]);

    if (categoryDetailsResult.error) throw new AppError(500, categoryDetailsResult.error.message);
    if (paymentsStatsResult.error) throw new AppError(500, paymentsStatsResult.error.message);

    // Categories
    const categoryDetails = categoryDetailsResult.data || [];
    const categoryDetailsProductIds = Array.from(new Set(categoryDetails.map((d) => d.product_id)));
    let productsWithCategories = null;
    if (categoryDetailsProductIds.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('id, categories(name)')
        .in('id', categoryDetailsProductIds);
      if (error) throw new AppError(500, error.message);
      productsWithCategories = data;
    }

    let categorySalesMap = new Map<string, number>();
    if (categoryDetails.length > 0 && productsWithCategories) {
      const prodToCat = new Map<string, string>();
      for (const p of productsWithCategories) {
        const catName = p.categories ? (p.categories as any).name : 'Khác';
        prodToCat.set(p.id, catName);
      }
      for (const d of categoryDetails) {
        const catName = prodToCat.get(d.product_id) || 'Khác';
        categorySalesMap.set(catName, (categorySalesMap.get(catName) || 0) + Number(d.subtotal || 0));
      }
    }
    const category_sales = Array.from(categorySalesMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Payments
    const paymentStats = { cash: 0, transfer: 0, card: 0 };
    const paymentCounts = { cash: 0, transfer: 0, card: 0 };
    const payments = paymentsStatsResult.data || [];
    for (const p of payments) {
      const method = p.method === 'transfer' || p.method === 'momo' || p.method === 'zalopay' 
        ? 'transfer' 
        : p.method === 'card' 
          ? 'card' 
          : 'cash';
      paymentStats[method] += Number(p.amount || 0);
      paymentCounts[method] += 1;
    }
    const totalPaymentCount = paymentCounts.cash + paymentCounts.transfer + paymentCounts.card || 1;
    const payment_stats = [
      { name: 'Tiền mặt', percentage: Math.round((paymentCounts.cash / totalPaymentCount) * 1000) / 10, count: paymentCounts.cash, amount: paymentStats.cash },
      { name: 'Chuyển khoản/Ví điện tử', percentage: Math.round((paymentCounts.transfer / totalPaymentCount) * 1000) / 10, count: paymentCounts.transfer, amount: paymentStats.transfer },
      { name: 'Thẻ', percentage: Math.round((paymentCounts.card / totalPaymentCount) * 1000) / 10, count: paymentCounts.card, amount: paymentStats.card },
    ];

    // ═══════════════════════════════════════════════════════════════════
    //  ADVANCED ANALYTICS COMPUTATION
    // ═══════════════════════════════════════════════════════════════════

    // Basic aggregates
    const totalRevenue = revenueTrend.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = revenueTrend.reduce((sum, item) => sum + item.orders, 0);
    const totalCogs = revenueTrend.reduce((sum, item) => sum + (item.cogs || 0), 0);
    const totalProfit = revenueTrend.reduce((sum, item) => sum + (item.profit || 0), 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const averageOrderVal = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const cogsRatio = totalRevenue > 0 ? (totalCogs / totalRevenue) * 100 : 0;

    // Revenue days analysis
    const activeDays = revenueTrend.filter(d => d.revenue > 0);
    const zeroDays = revenueTrend.filter(d => d.revenue === 0);
    const avgDailyRevenue = activeDays.length > 0 ? totalRevenue / activeDays.length : 0;
    const avgDailyOrders = activeDays.length > 0 ? totalOrders / activeDays.length : 0;

    // Peak & trough analysis
    const peakDay = activeDays.length > 0 ? activeDays.reduce((max, d) => d.revenue > max.revenue ? d : max, activeDays[0]) : null;
    const troughDay = activeDays.length > 0 ? activeDays.reduce((min, d) => d.revenue < min.revenue ? d : min, activeDays[0]) : null;
    const revenueVolatility = activeDays.length > 1
      ? Math.sqrt(activeDays.reduce((sum, d) => sum + Math.pow(d.revenue - avgDailyRevenue, 2), 0) / activeDays.length) / avgDailyRevenue * 100
      : 0;

    // Week-over-week growth (last 7 active days vs prior 7 active days)
    const recent7 = activeDays.slice(-7);
    const prior7 = activeDays.slice(-14, -7);
    const recent7Revenue = recent7.reduce((s, d) => s + d.revenue, 0);
    const prior7Revenue = prior7.reduce((s, d) => s + d.revenue, 0);
    const wowGrowth = prior7Revenue > 0 ? ((recent7Revenue - prior7Revenue) / prior7Revenue * 100) : null;

    // Category concentration (Herfindahl-like)
    const catShares = category_sales.map(c => ({
      name: c.name,
      value: c.value,
      share: totalRevenue > 0 ? (c.value / totalRevenue * 100) : 0
    }));
    const herfindahl = catShares.reduce((sum, c) => sum + Math.pow(c.share / 100, 2), 0);
    const concentrationRisk = herfindahl > 0.5 ? 'Rất cao' : herfindahl > 0.3 ? 'Cao' : herfindahl > 0.2 ? 'Trung bình' : 'Thấp';

    // Top product concentration
    const top2Revenue = topProductsRaw.slice(0, 2).reduce((s, p) => s + p.revenue, 0);
    const top2Share = totalRevenue > 0 ? (top2Revenue / totalRevenue * 100) : 0;

    // Formatting helpers
    const money = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')} VND`;
    const pct = (value: number) => `${value.toFixed(1)}%`;
    const fmtDate = (d: string) => d.split('-').reverse().join('/');

    // ═══════════════════════════════════════════════════════════════════
    //  CONSTRUCT DATA BLOCKS FOR PROMPT
    // ═══════════════════════════════════════════════════════════════════

    const topProductsList = topProductsRaw.slice(0, 5).map((p, idx) => {
      const share = totalRevenue > 0 ? (p.revenue / totalRevenue * 100).toFixed(1) : '0';
      return `  ${idx + 1}. ${p.product_name}\n     ├─ Doanh thu: ${money(p.revenue)} (chiếm ${share}% tổng DT)\n     └─ Sản lượng: ${p.quantity} đơn vị`;
    }).join('\n') || '  Không có sản phẩm nào bán ra trong kỳ.';

    const categorySalesList = catShares.map(c =>
      `  • ${c.name}: ${money(c.value)} — chiếm ${pct(c.share)} tổng doanh thu`
    ).join('\n') || '  Chưa phát sinh doanh thu theo danh mục.';

    const paymentStatsList = payment_stats.map(p =>
      `  • ${p.name}: ${pct(p.percentage)} (${p.count} giao dịch, tổng ${money(p.amount)})`
    ).join('\n');

    const recentRevenueTrend = revenueTrend.length > 14 ? revenueTrend.slice(-14) : revenueTrend;
    const revenueTrendList = recentRevenueTrend.map(r => {
      const dayMargin = r.revenue > 0 ? ((r.profit || 0) / r.revenue * 100).toFixed(1) : '—';
      return `  ${fmtDate(r.date)}: DT ${money(r.revenue)} | LN ${money(r.profit)} | Margin ${dayMargin}% | ${r.orders} đơn`;
    }).join('\n');

    // ═══════════════════════════════════════════════════════════════════
    //  SYSTEM INSTRUCTION — Enterprise Financial Analyst
    // ═══════════════════════════════════════════════════════════════════

    if (!env.groqApiKey) {
      throw new AppError(400, 'Groq API Key chưa được cấu hình ở Backend');
    }

    const systemInstruction = `Bạn là Trưởng phòng Kiểm soát Tài chính (Financial Controller) tại một tập đoàn bán lẻ, với 15+ năm kinh nghiệm phân tích P&L, quản trị doanh thu và tối ưu vận hành cửa hàng.

PHONG CÁCH PHÂN TÍCH:
- Sử dụng ngôn ngữ chuyên nghiệp, mang tính doanh nghiệp — như đang viết báo cáo trình Ban Giám đốc
- Mỗi nhận định PHẢI kèm theo số liệu chính xác + so sánh tương đối (%, lần, tỉ lệ)
- Phân tích nguyên nhân gốc rễ (root cause), không chỉ mô tả hiện tượng bề mặt
- Recommendations phải khả thi, có timeline, KPI đo lường và mức độ ưu tiên
- Sử dụng thuật ngữ tài chính chuẩn: COGS, Gross Margin, AOV, Revenue Mix, Concentration Risk, WoW Growth, Volatility
- KHÔNG sử dụng ngôn ngữ AI/chatbot ("Tôi sẽ phân tích...", "Chúng ta hãy xem...")
- Viết trực tiếp, đi thẳng vào vấn đề như một CFO

BẮT BUỘC trả về JSON hợp lệ (không markdown, không \`\`\`json). Chỉ MỘT JSON object duy nhất.

Cấu trúc JSON:
{
  "health_score": 72,
  "summary": "<Bản tóm tắt điều hành 4-6 câu. Mở đầu bằng đánh giá tổng thể ('Hiệu quả kinh doanh kỳ này ở mức...'), tiếp theo là 2-3 chỉ số tài chính cốt lõi, và kết bằng đánh giá xu hướng + rủi ro chính cần lưu ý.>",
  "insights": [
    "<Phân tích 1 — HIỆU SUẤT DOANH THU: Đánh giá tổng doanh thu vs benchmark ngành bán lẻ, phân tích biến động theo ngày (volatility), xác định ngày peak/trough và nguyên nhân tiềm năng. Nếu có ngày doanh thu = 0, phân tích tác động.>",
    "<Phân tích 2 — CƠ CẤU SẢN PHẨM & REVENUE MIX: Đánh giá mức độ tập trung doanh thu (concentration risk), tỉ trọng đóng góp của top sản phẩm, phân tích danh mục nào đang 'gánh' doanh thu và danh mục nào underperform.>",
    "<Phân tích 3 — BIÊN LỢI NHUẬN & HIỆU QUẢ CHI PHÍ: Phân tích Gross Margin so với chuẩn ngành (25-35% cho bán lẻ F&B), đánh giá COGS ratio, xác định sản phẩm/danh mục nào có margin cao/thấp nhất, cơ hội tối ưu.>",
    "<Phân tích 4 — HÀNH VI KHÁCH HÀNG & THANH TOÁN: Phân tích AOV, tần suất đơn hàng, tỉ lệ thanh toán số vs tiền mặt, xu hướng chuyển đổi digital payment, rủi ro quản lý tiền mặt.>",
    "<Phân tích 5 — RỦI RO & CƠ HỘI: Xác định 2-3 rủi ro kinh doanh cụ thể (ví dụ: phụ thuộc vào 1-2 sản phẩm, ngày không phát sinh doanh thu, margin bị ép). Đề xuất cơ hội tăng trưởng bị bỏ lỡ.>"
  ],
  "recommendations": [
    "<HÀNH ĐỘNG 1 — TĂNG TRƯỞNG DOANH THU [Ưu tiên: CAO]: Chiến lược cụ thể (sản phẩm/danh mục nào, cách triển khai, timeline 2-4 tuần). KPI mục tiêu: tăng X% doanh thu trong 30 ngày tới.>",
    "<HÀNH ĐỘNG 2 — TỐI ƯU CHI PHÍ & MARGIN [Ưu tiên: CAO]: Giải pháp cải thiện biên lợi nhuận — đàm phán giá vốn, điều chỉnh pricing, cắt giảm sản phẩm margin thấp. KPI mục tiêu: cải thiện Gross Margin thêm X điểm %.>",
    "<HÀNH ĐỘNG 3 — ĐA DẠNG HÓA & GIẢM RỦI RO [Ưu tiên: TRUNG BÌNH]: Chiến lược giảm concentration risk, phát triển danh mục mới, cross-sell/upsell. KPI mục tiêu: giảm tỉ trọng top 2 sản phẩm xuống dưới X%.>",
    "<HÀNH ĐỘNG 4 — VẬN HÀNH & TRẢI NGHIỆM [Ưu tiên: TRUNG BÌNH]: Cải thiện tần suất bán hàng (giảm ngày trống), tối ưu thanh toán số, tăng giờ hoạt động hoặc kênh bán. KPI mục tiêu.>",
    "<HÀNH ĐỘNG 5 — CHIẾN LƯỢC TRUNG HẠN [Ưu tiên: DÀI HẠN]: Kế hoạch 60-90 ngày cho phát triển sản phẩm, mở rộng tệp khách hàng, loyalty program. KPI mục tiêu.>"
  ],
  "charts": [
    {
      "title": "Cơ cấu doanh thu theo danh mục",
      "type": "pie",
      "data": [{ "name": "Danh mục 1", "value": 5000000 }, { "name": "Danh mục 2", "value": 3000000 }]
    },
    {
      "title": "Biến động doanh thu theo ngày",
      "type": "bar",
      "data": [{ "name": "01/06", "value": 1500000 }]
    },
    {
      "title": "Lợi nhuận gộp theo ngày (VND)",
      "type": "line",
      "data": [{ "name": "01/06", "value": 450000 }]
    },
    {
      "title": "Top 5 sản phẩm theo doanh thu",
      "type": "bar",
      "data": [{ "name": "Sản phẩm A", "value": 3000000 }]
    },
    {
      "title": "Cơ cấu phương thức thanh toán",
      "type": "pie",
      "data": [{ "name": "Tiền mặt", "value": 45 }, { "name": "Thanh toán điện tử", "value": 40 }]
    }
  ]
}

QUY TẮC BẮT BUỘC:
1. CHÍNH XÁC 5 biểu đồ theo đúng thứ tự và loại trên. Dữ liệu biểu đồ PHẢI dùng số thực tế, KHÔNG bịa.
2. health_score: 0-100 — Đánh giá khách quan dựa trên: margin (30%), tăng trưởng (25%), ổn định (20%), đa dạng hóa (15%), vận hành (10%).
3. Insights: Đủ 5 mục, mỗi mục 3-5 câu phân tích sâu, PHẢI có số liệu cụ thể.
4. Recommendations: Đủ 5 mục, mỗi mục có [Ưu tiên], hành động cụ thể, và KPI đo lường.
5. Ngôn ngữ: Chuyên nghiệp, trang trọng, như báo cáo trình hội đồng quản trị.
6. QUAN TRỌNG: Biểu đồ #3 "Lợi nhuận gộp theo ngày" — value PHẢI là số tiền VND tuyệt đối (ví dụ: 450000, 1200000), KHÔNG PHẢI tỉ lệ phần trăm. Lấy từ dữ liệu "LN" (lợi nhuận) trong mục VI.`;

    const userPrompt = `BÁO CÁO PHÂN TÍCH HIỆU QUẢ KINH DOANH — KỲ ${days} NGÀY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I. TÓM TẮT TÀI CHÍNH (P&L SUMMARY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Doanh thu thuần (Net Revenue):     ${money(totalRevenue)}
  Giá vốn hàng bán (COGS):          ${money(totalCogs)}  [COGS Ratio: ${pct(cogsRatio)}]
  Lợi nhuận gộp (Gross Profit):     ${money(totalProfit)}
  Biên lợi nhuận gộp (Gross Margin): ${pct(profitMargin)}
  Tổng đơn hàng:                     ${totalOrders} đơn
  Giá trị TB/đơn (AOV):             ${money(averageOrderVal)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
II. CHỈ SỐ VẬN HÀNH NÂNG CAO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Số ngày hoạt động:        ${activeDays.length}/${days} ngày (${(activeDays.length / days * 100).toFixed(0)}%)
  Số ngày không có doanh thu: ${zeroDays.length} ngày${zeroDays.length > 0 ? ` [⚠ Cảnh báo: mất ${pct(zeroDays.length / days * 100)} thời gian kinh doanh]` : ''}
  Doanh thu TB/ngày hoạt động: ${money(avgDailyRevenue)}
  Đơn hàng TB/ngày hoạt động: ${avgDailyOrders.toFixed(1)} đơn
  Biến động doanh thu (Volatility): ${pct(revenueVolatility)}${revenueVolatility > 50 ? ' [⚠ Biến động cao]' : revenueVolatility > 30 ? ' [Biến động trung bình]' : ' [Ổn định]'}
${peakDay ? `  Ngày doanh thu cao nhất: ${fmtDate(peakDay.date)} — ${money(peakDay.revenue)} (${peakDay.orders} đơn)` : ''}
${troughDay && troughDay !== peakDay ? `  Ngày doanh thu thấp nhất: ${fmtDate(troughDay.date)} — ${money(troughDay.revenue)} (${troughDay.orders} đơn)` : ''}
${wowGrowth !== null ? `  Tăng trưởng WoW (7 ngày gần nhất vs 7 ngày trước): ${wowGrowth >= 0 ? '+' : ''}${pct(wowGrowth)}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
III. TOP 5 SẢN PHẨM BÁN CHẠY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${topProductsList}
  ─── Rủi ro tập trung: Top 2 sản phẩm chiếm ${pct(top2Share)} tổng doanh thu [Mức độ: ${top2Share > 60 ? '⚠ CAO' : top2Share > 40 ? 'TRUNG BÌNH' : 'THẤP'}]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IV. CƠ CẤU DOANH THU THEO DANH MỤC (REVENUE MIX)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${categorySalesList}
  ─── Chỉ số tập trung danh mục (HHI): ${(herfindahl * 10000).toFixed(0)} điểm [Mức độ rủi ro: ${concentrationRisk}]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
V. CƠ CẤU THANH TOÁN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${paymentStatsList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VI. DỮ LIỆU DOANH THU & LỢI NHUẬN HÀNG NGÀY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${revenueTrendList}

Phân tích toàn diện dữ liệu trên và trả về JSON theo cấu trúc yêu cầu. Đảm bảo health_score phản ánh khách quan, insights phân tích sâu với root cause, recommendations khả thi với KPI cụ thể, và biểu đồ dùng đúng số liệu thực tế.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new AppError(500, `Lỗi khi gọi Groq API: ${errText}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const analysisResult = data.choices?.[0]?.message?.content?.trim();
    if (!analysisResult) {
      throw new AppError(500, 'Không nhận được kết quả phân tích từ Groq API');
    }

    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysisResult);
    } catch (error) {
      console.error('Lỗi parse JSON từ AI:', analysisResult);
      throw new AppError(500, 'AI trả về dữ liệu không đúng định dạng JSON');
    }

    const generatedAt = new Date().toISOString();
    const metricsSnapshot = {
      revenue: revenueTrend,
      top_products: topProductsRaw,
      category_sales,
      payment_stats,
      totals: {
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        total_cogs: totalCogs,
        total_profit: totalProfit,
        profit_margin: Number(profitMargin.toFixed(2)),
        average_order_value: Number(averageOrderVal.toFixed(2)),
        cogs_ratio: Number(cogsRatio.toFixed(2)),
        active_days: activeDays.length,
        zero_days: zeroDays.length,
        avg_daily_revenue: Number(avgDailyRevenue.toFixed(2)),
        avg_daily_orders: Number(avgDailyOrders.toFixed(2)),
        revenue_volatility: Number(revenueVolatility.toFixed(2)),
        wow_growth: wowGrowth === null ? null : Number(wowGrowth.toFixed(2)),
        top2_share: Number(top2Share.toFixed(2)),
      },
      generated_at: generatedAt,
    };

    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_revenue_analyses')
      .insert({
        days,
        period_start: getLocalDateString(rangeDaysAgo),
        period_end: getLocalDateString(today),
        health_score: typeof parsedAnalysis.health_score === 'number' ? parsedAnalysis.health_score : null,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        total_cogs: totalCogs,
        total_profit: totalProfit,
        profit_margin: Number(profitMargin.toFixed(2)),
        average_order_value: Number(averageOrderVal.toFixed(2)),
        analysis: parsedAnalysis,
        metrics_snapshot: metricsSnapshot,
        generated_by: generatedBy || null,
        generated_at: generatedAt,
      })
      .select('id, days, period_start, period_end, health_score, total_revenue, total_orders, total_profit, profit_margin, generated_at, generated_by')
      .single();

    if (saveError) {
      if (saveError.message.includes('ai_revenue_analyses')) {
        throw new AppError(500, 'Chưa chạy migration bảng ai_revenue_analyses trong database/schema.sql');
      }
      throw new AppError(500, saveError.message);
    }

    return {
      analysis: parsedAnalysis,
      generated_at: generatedAt,
      days,
      saved_report: savedAnalysis
    };
  }

  static async aiAnalysisHistory(queryParams: AnalysisHistoryQuery) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('ai_revenue_analyses')
      .select('id, days, period_start, period_end, health_score, total_revenue, total_orders, total_profit, profit_margin, generated_at, generated_by, users:generated_by(full_name, email)', { count: 'exact' })
      .order('generated_at', { ascending: false })
      .range(from, to);

    if (queryParams.days) query = query.eq('days', Number(queryParams.days));
    if (queryParams.date_from) query = query.gte('period_start', String(queryParams.date_from));
    if (queryParams.date_to) query = query.lte('period_end', String(queryParams.date_to));

    const { data, error, count } = await query;
    if (error) {
      if (error.message.includes('ai_revenue_analyses')) {
        throw new AppError(500, 'Chưa chạy migration bảng ai_revenue_analyses trong database/schema.sql');
      }
      throw new AppError(500, error.message);
    }

    return {
      items: (data || []).map((item: any) => ({
        id: item.id,
        days: item.days,
        period_start: item.period_start,
        period_end: item.period_end,
        health_score: item.health_score,
        total_revenue: Number(item.total_revenue || 0),
        total_orders: Number(item.total_orders || 0),
        total_profit: Number(item.total_profit || 0),
        profit_margin: Number(item.profit_margin || 0),
        generated_at: item.generated_at,
        generated_by: item.generated_by,
        generated_by_user: item.users || null,
      })),
      pagination: { page, limit, total: count || 0 },
    };
  }

  static async aiAnalysisDetail(id: string) {
    const { data, error } = await supabase
      .from('ai_revenue_analyses')
      .select('*, users:generated_by(full_name, email)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new AppError(404, 'Không tìm thấy bản phân tích doanh thu');
      throw new AppError(500, error.message);
    }

    return {
      ...data,
      total_revenue: Number(data.total_revenue || 0),
      total_orders: Number(data.total_orders || 0),
      total_cogs: Number(data.total_cogs || 0),
      total_profit: Number(data.total_profit || 0),
      profit_margin: Number(data.profit_margin || 0),
      average_order_value: Number(data.average_order_value || 0),
      generated_by_user: data.users || null,
      users: undefined,
    };
  }

  static async deleteAiAnalysis(id: string) {
    const { error } = await supabase
      .from('ai_revenue_analyses')
      .delete()
      .eq('id', id);

    if (error) throw new AppError(500, error.message);
    return { id };
  }

  /** Build inventory intelligence metrics (deterministic — charts/tables use this). */
  private static async buildInventoryMetrics(days: number) {
    const targetDays = 14;
    const today = startOfDay();
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    const midStart = new Date(today);
    midStart.setDate(midStart.getDate() - Math.floor(days / 2));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [productsRes, ordersRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, sku, unit, stock_quantity, min_stock_level, cost_price, sell_price, categories(id, name), suppliers(id, name)')
        .eq('is_active', true),
      supabase
        .from('orders')
        .select('id, created_at')
        .eq('status', 'completed')
        .gte('created_at', rangeStart.toISOString())
        .lt('created_at', tomorrow.toISOString()),
    ]);

    if (productsRes.error) throw new AppError(500, productsRes.error.message);
    if (ordersRes.error) throw new AppError(500, ordersRes.error.message);

    const products = productsRes.data || [];
    const orders = ordersRes.data || [];
    const orderIds = orders.map((o) => o.id);
    const midIso = midStart.toISOString();

    let details: Array<{ order_id: string; product_id: string; quantity: number; subtotal: number; product_name?: string }> = [];
    if (orderIds.length > 0) {
      // Chunk to avoid URL length limits
      const chunkSize = 200;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('order_details')
          .select('order_id, product_id, quantity, subtotal, product_name')
          .in('order_id', chunk);
        if (error) throw new AppError(500, error.message);
        details = details.concat(data || []);
      }
    }

    const orderCreatedAt = new Map(orders.map((o) => [o.id, o.created_at as string]));
    type SalesAgg = { qty: number; revenue: number; qtyRecent: number; qtyPrior: number };
    const salesMap = new Map<string, SalesAgg>();

    for (const d of details) {
      const created = orderCreatedAt.get(d.order_id) || '';
      const qty = Number(d.quantity || 0);
      const rev = Number(d.subtotal || 0);
      const cur = salesMap.get(d.product_id) || { qty: 0, revenue: 0, qtyRecent: 0, qtyPrior: 0 };
      cur.qty += qty;
      cur.revenue += rev;
      if (created >= midIso) cur.qtyRecent += qty;
      else cur.qtyPrior += qty;
      salesMap.set(d.product_id, cur);
    }

    const periodDays = Math.max(days, 1);
    const halfDays = Math.max(Math.floor(days / 2), 1);

    type SkuRow = {
      id: string;
      name: string;
      sku: string;
      unit: string;
      stock_quantity: number;
      min_stock_level: number;
      cost_price: number;
      sell_price: number;
      category: string;
      supplier: string;
      stock_value: number;
      retail_value: number;
      sold_qty: number;
      sold_revenue: number;
      avg_daily_sales: number;
      sales_speed_recent: number;
      sales_trend: 'up' | 'down' | 'stable';
      stock_days: number | null;
      recommended_qty: number;
      restock_cost: number;
      status: 'out_of_stock' | 'low_stock' | 'needs_restock' | 'dead_stock' | 'overstock' | 'healthy';
      priority: 'critical' | 'high' | 'medium' | 'low';
    };

    const rows: SkuRow[] = [];
    let outOfStock = 0;
    let lowStock = 0;
    let safe = 0;
    let needsRestock = 0;
    let deadStock = 0;
    let overstock = 0;
    let totalStockValue = 0;
    let totalRetailValue = 0;
    let estimatedRestockCost = 0;
    let estimatedLostRevenue = 0;

    const categoryMap = new Map<string, { name: string; product_count: number; low_count: number; stock_value: number; sold_qty: number }>();

    for (const p of products) {
      const stock = Number(p.stock_quantity || 0);
      const minStock = Number(p.min_stock_level || 0);
      const cost = Number(p.cost_price || 0);
      const sell = Number(p.sell_price || 0);
      const stockValue = stock * cost;
      const retailValue = stock * sell;
      totalStockValue += stockValue;
      totalRetailValue += retailValue;

      const sales = salesMap.get(p.id) || { qty: 0, revenue: 0, qtyRecent: 0, qtyPrior: 0 };
      const avgDaily = sales.qty / periodDays;
      const speedRecent = sales.qtyRecent / halfDays;
      const speedPrior = sales.qtyPrior / halfDays;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (speedPrior > 0.05) {
        const change = (speedRecent - speedPrior) / speedPrior;
        if (change >= 0.2) trend = 'up';
        else if (change <= -0.2) trend = 'down';
      } else if (speedRecent > 0.2) {
        trend = 'up';
      }

      const stockDays = avgDaily > 0 ? Math.round((stock / avgDaily) * 10) / 10 : null;
      const targetStock = Math.ceil(avgDaily * targetDays);
      const recommendedQty = Math.max(0, Math.max(minStock, targetStock) - stock);
      const restockCost = recommendedQty * cost;

      let status: SkuRow['status'] = 'healthy';
      let priority: SkuRow['priority'] = 'low';

      if (stock <= 0) {
        status = 'out_of_stock';
        priority = 'critical';
        outOfStock += 1;
        if (avgDaily > 0) estimatedLostRevenue += avgDaily * sell * Math.min(7, days);
      } else if (stock <= minStock) {
        status = 'low_stock';
        priority = avgDaily > 0.5 || trend === 'up' ? 'high' : 'medium';
        lowStock += 1;
      } else if (stockDays !== null && stockDays <= targetDays && avgDaily > 0) {
        status = 'needs_restock';
        priority = stockDays <= 5 ? 'high' : 'medium';
        needsRestock += 1;
      } else if (avgDaily === 0 && stock > 0 && stockValue > 0) {
        status = 'dead_stock';
        priority = stockValue >= 500_000 ? 'medium' : 'low';
        deadStock += 1;
      } else if (stockDays !== null && stockDays > targetDays * 3 && stock > minStock * 2) {
        status = 'overstock';
        priority = 'low';
        overstock += 1;
        safe += 1;
      } else {
        safe += 1;
      }

      estimatedRestockCost += restockCost;

      const catName = (p as any).categories?.name || 'Chưa phân loại';
      const catId = (p as any).categories?.id || 'uncategorized';
      const cat = categoryMap.get(catId) || { name: catName, product_count: 0, low_count: 0, stock_value: 0, sold_qty: 0 };
      cat.product_count += 1;
      cat.stock_value += stockValue;
      cat.sold_qty += sales.qty;
      if (status === 'out_of_stock' || status === 'low_stock' || status === 'needs_restock') cat.low_count += 1;
      categoryMap.set(catId, cat);

      rows.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit || 'cái',
        stock_quantity: stock,
        min_stock_level: minStock,
        cost_price: cost,
        sell_price: sell,
        category: catName,
        supplier: (p as any).suppliers?.name || '—',
        stock_value: Math.round(stockValue),
        retail_value: Math.round(retailValue),
        sold_qty: sales.qty,
        sold_revenue: Math.round(sales.revenue),
        avg_daily_sales: Math.round(avgDaily * 100) / 100,
        sales_speed_recent: Math.round(speedRecent * 100) / 100,
        sales_trend: trend,
        stock_days: stockDays,
        recommended_qty: recommendedQty,
        restock_cost: Math.round(restockCost),
        status,
        priority,
      });
    }

    const priorityWeight = { critical: 0, high: 1, medium: 2, low: 3 };
    const restockPlan = rows
      .filter((r) => r.recommended_qty > 0 && (r.status === 'out_of_stock' || r.status === 'low_stock' || r.status === 'needs_restock'))
      .sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || b.avg_daily_sales - a.avg_daily_sales)
      .slice(0, 20);

    const deadStockList = rows
      .filter((r) => r.status === 'dead_stock')
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 15);

    const risingDemand = rows
      .filter((r) => r.sales_trend === 'up' && r.sold_qty > 0)
      .sort((a, b) => b.sales_speed_recent - a.sales_speed_recent)
      .slice(0, 12);

    const fallingDemand = rows
      .filter((r) => r.sales_trend === 'down' && r.sold_qty > 0)
      .sort((a, b) => a.sales_speed_recent - b.sales_speed_recent)
      .slice(0, 10);

    const topValue = [...rows].sort((a, b) => b.stock_value - a.stock_value).slice(0, 10);
    const mismatch = rows
      .filter((r) => r.sales_trend === 'up' && (r.status === 'out_of_stock' || r.status === 'low_stock' || r.status === 'needs_restock'))
      .sort((a, b) => b.avg_daily_sales - a.avg_daily_sales)
      .slice(0, 10);

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        product_count: v.product_count,
        low_count: v.low_count,
        stock_value: Math.round(v.stock_value),
        sold_qty: v.sold_qty,
      }))
      .sort((a, b) => b.stock_value - a.stock_value);

    const totalProducts = products.length || 1;
    const availabilityScore = Math.max(0, 100 - (outOfStock / totalProducts) * 50 - (lowStock / totalProducts) * 30);
    const capitalScore = totalStockValue > 0
      ? Math.max(0, 100 - (deadStockList.reduce((s, r) => s + r.stock_value, 0) / totalStockValue) * 100)
      : 70;
    const turnoverScore = rows.filter((r) => r.sold_qty > 0).length / totalProducts * 100;
    const mismatchPenalty = Math.min(30, mismatch.length * 4);
    const healthScore = Math.round(
      Math.min(100, Math.max(0, availabilityScore * 0.4 + capitalScore * 0.25 + turnoverScore * 0.25 + (100 - mismatchPenalty) * 0.1))
    );

    const statusDistribution = [
      { name: 'Hết hàng', value: outOfStock, key: 'out_of_stock' },
      { name: 'Tồn thấp', value: lowStock, key: 'low_stock' },
      { name: 'Sắp thiếu', value: needsRestock, key: 'needs_restock' },
      { name: 'Hàng tồn lâu', value: deadStock, key: 'dead_stock' },
      { name: 'An toàn', value: Math.max(0, safe - overstock), key: 'healthy' },
    ].filter((x) => x.value > 0);

    return {
      days,
      target_days: targetDays,
      period_start: getLocalDateString(rangeStart),
      period_end: getLocalDateString(today),
      kpis: {
        total_products: products.length,
        out_of_stock: outOfStock,
        low_stock: lowStock,
        needs_restock: needsRestock,
        dead_stock: deadStock,
        overstock,
        safe: Math.max(0, safe - overstock),
        total_stock_value: Math.round(totalStockValue),
        total_retail_value: Math.round(totalRetailValue),
        estimated_restock_cost: Math.round(estimatedRestockCost),
        estimated_lost_revenue_7d: Math.round(estimatedLostRevenue),
        health_score: healthScore,
        score_breakdown: {
          availability: Math.round(availabilityScore),
          capital_efficiency: Math.round(capitalScore),
          turnover: Math.round(turnoverScore),
        },
      },
      status_distribution: statusDistribution,
      category_breakdown: categoryBreakdown,
      restock_plan: restockPlan,
      dead_stock: deadStockList,
      rising_demand: risingDemand,
      falling_demand: fallingDemand,
      top_stock_value: topValue,
      demand_mismatch: mismatch,
    };
  }

  private static buildInventoryCharts(metrics: Awaited<ReturnType<typeof ReportService.buildInventoryMetrics>>) {
    return [
      {
        title: 'Phân bố trạng thái tồn kho',
        type: 'pie' as const,
        data: metrics.status_distribution.map((s) => ({ name: s.name, value: s.value })),
      },
      {
        title: 'Giá trị tồn theo danh mục (vốn)',
        type: 'bar' as const,
        data: metrics.category_breakdown.slice(0, 8).map((c) => ({ name: c.name, value: c.stock_value })),
      },
      {
        title: 'Top vốn tồn lâu',
        type: 'bar' as const,
        data: metrics.dead_stock.slice(0, 8).map((r) => ({ name: r.name.slice(0, 18), value: r.stock_value })),
      },
      {
        title: 'Nhu cầu tăng — tốc độ bán/ngày (nửa kỳ gần)',
        type: 'bar' as const,
        data: metrics.rising_demand.slice(0, 8).map((r) => ({ name: r.name.slice(0, 18), value: r.sales_speed_recent })),
      },
      {
        title: 'Kế hoạch nhập — chi phí ước tính',
        type: 'bar' as const,
        data: metrics.restock_plan.slice(0, 8).map((r) => ({ name: r.name.slice(0, 18), value: r.restock_cost })),
      },
    ];
  }

  private static buildLocalInventoryNarrative(metrics: Awaited<ReturnType<typeof ReportService.buildInventoryMetrics>>) {
    const k = metrics.kpis;
    const money = (v: number) => `${Math.round(v).toLocaleString('vi-VN')}đ`;
    const summary =
      `Sức khỏe kho ${k.health_score}/100. ` +
      `${k.out_of_stock} SKU hết hàng, ${k.low_stock} tồn thấp, ${k.needs_restock} sắp thiếu theo ${metrics.target_days} ngày cover. ` +
      `Giá trị tồn (vốn) ${money(k.total_stock_value)}; vốn dead stock ~${money(metrics.dead_stock.reduce((s, r) => s + r.stock_value, 0))}. ` +
      `Ước tính chi phí nhập ưu tiên ${money(k.estimated_restock_cost)}` +
      (k.estimated_lost_revenue_7d > 0 ? `; rủi ro mất DT ~${money(k.estimated_lost_revenue_7d)}/7 ngày nếu không nhập.` : '.');

    const insights = [
      `Khả dụng: ${k.out_of_stock + k.low_stock}/${k.total_products} SKU dưới ngưỡng an toàn (điểm availability ${k.score_breakdown.availability}).`,
      `Vốn: ${money(k.total_stock_value)} giá vốn / ${money(k.total_retail_value)} bán lẻ — hiệu quả vốn ${k.score_breakdown.capital_efficiency}/100.`,
      `Nhu cầu: ${metrics.rising_demand.length} SKU tăng tốc, ${metrics.demand_mismatch.length} SKU vừa tăng cầu vừa thiếu hàng.`,
      `Hàng tồn lâu: ${k.dead_stock} SKU không bán trong ${metrics.days} ngày — ưu tiên xả hàng, tạo combo hoặc ngừng nhập.`,
    ];

    const recommendations = [
      `[CAO] Nhập gấp ${metrics.restock_plan.filter((r) => r.priority === 'critical' || r.priority === 'high').length} SKU ưu tiên cao — chi phí ~${money(metrics.restock_plan.filter((r) => r.priority === 'critical' || r.priority === 'high').reduce((s, r) => s + r.restock_cost, 0))}.`,
      `[CAO] Xử lý ${metrics.demand_mismatch.length} SKU lệch cầu (bán tăng + tồn thấp) trước cuối tuần.`,
      `[TB] Xả hàng hoặc tạo combo cho ${Math.min(5, metrics.dead_stock.length)} SKU tồn lâu có giá trị cao nhất.`,
      `[TB] Rà min_stock theo velocity; target cover ${metrics.target_days} ngày cho nhóm bán chạy.`,
    ];

    return { summary, insights, recommendations };
  }

  static async aiInventoryAnalysis(days = 30, generatedBy?: string) {
    const safeDays = Math.min(Math.max(Number(days) || 30, 7), 90);
    const metrics = await this.buildInventoryMetrics(safeDays);
    const charts = this.buildInventoryCharts(metrics);
    const local = this.buildLocalInventoryNarrative(metrics);
    const money = (v: number) => `${Math.round(v || 0).toLocaleString('vi-VN')} VND`;

    let summary = local.summary;
    let insights = local.insights;
    let recommendations = local.recommendations;
    let aiProvider = 'local';

    if (env.groqApiKey) {
      try {
        const restockLines = metrics.restock_plan.slice(0, 12).map((r, i) =>
          `${i + 1}. ${r.name} | tồn ${r.stock_quantity}/${r.min_stock_level} | bán/ngày ${r.avg_daily_sales} | ${r.sales_trend} | đề xuất +${r.recommended_qty} | ${r.priority} | NCC ${r.supplier}`
        ).join('\n') || 'Không có SKU cần nhập.';

        const deadLines = metrics.dead_stock.slice(0, 8).map((r, i) =>
          `${i + 1}. ${r.name} | tồn ${r.stock_quantity} | vốn ${money(r.stock_value)}`
        ).join('\n') || 'Không có dead stock đáng kể.';

        const riseLines = metrics.rising_demand.slice(0, 8).map((r, i) =>
          `${i + 1}. ${r.name} | tốc độ ${r.sales_speed_recent}/ngày | tồn ${r.stock_quantity} | ${r.status}`
        ).join('\n') || 'Không có tín hiệu tăng mạnh.';

        const systemInstruction = `Bạn là Giám đốc Chuỗi cung ứng (Supply Chain Director) bán lẻ. Viết báo cáo ngắn, chuyên nghiệp, tiếng Việt.
BẮT BUỘC trả về ĐÚNG 1 JSON object (không markdown):
{
  "summary": "3-5 câu tóm tắt điều hành, có số liệu",
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4"],
  "recommendations": ["hành động 1 [Ưu tiên]", "hành động 2", "hành động 3", "hành động 4"]
}
Quy tắc: mỗi insight/recommendation 1-2 câu, có số liệu, actionable. Không bịa SKU ngoài dữ liệu. Không trả charts.`;

        const userPrompt = `BÁO CÁO KHO — ${safeDays} ngày (${metrics.period_start} → ${metrics.period_end})
Health: ${metrics.kpis.health_score}/100 | Availability ${metrics.kpis.score_breakdown.availability} | Capital ${metrics.kpis.score_breakdown.capital_efficiency} | Turnover ${metrics.kpis.score_breakdown.turnover}
SKU: ${metrics.kpis.total_products} | Hết: ${metrics.kpis.out_of_stock} | Thấp: ${metrics.kpis.low_stock} | Sắp thiếu: ${metrics.kpis.needs_restock} | Dead: ${metrics.kpis.dead_stock}
Giá trị vốn: ${money(metrics.kpis.total_stock_value)} | Bán lẻ: ${money(metrics.kpis.total_retail_value)}
Chi phí nhập ưu tiên: ${money(metrics.kpis.estimated_restock_cost)} | Rủi ro mất DT 7d: ${money(metrics.kpis.estimated_lost_revenue_7d)}

RESTOCK TOP:
${restockLines}

DEAD STOCK:
${deadLines}

RISING DEMAND:
${riseLines}

Lệch cầu-tồn: ${metrics.demand_mismatch.length} SKU
Viết summary + 4 insights + 4 recommendations.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 1800,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const raw = data.choices?.[0]?.message?.content?.trim();
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.summary === 'string' && parsed.summary.trim()) summary = parsed.summary.trim();
            if (Array.isArray(parsed.insights) && parsed.insights.length) {
              insights = parsed.insights.map((x: unknown) => String(x)).filter(Boolean).slice(0, 5);
            }
            if (Array.isArray(parsed.recommendations) && parsed.recommendations.length) {
              recommendations = parsed.recommendations.map((x: unknown) => String(x)).filter(Boolean).slice(0, 5);
            }
            aiProvider = 'groq';
          }
        }
      } catch (err) {
        console.error('[aiInventoryAnalysis] Groq fallback to local:', err);
      }
    }

    const analysis = {
      health_score: metrics.kpis.health_score,
      score_breakdown: metrics.kpis.score_breakdown,
      summary,
      insights,
      recommendations,
      charts,
      kpis: metrics.kpis,
      restock_plan: metrics.restock_plan,
      dead_stock: metrics.dead_stock,
      rising_demand: metrics.rising_demand,
      falling_demand: metrics.falling_demand,
      demand_mismatch: metrics.demand_mismatch,
      category_breakdown: metrics.category_breakdown,
      status_distribution: metrics.status_distribution,
      top_stock_value: metrics.top_stock_value,
      target_days: metrics.target_days,
      ai_provider: aiProvider,
    };

    const generatedAt = new Date().toISOString();
    const metricsSnapshot = {
      ...metrics,
      generated_at: generatedAt,
    };

    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_inventory_analyses')
      .insert({
        days: safeDays,
        period_start: metrics.period_start,
        period_end: metrics.period_end,
        health_score: metrics.kpis.health_score,
        total_products: metrics.kpis.total_products,
        out_of_stock_count: metrics.kpis.out_of_stock,
        low_stock_count: metrics.kpis.low_stock,
        safe_count: metrics.kpis.safe,
        total_stock_value: metrics.kpis.total_stock_value,
        total_retail_value: metrics.kpis.total_retail_value,
        estimated_restock_cost: metrics.kpis.estimated_restock_cost,
        analysis,
        metrics_snapshot: metricsSnapshot,
        generated_by: generatedBy || null,
        generated_at: generatedAt,
      })
      .select('id, days, period_start, period_end, health_score, total_products, out_of_stock_count, low_stock_count, safe_count, total_stock_value, total_retail_value, estimated_restock_cost, generated_at, generated_by')
      .single();

    if (saveError) {
      if (saveError.message.includes('ai_inventory_analyses')) {
        // Table missing: still return analysis without history
        console.warn('[aiInventoryAnalysis] table missing, return without save:', saveError.message);
        return {
          analysis,
          generated_at: generatedAt,
          days: safeDays,
          saved_report: null,
          save_warning: 'Chưa chạy migration database/ai_inventory_analyses.sql — không lưu lịch sử',
        };
      }
      throw new AppError(500, saveError.message);
    }

    return {
      analysis,
      generated_at: generatedAt,
      days: safeDays,
      saved_report: savedAnalysis,
    };
  }

  static async aiInventoryHistory(queryParams: AnalysisHistoryQuery) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('ai_inventory_analyses')
      .select('id, days, period_start, period_end, health_score, total_products, out_of_stock_count, low_stock_count, safe_count, total_stock_value, total_retail_value, estimated_restock_cost, generated_at, generated_by, users:generated_by(full_name, email)', { count: 'exact' })
      .order('generated_at', { ascending: false })
      .range(from, to);

    if (queryParams.days) query = query.eq('days', Number(queryParams.days));

    const { data, error, count } = await query;
    if (error) {
      if (error.message.includes('ai_inventory_analyses')) {
        return { items: [], pagination: { page, limit, total: 0 } };
      }
      throw new AppError(500, error.message);
    }

    return {
      items: (data || []).map((item: any) => ({
        id: item.id,
        days: item.days,
        period_start: item.period_start,
        period_end: item.period_end,
        health_score: item.health_score,
        total_products: Number(item.total_products || 0),
        out_of_stock_count: Number(item.out_of_stock_count || 0),
        low_stock_count: Number(item.low_stock_count || 0),
        safe_count: Number(item.safe_count || 0),
        total_stock_value: Number(item.total_stock_value || 0),
        total_retail_value: Number(item.total_retail_value || 0),
        estimated_restock_cost: Number(item.estimated_restock_cost || 0),
        generated_at: item.generated_at,
        generated_by: item.generated_by,
        generated_by_user: item.users || null,
      })),
      pagination: { page, limit, total: count || 0 },
    };
  }

  static async aiInventoryDetail(id: string) {
    const { data, error } = await supabase
      .from('ai_inventory_analyses')
      .select('*, users:generated_by(full_name, email)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new AppError(404, 'Không tìm thấy báo cáo kho AI');
      throw new AppError(500, error.message);
    }

    return {
      ...data,
      total_products: Number(data.total_products || 0),
      out_of_stock_count: Number(data.out_of_stock_count || 0),
      low_stock_count: Number(data.low_stock_count || 0),
      safe_count: Number(data.safe_count || 0),
      total_stock_value: Number(data.total_stock_value || 0),
      total_retail_value: Number(data.total_retail_value || 0),
      estimated_restock_cost: Number(data.estimated_restock_cost || 0),
      generated_by_user: data.users || null,
      users: undefined,
    };
  }

  static async deleteAiInventoryAnalysis(id: string) {
    const { error } = await supabase.from('ai_inventory_analyses').delete().eq('id', id);
    if (error) throw new AppError(500, error.message);
    return { id };
  }
}
