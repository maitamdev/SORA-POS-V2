export const DEMO_PROMOTION_USAGE_KEY = 'sora_demo_promotion_usage';
export const DEMO_PROMOTION_USAGE_EVENT = 'sora:promotion-usage-updated';

export type PromotionUsageMap = Record<string, number>;

export const readDemoPromotionUsage = (): PromotionUsageMap => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(DEMO_PROMOTION_USAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => Number.isFinite(Number(value)))
        .map(([id, value]) => [id, Math.max(0, Number(value))])
    );
  } catch {
    return {};
  }
};

export const recordDemoPromotionUsage = (promotionIds: string[]) => {
  if (typeof window === 'undefined' || promotionIds.length === 0) return;

  const usage = readDemoPromotionUsage();
  promotionIds.forEach((id) => {
    if (id) usage[id] = (usage[id] || 0) + 1;
  });

  window.localStorage.setItem(DEMO_PROMOTION_USAGE_KEY, JSON.stringify(usage));
  window.dispatchEvent(new Event(DEMO_PROMOTION_USAGE_EVENT));
};
