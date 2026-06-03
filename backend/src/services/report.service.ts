import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const currencyDate = (date: Date) => date.toISOString().slice(0, 10);

export class ReportService {
  static async dashboard(dateStr?: string) {
    const today = dateStr ? new Date(dateStr + 'T00:00:00') : startOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 1. Fetch completed orders for today and yesterday to compute revenue, order count, and growth
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, final_amount, created_at, status')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (ordersError) throw new AppError(500, ordersError.message);

    const todayCompletedOrders = (orders || []).filter(
      (o) => o.status === 'completed' && o.created_at >= today.toISOString()
    );
    const yesterdayCompletedOrders = (orders || []).filter(
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

    // 2. Fetch products sold today vs yesterday (from order_details)
    const todayOrderIds = todayCompletedOrders.map((o) => o.id);
    const yesterdayOrderIds = yesterdayCompletedOrders.map((o) => o.id);
    const allCompletedOrderIds = [...todayOrderIds, ...yesterdayOrderIds];

    let todaySoldProducts = 0;
    let yesterdaySoldProducts = 0;

    if (allCompletedOrderIds.length > 0) {
      const { data: details, error: detailsError } = await supabase
        .from('order_details')
        .select('order_id, quantity')
        .in('order_id', allCompletedOrderIds);

      if (detailsError) throw new AppError(500, detailsError.message);

      if (details) {
        todaySoldProducts = details
          .filter((d) => todayOrderIds.includes(d.order_id))
          .reduce((sum, d) => sum + Number(d.quantity || 0), 0);
        yesterdaySoldProducts = details
          .filter((d) => yesterdayOrderIds.includes(d.order_id))
          .reduce((sum, d) => sum + Number(d.quantity || 0), 0);
      }
    }

    const todaySoldGrowth = yesterdaySoldProducts > 0 
      ? Math.round(((todaySoldProducts - yesterdaySoldProducts) / yesterdaySoldProducts) * 1000) / 10 
      : todaySoldProducts > 0 ? 100 : 0;

    // 3. Fetch low stock alert counts (active and new today)
    const [{ count: lowStockCount }, { count: newLowStockCount }] = await Promise.all([
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
    ]);

    // 4. Fetch 7-day revenue trend
    const revenueTrend = await this.revenue(7, today);

    // 5. Fetch sales by category (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data: sevenDayOrders, error: sevenDayOrdersError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'completed')
      .gte('created_at', sevenDaysAgo.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (sevenDayOrdersError) throw new AppError(500, sevenDayOrdersError.message);
    const sevenDayOrderIds = (sevenDayOrders || []).map((o) => o.id);

    let categorySalesMap = new Map<string, number>();
    if (sevenDayOrderIds.length > 0) {
      const { data: details, error: detailsError } = await supabase
        .from('order_details')
        .select('product_id, subtotal')
        .in('order_id', sevenDayOrderIds);

      if (detailsError) throw new AppError(500, detailsError.message);

      if (details && details.length > 0) {
        const productIds = Array.from(new Set(details.map((d) => d.product_id)));
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, categories(name)')
          .in('id', productIds);

        if (productsError) throw new AppError(500, productsError.message);

        const prodToCat = new Map<string, string>();
        for (const p of products || []) {
          const catName = p.categories ? (p.categories as any).name : 'Khác';
          prodToCat.set(p.id, catName);
        }

        for (const d of details) {
          const catName = prodToCat.get(d.product_id) || 'Khác';
          categorySalesMap.set(catName, (categorySalesMap.get(catName) || 0) + Number(d.subtotal || 0));
        }
      }
    }
    const category_sales = Array.from(categorySalesMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 6. Fetch payment methods statistics (last 7 days)
    const paymentStats = { cash: 0, transfer: 0, card: 0 };
    const paymentCounts = { cash: 0, transfer: 0, card: 0 };
    if (sevenDayOrderIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('order_id, method, amount')
        .in('order_id', sevenDayOrderIds);

      if (paymentsError) throw new AppError(500, paymentsError.message);

      for (const p of payments || []) {
        const method = p.method === 'transfer' || p.method === 'momo' || p.method === 'zalopay' 
          ? 'transfer' 
          : p.method === 'card' 
            ? 'card' 
            : 'cash';

        paymentStats[method] += Number(p.amount || 0);
        paymentCounts[method] += 1;
      }
    }
    const totalPaymentCount = paymentCounts.cash + paymentCounts.transfer + paymentCounts.card || 1;
    const payment_stats = [
      { name: 'Tiền mặt', percentage: Math.round((paymentCounts.cash / totalPaymentCount) * 1000) / 10, count: paymentCounts.cash },
      { name: 'QR', percentage: Math.round((paymentCounts.transfer / totalPaymentCount) * 1000) / 10, count: paymentCounts.transfer },
      { name: 'Thẻ', percentage: Math.round((paymentCounts.card / totalPaymentCount) * 1000) / 10, count: paymentCounts.card },
    ];

    // 7. Fetch recent transactions
    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from('orders')
      .select('id, order_number, final_amount, created_at, status, customers(name)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentOrdersError) throw new AppError(500, recentOrdersError.message);

    const recentOrderIds = (recentOrders || []).map((o) => o.id);
    let recentPaymentsMap = new Map<string, string>();
    if (recentOrderIds.length > 0) {
      const { data: pmts, error: pmtsError } = await supabase
        .from('payments')
        .select('order_id, method')
        .in('order_id', recentOrderIds);

      if (pmtsError) throw new AppError(500, pmtsError.message);

      for (const p of pmts || []) {
        recentPaymentsMap.set(p.order_id, p.method);
      }
    }

    const recent_orders = (recentOrders || []).map((o) => {
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

    // 8. Fetch low stock alert products
    const { data: alerts, error: alertsError } = await supabase
      .from('stock_alerts')
      .select('current_stock, min_stock_level, status, products(id, name, image_url)')
      .in('status', ['low_stock', 'out_of_stock'])
      .order('current_stock', { ascending: true })
      .limit(4);

    if (alertsError) throw new AppError(500, alertsError.message);

    const low_stock_products = (alerts || []).map((a) => {
      const p = a.products as any;
      return {
        id: p?.id || '',
        name: p?.name || 'Sản phẩm không tên',
        stock: a.current_stock,
        alert_status: a.current_stock === 0 ? 'Rất thấp' : a.current_stock <= 5 ? 'Rất thấp' : 'Thấp',
        image_url: p?.image_url || '/assets/logo.png',
      };
    });

    // 9. Fetch top products (including image_url)
    const topProductsRaw = await this.topProducts(7, 5, today);
    const topProductIds = topProductsRaw.map((p) => p.product_id);
    let topProductsImages = new Map<string, string>();
    if (topProductIds.length > 0) {
      const { data: prods, error: prodsError } = await supabase
        .from('products')
        .select('id, image_url')
        .in('id', topProductIds);

      if (prodsError) throw new AppError(500, prodsError.message);

      for (const pr of prods || []) {
        topProductsImages.set(pr.id, pr.image_url || '');
      }
    }
    const top_products = topProductsRaw.map((p, idx) => ({
      rank: idx + 1,
      id: p.product_id,
      name: p.product_name,
      quantity: p.quantity,
      revenue: p.revenue,
      image_url: topProductsImages.get(p.product_id) || '/assets/logo.png',
    }));

    return {
      summary: {
        today_revenue: todayRevenue,
        today_revenue_growth: todayRevenueGrowth,
        today_orders: todayOrdersCount,
        today_orders_growth: todayOrdersGrowth,
        today_sold_products: todaySoldProducts,
        today_sold_growth: todaySoldGrowth,
        low_stock_count: lowStockCount || 0,
        new_low_stock_count: newLowStockCount || 0,
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

    const { data, error } = await supabase
      .from('orders')
      .select('id, final_amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', fromDate.toISOString())
      .lt('created_at', new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error) throw new AppError(500, error.message);

    const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      buckets.set(currencyDate(date), { date: currencyDate(date), revenue: 0, orders: 0 });
    }

    for (const order of data || []) {
      const key = String(order.created_at).slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.revenue += Number(order.final_amount || 0);
      bucket.orders += 1;
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
}
