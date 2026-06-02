import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { parsePagination } from '../utils/query';

type Candidate = {
  id: string;
  sku: string;
  name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
};

const lastNDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export class AIService {
  private static async averageDailySales(productId: string, days = 30) {
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'completed')
      .gte('created_at', lastNDays(days));

    if (orderError) throw { status: 500, message: orderError.message };
    const orderIds = (orders || []).map((order) => order.id);
    if (orderIds.length === 0) return 0;

    const { data: details, error } = await supabase
      .from('order_details')
      .select('quantity')
      .eq('product_id', productId)
      .in('order_id', orderIds);

    if (error) throw { status: 500, message: error.message };
    const sold = (details || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return Number((sold / days).toFixed(2));
  }

  private static fallbackInsight(product: Candidate, avgDailySales: number, recommendedQuantity: number, targetDays: number) {
    if (recommendedQuantity <= 0) {
      return `Tồn kho hiện tại đủ cho mục tiêu ${targetDays} ngày dựa trên doanh số trung bình ${avgDailySales}/ngày.`;
    }
    if (product.stock_quantity <= 0) {
      return `Sản phẩm đã hết hàng. Nên ưu tiên nhập ${recommendedQuantity} ${product.unit || ''} để tránh mất đơn.`;
    }
    return `Tồn kho đang thấp hơn ngưỡng an toàn. Nên nhập ${recommendedQuantity} ${product.unit || ''} dựa trên doanh số trung bình ${avgDailySales}/ngày và mục tiêu ${targetDays} ngày.`;
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
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  static async generateRecommendations(targetDays = 14, userId?: string, productId?: string) {
    let query = supabase
      .from('products')
      .select('id, sku, name, stock_quantity, min_stock_level, unit')
      .eq('is_active', true);

    if (productId) query = query.eq('id', productId);
    const { data: products, error } = await query;
    if (error) throw { status: 500, message: error.message };

    const candidates = ((products || []) as Candidate[]).filter(
      (product) => product.stock_quantity <= product.min_stock_level || Boolean(productId)
    );

    const created = [];
    for (const product of candidates) {
      const averageDailySales = await this.averageDailySales(product.id, 30);
      const targetStock = Math.max(product.min_stock_level, Math.ceil(averageDailySales * targetDays));
      const recommendedQuantity = Math.max(targetStock - product.stock_quantity, 0);
      const priority =
        product.stock_quantity <= 0 || recommendedQuantity >= product.min_stock_level * 2
          ? 'high'
          : product.stock_quantity <= product.min_stock_level
            ? 'medium'
            : 'low';

      const reason =
        product.stock_quantity <= 0
          ? 'Sản phẩm đã hết hàng'
          : product.stock_quantity <= product.min_stock_level
            ? 'Sản phẩm thấp hơn hoặc bằng ngưỡng tồn kho tối thiểu'
            : 'Đánh giá theo mục tiêu tồn kho';

      const prompt = [
        `Sản phẩm: ${product.name} (${product.sku})`,
        `Tồn hiện tại: ${product.stock_quantity}`,
        `Ngưỡng tối thiểu: ${product.min_stock_level}`,
        `Doanh số trung bình 30 ngày: ${averageDailySales}/ngày`,
        `Số lượng đề xuất nhập: ${recommendedQuantity}`,
        `Mục tiêu tồn kho: ${targetDays} ngày`,
        'Hãy đưa ra cảnh báo tồn kho và khuyến nghị nhập hàng.',
      ].join('\n');

      const aiInsight =
        (await this.groqInsight(prompt)) ||
        this.fallbackInsight(product, averageDailySales, recommendedQuantity, targetDays);

      const { data: recommendation, error: insertError } = await supabase
        .from('ai_recommendations')
        .insert({
          product_id: product.id,
          current_stock: product.stock_quantity,
          min_stock_level: product.min_stock_level,
          average_daily_sales: averageDailySales,
          recommended_quantity: recommendedQuantity,
          priority,
          reason,
          ai_insight: aiInsight,
          status: 'pending',
          created_by: userId || null,
        })
        .select('*, products(id, sku, name, unit)')
        .single();

      if (insertError) throw { status: 400, message: insertError.message };
      created.push(recommendation);
    }

    return {
      target_days: targetDays,
      generated: created.length,
      recommendations: created,
      ai_provider: env.groqApiKey ? 'groq' : 'local-rules',
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
    if (error) throw { status: 500, message: error.message };
    return { items: data || [], pagination: { page, limit, total: count || 0 } };
  }

  static async updateStatus(id: string, status: 'approved' | 'rejected') {
    const { data, error } = await supabase
      .from('ai_recommendations')
      .update({ status })
      .eq('id', id)
      .select('*, products(id, sku, name, unit, stock_quantity)')
      .single();
    if (error) throw { status: 400, message: error.message };
    return data;
  }

  static async generateDescription(productName: string) {
    const prompt = `Viết một mô tả ngắn (khoảng 25-45 từ) bán hàng, hấp dẫn cho sản phẩm bán lẻ tiêu dùng có tên là: "${productName}". Mô tả cần làm nổi bật công dụng hoặc điểm đặc biệt của sản phẩm, viết bằng Tiếng Việt tự nhiên. Không thêm tiêu đề hay lời chào hay dấu nháy kép.`;
    const insight = await this.groqInsight(prompt);
    if (insight) return insight;
    
    // Fallback based on common category keywords in the name
    const nameLower = productName.toLowerCase();
    if (nameLower.includes('coca') || nameLower.includes('pepsi') || nameLower.includes('nước ngọt')) {
      return `Nước ngọt giải khát có ga thơm ngon sảng khoái, đập tan cơn khát tức thì. Rất thích hợp sử dụng trong các bữa tiệc ăn uống cùng bạn bè và gia đình.`;
    }
    if (nameLower.includes('nước suối') || nameLower.includes('aquafina')) {
      return `Nước uống tinh khiết được lọc qua hệ thống hiện đại, giữ trọn sự trong lành thanh mát, giúp bù nước nhanh chóng và duy trì năng lượng suốt ngày dài.`;
    }
    if (nameLower.includes('bánh') || nameLower.includes('lay') || nameLower.includes('oreo')) {
      return `Bánh giòn tan đậm vị, thơm ngon hấp dẫn. Là món ăn nhẹ tuyệt vời, cung cấp nguồn năng lượng nhanh cho những giờ làm việc và học tập căng thẳng.`;
    }
    if (nameLower.includes('sữa') || nameLower.includes('vinamilk')) {
      return `Sữa tươi thanh trùng chất lượng cao, bổ sung lượng Canxi và Vitamin thiết yếu cho cơ thể phát triển khỏe mạnh và tràn đầy sức sống mỗi ngày.`;
    }
    if (nameLower.includes('mì')) {
      return `Mì ăn liền thơm ngon với sợi mì dai giòn hòa quyện trong nước súp đậm đà, chuẩn vị truyền thống, là bữa ăn nhanh gọn lý tưởng cho mọi lúc mọi nơi.`;
    }
    return `Sản phẩm ${productName} chất lượng cao, an toàn vệ sinh thực phẩm, đóng gói tiện lợi. Được kiểm định chính hãng và phân phối với mức giá ưu đãi tại Sora Mart.`;
  }

  static async suggestCategory(productName: string, categories: Array<{ id: string; name: string }>) {
    if (categories.length === 0) return null;

    const categoriesList = categories.map(c => `- ID: ${c.id}, Name: ${c.name}`).join('\n');
    const prompt = `Phân tích tên sản phẩm: "${productName}".
Dựa trên danh sách các danh mục sau đây, hãy chọn ra một danh mục phù hợp nhất và chỉ trả về duy nhất ID của danh mục đó, không thêm bất kỳ văn bản giải thích nào khác.

Danh sách danh mục:
${categoriesList}

Chỉ trả về ID duy nhất (ví dụ: c853d9ea-3e91-4545-9271-bf75c7b39a3f).`;

    const suggestedId = await this.groqInsight(prompt);
    if (suggestedId && categories.some(c => c.id === suggestedId.trim())) {
      return suggestedId.trim();
    }

    // Local rule-based fallback if Groq is not set or returns invalid ID
    const nameLower = productName.toLowerCase();
    
    for (const cat of categories) {
      const catLower = cat.name.toLowerCase();
      if (
        (nameLower.includes('coca') || nameLower.includes('pepsi') || nameLower.includes('nước ngọt') || nameLower.includes('aquafina') || nameLower.includes('suối') || nameLower.includes('trà') || nameLower.includes('bia') || nameLower.includes('fanta') || nameLower.includes('sprite')) && 
        (catLower.includes('nước') || catLower.includes('uống') || catLower.includes('giải khát') || catLower.includes('đồ uống'))
      ) {
        return cat.id;
      }
      if (
        (nameLower.includes('mì') || nameLower.includes('hảo hảo') || nameLower.includes('phở') || nameLower.includes('miến') || nameLower.includes('cháo gói') || nameLower.includes('kokomi') || nameLower.includes('omachi')) && 
        (catLower.includes('mì') || catLower.includes('ăn liền') || catLower.includes('thực phẩm'))
      ) {
        return cat.id;
      }
      if (
        (nameLower.includes('bánh') || nameLower.includes('kẹo') || nameLower.includes('oreo') || nameLower.includes('lay') || nameLower.includes('khoai tây') || nameLower.includes('snack') || nameLower.includes('chupa chups')) && 
        (catLower.includes('bánh') || catLower.includes('kẹo') || catLower.includes('snack'))
      ) {
        return cat.id;
      }
      if (
        (nameLower.includes('sữa') || nameLower.includes('vinamilk') || nameLower.includes('th true') || nameLower.includes('dutch lady') || nameLower.includes('yo-most')) && 
        (catLower.includes('sữa') || catLower.includes('thực phẩm') || catLower.includes('dinh dưỡng'))
      ) {
        return cat.id;
      }
      if (
        (nameLower.includes('chén') || nameLower.includes('bát') || nameLower.includes('chảo') || nameLower.includes('nồi') || nameLower.includes('lau nhà') || nameLower.includes('bột giặt') || nameLower.includes('nước xả') || nameLower.includes('sunlight') || nameLower.includes('omo')) && 
        (catLower.includes('gia dụng') || catLower.includes('tiêu dùng') || catLower.includes('hàng ngày') || catLower.includes('đồ dùng'))
      ) {
        return cat.id;
      }
    }

    return categories[0]?.id || null;
  }
}
