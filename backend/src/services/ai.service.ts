import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { parsePagination } from '../utils/query';
import dns from 'node:dns';
import { promisify } from 'node:util';

const dnsLookup = promisify(dns.lookup);

const isSafeUrl = async (urlStr: string): Promise<boolean> => {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === 'localhost.localdomain' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    const { address } = await dnsLookup(hostname);
    if (
      /^127\./.test(address) ||
      /^10\./.test(address) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(address) ||
      /^192\.168\./.test(address) ||
      /^169\.254\./.test(address) ||
      address === '0.0.0.0'
    ) {
      return false;
    }
    if (
      address === '::1' ||
      address.toLowerCase().startsWith('fe80:') ||
      address.toLowerCase().startsWith('fc00:') ||
      address.toLowerCase().startsWith('fd00:')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

type Priority = 'low' | 'medium' | 'high';
type RestockStatus = 'out_of_stock' | 'low_stock' | 'needs_restock' | 'healthy';

type Candidate = {
  id: string;
  sku: string;
  name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  cost_price?: number;
  sell_price?: number;
  categories?: any;
  suppliers?: any;
};

type RestockAnalysisItem = Candidate & {
  average_daily_sales: number;
  target_stock: number;
  recommended_quantity: number;
  priority: Priority;
  alert_status: RestockStatus;
  stock_days: number | null;
  reason: string;
  ai_insight: string;
  sales_speed_7d?: number;
  sales_trend?: 'up' | 'down' | 'stable';
};

type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  product_name_vi?: string;
  generic_name?: string;
  generic_name_vi?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  categories_tags_en?: string[];
  quantity?: string;
  image_front_url?: string;
  image_url?: string;
};

type NormalizedProductInfo = {
  source: string;
  source_url?: string;
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  image_url?: string;
};

const lastNDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const priorityWeight: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export class AIService {
  private static normalizeTargetDays(targetDays: number) {
    const value = Number.isFinite(targetDays) ? Math.floor(targetDays) : 14;
    return Math.min(Math.max(value, 1), 90);
  }

  private static buildReason(product: Candidate, stockDays: number | null, targetDays: number) {
    if (product.stock_quantity <= 0) return 'Sản phẩm đã hết hàng';
    if (product.stock_quantity <= product.min_stock_level) {
      return 'Sản phẩm đang thấp hơn hoặc bằng ngưỡng tồn kho tối thiểu';
    }
    if (stockDays !== null && stockDays <= targetDays) {
      return `Tồn kho dự kiến chỉ đủ khoảng ${stockDays} ngày`;
    }
    return 'Tồn kho đang trong vùng an toàn';
  }

  private static buildLocalInsight(item: {
    stock_quantity: number;
    min_stock_level: number;
    average_daily_sales: number;
    recommended_quantity: number;
    unit: string;
    stock_days: number | null;
  }, targetDays: number) {
    const unit = item.unit || 'sản phẩm';
    const daysLeft = item.stock_days !== null ? `${item.stock_days} ngày` : 'chưa đủ dữ liệu dự báo';
    const dailySales = Number(item.average_daily_sales || 0);
    const actionLine = item.recommended_quantity > 0
      ? `Đề xuất nhập **${item.recommended_quantity} ${unit}** để đạt vùng tồn khoảng **${targetDays} ngày**.`
      : 'Chưa cần nhập thêm, ưu tiên theo dõi thêm biến động bán trong vài ngày tới.';
    const cadenceLine = dailySales > 0
      ? `Với tốc độ bán trung bình **${dailySales}/${unit}/ngày**, nên kiểm tra lại tồn kho sau **3-5 ngày** hoặc ngay khi có đơn lớn.`
      : 'Do chưa có tốc độ bán ổn định, chỉ nên nhập theo ngưỡng tối thiểu và tránh ôm tồn quá nhiều.';

    if (item.stock_quantity <= 0) {
      return [
        '- **Mức ưu tiên:** Khẩn cấp vì sản phẩm đã hết hàng.',
        `- **Hành động:** ${actionLine}`,
        '- **Rủi ro:** Đang có nguy cơ mất đơn ngay; nếu nhà cung cấp giao chậm, nên ưu tiên nhập lô nhỏ trước để mở bán lại.',
        `- **Theo dõi:** ${cadenceLine}`,
      ].join('\n');
    }

    if (item.stock_quantity <= item.min_stock_level) {
      return [
        `- **Mức ưu tiên:** Cao vì tồn hiện tại (**${item.stock_quantity} ${unit}**) đã chạm/ngang ngưỡng tối thiểu (**${item.min_stock_level} ${unit}**).`,
        `- **Hành động:** ${actionLine}`,
        `- **Lý do:** Dự kiến còn bán được khoảng **${daysLeft}**, thấp hơn vùng dự phòng mong muốn.`,
        `- **Theo dõi:** ${cadenceLine}`,
      ].join('\n');
    }

    if (item.stock_days !== null && item.stock_days <= targetDays) {
      return [
        `- **Mức ưu tiên:** Trung bình, chưa nguy hiểm nhưng tồn chỉ đủ khoảng **${daysLeft}**.`,
        `- **Hành động:** ${actionLine}`,
        '- **Lý do:** Nên đặt hàng trước khi chạm ngưỡng thấp để tránh đứt hàng bất ngờ.',
        `- **Theo dõi:** ${cadenceLine}`,
      ].join('\n');
    }

    return [
      `- **Mức ưu tiên:** Thấp, tồn kho đang trong vùng an toàn cho mục tiêu **${targetDays} ngày**.`,
      '- **Hành động:** Chưa cần nhập thêm; ưu tiên bán xoay vòng và theo dõi tốc độ bán.',
      '- **Rủi ro:** Nếu bán chậm, nhập thêm lúc này có thể làm tăng vốn nằm kho.',
      `- **Theo dõi:** ${cadenceLine}`,
    ].join('\n');
  }

  private static async groqInsight(prompt: string) {
    if (!env.groqApiKey) return null;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Bạn là Chuyên gia Quản trị Chuỗi Cung Ứng (Supply Chain Manager) cấp cao chuyên về hệ thống POS bán lẻ.
TUYỆT ĐỐI KHÔNG sử dụng emoji. Duy trì văn phong kinh tế, chuyên nghiệp, nghiêm túc.

Với mỗi sản phẩm, hãy phân tích theo 6 KHUNG sau (chỉ phân tích khung nào có dữ liệu liên quan):

**1. Tình trạng tồn kho:**
- Đánh giá mức tồn so với ngưỡng tối thiểu và tốc độ bán
- Ước tính số ngày còn lại trước khi hết hàng

**2. Xu hướng nhu cầu:**
- So sánh tốc độ bán 7 ngày gần đây vs 30 ngày
- Phát hiện xu hướng TĂNG/GIẢM/ỔN ĐỊNH và lý giải nguyên nhân

**3. Phân tích mùa vụ & thời điểm:**
- Sản phẩm này có đặc tính mùa vụ không (mùa hè/đông, lễ tết, cuối tuần)?
- Thời điểm hiện tại có phải peak season?

**4. Chiến lược giá & biên lợi nhuận:**
- Đánh giá biên lợi nhuận hiện tại
- Sản phẩm này đáng để đầu tư nhập nhiều hay nên giảm?

**5. Rủi ro chuỗi cung ứng:**
- Lead time nhà cung cấp dự kiến
- Chi phí tồn kho vs chi phí hết hàng (mất đơn)

**6. Khuyến nghị hành động cụ thể:**
- Nhập bao nhiêu, khi nào, mức ưu tiên
- ROI dự kiến nếu nhập theo đề xuất

BẮT BUỘC TRẢ LỜI THEO FORMAT SAU, KHÔNG VIẾT THÀNH MỘT ĐOẠN VĂN CHUNG CHUNG:
- **Quyết định nhập:** Nên nhập / chưa nên nhập / nhập thử lô nhỏ. Nêu số lượng cụ thể và thời điểm thực hiện.
- **Lý do chính:** 2-3 gạch đầu dòng dựa trên tồn kho, tốc độ bán, ngày còn hàng, xu hướng 7 ngày vs 30 ngày.
- **Rủi ro cần kiểm soát:** Nêu nguy cơ hết hàng, tồn chết, vốn nằm kho, hoặc thiếu dữ liệu. Nếu dữ liệu mùa vụ/lead time không có, phải nói rõ là giả định bảo thủ.
- **Kế hoạch hành động:** Việc cần làm ngay sau khi duyệt đề xuất: liên hệ nhà cung cấp, ưu tiên nhập lô nào, kiểm tra lại sau bao nhiêu ngày, theo dõi chỉ số nào.
- **Gợi ý bán hàng/vận hành:** Gợi ý trưng bày, combo, bán kèm, hoặc chuyển tồn giữa chi nhánh nếu phù hợp với loại sản phẩm.

QUY TẮC CHẤT LƯỢNG:
- Không được chỉ nói "nên nhập X" rồi dừng lại.
- Không được bịa dữ liệu không có trong prompt. Khi thiếu dữ liệu, ghi "chưa có dữ liệu" và đưa giả định an toàn.
- Không được mâu thuẫn với số lượng đề xuất nhập trong dữ liệu đầu vào.
- Nếu tốc độ bán thấp nhưng sản phẩm hết hàng, phân biệt rõ: hết hàng do tồn bằng 0, không nhất thiết do nhu cầu tăng mạnh.
- Ưu tiên câu ngắn, có hành động, đọc như trợ lý mua hàng cho chủ cửa hàng.

Sử dụng Markdown:
- **in đậm** cho số liệu quan trọng
- Gạch đầu dòng (-) cho danh sách
- Viết ngắn gọn 170-260 từ, đi thẳng vào vấn đề`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  private static aiProviderName() {
    if (env.groqApiKey) return 'groq';
    return 'local-rules';
  }

  private static async getProductSalesMetrics(productIds: string[]) {
    const result = new Map<string, { speed30d: number; speed7d: number; trend: 'up' | 'down' | 'stable' }>();
    productIds.forEach((id) => result.set(id, { speed30d: 0, speed7d: 0, trend: 'stable' }));
    if (productIds.length === 0) return result;

    const date30DaysAgo = lastNDays(30);
    const date7DaysAgo = lastNDays(7);

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('status', 'completed')
      .gte('created_at', date30DaysAgo);

    if (orderError) throw new AppError(500, orderError.message);
    const orderIds = (orders || []).map((order) => order.id);
    if (orderIds.length === 0) return result;

    const orderIdToDate = new Map<string, string>();
    for (const o of orders || []) {
      orderIdToDate.set(o.id, o.created_at);
    }

    const { data: details, error } = await supabase
      .from('order_details')
      .select('product_id, quantity, order_id')
      .in('product_id', productIds)
      .in('order_id', orderIds);

    if (error) throw new AppError(500, error.message);

    const sold30dMap = new Map<string, number>();
    const sold7dMap = new Map<string, number>();

    for (const detail of details || []) {
      const productId = String(detail.product_id);
      const qty = Number(detail.quantity || 0);
      const createdAt = orderIdToDate.get(detail.order_id);

      sold30dMap.set(productId, (sold30dMap.get(productId) || 0) + qty);
      if (createdAt && createdAt >= date7DaysAgo) {
        sold7dMap.set(productId, (sold7dMap.get(productId) || 0) + qty);
      }
    }

    for (const productId of productIds) {
      const sold30d = sold30dMap.get(productId) || 0;
      const sold7d = sold7dMap.get(productId) || 0;

      const speed30d = Number((sold30d / 30).toFixed(2));
      const speed7d = Number((sold7d / 7).toFixed(2));

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (speed7d > speed30d * 1.2 && speed7d > 0.05) {
        trend = 'up';
      } else if (speed7d < speed30d * 0.8) {
        trend = 'down';
      }

      result.set(productId, { speed30d, speed7d, trend });
    }

    return result;
  }

  private static toAnalysisItem(
    product: Candidate,
    metrics: { speed30d: number; speed7d: number; trend: 'up' | 'down' | 'stable' },
    targetDays: number,
    savedInsight?: string
  ): RestockAnalysisItem {
    const averageDailySales = metrics.speed30d;
    const currentStock = Number(product.stock_quantity || 0);
    const minStockLevel = Number(product.min_stock_level || 0);
    const stockDays = averageDailySales > 0 ? Number((currentStock / averageDailySales).toFixed(1)) : null;
    const targetStock = Math.max(minStockLevel, Math.ceil(averageDailySales * targetDays));
    const recommendedQuantity = Math.max(targetStock - currentStock, 0);

    const alertStatus: RestockStatus =
      currentStock <= 0
        ? 'out_of_stock'
        : currentStock <= minStockLevel
          ? 'low_stock'
          : stockDays !== null && stockDays <= targetDays
            ? 'needs_restock'
            : 'healthy';

    const priority: Priority =
      alertStatus === 'out_of_stock' || (stockDays !== null && stockDays <= 3)
        ? 'high'
        : alertStatus === 'low_stock' || alertStatus === 'needs_restock'
          ? 'medium'
          : 'low';

    const reason = this.buildReason(
      { ...product, stock_quantity: currentStock, min_stock_level: minStockLevel },
      stockDays,
      targetDays
    );

    const localInsight = this.buildLocalInsight(
      {
        stock_quantity: currentStock,
        min_stock_level: minStockLevel,
        average_daily_sales: averageDailySales,
        recommended_quantity: recommendedQuantity,
        unit: product.unit,
        stock_days: stockDays,
      },
      targetDays
    );

    return {
      ...product,
      stock_quantity: currentStock,
      min_stock_level: minStockLevel,
      average_daily_sales: averageDailySales,
      target_stock: targetStock,
      recommended_quantity: recommendedQuantity,
      priority,
      alert_status: alertStatus,
      stock_days: stockDays,
      reason,
      sales_speed_7d: metrics.speed7d,
      sales_trend: metrics.trend,
      ai_insight: savedInsight || localInsight,
    };
  }

  private static buildSummary(items: RestockAnalysisItem[]) {
    const actionableItems = items.filter((item) => item.alert_status !== 'healthy');

    return {
      total_products: items.length,
      out_of_stock: items.filter((item) => item.alert_status === 'out_of_stock').length,
      low_stock: items.filter((item) => item.alert_status === 'low_stock').length,
      needs_restock: items.filter((item) => item.alert_status === 'needs_restock').length,
      healthy: items.filter((item) => item.alert_status === 'healthy').length,
      total_recommended_quantity: actionableItems.reduce((sum, item) => sum + item.recommended_quantity, 0),
      urgent_items: items.filter((item) => item.priority === 'high').length,
    };
  }

  static async analyzeRestock(targetDays = 14, productId?: string) {
    const normalizedTargetDays = this.normalizeTargetDays(targetDays);
    let query = supabase
      .from('products')
      .select('id, sku, name, stock_quantity, min_stock_level, unit, cost_price, sell_price, category_id, supplier_id, categories(name), suppliers(name)')
      .eq('is_active', true);

    if (productId) query = query.eq('id', productId);

    const { data: products, error } = await query;
    if (error) throw new AppError(500, error.message);

    const candidates = (products || []) as Candidate[];

    // Fetch latest pending/approved recommendations to map saved insights
    const { data: savedRecs } = await supabase
      .from('ai_recommendations')
      .select('product_id, ai_insight')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false });

    const savedRecsMap = new Map<string, string>();
    if (savedRecs) {
      for (const rec of savedRecs) {
        if (rec.product_id && rec.ai_insight && !savedRecsMap.has(rec.product_id)) {
          savedRecsMap.set(rec.product_id, rec.ai_insight);
        }
      }
    }

    const salesMetricsMap = await this.getProductSalesMetrics(
      candidates.map((product) => product.id)
    );

    const items = candidates
      .map((product) => this.toAnalysisItem(
        product,
        salesMetricsMap.get(product.id) || { speed30d: 0, speed7d: 0, trend: 'stable' },
        normalizedTargetDays,
        savedRecsMap.get(product.id)
      ))
      .sort((a, b) => {
        const priorityCompare = priorityWeight[a.priority] - priorityWeight[b.priority];
        if (priorityCompare !== 0) return priorityCompare;
        return b.recommended_quantity - a.recommended_quantity;
      });

    return {
      target_days: normalizedTargetDays,
      sales_window_days: 30,
      summary: this.buildSummary(items),
      items,
      ai_provider: this.aiProviderName(),
    };
  }


  private static async saveRecommendation(item: RestockAnalysisItem, userId?: string) {
    const payload = {
      product_id: item.id,
      current_stock: item.stock_quantity,
      min_stock_level: item.min_stock_level,
      average_daily_sales: item.average_daily_sales,
      recommended_quantity: item.recommended_quantity,
      priority: item.priority,
      reason: item.reason,
      ai_insight: item.ai_insight,
      status: 'pending',
      created_by: userId || null,
    };

    // Tìm gợi ý cũ (pending hoặc rejected) để thay thế thay vì tạo mới
    const { data: existing, error: findError } = await supabase
      .from('ai_recommendations')
      .select('id')
      .eq('product_id', item.id)
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw new AppError(500, findError.message);

    const query = existing
      ? supabase.from('ai_recommendations').update(payload).eq('id', existing.id)
      : supabase.from('ai_recommendations').insert(payload);

    const { data: recommendation, error } = await query
      .select('*, products(id, sku, name, unit, stock_quantity)')
      .single();

    if (error) throw new AppError(400, error.message);
    return recommendation;
  }

  static async generateRecommendations(targetDays = 14, userId?: string, productId?: string) {
    const analysis = await this.analyzeRestock(targetDays, productId);
    const actionableItems = analysis.items.filter(
      (item) => item.alert_status !== 'healthy' || Boolean(productId)
    );

    const created = [];
    for (const item of actionableItems) {
      const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const stockDaysLeft = item.average_daily_sales > 0
        ? Math.floor(item.stock_quantity / item.average_daily_sales)
        : null;

      const categoryObj = item.categories;
      const categoryName = categoryObj
        ? (Array.isArray(categoryObj) ? categoryObj[0]?.name : categoryObj.name)
        : 'Chưa phân loại';

      const supplierObj = item.suppliers;
      const supplierName = supplierObj
        ? (Array.isArray(supplierObj) ? supplierObj[0]?.name : supplierObj.name)
        : 'Chưa liên kết nhà cung cấp';

      const costPrice = Number(item.cost_price || 0);
      const sellPrice = Number(item.sell_price || 0);
      const profitMargin = sellPrice > 0 ? Math.round(((sellPrice - costPrice) / sellPrice) * 100) : 0;
      const estimatedCost = item.recommended_quantity * costPrice;

      const formatVnd = (val: number) => `${Math.round(val).toLocaleString('vi-VN')}đ`;

      const trendText = item.sales_trend === 'up'
        ? 'TĂNG NHANH GẦN ĐÂY'
        : item.sales_trend === 'down'
          ? 'GIẢM GẦN ĐÂY'
          : 'ỔN ĐỊNH';

      const speed7d = item.sales_speed_7d || 0;
      const speed30d = item.average_daily_sales;
      const speedChangePercent = speed30d > 0 
        ? Math.round(((speed7d - speed30d) / speed30d) * 100) 
        : 0;
      const estimatedRevenue = item.recommended_quantity * sellPrice;
      const estimatedProfit = item.recommended_quantity * (sellPrice - costPrice);
      const sellThroughDays = speed30d > 0 
        ? Math.ceil(item.recommended_quantity / speed30d) 
        : null;
      const stockAfterImport = item.stock_quantity + item.recommended_quantity;
      const statusText =
        item.alert_status === 'out_of_stock'
          ? 'HẾT HÀNG'
          : item.alert_status === 'low_stock'
            ? 'TỒN THẤP'
            : item.alert_status === 'needs_restock'
              ? 'SẮP THIẾU'
              : 'AN TOÀN';

      const prompt = [
        `═══ BÁO CÁO PHÂN TÍCH SẢN PHẨM ═══`,
        `Thời điểm: ${now}`,
        ``,
        `▸ SẢN PHẨM: ${item.name} (SKU: ${item.sku})`,
        `▸ Danh mục: ${categoryName}`,
        `▸ Nhà cung cấp: ${supplierName}`,
        ``,
        `─── TÀI CHÍNH ───`,
        `• Giá nhập: ${formatVnd(costPrice)}`,
        `• Giá bán: ${formatVnd(sellPrice)}`,
        `• Biên lợi nhuận: ${profitMargin}%`,
        ``,
        `─── TỒN KHO ───`,
        `• Trạng thái cảnh báo: ${statusText}`,
        `• Tồn hiện tại: ${item.stock_quantity} ${item.unit}`,
        `• Ngưỡng tối thiểu: ${item.min_stock_level} ${item.unit}`,
        `• Tồn mục tiêu theo hệ thống: ${item.target_stock} ${item.unit}`,
        `• Tồn dự kiến sau khi nhập đề xuất: ${stockAfterImport} ${item.unit}`,
        stockDaysLeft !== null 
          ? `• Dự kiến hết hàng sau: ${stockDaysLeft} ngày` 
          : `• Chưa có dữ liệu bán hàng đủ để dự báo`,
        ``,
        `─── XU HƯỚNG BÁN HÀNG ───`,
        `• Tốc độ bán TB 30 ngày: ${speed30d}/ngày`,
        `• Tốc độ bán TB 7 ngày gần đây: ${speed7d}/ngày`,
        `• Thay đổi tốc độ: ${speedChangePercent > 0 ? '+' : ''}${speedChangePercent}% (${trendText})`,
        ``,
        `─── ĐỀ XUẤT NHẬP HÀNG ───`,
        `• Số lượng đề xuất nhập: ${item.recommended_quantity} ${item.unit}`,
        `• Chi phí nhập dự kiến: ${formatVnd(estimatedCost)}`,
        `• Doanh thu dự kiến nếu bán hết: ${formatVnd(estimatedRevenue)}`,
        `• Lợi nhuận gộp dự kiến: ${formatVnd(estimatedProfit)}`,
        sellThroughDays ? `• Thời gian bán hết (ước tính): ${sellThroughDays} ngày` : '',
        `• Mục tiêu tồn kho: ${analysis.target_days} ngày`,
        ``,
        `═══ YÊU CẦU PHÂN TÍCH ═══`,
        `Dựa trên dữ liệu trên, hãy viết như trợ lý mua hàng cho chủ cửa hàng, không viết chung chung.`,
        `Bắt buộc có các mục sau bằng gạch đầu dòng Markdown:`,
        `1. Quyết định nhập: nhập bao nhiêu, nhập ngay hay nhập thử lô nhỏ, ưu tiên cao/trung bình/thấp.`,
        `2. Vì sao: dựa trên tồn hiện tại, ngưỡng tối thiểu, số ngày còn hàng, tốc độ 7 ngày và 30 ngày.`,
        `3. Rủi ro: nguy cơ hết hàng, tồn chết, vốn nằm kho, hoặc thiếu dữ liệu nhà cung cấp/lead time.`,
        `4. Kế hoạch hành động: liên hệ nhà cung cấp, kiểm tra lại sau bao nhiêu ngày, theo dõi chỉ số nào.`,
        `5. Gợi ý vận hành/bán hàng: trưng bày, combo, bán kèm, ưu tiên bán trước, hoặc chuyển tồn nếu phù hợp.`,
        `Không được mâu thuẫn với số lượng đề xuất nhập ${item.recommended_quantity} ${item.unit}.`,
        `Nếu thiếu dữ liệu mùa vụ hoặc lead time, nói rõ "chưa có dữ liệu" và đưa giả định bảo thủ.`,
      ].filter(Boolean).join('\n');

      const aiInsight = (await this.groqInsight(prompt)) || item.ai_insight;
      created.push(await this.saveRecommendation({ ...item, ai_insight: aiInsight }, userId));
    }

    return {
      target_days: analysis.target_days,
      generated: created.length,
      recommendations: created,
      summary: analysis.summary,
      ai_provider: analysis.ai_provider,
    };
  }

  static async list(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('ai_recommendations')
      .select('*, products(id, sku, name, unit, stock_quantity)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.status) query = query.eq('status', queryParams.status);
    if (queryParams.priority) query = query.eq('priority', queryParams.priority);

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async updateStatus(id: string, status: 'approved' | 'rejected') {
    const { data, error } = await supabase
      .from('ai_recommendations')
      .update({ status })
      .eq('id', id)
      .select('*, products(id, sku, name, unit, stock_quantity)')
      .single();
    if (error) throw new AppError(400, error.message);
    return data;
  }

  private static cleanOpenFoodFactsTag(tag?: string) {
    if (!tag) return '';
    return tag
      .replace(/^[a-z]{2}:/i, '')
      .replace(/-/g, ' ')
      .trim();
  }

  private static inferUnit(product: OpenFoodFactsProduct) {
    const source = `${product.quantity || ''} ${product.product_name || ''}`.toLowerCase();
    if (source.includes('ml') || source.includes('l')) return 'Chai';
    if (source.includes('lon') || source.includes('can')) return 'Lon';
    if (source.includes('gói') || source.includes('pack')) return 'Gói';
    if (source.includes('hộp') || source.includes('box')) return 'Hộp';
    return 'Cái';
  }

  private static async fetchOpenFoodFacts(barcode: string): Promise<NormalizedProductInfo | null> {
    const fields = [
      'code',
      'product_name',
      'product_name_vi',
      'generic_name',
      'generic_name_vi',
      'brands',
      'categories',
      'categories_tags',
      'categories_tags_en',
      'quantity',
      'image_front_url',
      'image_url',
    ].join(',');

    const hosts = ['https://vn.openfoodfacts.org', 'https://world.openfoodfacts.org'];
    for (const host of hosts) {
      try {
        const response = await fetch(
          `${host}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
          {
            signal: AbortSignal.timeout(6000),
            headers: {
              'User-Agent': 'SoraPOS/1.0 (https://github.com/sora-pos)',
            },
          }
        );

        if (!response.ok) continue;

        const result = (await response.json()) as {
          status?: number;
          product?: OpenFoodFactsProduct;
        };

        if (result.status === 1 && result.product) {
          const product = result.product;
          const categoryTag =
            product.categories_tags?.[product.categories_tags.length - 1] ||
            product.categories_tags_en?.[product.categories_tags_en.length - 1] ||
            '';
          const categoryName =
            this.cleanOpenFoodFactsTag(categoryTag) ||
            (product.categories || '').split(',').map((v) => v.trim()).filter(Boolean).pop() ||
            '';

          const name =
            product.product_name_vi ||
            product.product_name ||
            product.generic_name_vi ||
            product.generic_name ||
            '';

          return {
            source: 'openfoodfacts',
            source_url: `${host}/product/${barcode}`,
            name: name || undefined,
            brand: product.brands || undefined,
            category: categoryName || undefined,
            description: product.quantity ? `Quy cách: ${product.quantity}` : undefined,
            image_url: product.image_front_url || product.image_url || undefined,
          };
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  }

  private static async fetchOpenBeautyFacts(barcode: string): Promise<NormalizedProductInfo | null> {
    try {
      const response = await fetch(
        `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
        {
          signal: AbortSignal.timeout(6000),
          headers: { 'User-Agent': 'SoraPOS/1.0' },
        }
      );
      if (!response.ok) return null;
      const result = await response.json() as any;
      if (result.status === 1 && result.product) {
        const product = result.product;
        return {
          source: 'openbeautyfacts',
          source_url: `https://world.openbeautyfacts.org/product/${barcode}`,
          name: product.product_name || product.generic_name || undefined,
          brand: product.brands || undefined,
          category: product.categories || undefined,
          image_url: product.image_front_url || product.image_url || undefined,
        };
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  private static async fetchUPCitemdb(barcode: string): Promise<NormalizedProductInfo | null> {
    try {
      const response = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
        {
          headers: { 'User-Agent': 'SoraPOS/1.0' },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (!response.ok) return null;
      const data = (await response.json()) as {
        code?: string;
        items?: Array<{
          title?: string;
          brand?: string;
          category?: string;
          description?: string;
          images?: string[];
        }>;
      };
      if (data.code === 'OK' && data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          source: 'upcitemdb',
          source_url: `https://www.upcitemdb.com/upc/${barcode}`,
          name: item.title || undefined,
          brand: item.brand || undefined,
          category: item.category || undefined,
          description: item.description || undefined,
          image_url: item.images && item.images.length > 0 ? item.images[0] : undefined,
        };
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  private static async fetchICheck(barcode: string): Promise<NormalizedProductInfo | null> {
    try {
      const response = await fetch(
        `https://icheck.vn/san-pham/${encodeURIComponent(barcode)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (!response.ok) return null;
      const html = await response.text();

      // Parse title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (!titleMatch) return null;

      const fullTitle = titleMatch[1].trim();
      const name = fullTitle.replace(/\s*\|\s*iCheck(\.vn)?/gi, '').trim();

      if (
        !name ||
        name === 'iCheck - Mạng xã hội sản phẩm, quét mã vạch và truy xuất nguồn gốc' ||
        name.toLowerCase().includes('không tìm thấy') ||
        name.toLowerCase().includes('chưa được cập nhật') ||
        name.toLowerCase().includes('chua duoc cap nhat')
      ) {
        return null;
      }

      // Parse brand (Company name)
      let brand: string | undefined = undefined;
      const companyMatch = html.match(/(Công\s+ty\s+TNHH\s+[^<]+)/i) || html.match(/(Công\s+ty\s+Cổ\s+phần\s+[^<]+)/i);
      if (companyMatch) {
        brand = companyMatch[1].replace(/Doanh nghiệp sở hữu/i, '').trim();
      }

      // Parse image_url
      let imageUrl: string | undefined = undefined;
      const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (imageMatch && !imageMatch[1].includes('avatar-default') && !imageMatch[1].includes('logo-')) {
        imageUrl = imageMatch[1].trim();
      }

      return {
        source: 'icheck',
        source_url: `https://icheck.vn/san-pham/${barcode}`,
        name: name,
        brand: brand,
        image_url: imageUrl,
      };
    } catch (e) {
      // ignore
    }
    return null;
  }

  private static async fetchFromSearchEngine(barcode: string): Promise<NormalizedProductInfo[]> {
    const results: NormalizedProductInfo[] = [];

    // 1. Thử tìm kiếm bằng Yahoo Search
    try {
      const response = await fetch(
        `https://search.yahoo.com/search?q=${encodeURIComponent(barcode)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (response.ok) {
        const html = await response.text();
        const titleRegex = /<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/g;
        const compTextRegex = /<div class="compText[^"]*">([\s\S]*?)<\/div>/g;

        const titles: string[] = [];
        const snippets: string[] = [];
        let match;

        while ((match = titleRegex.exec(html)) !== null) {
          const cleanTitle = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          if (cleanTitle) {
            titles.push(this.decodeHtmlEntities(cleanTitle));
          }
        }

        while ((match = compTextRegex.exec(html)) !== null) {
          const cleanSnippet = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          if (cleanSnippet) {
            snippets.push(this.decodeHtmlEntities(cleanSnippet));
          }
        }

        const count = Math.min(titles.length, snippets.length, 5);
        for (let i = 0; i < count; i++) {
          results.push({
            source: 'web-search',
            source_url: 'https://search.yahoo.com',
            name: titles[i],
            description: snippets[i],
          });
        }
      }
    } catch (error) {
      console.warn('Lỗi khi fetch Yahoo Search (bỏ qua):', error);
    }

    // 2. Thử tìm kiếm bằng Bing Search nếu Yahoo không trả về kết quả (thường gặp khi chạy trên serverless Vercel bị chặn IP)
    if (results.length === 0) {
      try {
        const response = await fetch(
          `https://www.bing.com/search?q=${encodeURIComponent(barcode)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            signal: AbortSignal.timeout(6000),
          }
        );

        if (response.ok) {
          const html = await response.text();
          const blockRegex = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
          let match;

          while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
            const block = match[1];
            const titleMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
            if (titleMatch) {
              const titleText = titleMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
              const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || block.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
              const snippetText = pMatch ? pMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

              results.push({
                source: 'web-search',
                source_url: 'https://www.bing.com',
                name: this.decodeHtmlEntities(titleText),
                description: this.decodeHtmlEntities(snippetText),
              });
            }
          }
        }
      } catch (error) {
        console.warn('Lỗi khi fetch Bing Search (bỏ qua):', error);
      }
    }

    return results;
  }

  private static decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&aacute;/g, 'á').replace(/&amp;aacute;/g, 'á').replace(/&agrave;/g, 'à').replace(/&amp;agrave;/g, 'à')
      .replace(/&Aacute;/g, 'Á').replace(/&amp;Aacute;/g, 'Á').replace(/&Agrave;/g, 'À').replace(/&amp;Agrave;/g, 'À')
      .replace(/&eacute;/g, 'é').replace(/&amp;eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&amp;egrave;/g, 'è')
      .replace(/&Eacute;/g, 'É').replace(/&amp;Eacute;/g, 'É').replace(/&Egrave;/g, 'È').replace(/&amp;Egrave;/g, 'È')
      .replace(/&iacute;/g, 'í').replace(/&amp;iacute;/g, 'í').replace(/&igrave;/g, 'ì').replace(/&amp;igrave;/g, 'ì')
      .replace(/&Iacute;/g, 'Í').replace(/&amp;Iacute;/g, 'Í').replace(/&Igrave;/g, 'Ì').replace(/&amp;Igrave;/g, 'Ì')
      .replace(/&oacute;/g, 'ó').replace(/&amp;oacute;/g, 'ó').replace(/&ograve;/g, 'ò').replace(/&amp;ograve;/g, 'ò')
      .replace(/&Oacute;/g, 'Ó').replace(/&amp;Oacute;/g, 'Ó').replace(/&Ograve;/g, 'Ò').replace(/&amp;Ograve;/g, 'Ò')
      .replace(/&uacute;/g, 'ú').replace(/&amp;uacute;/g, 'ú').replace(/&ugrave;/g, 'ù').replace(/&amp;ugrave;/g, 'ù')
      .replace(/&Uacute;/g, 'Ú').replace(/&amp;Uacute;/g, 'Ú').replace(/&Ugrave;/g, 'Ù').replace(/&amp;Ugrave;/g, 'Ù')
      .replace(/&yacute;/g, 'ý').replace(/&amp;yacute;/g, 'ý').replace(/&ygrave;/g, 'ỳ').replace(/&amp;ygrave;/g, 'ỳ')
      .replace(/&Yacute;/g, 'Ý').replace(/&amp;Yacute;/g, 'Ý').replace(/&Ygrave;/g, 'Ỳ').replace(/&amp;Ygrave;/g, 'Ỳ')
      .replace(/&acirc;/g, 'â').replace(/&amp;acirc;/g, 'â').replace(/&ecirc;/g, 'ê').replace(/&amp;ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô').replace(/&amp;ocirc;/g, 'ô')
      .replace(/&Acirc;/g, 'Â').replace(/&amp;Acirc;/g, 'Â').replace(/&Ecirc;/g, 'Ê').replace(/&amp;Ecirc;/g, 'Ê').replace(/&Ocirc;/g, 'Ô').replace(/&amp;Ocirc;/g, 'Ô')
      .replace(/&atilde;/g, 'ã').replace(/&amp;atilde;/g, 'ã').replace(/&Atilde;/g, 'Ã').replace(/&amp;Atilde;/g, 'Ã').replace(/&otilde;/g, 'õ').replace(/&amp;otilde;/g, 'õ').replace(/&Otilde;/g, 'Õ').replace(/&amp;Otilde;/g, 'Õ')
      .replace(/&deg;/g, '°')
      .replace(/&trade;/g, '™')
      .replace(/&reg;/g, '®')
      .replace(/&copy;/g, '©');
  }

  private static async generateSku(name: string, barcode: string): Promise<string> {
    const cleanName = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .toUpperCase()
      .split(/[\s-]+/)
      .filter(Boolean);
    
    const tokens = cleanName.filter(t => t.length > 1 || !isNaN(Number(t))).slice(0, 3);
    const prefix = tokens.join('-');
    const suffix = barcode.slice(-4) || Math.floor(1000 + Math.random() * 9000).toString();
    
    const baseSku = prefix ? `${prefix}-${suffix}` : `SP-${suffix}`;
    let finalSku = baseSku;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
      try {
        const { data } = await supabase
          .from('products')
          .select('id')
          .eq('sku', finalSku)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!data) {
          exists = false;
        } else {
          attempts++;
          const rand = Math.floor(100 + Math.random() * 900).toString();
          finalSku = `${baseSku}-${rand}`;
        }
      } catch (err) {
        console.error('Lỗi check SKU trùng:', err);
        return `${baseSku}-${Date.now().toString().slice(-4)}`;
      }
    }

    return finalSku;
  }

  private static localMergeResults(results: NormalizedProductInfo[], barcode: string) {
    const rawName = results.map(r => r.name).find(Boolean) || '';
    const brand = results.map(r => r.brand).find(Boolean) || null;
    const categoryName = results.map(r => r.category).find(Boolean) || null;
    const description = results.map(r => r.description).find(Boolean) || '';
    const imageUrl = results.map(r => r.image_url).find(Boolean) || null;

    // Lọc sạch tên cửa hàng / sàn thương mại điện tử khỏi tên sản phẩm
    const cleanedRawName = rawName
      .replace(/\s*[-–|:|]\s*(Minh Cầu Mart|Bách Hóa Xanh|Shopee|Tiki|Lazada|Sendo|WinMart|Coopmart|Co\.opmart|Điện Máy Xanh|Thế Giới Di Động|Siêu thị.*|Giá rẻ.*|Mua ngay.*)$/gi, '')
      .trim();

    // Xây tên tốt nhất: nếu tên gốc chưa chứa brand thì thêm brand vào
    let name = cleanedRawName;
    if (brand && cleanedRawName && !cleanedRawName.toLowerCase().includes(brand.toLowerCase())) {
      name = `${brand} ${cleanedRawName}`;
    }
    if (!name) name = `Sản phẩm ${barcode}`;
    
    const unitSource = `${name} ${description}`.toLowerCase();
    let unit = 'Cái';
    if (/\blon\b/.test(unitSource) || /\bcan\b/.test(unitSource)) unit = 'Lon';
    else if (unitSource.includes('ml') || /\bchai\b/.test(unitSource) || /\bbottle\b/.test(unitSource)) unit = 'Chai';
    else if (/\bgói\b/.test(unitSource) || /\bpack\b/.test(unitSource)) unit = 'Gói';
    else if (/\bhộp\b/.test(unitSource) || /\bbox\b/.test(unitSource)) unit = 'Hộp';
    else if (/\bhũ\b/.test(unitSource) || /\bjar\b/.test(unitSource)) unit = 'Hũ';
    else if (/\btúi\b/.test(unitSource) || /\bbag\b/.test(unitSource)) unit = 'Túi';

    return {
      name,
      brand,
      category_name: categoryName,
      unit,
      description: description || `Thông tin sản phẩm tự động từ cơ sở dữ liệu mã vạch cho mã ${barcode}.`,
      image_url: imageUrl || undefined,
    };
  }

  private static async groqMergeResults(
    results: NormalizedProductInfo[],
    barcode: string,
    categoriesList: Array<{ id: string; name: string }>
  ) {
    if (!env.groqApiKey) return null;

    const formattedCategories = categoriesList.map(c => `- ID: ${c.id}, Name: ${c.name}`).join('\n');
    
    // Lấy tên gốc từ nguồn dữ liệu đầu tiên để ép AI không bịa
    const sourceNames = results.map(r => r.name).filter(Boolean);
    const sourceBrands = results.map(r => r.brand).filter(Boolean);
    const bestSourceName = sourceNames[0] || '';
    
    const prompt = `Bạn là trợ lý dữ liệu POS. Chuẩn hóa thông tin sản phẩm từ dữ liệu mã vạch.
Mã vạch: ${barcode}

Dữ liệu thô:
${JSON.stringify(results, null, 2)}

Danh mục POS hiện có:
${formattedCategories}

QUY TẮC BẮT BUỘC:
1. "name": Chuẩn hóa tên sản phẩm từ dữ liệu gốc ở trên. Hãy loại bỏ các hậu tố tên thương mại, tên website hoặc cửa hàng (ví dụ: "- Minh Cầu Mart", "- Bách Hóa Xanh", "- Shopee", "Tiki", "Lazada", "Siêu thị...", "Giá rẻ...", "Mua ngay...") và các thông tin quảng cáo/khuyến mãi thừa thãi. Chỉ giữ lại tên sản phẩm chính xác kèm dung tích/trọng lượng nếu có. Tên gốc tham chiếu: "${bestSourceName}"
2. "brand": Lấy đúng thương hiệu của sản phẩm từ trường "brand" trong dữ liệu gốc. Nếu không có trường thương hiệu rõ ràng (ví dụ dữ liệu từ web-search), hãy phân tích tiêu đề và mô tả sản phẩm để trích xuất thương hiệu chính xác nhất (ví dụ: "Pepsi", "Coca-Cola", "Trung Nguyên", "Chinsu"...). Nếu không xác định được thương hiệu, hãy để null.
3. "category_name": CHỈ chọn 1 tên danh mục CÓ TRONG danh sách trên. Nếu không phù hợp → null. KHÔNG tự chế danh mục.
4. "unit": Chọn đơn vị (Lon, Chai, Gói, Hộp, Cái, Túi, Lốc, Thùng, Cây, Cuộn). Lon dạng can/lon kim loại. Chai dạng chai nhựa/thủy tinh.
5. "description": Mô tả ngắn 20-40 từ tiếng Việt, tự nhiên.

Chỉ trả về JSON thuần túy:
{
  "name": "...",
  "brand": "...",
  "category_name": "...",
  "unit": "...",
  "description": "..."
}`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'Bạn là trợ lý dữ liệu POS. Chỉ trả về JSON thuần túy. TUYỆT ĐỐI KHÔNG thay đổi tên sản phẩm hoặc thương hiệu từ dữ liệu gốc.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
          max_tokens: 400,
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      const cleanJsonStr = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      // === VALIDATION: Kiểm tra AI có bịa tên không ===
      const aiName = (parsed.name || '').toLowerCase();
      const allSourceText = [...sourceNames, ...sourceBrands].join(' ').toLowerCase();
      
      // Tách từ quan trọng (>= 3 ký tự) từ tên AI trả về
      const aiWords = aiName.replace(/[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ0-9\s]/gi, '')
        .split(/\s+/)
        .filter((w: string) => w.length >= 3);
      
      // Ít nhất 1 từ quan trọng trong tên AI phải có trong dữ liệu gốc
      const hasOverlap = aiWords.length === 0 || aiWords.some((word: string) => allSourceText.includes(word));
      
      if (!hasOverlap) {
        console.warn(`[AI Validation] Tên AI "${parsed.name}" không khớp dữ liệu gốc "${sourceNames.join(', ')}". Dùng tên gốc.`);
        parsed.name = bestSourceName;
      }

      // Lấy image_url từ nguồn gốc, không để AI bịa URL
      const sourceImageUrl = results.map(r => r.image_url).find(Boolean) || undefined;

      return {
        name: parsed.name || undefined,
        brand: parsed.brand || undefined,
        category_name: parsed.category_name || undefined,
        unit: parsed.unit || undefined,
        description: parsed.description || undefined,
        image_url: sourceImageUrl,
      };
    } catch (e) {
      console.error('Lỗi khi gọi Groq AI để merge sản phẩm:', e);
      return null;
    }
  }

  /**
   * Parse nội dung QR code thông minh — trích xuất barcode/GTIN từ nhiều định dạng:
   * - GS1 Digital Link: https://id.gs1.org/01/08934680036832
   * - iCheck: https://icheck.vn/san-pham/8934680036832
   * - Open Food Facts: https://world.openfoodfacts.org/product/8934680036832
   * - Barcode thuần: 8934680036832
   * - URL chứa số barcode trong path
   */
  private static extractBarcodeFromQR(rawInput: string): { barcode: string; qrUrl?: string } {
    const input = String(rawInput || '').trim();

    // 1. GS1 Digital Link — tìm /01/ + 8-14 chữ số (GTIN)
    const gs1Match = input.match(/\/01\/(\d{8,14})/);
    if (gs1Match) {
      return { barcode: gs1Match[1], qrUrl: input };
    }

    // 2. iCheck URL — https://icheck.vn/san-pham/{barcode}
    const icheckMatch = input.match(/icheck\.vn\/san-pham\/(\d{6,14})/i);
    if (icheckMatch) {
      return { barcode: icheckMatch[1], qrUrl: input };
    }

    // 3. Open Food Facts / Open Beauty Facts / Open Products Facts URL
    const offMatch = input.match(/open(?:food|beauty|pet|products?)facts\.org\/(?:api\/v\d\/)?product\/(\d{6,14})/i);
    if (offMatch) {
      return { barcode: offMatch[1], qrUrl: input };
    }

    // 4. Barcodelookup URL
    const bclMatch = input.match(/barcodelookup\.com\/(\d{6,14})/i);
    if (bclMatch) {
      return { barcode: bclMatch[1], qrUrl: input };
    }

    // 5. URL chung chứa chuỗi số dài 8-14 ký tự trong path (fallback cho QR nhà sản xuất)
    if (/^https?:\/\//i.test(input)) {
      // Tìm chuỗi số 8-14 trong path (sau domain)
      const urlPath = input.replace(/^https?:\/\/[^/]+/i, '');
      const numMatch = urlPath.match(/(\d{8,14})/);
      if (numMatch) {
        return { barcode: numMatch[1], qrUrl: input };
      }
      // Nếu URL không chứa barcode → trả về URL để fetch metadata
      return { barcode: '', qrUrl: input };
    }

    // 6. Input thuần là số (barcode truyền thống)
    const digitsOnly = input.replace(/\D/g, '');
    return { barcode: digitsOnly };
  }

  private static async fetchWithSsrfProtection(url: string, headers: Record<string, string>, timeout = 8000): Promise<{ text: () => Promise<string>; ok: boolean } | null> {
    let currentUrl = url;
    const maxRedirects = 3;
    
    for (let redirectCount = 0; redirectCount < maxRedirects; redirectCount++) {
      const isSafe = await isSafeUrl(currentUrl);
      if (!isSafe) {
        console.warn(`[SSRF Protection] Blocked unsafe URL: ${currentUrl}`);
        return null;
      }
      
      try {
        const response = await fetch(currentUrl, {
          headers,
          signal: AbortSignal.timeout(timeout),
          redirect: 'manual',
        });
        
        if ([301, 302, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            return null;
          }
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        
        if (!response.ok) return null;
        
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) { // 1MB limit
          console.warn(`[SSRF Protection] Blocked large payload from ${currentUrl}: ${contentLength} bytes`);
          return null;
        }
        
        return response;
      } catch (e) {
        return null;
      }
    }
    
    console.warn(`[SSRF Protection] Exceeded max redirects for ${url}`);
    return null;
  }

  /**
   * Fetch thông tin sản phẩm từ URL QR code (scrape metadata OG tags)
   */
  private static async fetchProductFromQRUrl(url: string): Promise<NormalizedProductInfo | null> {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      };
      const response = await this.fetchWithSsrfProtection(url, headers, 8000);
      if (!response || !response.ok) return null;

      const html = await response.text();

      // Parse OG tags + title
      const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1];
      const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1];
      const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
      const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1];

      const name = ogTitle || titleTag?.replace(/\s*[\|–-]\s*.+$/, '').trim();
      if (!name || name.length < 3) return null;

      // Tìm barcode trong HTML (nếu trang hiển thị barcode)
      const barcodeInPage = html.match(/(?:barcode|mã vạch|EAN|UPC|GTIN)[:\s]*(\d{8,14})/i)?.[1];

      return {
        source: 'qr-url',
        source_url: url,
        name: name || undefined,
        description: ogDesc || undefined,
        image_url: ogImage && !ogImage.includes('logo') && !ogImage.includes('avatar') ? ogImage : undefined,
      };
    } catch (e) {
      // ignore
    }
    return null;
  }

  static async identifyProductByBarcode(barcode: string) {
    // === SMART QR PARSER: Xử lý cả QR code URL lẫn barcode thuần ===
    const { barcode: extractedBarcode, qrUrl } = this.extractBarcodeFromQR(barcode);
    const cleanBarcode = extractedBarcode.replace(/\D/g, '');

    if (cleanBarcode.length < 6 && !qrUrl) {
      throw new AppError(400, 'Mã vạch không hợp lệ');
    }


    try {
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*, categories(id, name), suppliers(id, name)')
        .eq('is_active', true)
        .or(`barcode.eq.${cleanBarcode},sku.eq.${cleanBarcode}`)
        .limit(1)
        .maybeSingle();

      if (existingProduct) {
        return {
          source: 'local',
          exists: true,
          barcode: existingProduct.barcode || cleanBarcode,
          sku: existingProduct.sku,
          name: existingProduct.name,
          brand: null,
          category_name: (existingProduct.categories as any)?.name || null,
          unit: existingProduct.unit || 'Cái',
          image_url: existingProduct.image_url || null,
          description: existingProduct.description || '',
          confidence: 'high',
          raw: existingProduct,
        };
      }
    } catch (error) {
      console.error('Lỗi khi kiểm tra local DB:', error);
    }

    const activeFetches: Promise<NormalizedProductInfo | null>[] = [];

    // Fetch từ barcode APIs (nếu có barcode hợp lệ)
    if (cleanBarcode.length >= 6) {
      activeFetches.push(this.fetchOpenFoodFacts(cleanBarcode));
      activeFetches.push(this.fetchOpenBeautyFacts(cleanBarcode));
      activeFetches.push(this.fetchUPCitemdb(cleanBarcode));
      activeFetches.push(this.fetchICheck(cleanBarcode));
    }

    // Fetch từ QR URL (nếu input là URL từ QR code)
    if (qrUrl) {
      activeFetches.push(this.fetchProductFromQRUrl(qrUrl));
    }

    let validResults: NormalizedProductInfo[] = [];
    try {
      const settleResults = await Promise.allSettled(activeFetches);
      validResults = settleResults
        .filter((r): r is PromiseFulfilledResult<NormalizedProductInfo> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    } catch (e) {
      console.error('Lỗi khi fetch barcode/QR APIs:', e);
    }

    if (validResults.length === 0 && cleanBarcode.length >= 6) {
      try {
        const searchResults = await this.fetchFromSearchEngine(cleanBarcode);
        if (searchResults.length > 0) {
          validResults.push(...searchResults);
        }
      } catch (err) {
        console.error('Lỗi khi tìm kiếm qua search engine fallback:', err);
      }
    }

    if (validResults.length === 0) {
      const identifier = cleanBarcode || qrUrl || barcode;
      throw new AppError(404, `Không tìm thấy thông tin sản phẩm trên bất kỳ hệ thống dữ liệu nào với mã: ${identifier}`);
    }

    let categoriesList: Array<{ id: string; name: string }> = [];
    try {
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true);
      categoriesList = categories || [];
    } catch (e) {
      // ignore
    }

    let merged: { name?: string; brand?: string | null; category_name?: string | null; unit?: string; description?: string; image_url?: string } | null = await this.groqMergeResults(validResults, cleanBarcode, categoriesList);
    let isAiProcessed = true;

    if (!merged) {
      merged = this.localMergeResults(validResults, cleanBarcode);
      isAiProcessed = false;
    }

    // merged is guaranteed non-null after localMergeResults fallback
    const finalMerged = merged!;

    const firstSourceUrl = validResults.map(r => r.source_url).find(Boolean) || '';
    const barcodeOrFallback = cleanBarcode || 'QR';
    const generatedSku = await this.generateSku(finalMerged.name || `Sản phẩm ${barcodeOrFallback}`, cleanBarcode || Date.now().toString().slice(-8));

    return {
      source: isAiProcessed ? 'ai-merged' : 'local-merged',
      source_url: firstSourceUrl || qrUrl || null,
      barcode: cleanBarcode || null,
      qr_url: qrUrl || null,
      sku: generatedSku,
      name: finalMerged.name || `Sản phẩm ${barcodeOrFallback}`,
      brand: finalMerged.brand || null,
      category_name: finalMerged.category_name || null,
      unit: finalMerged.unit || 'Cái',
      image_url: finalMerged.image_url || null,
      description: finalMerged.description || '',
      confidence: isAiProcessed ? 'high' : 'medium',
      exists: false,
      raw: {
        sources: validResults.map(r => r.source),
        items: validResults,
      },
    };
  }

  static async generateDescription(productName: string) {
    const prompt = `Viết một mô tả ngắn khoảng 25-45 từ cho sản phẩm bán lẻ tiêu dùng có tên: "${productName}". Mô tả cần tự nhiên, hấp dẫn, làm nổi bật công dụng hoặc điểm đặc biệt. Không thêm tiêu đề, lời chào hoặc dấu nháy kép.`;
    const insight = await this.groqInsight(prompt);
    if (insight) return insight;

    const nameLower = productName.toLowerCase();
    if (nameLower.includes('coca') || nameLower.includes('pepsi') || nameLower.includes('nước ngọt')) {
      return 'Nước ngọt giải khát có ga thơm ngon, sảng khoái, phù hợp dùng trong bữa ăn, tiệc nhỏ hoặc khi cần làm dịu cơn khát nhanh.';
    }
    if (nameLower.includes('nước suối') || nameLower.includes('aquafina')) {
      return 'Nước uống tinh khiết thanh mát, đóng chai tiện lợi, giúp bổ sung nước nhanh chóng và phù hợp sử dụng hằng ngày.';
    }
    if (nameLower.includes('bánh') || nameLower.includes('lay') || nameLower.includes('oreo')) {
      return 'Bánh ăn nhẹ thơm ngon, giòn tan và tiện lợi, phù hợp dùng khi làm việc, học tập hoặc chia sẻ cùng bạn bè.';
    }
    if (nameLower.includes('sữa') || nameLower.includes('vinamilk')) {
      return 'Sữa chất lượng cao, bổ sung dinh dưỡng cần thiết cho cơ thể, phù hợp sử dụng mỗi ngày cho cả gia đình.';
    }
    if (nameLower.includes('mì')) {
      return 'Mì ăn liền tiện lợi với hương vị đậm đà, dễ chế biến và phù hợp cho bữa ăn nhanh gọn mọi lúc.';
    }
    return `Sản phẩm ${productName} chất lượng, đóng gói tiện lợi, phù hợp nhu cầu mua sắm hằng ngày tại Sora Mart.`;
  }

  static async suggestCategory(productName: string, categories: Array<{ id: string; name: string }>) {
    if (categories.length === 0) return null;
    if (!env.groqApiKey) {
      return this.localSuggestCategory(productName, categories);
    }

    const categoriesList = categories.map((c) => `- ID: ${c.id}, Name: ${c.name}`).join('\n');
    const prompt = `Phân tích tên sản phẩm: "${productName}".
Dựa trên danh sách danh mục sau, hãy chọn một danh mục phù hợp nhất và trả về một đối tượng JSON chứa "categoryId" duy nhất của danh mục đó.
Ví dụ: {"categoryId": "uuid-cua-danh-muc"}

Danh sách danh mục:
${categoriesList}

Chỉ trả về JSON thuần túy.`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a POS data assistant. Identify the most appropriate category for the product name. Respond with JSON containing "categoryId" only.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
          max_tokens: 100,
        }),
      });

      if (response.ok) {
        const resData = await response.json() as any;
        const raw = resData.choices?.[0]?.message?.content?.trim() || null;
        if (raw) {
          const parsed = JSON.parse(raw);
          const suggestedId = parsed.categoryId?.trim();
          if (suggestedId && categories.some((c) => c.id === suggestedId)) {
            return suggestedId;
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi gợi ý danh mục bằng AI:', e);
    }

    return this.localSuggestCategory(productName, categories);
  }

  private static localSuggestCategory(productName: string, categories: Array<{ id: string; name: string }>) {
    const nameLower = productName.toLowerCase();

    for (const cat of categories) {
      const catLower = cat.name.toLowerCase();
      if (
        (nameLower.includes('coca') ||
          nameLower.includes('pepsi') ||
          nameLower.includes('nước ngọt') ||
          nameLower.includes('aquafina') ||
          nameLower.includes('suối') ||
          nameLower.includes('trà') ||
          nameLower.includes('bia') ||
          nameLower.includes('fanta') ||
          nameLower.includes('sprite')) &&
        (catLower.includes('nước') ||
          catLower.includes('uống') ||
          catLower.includes('giải khát') ||
          catLower.includes('đồ uống'))
      ) {
        return cat.id;
      }
      if (
        (nameLower.includes('mì') ||
          nameLower.includes('hảo hảo') ||
          nameLower.includes('phở') ||
          nameLower.includes('miến') ||
          nameLower.includes('cháo gói') ||
          nameLower.includes('kokomi') ||
          nameLower.includes('omachi')) &&
        (catLower.includes('mì') || catLower.includes('ăn liền') || catLower.includes('thực phẩm'))
      ) {
        return cat.id;
      }
      
      // Ưu tiên trùng khớp snack cụ thể
      if (nameLower.includes('snack') && (catLower.includes('snack') || catLower.includes('vặt') || catLower.includes('ăn vặt'))) {
        return cat.id;
      }

      if (
        (nameLower.includes('bánh') ||
          nameLower.includes('kẹo') ||
          nameLower.includes('oreo') ||
          nameLower.includes('lay') ||
          nameLower.includes('khoai tây') ||
          nameLower.includes('chupa chups')) &&
        (catLower.includes('bánh') || catLower.includes('kẹo') || catLower.includes('snack'))
      ) {
        return cat.id;
      }
      if (
        (nameLower.includes('sữa') ||
          nameLower.includes('vinamilk') ||
          nameLower.includes('th true') ||
          nameLower.includes('dutch lady') ||
          nameLower.includes('yo-most')) &&
        (catLower.includes('sữa') || catLower.includes('thực phẩm') || catLower.includes('dinh dưỡng'))
      ) {
        return cat.id;
      }
      if (
        (nameLower.includes('chén') ||
          nameLower.includes('bát') ||
          nameLower.includes('chảo') ||
          nameLower.includes('nồi') ||
          nameLower.includes('lau nhà') ||
          nameLower.includes('bột giặt') ||
          nameLower.includes('nước xả') ||
          nameLower.includes('sunlight') ||
          nameLower.includes('omo')) &&
        (catLower.includes('gia dụng') ||
          catLower.includes('tiêu dùng') ||
          catLower.includes('hằng ngày') ||
          catLower.includes('đồ dùng'))
      ) {
        return cat.id;
      }
    }

    return categories[0]?.id || null;
  }

  static async suggestCategoryImage(categoryName: string) {
    if (!env.groqApiKey) return null;
    const prompt = `Translate this product category name to English for image search. Category: "${categoryName}". Return ONLY a JSON object with a single key "keyword". Example: {"keyword": "fried rice"}`;
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a translation assistant. Translate the product category to a simple, descriptive English keyword suitable for image search. Return ONLY a valid JSON object.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
          max_tokens: 100,
        }),
      });

      if (!response.ok) return null;
      const responseData = await response.json() as any;
      const raw = responseData.choices?.[0]?.message?.content?.trim() || null;
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const searchKeyword = parsed.keyword?.toLowerCase().trim();
      if (!searchKeyword) return null;
      
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=filetype:bitmap%20${encodeURIComponent(searchKeyword)}&gsrnamespace=6&gsrlimit=10&pithumbsize=600`, {
        signal: AbortSignal.timeout(6000)
      });
      
      if (!res.ok) return null;
      const data = await res.json() as any;
      if (data?.query?.pages) {
        const pages = Object.values(data.query.pages) as any[];
        
        // Sort by search relevance index
        pages.sort((a, b) => (a.index || 0) - (b.index || 0));
        
        // Filter out non-product/building images
        const blacklistedKeywords = [
          'geograph.org.uk', 'factory', 'industrial', 'building', 'street',
          'road', 'map', 'logo', 'banner', 'diagram', 'sign', 'outside',
          'entrance', 'exterior', 'storefront', 'shopfront', 'office'
        ];
        
        const filteredPages = pages.filter(p => {
          const title = (p.title || '').toLowerCase();
          return !blacklistedKeywords.some(kw => title.includes(kw));
        });

        const image = filteredPages.find(p => p.thumbnail?.source);
        if (image?.thumbnail?.source) {
          return image.thumbnail.source;
        }
      }
    } catch(e) {
      console.error('Lỗi khi gợi ý ảnh danh mục:', e);
    }
    return null;
  }

  private static async fetchSearchSnippets(supplierName: string): Promise<string[]> {
    try {
      const query = `${supplierName} địa chỉ số điện thoại website`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return [];
      const html = await res.text();
      
      const snippets: string[] = [];
      let idx = html.indexOf('class="result__snippet"');
      while (idx !== -1) {
        const end = html.indexOf('</a>', idx);
        if (end === -1) break;
        const snippet = html.substring(idx, end).replace(/<[^>]*>/g, '').trim();
        snippets.push(snippet);
        idx = html.indexOf('class="result__snippet"', end);
      }
      return snippets.slice(0, 10);
    } catch (e) {
      console.error('Lỗi khi cào DuckDuckGo:', e);
      return [];
    }
  }

  private static async resolveCompanyDetails(supplierName: string) {
    try {
      const query = `mst ${supplierName}`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return null;
      const html = await res.text();
      const regex = /\b\d{10}\b/g;
      const matches = html.match(regex);
      if (!matches || matches.length === 0) return null;
      
      const uniqueMsts = Array.from(new Set(matches)).slice(0, 3);
      for (const mst of uniqueMsts) {
        const detailRes = await fetch(`https://api.vietqr.io/v2/business/${mst}`, {
          signal: AbortSignal.timeout(3000)
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json() as any;
          if (detailData.code === '00' && detailData.data) {
            return {
              name: detailData.data.name,
              address: detailData.data.address,
              tax_code: detailData.data.id,
            };
          }
        }
      }
    } catch (e) {
      console.error('Lỗi khi tra cứu MST nhà cung cấp:', e);
    }
    return null;
  }

  static async suggestSupplier(supplierName: string) {
    if (!env.groqApiKey) return null;

    // Lấy thông tin từ cả 2 nguồn: VietQR và Crawl snippets
    const [facts, snippets] = await Promise.all([
      this.resolveCompanyDetails(supplierName),
      this.fetchSearchSnippets(supplierName)
    ]);

    let promptContext = '';
    if (facts) {
      promptContext += `
Dữ liệu đăng ký mã số thuế chính thức:
- Tên công ty: ${facts.name}
- Mã số thuế: ${facts.tax_code}
- Địa chỉ đăng ký thuế: ${facts.address}
`;
    }

    if (snippets && snippets.length > 0) {
      promptContext += `
Dữ liệu tra cứu thực tế trên Internet (snippets):
---
${snippets.join('\n---\n')}
---
`;
    }

    const prompt = `Phân tích tên đối tác/nhà cung cấp: "${supplierName}".
Hãy tổng hợp thông tin doanh nghiệp chính xác nhất của thương hiệu này tại Việt Nam dựa trên các dữ liệu sau:
${promptContext}

Lưu ý quan trọng:
1. Đối với địa chỉ (address): 
   - Kiểm tra kỹ địa chỉ đăng ký thuế và các snippet thực tế. Nếu địa chỉ đăng ký thuế bị sai địa giới (ví dụ ghép phường Vĩnh Tân, VSIP II-A của Bình Dương vào "TP Hồ Chí Minh"), hãy sửa lại cho đúng tỉnh thành (Vĩnh Tân, Tân Uyên, Bình Dương).
   - Nếu có cả văn phòng đại diện ở TP.HCM (ví dụ: Trương Quốc Dung, Phú Nhuận) và nhà máy ở Bình Dương, hãy chọn địa chỉ văn phòng đại diện chính xác hoặc địa chỉ nhà máy đúng tỉnh thành. Tuyệt đối không ghép lẫn lộn.
2. Đối với số điện thoại (phone): Hãy tìm số điện thoại hotline hoặc số bàn (ví dụ: 02862883139 hoặc hotline di động) xuất hiện trong các snippet thực tế.
3. Đối với email và website: email phỏng đoán bắt buộc phải sử dụng chung tên miền (domain) với website gợi ý (Ví dụ: nếu website gợi ý là "maithu.com.vn" thì email bắt buộc phải là "info@maithu.com.vn" hoặc "contact@maithu.com.vn", TUYỆT ĐỐI KHÔNG sử dụng tên miền khác như "@baobimai.com.vn" cho email).

Trả về một đối tượng JSON duy nhất với cấu trúc sau:
{
  "name": "Tên đầy đủ chính thức của công ty",
  "email": "Email liên hệ chính thức, hoặc phỏng đoán theo tên miền website gợi ý ở dưới (Ví dụ: info@maithu.com.vn), hoặc null",
  "phone": "Số điện thoại liên hệ chính thức tìm được từ snippets, hoặc null",
  "address": "Địa chỉ văn phòng hoặc địa điểm chính xác tại Việt Nam, hoặc null",
  "tax_code": "Mã số thuế chính xác của công ty nếu có, hoặc null",
  "website": "Domain trang web chính thức (ví dụ: vinamilk.com.vn), hoặc null"
}

Chỉ trả về JSON thuần túy, không có giải thích, không markdown.`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'Bạn là trợ lý dữ liệu POS chuyên nghiệp. Bạn chỉ trả về duy nhất chuỗi JSON hợp lệ theo đúng cấu trúc yêu cầu, không thêm bất kỳ văn bản giải thích nào.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = data.choices?.[0]?.message?.content?.trim() || null;
      if (!raw) return null;

      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!jsonStr) return null;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Lỗi khi gợi ý thông tin nhà cung cấp:', e);
    }
    return null;
  }
}
