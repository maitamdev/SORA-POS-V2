export interface MarginLine {
  product_id: string;
  product_name?: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount?: number;
}

export interface OrderMarginSummary {
  merchandiseTotal: number;
  discountAmount: number;
  finalAmount: number;
  cogs: number;
  grossProfit: number;
  isLoss: boolean;
}

const money = (value: number) => Math.round(value).toLocaleString('vi-VN');

/**
 * Calculates the margin using the same values that the checkout transaction
 * uses. This is intentionally kept pure so it can protect every checkout
 * path (online, offline replay and API callers) with regression tests.
 */
export const calculateOrderMargin = (
  lines: MarginLine[],
  orderDiscount = 0,
): OrderMarginSummary => {
  const merchandiseTotal = lines.reduce((sum, line) => {
    const lineTotal = Math.max(
      Number(line.unit_price || 0) * Number(line.quantity || 0) - Number(line.discount || 0),
      0,
    );
    return sum + lineTotal;
  }, 0);
  const cogs = lines.reduce(
    (sum, line) => sum + Math.max(Number(line.cost_price || 0), 0) * Number(line.quantity || 0),
    0,
  );
  const discountAmount = Math.min(
    Math.max(Number(orderDiscount || 0), 0),
    merchandiseTotal,
  );
  const finalAmount = Math.max(merchandiseTotal - discountAmount, 0);
  const grossProfit = finalAmount - cogs;

  return {
    merchandiseTotal,
    discountAmount,
    finalAmount,
    cogs,
    grossProfit,
    isLoss: grossProfit < -0.01,
  };
};

export const formatMarginLossMessage = (summary: OrderMarginSummary) =>
  `Giao dịch bị từ chối vì sẽ lỗ gộp ${money(Math.abs(summary.grossProfit))}đ ` +
  `(doanh thu sau giảm ${money(summary.finalAmount)}đ thấp hơn giá vốn ${money(summary.cogs)}đ).`;

