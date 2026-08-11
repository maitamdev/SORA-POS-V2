import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { parsePagination } from '../utils/query';

type Query = Record<string, unknown>;
type CartItem = {
  product_id: string;
  category_id?: string | null;
  quantity: number;
  unit_price: number;
  cost_price?: number;
};

const enrichCartItemsWithCosts = async (items: CartItem[]) => {
  const productIds = Array.from(new Set(items.map((item) => item.product_id)));
  if (productIds.length === 0) return items;

  const { data, error } = await supabase
    .from('products')
    .select('id, sell_price, cost_price')
    .in('id', productIds);

  if (error) throw new AppError(503, 'Không thể xác thực giá vốn sản phẩm cho khuyến mãi');

  const productsById = new Map((data || []).map((product) => [product.id, product]));
  return items.flatMap((item) => {
    const product = productsById.get(item.product_id);
    if (!product) return [];

    return [{
      ...item,
      unit_price: Number(product.sell_price ?? item.unit_price ?? 0),
      cost_price: Math.max(Number(product.cost_price || 0), 0),
    }];
  });
};

const isMarginSafe = (items: CartItem[], revenue: number, discount: number) => {
  const cogs = items.reduce(
    (sum, item) => sum + Math.max(Number(item.cost_price || 0), 0) * Number(item.quantity || 0),
    0,
  );
  return Math.max(Number(revenue || 0) - Number(discount || 0), 0) >= cogs - 0.01;
};

/**
 * Helper: calculate discount based on promo type and applicable items
 */
