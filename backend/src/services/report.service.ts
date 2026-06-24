import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { env } from '../config/env';

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const getLocalDateString = (dateInput: Date | string) => {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export class ReportService {
  static async dashboard(dateStr?: string, days = 7) {
    const today = dateStr ? new Date(dateStr + 'T00:00:00') : startOfDay();
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
        ? supabase.from('order_details').select('order_id, quantity, products(cost_price)').in('order_id', allCompletedOrderIds)
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
        const costPrice = Number((d.products as any)?.cost_price || 0);
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
      if (method === 'transfer' || method === 'momo' || method === 'zalopay') methodLabel = 'QR Pay';
      else if (method === 'card') methodLabel = 'Thẻ Visa';

      return {
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customers ? (o.customers as any).name : 'Khách lẻ',
        payment_method: methodLabel,
        total_amount: Number(o.final_amount || 0),
        status: o.status === 'completed' ? 'Hoàn thành' : o.status === 'cancelled' ? 'Đã hủy' : 'Hoạt động',
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

    return {
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
        .select('order_id, quantity, products(cost_price)')
        .in('order_id', orderIds);
      if (detailsErr) throw new AppError(500, detailsErr.message);
      details = data || [];
    }

    // Calculate COGS per order
    const orderCogsMap = new Map<string, number>();
    for (const d of details) {
      const costPrice = Number((d.products as any)?.cost_price || 0);
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

  static async aiAnalysis(days = 30) {
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
      { name: 'QR Pay/Chuyển khoản', percentage: Math.round((paymentCounts.transfer / totalPaymentCount) * 1000) / 10, count: paymentCounts.transfer, amount: paymentStats.transfer },
      { name: 'Thẻ', percentage: Math.round((paymentCounts.card / totalPaymentCount) * 1000) / 10, count: paymentCounts.card, amount: paymentStats.card },
    ];

    // Aggregates
    const totalRevenue = revenueTrend.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = revenueTrend.reduce((sum, item) => sum + item.orders, 0);
    const totalCogs = revenueTrend.reduce((sum, item) => sum + (item.cogs || 0), 0);
    const totalProfit = revenueTrend.reduce((sum, item) => sum + (item.profit || 0), 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const averageOrderVal = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Formatting currency for prompt
    const money = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')} VND`;

    // Construct detailed prompt
    const topProductsList = topProductsRaw.map((p, idx) => 
      `- Top ${idx + 1}: ${p.product_name} - Số lượng: ${p.quantity} - Doanh thu: ${money(p.revenue)}`
    ).join('\n') || '- Không có sản phẩm nào bán ra';

    const categorySalesList = category_sales.map((c) => 
      `- ${c.name}: ${money(c.value)}`
    ).join('\n') || '- Chưa có dữ liệu doanh thu danh mục';

    const paymentStatsList = payment_stats.map((p) => 
      `- ${p.name}: Chiếm ${p.percentage}% (${p.count} giao dịch - ${money(p.amount)})`
    ).join('\n');

    const revenueTrendList = revenueTrend.map((r) => 
      `+ Ngày ${r.date.split('-').reverse().join('/')}: Doanh thu: ${money(r.revenue)} | Lợi nhuận: ${money(r.profit)} | Đơn hàng: ${r.orders}`
    ).join('\n');

    if (!env.groqApiKey) {
      throw new AppError(400, 'Groq API Key chưa được cấu hình ở Backend');
    }

    const systemInstruction = `Bạn là Giám đốc Tài chính (CFO) kiêm Chuyên gia Phân tích Dữ liệu Kinh doanh POS chuyên nghiệp. 
Hãy phân tích báo cáo doanh thu và tình hình hoạt động của cửa hàng dựa trên dữ liệu thực tế được cung cấp. Trả lời bằng tiếng Việt.
Sử dụng định dạng Markdown phong phú để trình bày báo cáo chuyên nghiệp. In đậm những con số quan trọng, xu hướng nổi bật.`;

    const userPrompt = `Hãy phân tích báo cáo hoạt động kinh doanh trong ${days} ngày qua với các số liệu thực tế sau:

1. CHỈ SỐ TÀI CHÍNH TỔNG QUAN:
- Tổng doanh thu: ${money(totalRevenue)}
- Tổng giá vốn hàng bán (COGS): ${money(totalCogs)}
- Tổng lợi nhuận gộp: ${money(totalProfit)}
- Tỉ suất lợi nhuận gộp trung bình: ${profitMargin.toFixed(1)}%
- Tổng số đơn hàng: ${totalOrders} đơn
- Giá trị trung bình mỗi đơn hàng (AOV): ${money(averageOrderVal)}

2. TOP SẢN PHẨM BÁN CHẠY NHẤT:
${topProductsList}

3. DOANH THU THEO DANH MỤC SẢN PHẨM:
${categorySalesList}

4. PHƯƠNG THỨC THANH TOÁN:
${paymentStatsList}

5. CHI TIẾT DOANH THU & LỢI NHUẬN HÀNG NGÀY:
${revenueTrendList}

HÃY ĐƯA RA BÁO CÁO PHÂN TÍCH SÂU SẮC BẰNG TIẾNG VIỆT, SỬ DỤNG ĐỊNH DẠNG MARKDOWN RÕ RÀNG VỚI CÁC MỤC SAU:

### 📊 1. Đánh giá Tổng quan Sức khỏe Tài chính
- Nhận định sâu sắc về doanh thu, chi phí vốn và biên lợi nhuận gộp (độ hiệu quả kinh doanh, tỷ suất có đạt kỳ vọng không).
- Đánh giá quy mô đơn hàng (số lượng đơn và giá trị trung bình đơn hàng).

### 📈 2. Phân tích Xuương & Chu kỳ Kinh doanh
- Nhận diện các ngày có doanh thu tăng đột biến hoặc giảm sâu. Phân tích nguyên nhân tiềm ẩn hoặc chu kỳ từ chuỗi số liệu hàng ngày.

### 📦 3. Cơ cấu Sản phẩm & Danh mục Chủ lực
- Nhận xét về nhóm sản phẩm bán chạy nhất và cơ cấu đóng góp doanh thu của các danh mục. Chỉ ra danh mục nào là đóng góp chính hoặc danh mục nào đang yếu cần đẩy mạnh.

### 💳 4. Hành vi Khách hàng & Phương thức Thanh toán
- Phân tích từ cơ cấu thanh toán (Tiền mặt, QR, Thẻ) để tối ưu hóa quy trình thu ngân hoặc đề xuất chương trình thúc đẩy thanh toán không tiền mặt.

### 💡 5. Đề xuất Hành động Chiến lược (Chi tiết & Khả thi)
- Đưa ra ít nhất 3 hành động cụ thể và thiết thực để cải thiện tình hình kinh doanh (ví dụ: tối ưu tồn kho, kích cầu sản phẩm, kiểm soát COGS).

YÊU CẦU TRÌNH BÀY:
- Phân tích sâu sắc, chuyên nghiệp, sử dụng ngôn ngữ kinh tế/kinh doanh thực tế, tránh các lời khuyên chung chung sáo rỗng.
- In đậm các con số quan trọng để dễ theo dõi.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 2000,
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

    return {
      analysis: analysisResult,
      generated_at: new Date().toISOString(),
      days
    };
  }
}
