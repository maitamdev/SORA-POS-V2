/**
 * Smart Promotion Intent Parser
 * Phân tích mô tả khuyến mãi bằng tiếng Việt tự nhiên
 * và trả về cấu hình form tương ứng.
 *
 * Hỗ trợ 7 loại:
 *   1. percent            — "Giảm 20%", "giảm 15 phần trăm"
 *   2. fixed_amount       — "Giảm 50k", "giảm 30.000đ"
 *   3. buy_x_get_y        — "Mua 2 tặng 1", "mua 3 được 1"
 *   4. fixed_price         — "Combo 3 SP = 99k", "3 sản phẩm giá 99.000"
 *   5. nth_item_discount  — "SP thứ 2 giảm 50%", "cái thứ 2 giảm nửa giá"
 *   6. happy_hour         — "14h-17h giảm 30%", "happy hour 2h-5h chiều"
 *   7. bundle             — handled elsewhere (needs product picker)
 */

export type DiscountType =
  | 'percent'
  | 'fixed_amount'
  | 'buy_x_get_y'
  | 'fixed_price'
  | 'nth_item_discount'
  | 'happy_hour'
  | 'bundle';

export interface ParsedPromoIntent {
  discount_type: DiscountType;
  discount_value: number;
  max_discount?: number;
  buy_quantity?: number;
  get_quantity?: number;
  combo_quantity?: number;
  nth_item?: number;
  happy_hour_start?: string;
  happy_hour_end?: string;
  name: string;
  confidence: number; // 0-1
}

// Normalize Vietnamese text for matching
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse money values: "50k" → 50000, "30.000đ" → 30000, "99000" → 99000
function parseMoney(str: string): number {
  const cleaned = str.replace(/[.,\s]/g, '').replace(/[đd]/gi, '');
  if (/k$/i.test(str.replace(/[đd]/gi, ''))) {
    return parseInt(cleaned.replace(/k/i, '')) * 1000;
  }
  return parseInt(cleaned) || 0;
}

// Parse time: "14h" → "14:00", "2h chiều" → "14:00", "14:30" → "14:30"
function parseTime(str: string): string | null {
  // "14h30" or "14h" or "14:30"
  let match = str.match(/(\d{1,2})[h:](\d{2})?/i);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    // Adjust for "chiều" / "tối"
    if (hour < 12 && /chiều|tối/i.test(str)) hour += 12;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  // Just a number like "14" in context
  match = str.match(/(\d{1,2})/);
  if (match) {
    let hour = parseInt(match[1]);
    if (hour < 12 && /chiều|tối/i.test(str)) hour += 12;
    if (hour >= 0 && hour <= 23) return `${hour.toString().padStart(2, '0')}:00`;
  }
  return null;
}