function calculateDiscount(
  promo: Record<string, any>,
  applicableTotal: number,
  applicableItems: CartItem[]
): { discount_amount: number; free_items?: Array<{ product_id: string; quantity: number }> ; description: string } {
  const discType = promo.discount_type;

  if (discType === 'percent') {
    let amount = Math.floor((applicableTotal * Number(promo.discount_value)) / 100);
    if (promo.max_discount) amount = Math.min(amount, Number(promo.max_discount));
    return { discount_amount: amount, description: `Giảm ${promo.discount_value}%` };
  }

  if (discType === 'fixed_amount') {
    const amount = Math.min(Number(promo.discount_value), applicableTotal);
    return { discount_amount: amount, description: `Giảm ${Number(promo.discount_value).toLocaleString('vi-VN')}đ` };
  }

  if (discType === 'buy_x_get_y') {
    const buyQty = Number(promo.buy_quantity) || 0;
    const getQty = Number(promo.get_quantity) || 0;
    if (buyQty < 1 || getQty < 1) return { discount_amount: 0, description: '' };

    // Check if cart has enough qualifying items
    const totalQualifyingQty = applicableItems.reduce((sum, i) => sum + i.quantity, 0);
    const setsAvailable = Math.floor(totalQualifyingQty / (buyQty + getQty));

    if (setsAvailable < 1) {
      const needed = buyQty + getQty - totalQualifyingQty;
      return {
        discount_amount: 0,
        description: `Mua ${buyQty} tặng ${getQty} (Cần thêm ${needed} SP)`
      };
    }

    const freeCount = setsAvailable * getQty;

    // Calculate discount = price of cheapest items × free count
    const sortedByPrice = [...applicableItems]
      .flatMap(i => Array(i.quantity).fill(i.unit_price))
      .sort((a, b) => a - b);

    const actualFree = Math.min(freeCount, sortedByPrice.length);
    const discountAmount = sortedByPrice.slice(0, actualFree).reduce((sum, p) => sum + p, 0);

    const getProductIds = Array.isArray(promo.get_product_ids) ? promo.get_product_ids : [];
    const freeItems = getProductIds.length > 0
      ? getProductIds.map((pid: string) => ({ product_id: pid, quantity: getQty }))
      : undefined;

    return {
      discount_amount: discountAmount,
      free_items: freeItems,
      description: `Mua ${buyQty} tặng ${getQty}`,
    };
  }

  if (discType === 'fixed_price') {
    const comboQty = Number(promo.combo_quantity) || 0;
    const comboPrice = Number(promo.discount_value);
    if (comboQty < 2) return { discount_amount: 0, description: '' };

    const totalQualifyingQty = applicableItems.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQualifyingQty < comboQty) {
      const needed = comboQty - totalQualifyingQty;
      return {
        discount_amount: 0,
        description: `Combo ${comboQty} SP = ${comboPrice.toLocaleString('vi-VN')}đ (Cần thêm ${needed} SP)`
      };
    }

    // Sum the prices of the cheapest comboQty items (that's the original price)
    const sortedByPrice = [...applicableItems]
      .flatMap(i => Array(i.quantity).fill(i.unit_price))
      .sort((a, b) => a - b);

    const originalComboPrice = sortedByPrice.slice(0, comboQty).reduce((sum, p) => sum + p, 0);
    const discountAmount = Math.max(originalComboPrice - comboPrice, 0);

    return {
      discount_amount: discountAmount,
      description: `Combo ${comboQty} SP = ${comboPrice.toLocaleString('vi-VN')}đ`,
    };
  }

  if (discType === 'nth_item_discount') {
    const nth = Number(promo.nth_item) || 2;
    const pct = Number(promo.discount_value);
    if (pct <= 0 || pct > 100) return { discount_amount: 0, description: '' };

    const totalQualifyingQty = applicableItems.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQualifyingQty < nth) {
      const needed = nth - totalQualifyingQty;
      return {
        discount_amount: 0,
        description: `Mua ${nth} SP để được giảm SP thứ ${nth} (Cần thêm ${needed} SP)`
      };
    }

    // Sort by price descending → the nth cheapest item gets discount
    const sortedByPrice = [...applicableItems]
      .flatMap(i => Array(i.quantity).fill(i.unit_price))
      .sort((a, b) => a - b);

    // How many "nth item" discounts apply: every Nth item in groups
    const numDiscounted = Math.floor(totalQualifyingQty / nth);
    let discountAmount = 0;
    for (let i = 0; i < numDiscounted; i++) {
      const itemPrice = sortedByPrice[i]; // cheapest items get discounted
      discountAmount += Math.floor((itemPrice * pct) / 100);
    }

    return {
      discount_amount: discountAmount,
      description: `SP thứ ${nth} giảm ${pct}%`,
    };
  }

  if (discType === 'happy_hour') {
    const pct = Number(promo.discount_value);
    if (pct <= 0 || pct > 100) return { discount_amount: 0, description: '' };

    // Check current time against happy hour window
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startTime = promo.happy_hour_start;
    const endTime = promo.happy_hour_end;
    if (!startTime || !endTime) return { discount_amount: 0, description: 'Chưa cấu hình khung giờ' };

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
      return { discount_amount: 0, description: `Chỉ áp dụng ${startTime}-${endTime}` };
    }

    let amount = Math.floor((applicableTotal * pct) / 100);
    if (promo.max_discount) amount = Math.min(amount, Number(promo.max_discount));

    return {
      discount_amount: amount,
      description: `Happy Hour ${startTime}-${endTime} giảm ${pct}%`,
    };
  }

  if (discType === 'bundle') {
    const bundleIds: string[] = Array.isArray(promo.bundle_product_ids)
      ? promo.bundle_product_ids
      : [];
    const bundlePrice = Number(promo.discount_value);
    if (bundleIds.length < 2 || bundlePrice <= 0) return { discount_amount: 0, description: '' };

    // Check if all bundle products are in cart
    const cartProductIds = applicableItems.map(i => i.product_id);
    const allPresent = bundleIds.every(id => cartProductIds.includes(id));
    if (!allPresent) {
      const missing = bundleIds.length - bundleIds.filter(id => cartProductIds.includes(id)).length;
      return {
        discount_amount: 0,
        description: `Mua combo nhóm SP = ${bundlePrice.toLocaleString('vi-VN')}đ (Còn thiếu ${missing} SP)`
      };
    }

    // Calculate original price of bundle items (1 each)
    const originalPrice = bundleIds.reduce((sum, id) => {
      const item = applicableItems.find(i => i.product_id === id);
      return sum + (item ? item.unit_price : 0);
    }, 0);

    const discountAmount = Math.max(originalPrice - bundlePrice, 0);

    return {
      discount_amount: discountAmount,
      description: `Bundle ${bundleIds.length} SP = ${bundlePrice.toLocaleString('vi-VN')}đ`,
    };
  }

  return { discount_amount: 0, description: '' };
}

