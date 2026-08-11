import { supabase } from '../config/supabase';

export type ReplenishmentPriority = 'high' | 'medium' | 'low';
export type ReplenishmentStatus = 'out_of_stock' | 'low_stock' | 'needs_restock' | 'healthy';
export type ForecastConfidence = 'high' | 'medium' | 'low';

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  cost_price?: number;
  sell_price?: number;
  category_id?: string | null;
  supplier_id?: string | null;
  categories?: { name?: string } | Array<{ name?: string }> | null;
  suppliers?: { name?: string } | Array<{ name?: string }> | null;
};

type SupplyPolicy = {
  product_id: string;
  lead_time_days?: number | null;
  safety_stock_qty?: number | null;
  target_cover_days?: number | null;
  review_period_days?: number | null;
  service_level?: number | null;
  moq?: number | null;
  order_multiple?: number | null;
  min_shelf_life_days?: number | null;
};

type SalesProfile = {
  sold7: number;
  sold30: number;
  sold90: number;
  avg7: number;
  avg30: number;
  avg90: number;
  forecastDaily: number;
  standardDeviation: number;
  salesDays90: number;
  trend: 'up' | 'down' | 'stable';
};

type BatchProfile = {
  expiredQuantity: number;
  expiringSoonQuantity: number;
};

type IncomingProfile = {
  quantity: number;
};

export type ReplenishmentItem = ProductRow & {
  average_daily_sales: number;
  sales_speed_7d: number;
  sales_speed_30d: number;
  sales_speed_90d: number;
  demand_stddev: number;
  sales_days_90d: number;
  sales_trend: 'up' | 'down' | 'stable';
  forecast_confidence: ForecastConfidence;
  forecast_method: 'weighted_velocity' | 'insufficient_demand';
  target_stock: number;
  recommended_quantity: number;
  priority: ReplenishmentPriority;
  alert_status: ReplenishmentStatus;
  stock_days: number | null;
  lead_time_days: number;
  review_period_days: number;
  safety_stock: number;
  reorder_point: number;
  inventory_position: number;
  on_hand_quantity: number;
  available_quantity: number;
  incoming_quantity: number;
  reserved_quantity: number;
  expired_quantity: number;
  expiring_soon_quantity: number;
  target_cover_days: number;
  moq: number;
  order_multiple: number;
  service_level: number;
  restock_cost: number;
  estimated_lost_revenue_7d: number;
  manual_review: boolean;
  data_quality: 'ready' | 'low_confidence' | 'insufficient_demand' | 'missing_policy';
  assumptions: string[];
  reason: string;
  ai_insight: string;
};

export type ReplenishmentAnalysis = {
  engine_version: string;
  generated_at: string;
  target_days: number;
  sales_window_days: number;
  policy: {
    default_lead_time_days: number;
    default_service_level: number;
    default_review_period_days: number;
    default_target_cover_days: number;
    policy_table_available: boolean;
    incoming_orders_available: boolean;
  };
  warnings: string[];
  summary: {
    total_products: number;
    out_of_stock: number;
    low_stock: number;
    needs_restock: number;
    healthy: number;
    urgent_items: number;
    low_confidence_items: number;
    manual_review_items: number;
    total_recommended_quantity: number;
    estimated_restock_cost: number;
    estimated_lost_revenue_7d: number;
  };
  items: ReplenishmentItem[];
  ai_provider: 'deterministic-v2';
};

const ENGINE_VERSION = 'replenishment-v2.0';
const SALES_WINDOW_DAYS = 90;
const DEFAULT_LEAD_TIME_DAYS = 3;
const DEFAULT_SERVICE_LEVEL = 0.95;
const DEFAULT_REVIEW_PERIOD_DAYS = 7;
const DEFAULT_ORDER_MULTIPLE = 1;
const DEFAULT_MOQ = 1;
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const priorityWeight: Record<ReplenishmentPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const positiveInt = (value: unknown, fallback: number, max = 365) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const positiveNumber = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
};

const roundUpToMultiple = (value: number, multiple: number) => {
  if (value <= 0) return 0;
  const safeMultiple = Math.max(1, Math.ceil(multiple));
  return Math.ceil(value / safeMultiple) * safeMultiple;
};