export function parsePromotionIntent(rawInput: string): ParsedPromoIntent | null {
  const input = normalize(rawInput);
  if (input.length < 3) return null;

  // ───────────────────────────────────────
  // 1. Nth Item Discount — "SP thứ 2 giảm 50%"
  // Patterns:
  //   "sp thứ 2 giảm 50%"
  //   "sản phẩm thứ 2 giảm nửa giá"
  //   "cái thứ 2 giảm 50%"
  //   "giảm 50% sp thứ 2"
  //   "giảm 10% cho sp thứ 2"
  // ───────────────────────────────────────
  const nthPatterns = [
    // "sp/sản phẩm thứ N giảm X%"
    /(?:sp|sản phẩm|cái|món|ly|chai)\s*thứ\s*(\d+)\s*(?:giảm|giá|sale|off)\s*(?:giá\s*)?(\d+)\s*%/,
    // "giảm X% sp/sản phẩm thứ N"
    /giảm\s*(\d+)\s*%\s*(?:cho\s*)?(?:sp|sản phẩm|cái|món|ly|chai)\s*thứ\s*(\d+)/,
    // "sp thứ N nửa giá"
    /(?:sp|sản phẩm|cái|món)\s*thứ\s*(\d+)\s*(?:nửa giá|half)/,
    // "mua N giảm X% sp thứ N"
    /thứ\s*(\d+)\s*giảm\s*(\d+)\s*%/,
  ];

  for (const pat of nthPatterns) {
    const m = input.match(pat);
    if (m) {
      // Handle "nửa giá" case
      if (/nửa giá|half/i.test(input)) {
        const nth = parseInt(m[1]);
        return {
          discount_type: 'nth_item_discount',
          discount_value: 50,
          nth_item: nth,
          name: `SP thứ ${nth} giảm 50%`,
          confidence: 0.9,
        };
      }
      // Determine which group is nth and which is percent
      const g1 = parseInt(m[1]);
      const g2 = m[2] ? parseInt(m[2]) : null;

      // If first pattern: group1=nth, group2=percent
      if (g2 !== null && g1 <= 10 && g2 <= 100) {
        return {
          discount_type: 'nth_item_discount',
          discount_value: g2,
          nth_item: g1,
          name: `SP thứ ${g1} giảm ${g2}%`,
          confidence: 0.95,
        };
      }
      // Reverse pattern
      if (g2 !== null && g2 <= 10 && g1 <= 100) {
        return {
          discount_type: 'nth_item_discount',
          discount_value: g1,
          nth_item: g2,
          name: `SP thứ ${g2} giảm ${g1}%`,
          confidence: 0.95,
        };
      }
    }
  }

  // ───────────────────────────────────────
  // 2. Buy X Get Y — "Mua 2 tặng 1"
  // ───────────────────────────────────────
  const bogoPatterns = [
    /mua\s*(\d+)\s*(?:tặng|được|free|tặng thêm|kèm)\s*(\d+)/,
    /buy\s*(\d+)\s*(?:get|free)\s*(\d+)/i,
    /(\d+)\s*\+\s*(\d+)\s*(?:free|miễn phí|tặng)/,
  ];

  for (const pat of bogoPatterns) {
    const m = input.match(pat);
    if (m) {
      const buy = parseInt(m[1]);
      const get = parseInt(m[2]);
      if (buy >= 1 && get >= 1) {
        return {
          discount_type: 'buy_x_get_y',
          discount_value: 0,
          buy_quantity: buy,
          get_quantity: get,
          name: `Mua ${buy} tặng ${get}`,
          confidence: 0.95,
        };
      }
    }
  }

  // ───────────────────────────────────────
  // 3. Happy Hour — "14h-17h giảm 30%"
  // ───────────────────────────────────────
  const happyHourPatterns = [
    // "14h-17h giảm 30%"
    /(\d{1,2})[h:]?\d{0,2}\s*[-–đến]\s*(\d{1,2})[h:]?\d{0,2}\s*(?:giảm|sale|off)\s*(\d+)\s*%/,
    // "giảm 30% từ 14h đến 17h"
    /giảm\s*(\d+)\s*%\s*(?:từ|lúc|khoảng)\s*(\d{1,2})[h:]?\d{0,2}\s*[-–đến]\s*(\d{1,2})[h:]?\d{0,2}/,
    // "happy hour 14h-17h giảm 30%"
    /happy\s*hour\s*(\d{1,2})[h:]?\d{0,2}\s*[-–]\s*(\d{1,2})[h:]?\d{0,2}\s*(?:giảm|sale)?\s*(\d+)?\s*%?/i,
    // "khung giờ vàng 14-17 giảm 30%"
    /khung giờ\s*(?:vàng)?\s*(\d{1,2})[h:]?\d{0,2}\s*[-–đến]\s*(\d{1,2})[h:]?\d{0,2}\s*(?:giảm|sale)?\s*(\d+)?\s*%?/,
  ];

  for (const pat of happyHourPatterns) {
    const m = input.match(pat);
    if (m) {
      let startH: string, endH: string, pct: number;

      if (pat.source.startsWith('giảm')) {
        // Pattern: giảm X% từ HH đến HH
        pct = parseInt(m[1]);
        startH = parseTime(m[2] + 'h') || '14:00';
        endH = parseTime(m[3] + 'h') || '17:00';
      } else {
        // Pattern: HH-HH giảm X%
        startH = parseTime(m[1] + 'h') || '14:00';
        endH = parseTime(m[2] + 'h') || '17:00';
        pct = m[3] ? parseInt(m[3]) : 20;
      }

      if (pct > 0 && pct <= 100) {
        return {
          discount_type: 'happy_hour',
          discount_value: pct,
          happy_hour_start: startH,
          happy_hour_end: endH,
          name: `Happy Hour ${startH}-${endH} giảm ${pct}%`,
          confidence: 0.9,
        };
      }
    }
  }

  // ───────────────────────────────────────
  // 4. Fixed Price Combo — "combo 3 SP = 99k"
  // ───────────────────────────────────────
  const comboPatterns = [
    // "combo 3 sp = 99k"
    /combo\s*(\d+)\s*(?:sp|sản phẩm|món|cái)?\s*[=:giá]\s*(\d[\d.,]*k?đ?d?)/i,
    // "3 sp/sản phẩm = 99k"
    /(\d+)\s*(?:sp|sản phẩm|món|cái)\s*(?:=|giá|chỉ)\s*(\d[\d.,]*k?đ?d?)/,
    // "3 cái giá 99k"
    /(\d+)\s*(?:sp|sản phẩm|món|cái|ly|chai)\s*giá\s*(\d[\d.,]*k?đ?d?)/,
  ];

  for (const pat of comboPatterns) {
    const m = input.match(pat);
    if (m) {
      const qty = parseInt(m[1]);
      const price = parseMoney(m[2]);
      if (qty >= 2 && price > 0) {
        return {
          discount_type: 'fixed_price',
          discount_value: price,
          combo_quantity: qty,
          name: `Combo ${qty} SP = ${price.toLocaleString('vi-VN')}đ`,
          confidence: 0.9,
        };
      }
    }
  }

  // ───────────────────────────────────────
  // 5. Percent Discount — "Giảm 20%"
  // ───────────────────────────────────────
  const pctPatterns = [
    /giảm\s*(?:giá\s*)?(\d+)\s*%/,
    /sale\s*(\d+)\s*%/i,
    /(\d+)\s*%\s*(?:off|giảm|sale)/i,
    /discount\s*(\d+)\s*%/i,
  ];

  for (const pat of pctPatterns) {
    const m = input.match(pat);
    if (m) {
      const pct = parseInt(m[1]);
      if (pct > 0 && pct <= 100) {
        // Check for max_discount: "giảm 20% tối đa 50k"
        let maxDiscount: number | undefined;
        const maxMatch = input.match(/(?:tối đa|max|không quá|giới hạn)\s*(\d[\d.,]*k?đ?d?)/i);
        if (maxMatch) maxDiscount = parseMoney(maxMatch[1]);

        return {
          discount_type: 'percent',
          discount_value: pct,
          max_discount: maxDiscount,
          name: `Giảm ${pct}%${maxDiscount ? ` (tối đa ${maxDiscount.toLocaleString('vi-VN')}đ)` : ''}`,
          confidence: 0.9,
        };
      }
    }
  }

  // ───────────────────────────────────────
  // 6. Fixed Amount — "Giảm 50k", "giảm 30.000đ"
  // ───────────────────────────────────────
  const fixedPatterns = [
    /giảm\s*(?:giá\s*)?(\d[\d.,]*)\s*k/,
    /giảm\s*(?:giá\s*)?(\d[\d.,]*)\s*(?:đ|đồng|d|vnđ|vnd)/i,
    /giảm\s*(?:giá\s*)?(\d{4,})/,
  ];

  for (const pat of fixedPatterns) {
    const m = input.match(pat);
    if (m) {
      const amount = parseMoney(m[1] + (/k/i.test(input.slice(m.index || 0, (m.index || 0) + m[0].length + 2)) ? 'k' : ''));
      if (amount > 0) {
        return {
          discount_type: 'fixed_amount',
          discount_value: amount,
          name: `Giảm ${amount.toLocaleString('vi-VN')}đ`,
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}

/**
 * Generate suggestion examples for the smart input
 */
export const PROMO_EXAMPLES = [
  'Giảm 20% tối đa 50k',
  'Mua 2 tặng 1',
  'SP thứ 2 giảm 50%',
  'Combo 3 SP = 99k',
  '14h-17h giảm 30%',
  'Giảm 30k đơn từ 200k',
  'Mua 1 tặng 1',
  'SP thứ 2 nửa giá',
];