/**
 * Helper: get applicable items and total based on promo scope
 */
function getApplicableScope(
  promo: Record<string, any>,
  orderTotal: number,
  items: CartItem[]
): { applicableTotal: number; applicableItems: CartItem[] } {
  const applyToIds = Array.isArray(promo.apply_to_ids) ? promo.apply_to_ids : [];

  if (promo.apply_to === 'product' && applyToIds.length > 0) {
    const filtered = items.filter((i) => applyToIds.includes(i.product_id));
    return {
      applicableTotal: filtered.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
      applicableItems: filtered,
    };
  }
  if (promo.apply_to === 'category' && applyToIds.length > 0) {
    const filtered = items.filter((i) => i.category_id && applyToIds.includes(i.category_id));
    return {
      applicableTotal: filtered.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
      applicableItems: filtered,
    };
  }
  return { applicableTotal: orderTotal, applicableItems: items };
}


export class PromotionService {
  /* ─── LIST ─── */
  static async list(query: Query) {
    const { page, limit, from, to } = parsePagination(query);
    const status = query.status as string | undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : '';

    let q = supabase
      .from('promotions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    const now = new Date().toISOString();

    if (status === 'active') {
      q = q
        .eq('is_active', true)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`);
    } else if (status === 'expired') {
      q = q.or(`is_active.eq.false,end_date.lt.${now}`);
    }

    if (search) {
      q = q.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw new AppError(500, error.message);

    return {
      items: data || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  /* ─── GET BY ID ─── */
  static async getById(id: string) {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new AppError(404, 'Không tìm thấy khuyến mãi');
    return data;
  }

  /* ─── CREATE ─── */
  static async create(body: Record<string, unknown>, userId?: string) {
    const code = typeof body.code === 'string' && body.code.trim()
      ? body.code.trim().toUpperCase()
      : null;

    if (code) {
      const { data: existing } = await supabase
        .from('promotions')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (existing) throw new AppError(409, `Mã khuyến mãi "${code}" đã tồn tại`);
    }

    const { data, error } = await supabase
      .from('promotions')
      .insert({
        name: body.name,
        code,
        description: body.description || null,
        discount_type: body.discount_type,
        discount_value: body.discount_value || 0,
        max_discount: body.max_discount || null,
        min_order_amount: body.min_order_amount || 0,
        buy_quantity: body.buy_quantity || 0,
        get_quantity: body.get_quantity || 0,
        get_product_ids: body.get_product_ids || [],
        combo_quantity: body.combo_quantity || 0,
        apply_to: body.apply_to || 'all',
        apply_to_ids: body.apply_to_ids || [],
        start_date: body.start_date || new Date().toISOString(),
        end_date: body.end_date || null,
        usage_limit: body.usage_limit || null,
        is_active: body.is_active !== false,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error) throw new AppError(500, error.message);
    return data;
  }

  /* ─── UPDATE ─── */
  static async update(id: string, body: Record<string, unknown>) {
    await this.getById(id);

    const updateData: Record<string, unknown> = {};
    const fields = [
      'name', 'description', 'discount_type', 'discount_value',
      'max_discount', 'min_order_amount', 'buy_quantity', 'get_quantity',
      'get_product_ids', 'combo_quantity', 'apply_to', 'apply_to_ids',
      'start_date', 'end_date', 'usage_limit', 'is_active',
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        // Normalize nullables
        if (['description', 'max_discount', 'end_date', 'usage_limit'].includes(field)) {
          updateData[field] = body[field] || null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (body.code !== undefined) {
      const code = typeof body.code === 'string' && body.code.trim()
        ? body.code.trim().toUpperCase()
        : null;

      if (code) {
        const { data: dup } = await supabase
          .from('promotions')
          .select('id')
          .eq('code', code)
          .neq('id', id)
          .maybeSingle();
        if (dup) throw new AppError(409, `Mã khuyến mãi "${code}" đã tồn tại`);
      }
      updateData.code = code;
    }

    const { data, error } = await supabase
      .from('promotions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(500, error.message);
    return data;
  }

  /* ─── DELETE ─── */
  static async delete(id: string) {
    await this.getById(id);
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) throw new AppError(500, error.message);
    return { deleted: true };
  }

  /* ─── VALIDATE CODE (for POS checkout) ─── */
  static async validateCode(
    code: string,
    orderTotal: number,
    items: CartItem[]
  ) {
    const { data: promo, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new AppError(500, error.message);
    if (!promo) throw new AppError(404, 'Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu');

    const now = new Date();
    const startDate = new Date(promo.start_date);
    const endDate = promo.end_date ? new Date(promo.end_date) : null;

    if (now < startDate) throw new AppError(400, 'Chương trình khuyến mãi chưa bắt đầu');
    if (endDate && now > endDate) throw new AppError(400, 'Chương trình khuyến mãi đã hết hạn');
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      throw new AppError(400, 'Mã khuyến mãi đã hết lượt sử dụng');
    }
    if (orderTotal < Number(promo.min_order_amount)) {
      const minFormatted = Number(promo.min_order_amount).toLocaleString('vi-VN');
      throw new AppError(400, `Đơn hàng tối thiểu ${minFormatted}đ để áp dụng mã này`);
    }

    const pricedItems = await enrichCartItemsWithCosts(items);
    const effectiveOrderTotal = pricedItems.reduce(
      (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
      0,
    );
    const { applicableTotal, applicableItems } = getApplicableScope(promo, effectiveOrderTotal, pricedItems);

    if (applicableTotal <= 0 && promo.apply_to !== 'all') {
      throw new AppError(400, 'Không có sản phẩm nào trong đơn hàng thuộc phạm vi khuyến mãi');
    }

    const result = calculateDiscount(promo, applicableTotal, applicableItems);

    if (!isMarginSafe(applicableItems, applicableTotal, result.discount_amount)) {
      throw new AppError(400, 'Khuyến mãi này làm giá bán sau giảm thấp hơn giá vốn và không thể áp dụng');
    }

    return {
      valid: true,
      promotion: {
        id: promo.id,
        name: promo.name,
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: Number(promo.discount_value),
        max_discount: promo.max_discount ? Number(promo.max_discount) : null,
        apply_to: promo.apply_to,
        buy_quantity: promo.buy_quantity,
        get_quantity: promo.get_quantity,
        combo_quantity: promo.combo_quantity,
      },
      discount_amount: result.discount_amount,
      free_items: result.free_items,
      description: result.description,
      applicable_total: applicableTotal,
    };
  }

  /* ─── INCREMENT USAGE ─── */
  static async incrementUsage(promoId: string) {
    const { data: promo } = await supabase
      .from('promotions')
      .select('usage_count')
      .eq('id', promoId)
      .single();

    if (promo) {
      await supabase
        .from('promotions')
        .update({ usage_count: (promo.usage_count || 0) + 1 })
        .eq('id', promoId);
    }
  }

  /* ─── GET AUTO PROMOTIONS (no code, auto-apply) ─── */
  static async getAutoPromotions(orderTotal: number, items: CartItem[]) {
    const safeItems: CartItem[] = Array.isArray(items)
      ? items.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];

          const productId = typeof item.product_id === 'string' ? item.product_id : '';
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unit_price);

          if (
            !productId ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(unitPrice) ||
            unitPrice < 0
          ) {
            return [];
          }

          return [{
            product_id: productId,
            category_id: typeof item.category_id === 'string' ? item.category_id : null,
            quantity,
            unit_price: unitPrice,
          }];
        })
      : [];

    let pricedItems: CartItem[];
    try {
      pricedItems = await enrichCartItemsWithCosts(safeItems);
    } catch (error) {
      console.error('[Promotions] Không thể đọc giá vốn để kiểm tra biên lợi nhuận:', error);
      return [];
    }

    const effectiveOrderTotal = pricedItems.reduce(
      (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
      0,
    );
    let acceptedDiscount = 0;
    const now = new Date().toISOString();

    const { data: promos, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .is('code', null)
      .lte('start_date', now)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('discount_value', { ascending: false });

    if (error || !promos) return [];

    const results: Array<{
      promotion: Record<string, unknown>;
      discount_amount: number;
      applicable_product_ids?: string[];
      description: string;
      free_items?: Array<{ product_id: string; quantity: number }>;
    }> = [];

    for (const promo of promos) {
      try {
        if (promo.usage_limit && promo.usage_count >= promo.usage_limit) continue;

      const { applicableTotal, applicableItems } = getApplicableScope(promo, effectiveOrderTotal, pricedItems);

      // If the cart doesn't qualify for min_order_amount, check if it's relevant to show it as a suggestion
      if (effectiveOrderTotal < Number(promo.min_order_amount)) {
        if (applicableItems.length > 0 || promo.apply_to === 'all') {
          const needed = Number(promo.min_order_amount) - effectiveOrderTotal;
          results.push({
            promotion: {
              id: promo.id,
              name: promo.name,
              discount_type: promo.discount_type,
              discount_value: Number(promo.discount_value),
              max_discount: promo.max_discount ? Number(promo.max_discount) : null,
              apply_to: promo.apply_to,
              apply_to_ids: Array.isArray(promo.apply_to_ids) ? promo.apply_to_ids : [],
              bundle_product_ids: Array.isArray(promo.bundle_product_ids) ? promo.bundle_product_ids : [],
              get_product_ids: Array.isArray(promo.get_product_ids) ? promo.get_product_ids : [],
              buy_quantity: promo.buy_quantity,
              get_quantity: promo.get_quantity,
              combo_quantity: promo.combo_quantity,
            },
            discount_amount: 0,
            applicable_product_ids: applicableItems.map((item) => item.product_id),
            description: `Đơn tối thiểu ${Number(promo.min_order_amount).toLocaleString('vi-VN')}đ (Cần thêm ${needed.toLocaleString('vi-VN')}đ)`,
          });
        }
        continue;
      }

      if (applicableTotal <= 0 && promo.apply_to !== 'all') continue;

      const result = calculateDiscount(promo, applicableTotal, applicableItems);

      // Never suggest a promotion that makes the scoped products or the full
      // cart sell below cost. The final checkout guard remains authoritative.
      if (
        result.discount_amount > 0 &&
        (!isMarginSafe(applicableItems, applicableTotal, result.discount_amount) ||
          !isMarginSafe(pricedItems, effectiveOrderTotal, acceptedDiscount + result.discount_amount))
      ) {
        continue;
      }

      // Return the promotion if it either has discount_amount > 0 OR it is relevant but not yet fully met (discount_amount = 0)
      if (result.discount_amount > 0 || (applicableItems.length > 0 && promo.apply_to !== 'all') || (promo.apply_to === 'all' && pricedItems.length > 0)) {
        results.push({
          promotion: {
            id: promo.id,
            name: promo.name,
            discount_type: promo.discount_type,
            discount_value: Number(promo.discount_value),
            max_discount: promo.max_discount ? Number(promo.max_discount) : null,
            apply_to: promo.apply_to,
            apply_to_ids: Array.isArray(promo.apply_to_ids) ? promo.apply_to_ids : [],
            bundle_product_ids: Array.isArray(promo.bundle_product_ids) ? promo.bundle_product_ids : [],
            get_product_ids: Array.isArray(promo.get_product_ids) ? promo.get_product_ids : [],
            buy_quantity: promo.buy_quantity,
            get_quantity: promo.get_quantity,
            combo_quantity: promo.combo_quantity,
          },
          discount_amount: result.discount_amount,
          applicable_product_ids: promo.discount_type === 'bundle' && Array.isArray(promo.bundle_product_ids) && promo.bundle_product_ids.length > 0
            ? promo.bundle_product_ids
            : applicableItems.map((item) => item.product_id),
          description: result.description,
          free_items: result.free_items,
        });
        acceptedDiscount += result.discount_amount;
        }
      } catch (error) {
        // A malformed legacy promotion should not break checkout. Skip that
        // promotion and keep the remaining valid rules usable.
        console.error(`[Promotions] Skipping invalid promotion ${promo.id}:`, error);
      }
    }

    return results;
  }
}