const calculateOrderQuantity = (hasDemand: boolean, inventoryPosition: number, reorderPoint: number, targetStock: number, moq: number, orderMultiple: number) => {
  if (!hasDemand || inventoryPosition > reorderPoint) return 0;
  const rawQuantity = Math.max(0, targetStock - inventoryPosition);
  return roundUpToMultiple(Math.max(rawQuantity, rawQuantity > 0 ? moq : 0), orderMultiple);
};

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const localDayKey = (value: Date | string) => {
  const parts = dateParts.formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const startOfLocalDay = (date = new Date()) => {
  const key = localDayKey(date);
  return new Date(`${key}T00:00:00+07:00`);
};

const getRelationName = (value: ProductRow['categories'] | ProductRow['suppliers']) => {
  if (Array.isArray(value)) return value[0]?.name || '';
  return value?.name || '';
};

const isMissingOptionalTable = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') || normalized.includes('schema cache') || normalized.includes('relation');
};

const zScoreForServiceLevel = (serviceLevel: number) => {
  if (serviceLevel >= 0.99) return 2.326;
  if (serviceLevel >= 0.975) return 1.96;
  if (serviceLevel >= 0.95) return 1.645;
  if (serviceLevel >= 0.9) return 1.282;
  return 1.036;
};

const buildLocalInsight = (item: Pick<ReplenishmentItem,
  | 'stock_quantity'
  | 'available_quantity'
  | 'incoming_quantity'
  | 'average_daily_sales'
  | 'stock_days'
  | 'lead_time_days'
  | 'reorder_point'
  | 'recommended_quantity'
  | 'target_stock'
  | 'sales_trend'
  | 'forecast_confidence'
  | 'manual_review'
  | 'data_quality'
  | 'unit'
>, targetCoverDays: number) => {
  const unit = item.unit || 'đơn vị';
  const stockDays = item.stock_days === null ? 'chưa đủ dữ liệu' : `${item.stock_days} ngày`;
  const confidence = item.forecast_confidence === 'high' ? 'cao' : item.forecast_confidence === 'medium' ? 'trung bình' : 'thấp';
  const trend = item.sales_trend === 'up' ? 'đang tăng' : item.sales_trend === 'down' ? 'đang giảm' : 'ổn định';

  if (item.manual_review && item.data_quality === 'insufficient_demand') {
    return `Chưa tự động đề xuất nhập vì chưa có đủ dữ liệu bán. Tồn khả dụng hiện tại ${item.available_quantity} ${unit}; cần xác nhận nhu cầu, mùa vụ và mức tồn tối thiểu trước khi đặt hàng.`;
  }

  if (item.recommended_quantity > 0) {
    return `Đề xuất nhập ${item.recommended_quantity} ${unit}. Tồn khả dụng ${item.available_quantity} ${unit}, hàng đang về ${item.incoming_quantity} ${unit}, tốc độ dự báo ${item.average_daily_sales.toFixed(2)}/${unit}/ngày và còn khoảng ${stockDays}. Mục tiêu là ${item.target_stock} ${unit} cho ${targetCoverDays} ngày cover; độ tin cậy dự báo ${confidence}, lead time mặc định ${item.lead_time_days} ngày.`;
  }

  return `Chưa cần nhập thêm. Tồn khả dụng ${item.available_quantity} ${unit}, điểm đặt hàng ${item.reorder_point} ${unit}, còn khoảng ${stockDays}; nhu cầu ${trend} và độ tin cậy dự báo ${confidence}.`;
};

export class InventoryReplenishmentService {
  private static async loadPolicies(productIds: string[]) {
    const map = new Map<string, SupplyPolicy>();
    if (productIds.length === 0) return { map, available: true };

    const { data, error } = await supabase
      .from('product_supply_policies')
      .select('product_id, lead_time_days, safety_stock_qty, target_cover_days, review_period_days, service_level, moq, order_multiple, min_shelf_life_days')
      .in('product_id', productIds);

    if (error) {
      if (!isMissingOptionalTable(error.message)) {
        console.warn('[InventoryReplenishment] optional policy table unavailable:', error.message);
      }
      return { map, available: false };
    }

    for (const row of data || []) map.set(row.product_id, row as SupplyPolicy);
    return { map, available: true };
  }

