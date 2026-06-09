import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { parsePagination } from '../utils/query';

type Priority = 'low' | 'medium' | 'high';
type RestockStatus = 'out_of_stock' | 'low_stock' | 'needs_restock' | 'healthy';

type Candidate = {
  id: string;
  sku: string;
  name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
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

    if (item.stock_quantity <= 0) {
      return `Hết hàng, nên nhập ngay ${item.recommended_quantity} ${unit} để tránh mất đơn.`;
    }

    if (item.stock_quantity <= item.min_stock_level) {
      return `Tồn kho thấp, nên nhập ${item.recommended_quantity} ${unit} để đủ bán khoảng ${targetDays} ngày.`;
    }

    if (item.stock_days !== null && item.stock_days <= targetDays) {
      return `Tốc độ bán trung bình ${item.average_daily_sales}/ngày, nên nhập thêm ${item.recommended_quantity} ${unit} trước khi chạm ngưỡng thấp.`;
    }

    return `Tồn kho hiện tại đủ an toàn cho mục tiêu ${targetDays} ngày, tạm thời chỉ cần theo dõi.`;
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
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Bạn là trợ lý quản lý tồn kho POS. Trả lời tiếng Việt, ngắn gọn, có hành động cụ thể.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 180,
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

  private static async getAverageDailySalesMap(productIds: string[], days = 30) {
    const result = new Map<string, number>();
    productIds.forEach((id) => result.set(id, 0));
    if (productIds.length === 0) return result;

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'completed')
      .gte('created_at', lastNDays(days));

    if (orderError) throw new AppError(500, orderError.message);
    const orderIds = (orders || []).map((order) => order.id);
    if (orderIds.length === 0) return result;

    const { data: details, error } = await supabase
      .from('order_details')
      .select('product_id, quantity')
      .in('product_id', productIds)
      .in('order_id', orderIds);

    if (error) throw new AppError(500, error.message);

    for (const detail of details || []) {
      const productId = String(detail.product_id);
      result.set(productId, (result.get(productId) || 0) + Number(detail.quantity || 0));
    }

    for (const [productId, sold] of result.entries()) {
      result.set(productId, Number((sold / days).toFixed(2)));
    }

    return result;
  }

  private static toAnalysisItem(product: Candidate, averageDailySales: number, targetDays: number): RestockAnalysisItem {
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
      ai_insight: this.buildLocalInsight(
        {
          stock_quantity: currentStock,
          min_stock_level: minStockLevel,
          average_daily_sales: averageDailySales,
          recommended_quantity: recommendedQuantity,
          unit: product.unit,
          stock_days: stockDays,
        },
        targetDays
      ),
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
      .select('id, sku, name, stock_quantity, min_stock_level, unit')
      .eq('is_active', true);

    if (productId) query = query.eq('id', productId);

    const { data: products, error } = await query;
    if (error) throw new AppError(500, error.message);

    const candidates = (products || []) as Candidate[];
    const averageDailySalesMap = await this.getAverageDailySalesMap(
      candidates.map((product) => product.id),
      30
    );

    const items = candidates
      .map((product) => this.toAnalysisItem(product, averageDailySalesMap.get(product.id) || 0, normalizedTargetDays))
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

    const { data: existing, error: findError } = await supabase
      .from('ai_recommendations')
      .select('id')
      .eq('product_id', item.id)
      .eq('status', 'pending')
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
      const prompt = [
        `Sản phẩm: ${item.name} (${item.sku})`,
        `Tồn hiện tại: ${item.stock_quantity}`,
        `Ngưỡng tối thiểu: ${item.min_stock_level}`,
        `Bán trung bình 30 ngày: ${item.average_daily_sales}/ngày`,
        `Số lượng đề xuất nhập: ${item.recommended_quantity}`,
        `Mục tiêu tồn kho: ${analysis.target_days} ngày`,
        'Hãy đưa ra cảnh báo tồn kho và khuyến nghị nhập hàng.',
      ].join('\n');

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

      if (!name || name === 'iCheck - Mạng xã hội sản phẩm, quét mã vạch và truy xuất nguồn gốc' || name.toLowerCase().includes('không tìm thấy')) {
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
    const name = results.map(r => r.name).find(Boolean) || `Sản phẩm ${barcode}`;
    const brand = results.map(r => r.brand).find(Boolean) || null;
    const categoryName = results.map(r => r.category).find(Boolean) || null;
    const description = results.map(r => r.description).find(Boolean) || '';
    const imageUrl = results.map(r => r.image_url).find(Boolean) || null;
    
    const unitSource = `${name} ${description}`.toLowerCase();
    let unit = 'Cái';
    if (unitSource.includes('ml') || unitSource.includes('l')) unit = 'Chai';
    else if (unitSource.includes('lon') || unitSource.includes('can')) unit = 'Lon';
    else if (unitSource.includes('gói') || unitSource.includes('pack')) unit = 'Gói';
    else if (unitSource.includes('hộp') || unitSource.includes('box')) unit = 'Hộp';
    else if (unitSource.includes('hũ') || unitSource.includes('jar')) unit = 'Hũ';
    else if (unitSource.includes('túi') || unitSource.includes('bag')) unit = 'Túi';

    return {
      name,
      brand,
      category_name: categoryName,
      unit,
      description: description || `Thông tin sản phẩm tự động từ cơ sở dữ liệu mã vạch cho mã ${barcode}.`,
      image_url: imageUrl,
    };
  }

  private static async groqMergeResults(
    results: NormalizedProductInfo[],
    barcode: string,
    categoriesList: Array<{ id: string; name: string }>
  ) {
    if (!env.groqApiKey) return null;

    const formattedCategories = categoriesList.map(c => `- ID: ${c.id}, Name: ${c.name}`).join('\n');
    
    const prompt = `Bạn là một chuyên gia dữ liệu hàng hóa siêu thị. Hãy hợp nhất và chuẩn hóa thông tin sản phẩm từ các nguồn dữ liệu mã vạch sau đây thành một đối tượng JSON tiếng Việt.
Mã vạch: ${barcode}

Dữ liệu thô:
${JSON.stringify(results, null, 2)}

Danh mục POS hiện có:
${formattedCategories}

Yêu cầu xuất JSON:
1. "name": Tên tiếng Việt ngắn gọn, dễ hiểu dựa trên dữ liệu gốc. KHÔNG TỰ BỊA TÊN. Dịch sang tiếng Việt nếu cần.
2. "brand": Tên thương hiệu (nếu có trong dữ liệu gốc).
3. "category_name": CHỈ chọn 1 tên danh mục CÓ TRONG danh sách "Danh mục POS hiện có". Nếu không có danh mục nào hoàn toàn phù hợp, hãy trả về giá trị null. KHÔNG TỰ CHẾ DANH MỤC.
4. "unit": Chọn đơn vị tính tiếng Việt chuẩn xác nhất dựa theo tên sản phẩm (Gói, Hộp, Lon, Chai, Lốc, Thùng, Cái, Túi, Cây, Cuộn). Nếu không chắc chắn, hãy dùng "Cái" hoặc "Gói". Chú ý: Bánh kẹo thường là Gói/Hộp.
5. "description": Viết một đoạn mô tả ngắn gọn, hấp dẫn và tự nhiên (khoảng 20-40 từ) dựa trên tên gọi và phân loại. Hãy làm cho sản phẩm nghe có vẻ ngon miệng hoặc hữu ích, nhưng đừng dùng những từ ngữ y tế thái quá như "chữa bệnh", "chống lão hóa".

Chỉ trả về JSON thuần túy, không có giải thích, không có markdown.
{
  "name": "...",
  "brand": "...",
  "category_name": "...",
  "unit": "...",
  "description": "...",
  "image_url": "..."
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
              content: 'Bạn là trợ lý dữ liệu POS. Chỉ trả về JSON thuần túy, không có giải thích, không có khối mã ```json.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 400,
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      const cleanJsonStr = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJsonStr);
      return {
        name: parsed.name || undefined,
        brand: parsed.brand || undefined,
        category_name: parsed.category_name || undefined,
        unit: parsed.unit || undefined,
        description: parsed.description || undefined,
        image_url: parsed.image_url || undefined,
      };
    } catch (e) {
      console.error('Lỗi khi gọi Groq AI để merge sản phẩm:', e);
      return null;
    }
  }

  static async identifyProductByBarcode(barcode: string) {
    const cleanBarcode = String(barcode || '').replace(/\D/g, '');
    if (cleanBarcode.length < 6) {
      throw new AppError(400, 'Mã vạch không hợp lệ');
    }

    try {
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*, categories(id, name), suppliers(id, name)')
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
    activeFetches.push(this.fetchOpenFoodFacts(cleanBarcode));
    activeFetches.push(this.fetchOpenBeautyFacts(cleanBarcode));
    activeFetches.push(this.fetchUPCitemdb(cleanBarcode));
    activeFetches.push(this.fetchICheck(cleanBarcode));

    let validResults: NormalizedProductInfo[] = [];
    try {
      const settleResults = await Promise.allSettled(activeFetches);
      validResults = settleResults
        .filter((r): r is PromiseFulfilledResult<NormalizedProductInfo> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    } catch (e) {
      console.error('Lỗi khi fetch barcode APIs:', e);
    }

    if (validResults.length === 0) {
      throw new AppError(404, `Không tìm thấy thông tin sản phẩm trên bất kỳ hệ thống dữ liệu nào với mã: ${cleanBarcode}`);
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

    let merged = await this.groqMergeResults(validResults, cleanBarcode, categoriesList);
    let isAiProcessed = true;

    if (!merged) {
      merged = this.localMergeResults(validResults, cleanBarcode);
      isAiProcessed = false;
    }

    const firstSourceUrl = validResults.map(r => r.source_url).find(Boolean) || '';
    const generatedSku = await this.generateSku(merged.name || `Sản phẩm ${cleanBarcode}`, cleanBarcode);

    return {
      source: isAiProcessed ? 'ai-merged' : 'local-merged',
      source_url: firstSourceUrl || null,
      barcode: cleanBarcode,
      sku: generatedSku,
      name: merged.name || `Sản phẩm ${cleanBarcode}`,
      brand: merged.brand || null,
      category_name: merged.category_name || null,
      unit: merged.unit || 'Cái',
      image_url: merged.image_url || null,
      description: merged.description || '',
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

    const categoriesList = categories.map((c) => `- ID: ${c.id}, Name: ${c.name}`).join('\n');
    const prompt = `Phân tích tên sản phẩm: "${productName}".
Dựa trên danh sách danh mục sau, hãy chọn một danh mục phù hợp nhất và chỉ trả về duy nhất ID của danh mục đó.

Danh sách danh mục:
${categoriesList}

Chỉ trả về ID duy nhất.`;

    const suggestedId = await this.groqInsight(prompt);
    if (suggestedId && categories.some((c) => c.id === suggestedId.trim())) {
      return suggestedId.trim();
    }

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
      if (
        (nameLower.includes('bánh') ||
          nameLower.includes('kẹo') ||
          nameLower.includes('oreo') ||
          nameLower.includes('lay') ||
          nameLower.includes('khoai tây') ||
          nameLower.includes('snack') ||
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
      const result = await this.groqInsight(prompt);
      const jsonStr = result?.match(/\{[\s\S]*\}/)?.[0];
      if (!jsonStr) return null;
      const parsed = JSON.parse(jsonStr);
      const searchKeyword = parsed.keyword?.toLowerCase().trim();
      if (!searchKeyword) return null;
      
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=filetype:bitmap%20${encodeURIComponent(searchKeyword)}&gsrnamespace=6&gsrlimit=3&pithumbsize=600`, {
        signal: AbortSignal.timeout(6000)
      });
      
      if (!res.ok) return null;
      const data = await res.json() as any;
      if (data?.query?.pages) {
        const pages = Object.values(data.query.pages) as any[];
        const image = pages.find(p => p.thumbnail?.source);
        if (image?.thumbnail?.source) {
          return image.thumbnail.source;
        }
      }
    } catch(e) {
      console.error('Lỗi khi gợi ý ảnh danh mục:', e);
    }
    return null;
  }
}
