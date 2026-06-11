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
            content: 'Bạn là trợ lý quản lý tồn kho POS chuyên nghiệp. Trả lời tiếng Việt, ngắn gọn 2-3 câu văn liền mạch. TUYỆT ĐỐI KHÔNG dùng dấu **, dấu gạch đầu dòng (-), markdown hay định dạng đặc biệt. Chỉ viết câu văn thuần túy, tập trung vào hành động cụ thể cần làm.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() || null;
    // Làm sạch output: loại bỏ ** và - đầu dòng nếu AI vẫn tự thêm
    if (!raw) return null;
    return raw
      .replace(/\*\*/g, '')
      .replace(/^[-•]\s*/gm, '')
      .replace(/\n{2,}/g, ' ')
      .replace(/\n/g, '. ')
      .replace(/\.\s*\./g, '.')
      .trim();
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

      const prompt = [
        `Thời điểm phân tích: ${now}`,
        `Sản phẩm: ${item.name} (${item.sku})`,
        `Tồn hiện tại: ${item.stock_quantity} ${item.unit}`,
        `Ngưỡng tối thiểu: ${item.min_stock_level}`,
        `Bán trung bình 30 ngày: ${item.average_daily_sales}/ngày`,
        stockDaysLeft !== null ? `Dự kiến hết hàng sau: ${stockDaysLeft} ngày` : 'Chưa có dữ liệu bán hàng',
        `Số lượng đề xuất nhập: ${item.recommended_quantity}`,
        `Mục tiêu tồn kho: ${analysis.target_days} ngày`,
        '',
        'Hãy đưa ra nhận định ngắn gọn (2-3 câu) về tình trạng tồn kho và khuyến nghị cụ thể.',
        'Viết tự nhiên, chuyên nghiệp, tập trung vào hành động cần làm. Không dùng dấu ** hay markdown.',
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

    // Xây tên tốt nhất: nếu tên gốc chưa chứa brand thì thêm brand vào
    let name = rawName;
    if (brand && rawName && !rawName.toLowerCase().includes(brand.toLowerCase())) {
      name = `${brand} ${rawName}`;
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
1. "name": PHẢI dùng ĐÚNG tên sản phẩm từ dữ liệu gốc ở trên. TUYỆT ĐỐI KHÔNG được đổi tên, KHÔNG dịch tên thương hiệu. Ví dụ: nếu dữ liệu gốc ghi "Pepsi" thì PHẢI giữ "Pepsi", KHÔNG được đổi thành "Coca Cola" hay bất kỳ tên khác. Chỉ được chuẩn hóa format (bỏ ký tự thừa, thêm dung tích nếu có). Tên gốc tham chiếu: "${bestSourceName}"
2. "brand": Lấy ĐÚNG từ trường "brands" trong dữ liệu gốc. KHÔNG tự chế.
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

  /**
   * Fetch thông tin sản phẩm từ URL QR code (scrape metadata OG tags)
   */
  private static async fetchProductFromQRUrl(url: string): Promise<NormalizedProductInfo | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!response.ok) return null;

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