  private static async loadIncoming(productIds: string[]) {
    const map = new Map<string, IncomingProfile>();
    if (productIds.length === 0) return { map, available: true };

    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('product_id, quantity, received_quantity, purchase_orders(status)')
      .in('product_id', productIds);

    if (error) {
      if (!isMissingOptionalTable(error.message)) {
        console.warn('[InventoryReplenishment] optional incoming orders unavailable:', error.message);
      }
      return { map, available: false };
    }

    // A draft or approval queue item is not committed supply. Counting it as
    // incoming would suppress a valid reorder recommendation before a buyer
    // has actually approved/placed the purchase order.
    const openStatuses = new Set(['approved', 'partially_received', 'ordered', 'in_transit']);
    for (const row of data || []) {
      const purchaseOrder = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders;
      if (purchaseOrder?.status && !openStatuses.has(String(purchaseOrder.status))) continue;
      const quantity = positiveNumber(row.quantity, 0);
      const received = positiveNumber(row.received_quantity, 0);
      const outstanding = Math.max(0, quantity - received);
      if (outstanding <= 0) continue;
      const current = map.get(row.product_id) || { quantity: 0 };
      current.quantity += outstanding;
      map.set(row.product_id, current);
    }
    return { map, available: true };
  }

  private static async loadBatches(productIds: string[]) {
    const map = new Map<string, BatchProfile>();
    if (productIds.length === 0) return { map, available: true };

    const { data, error } = await supabase
      .from('product_batches')
      .select('product_id, quantity, expiry_date')
      .in('product_id', productIds)
      .gt('quantity', 0);

    if (error) {
      if (!isMissingOptionalTable(error.message)) {
        console.warn('[InventoryReplenishment] batch data unavailable:', error.message);
      }
      return { map, available: false };
    }

    const today = startOfLocalDay();
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 14);
    for (const row of data || []) {
      const quantity = positiveInt(row.quantity, 0, 1_000_000);
      const expiry = new Date(`${row.expiry_date}T00:00:00+07:00`);
      const current = map.get(row.product_id) || { expiredQuantity: 0, expiringSoonQuantity: 0 };
      if (expiry < today) current.expiredQuantity += quantity;
      else if (expiry <= soon) current.expiringSoonQuantity += quantity;
      map.set(row.product_id, current);
    }
    return { map, available: true };
  }

  private static async loadSales(productIds: string[]) {
    const profiles = new Map<string, SalesProfile>();
    const daily = new Map<string, Map<string, number>>();
    const today = startOfLocalDay();
    const from = new Date(today);
    from.setDate(from.getDate() - (SALES_WINDOW_DAYS - 1));

    productIds.forEach((id) => {
      profiles.set(id, {
        sold7: 0,
        sold30: 0,
        sold90: 0,
        avg7: 0,
        avg30: 0,
        avg90: 0,
        forecastDaily: 0,
        standardDeviation: 0,
        salesDays90: 0,
        trend: 'stable',
      });
      daily.set(id, new Map());
    });

    if (productIds.length === 0) return profiles;

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('status', 'completed')
      .gte('created_at', from.toISOString())
      .lt('created_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    if (orderError) throw orderError;
    const orderRows = orders || [];
    const orderDates = new Map(orderRows.map((order) => [order.id, localDayKey(order.created_at)]));
    const productIdSet = new Set(productIds);

    // Keep requests bounded for Supabase/PostgREST URL and payload limits.
    const chunkSize = 200;
    for (let index = 0; index < orderRows.length; index += chunkSize) {
      const orderIds = orderRows.slice(index, index + chunkSize).map((order) => order.id);
      const { data: details, error } = await supabase
        .from('order_details')
        .select('product_id, quantity, order_id')
        .in('order_id', orderIds);
      if (error) throw error;

      for (const detail of details || []) {
        const productId = String(detail.product_id);
        const day = orderDates.get(detail.order_id);
        if (!day || !productIdSet.has(productId)) continue;
        const quantity = positiveNumber(detail.quantity, 0, 1_000_000);
        const productDaily = daily.get(productId)!;
        productDaily.set(day, (productDaily.get(day) || 0) + quantity);
      }
    }

    for (const productId of productIds) {
      const productDaily = daily.get(productId)!;
      const profile = profiles.get(productId)!;
      const values: number[] = [];
      for (let offset = SALES_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
        const day = new Date(today);
        day.setDate(day.getDate() - offset);
        values.push(productDaily.get(localDayKey(day)) || 0);
      }

      profile.sold90 = values.reduce((sum, value) => sum + value, 0);
      profile.sold30 = values.slice(-30).reduce((sum, value) => sum + value, 0);
      profile.sold7 = values.slice(-7).reduce((sum, value) => sum + value, 0);
      profile.avg90 = profile.sold90 / 90;
      profile.avg30 = profile.sold30 / 30;
      profile.avg7 = profile.sold7 / 7;
      profile.salesDays90 = values.filter((value) => value > 0).length;

      const variance = values.reduce((sum, value) => sum + Math.pow(value - profile.avg30, 2), 0) / 30;
      profile.standardDeviation = Math.sqrt(Math.max(variance, 0));
      profile.forecastDaily = Number((profile.avg7 * 0.45 + profile.avg30 * 0.4 + profile.avg90 * 0.15).toFixed(4));

      if (profile.avg30 > 0) {
        const change = profile.avg7 / profile.avg30 - 1;
        if (change >= 0.2) profile.trend = 'up';
        else if (change <= -0.2) profile.trend = 'down';
      } else if (profile.avg7 > 0) {
        profile.trend = 'up';
      }
    }

    return profiles;
  }

  private static buildItem(
    product: ProductRow,
    sales: SalesProfile,
    policy: SupplyPolicy | undefined,
    batch: BatchProfile,
    incoming: IncomingProfile,
    targetDays: number,
    optionalData: { policyAvailable: boolean; incomingAvailable: boolean; batchAvailable: boolean },
    savedInsight?: string,
  ): ReplenishmentItem {
    const onHand = positiveInt(product.stock_quantity, 0, 1_000_000);
    const minStock = positiveInt(product.min_stock_level, 0, 1_000_000);
    const cost = positiveNumber(product.cost_price, 0);
    const sell = positiveNumber(product.sell_price, 0);
    const expiredQuantity = Math.min(onHand, positiveInt(batch.expiredQuantity, 0, 1_000_000));
    const availableQuantity = Math.max(0, onHand - expiredQuantity);
    const incomingQuantity = positiveInt(incoming.quantity, 0, 1_000_000);
    const reservedQuantity = 0;
    const forecastDaily = sales.forecastDaily;

    const leadTimeDays = positiveInt(policy?.lead_time_days, DEFAULT_LEAD_TIME_DAYS, 90);
    const reviewPeriodDays = positiveInt(policy?.review_period_days, DEFAULT_REVIEW_PERIOD_DAYS, 90);
    const targetCoverDays = positiveInt(policy?.target_cover_days, targetDays, 90) || targetDays;
    const serviceLevel = clamp(positiveNumber(policy?.service_level, DEFAULT_SERVICE_LEVEL, 0.999), 0.8, 0.999);
    const fixedSafetyStock = positiveInt(policy?.safety_stock_qty, 0, 1_000_000);
    const moq = Math.max(DEFAULT_MOQ, positiveInt(policy?.moq, DEFAULT_MOQ, 1_000_000));
    const orderMultiple = Math.max(DEFAULT_ORDER_MULTIPLE, positiveInt(policy?.order_multiple, DEFAULT_ORDER_MULTIPLE, 1_000_000));
    const zScore = zScoreForServiceLevel(serviceLevel);
    const statisticalSafetyStock = Math.ceil(zScore * sales.standardDeviation * Math.sqrt(leadTimeDays + reviewPeriodDays));
    const safetyStock = Math.max(fixedSafetyStock, statisticalSafetyStock);
    const inventoryPosition = Math.max(0, availableQuantity + incomingQuantity - reservedQuantity);
    const demandDuringLeadTime = forecastDaily * leadTimeDays;
    const reorderPoint = Math.ceil(demandDuringLeadTime + safetyStock);
    const targetStock = Math.max(minStock, Math.ceil(forecastDaily * (leadTimeDays + targetCoverDays) + safetyStock));
    const hasDemand = sales.sold90 > 0 && forecastDaily > 0;
    // Replenish only when the inventory position crosses the reorder point.
    // This keeps healthy SKUs out of the purchase queue while preserving the
    // order-up-to target for the moment a replenishment decision is triggered.
    const recommendedQuantity = calculateOrderQuantity(hasDemand, inventoryPosition, reorderPoint, targetStock, moq, orderMultiple);
    const stockDays = forecastDaily > 0 ? Number((availableQuantity / forecastDaily).toFixed(1)) : null;
    const dataQuality: ReplenishmentItem['data_quality'] = !optionalData.policyAvailable || !policy
      ? 'missing_policy'
      : !hasDemand
        ? 'insufficient_demand'
        : sales.salesDays90 < 28
          ? 'low_confidence'
          : 'ready';
    const confidence: ForecastConfidence = sales.salesDays90 >= 56 && hasDemand
      ? 'high'
      : sales.salesDays90 >= 28 && hasDemand
        ? 'medium'
        : 'low';
    let alertStatus: ReplenishmentStatus = 'healthy';
    if (availableQuantity <= 0) alertStatus = 'out_of_stock';
    else if (availableQuantity <= minStock) alertStatus = 'low_stock';
    else if (hasDemand && inventoryPosition <= reorderPoint) alertStatus = 'needs_restock';

    const manualReview = !hasDemand || (dataQuality === 'low_confidence' && alertStatus !== 'healthy');

    let priority: ReplenishmentPriority = 'low';
    if (hasDemand && (alertStatus === 'out_of_stock' || (stockDays !== null && stockDays <= leadTimeDays))) priority = 'high';
    else if (alertStatus === 'low_stock' || alertStatus === 'needs_restock') priority = 'medium';

    const assumptions: string[] = [];
    if (!policy) assumptions.push(`Lead time mặc định ${leadTimeDays} ngày`);
    if (!optionalData.incomingAvailable) assumptions.push('Chưa có dữ liệu đơn mua đang về');
    if (!optionalData.batchAvailable) assumptions.push('Chưa đọc được tồn theo lô/HSD');
    if (!hasDemand) assumptions.push('Chưa có đủ dữ liệu bán trong 90 ngày');
    if (batch.expiringSoonQuantity > 0) assumptions.push(`${batch.expiringSoonQuantity} ${product.unit || 'đơn vị'} sắp hết hạn trong 14 ngày`);

    const estimatedLostRevenue7d = hasDemand
      ? Math.max(0, sales.forecastDaily * 7 - availableQuantity) * sell
      : 0;
    const restockCost = recommendedQuantity * cost;
    const reason = availableQuantity <= 0
      ? hasDemand ? 'Hết hàng trong khi vẫn có nhu cầu dự báo' : 'Hết hàng nhưng chưa có đủ dữ liệu nhu cầu'
      : alertStatus === 'low_stock'
        ? 'Tồn khả dụng đã chạm ngưỡng tối thiểu'
        : alertStatus === 'needs_restock'
          ? `Tồn khả dụng thấp hơn điểm đặt hàng ${reorderPoint} ${product.unit || 'đơn vị'}`
          : 'Tồn kho đang trên điểm đặt hàng';

    const item = {
      ...product,
      stock_quantity: onHand,
      min_stock_level: minStock,
      unit: product.unit || 'cái',
      cost_price: cost,
      sell_price: sell,
      average_daily_sales: Number(forecastDaily.toFixed(2)),
      sales_speed_7d: Number(sales.avg7.toFixed(2)),
      sales_speed_30d: Number(sales.avg30.toFixed(2)),
      sales_speed_90d: Number(sales.avg90.toFixed(2)),
      demand_stddev: Number(sales.standardDeviation.toFixed(2)),
      sales_days_90d: sales.salesDays90,
      sales_trend: sales.trend,
      forecast_confidence: confidence,
      forecast_method: hasDemand ? 'weighted_velocity' : 'insufficient_demand',
      target_stock: targetStock,
      recommended_quantity: recommendedQuantity,
      priority,
      alert_status: alertStatus,
      stock_days: stockDays,
      lead_time_days: leadTimeDays,
      review_period_days: reviewPeriodDays,
      safety_stock: safetyStock,
      reorder_point: reorderPoint,
      inventory_position: inventoryPosition,
      on_hand_quantity: onHand,
      available_quantity: availableQuantity,
      incoming_quantity: incomingQuantity,
      reserved_quantity: reservedQuantity,
      expired_quantity: expiredQuantity,
      expiring_soon_quantity: batch.expiringSoonQuantity,
      target_cover_days: targetCoverDays,
      moq,
      order_multiple: orderMultiple,
      service_level: serviceLevel,
      restock_cost: Math.round(restockCost),
      estimated_lost_revenue_7d: Math.round(estimatedLostRevenue7d),
      manual_review: manualReview,
      data_quality: dataQuality,
      assumptions,
      reason,
      ai_insight: savedInsight || '',
    } satisfies ReplenishmentItem;

    return {
      ...item,
      ai_insight: savedInsight || buildLocalInsight(item, targetCoverDays),
    };
  }

  static async analyze(targetDays = 14, productId?: string): Promise<ReplenishmentAnalysis> {
    const normalizedTargetDays = clamp(Math.floor(Number(targetDays) || 14), 1, 90);
    let query = supabase
      .from('products')
      .select('id, sku, name, stock_quantity, min_stock_level, unit, cost_price, sell_price, category_id, supplier_id, categories(name), suppliers(name)')
      .eq('is_active', true);

    if (productId) query = query.eq('id', productId);
    const { data: products, error } = await query;
    if (error) throw error;

    const candidates = (products || []) as ProductRow[];
    const productIds = candidates.map((product) => product.id);
    const [sales, policies, incoming, batches, savedRecs] = await Promise.all([
      this.loadSales(productIds),
      this.loadPolicies(productIds),
      this.loadIncoming(productIds),
      this.loadBatches(productIds),
      productIds.length > 0
        ? supabase.from('ai_recommendations').select('product_id, ai_insight').in('status', ['pending', 'approved']).order('created_at', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const savedInsightMap = new Map<string, string>();
    for (const row of savedRecs.data || []) {
      if (row.product_id && row.ai_insight && !savedInsightMap.has(row.product_id)) savedInsightMap.set(row.product_id, row.ai_insight);
    }

    const warnings: string[] = [];
    if (!policies.available) warnings.push('Chưa có bảng chính sách nhập hàng; hệ thống đang dùng lead time và service level mặc định.');
    if (!incoming.available) warnings.push('Chưa có dữ liệu đơn mua đang về; tồn khả dụng chưa cộng hàng trên đường nhập.');
    if (!batches.available) warnings.push('Chưa đọc được dữ liệu lô/HSD; cần kiểm tra migration product_batches.');

    const items = candidates
      .map((product) => this.buildItem(
        product,
        sales.get(product.id) || {
          sold7: 0, sold30: 0, sold90: 0, avg7: 0, avg30: 0, avg90: 0,
          forecastDaily: 0, standardDeviation: 0, salesDays90: 0, trend: 'stable',
        },
        policies.map.get(product.id),
        batches.map.get(product.id) || { expiredQuantity: 0, expiringSoonQuantity: 0 },
        incoming.map.get(product.id) || { quantity: 0 },
        normalizedTargetDays,
        { policyAvailable: policies.available, incomingAvailable: incoming.available, batchAvailable: batches.available },
        savedInsightMap.get(product.id),
      ))
      .sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]
        || Number(b.manual_review) - Number(a.manual_review)
        || b.recommended_quantity - a.recommended_quantity
        || b.average_daily_sales - a.average_daily_sales);

    return {
      engine_version: ENGINE_VERSION,
      generated_at: new Date().toISOString(),
      target_days: normalizedTargetDays,
      sales_window_days: SALES_WINDOW_DAYS,
      policy: {
        default_lead_time_days: DEFAULT_LEAD_TIME_DAYS,
        default_service_level: DEFAULT_SERVICE_LEVEL,
        default_review_period_days: DEFAULT_REVIEW_PERIOD_DAYS,
        default_target_cover_days: normalizedTargetDays,
        policy_table_available: policies.available,
        incoming_orders_available: incoming.available,
      },
      warnings,
      summary: {
        total_products: items.length,
        out_of_stock: items.filter((item) => item.alert_status === 'out_of_stock').length,
        low_stock: items.filter((item) => item.alert_status === 'low_stock').length,
        needs_restock: items.filter((item) => item.alert_status === 'needs_restock').length,
        healthy: items.filter((item) => item.alert_status === 'healthy').length,
        urgent_items: items.filter((item) => item.priority === 'high').length,
        low_confidence_items: items.filter((item) => item.forecast_confidence === 'low').length,
        manual_review_items: items.filter((item) => item.manual_review).length,
        total_recommended_quantity: items.reduce((sum, item) => sum + item.recommended_quantity, 0),
        estimated_restock_cost: items.reduce((sum, item) => sum + item.restock_cost, 0),
        estimated_lost_revenue_7d: items.reduce((sum, item) => sum + item.estimated_lost_revenue_7d, 0),
      },
      items,
      ai_provider: 'deterministic-v2',
    };
  }
}

export const replenishmentMath = {
  roundUpToMultiple,
  calculateOrderQuantity,
  zScoreForServiceLevel,
  calculateSafetyStock: (standardDeviation: number, leadTimeDays: number, reviewPeriodDays: number, serviceLevel = DEFAULT_SERVICE_LEVEL) => Math.max(0, Math.ceil(zScoreForServiceLevel(serviceLevel) * Math.max(0, standardDeviation) * Math.sqrt(Math.max(1, leadTimeDays + reviewPeriodDays)))),
};
