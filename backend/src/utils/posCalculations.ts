export type PaymentMethod = 'cash' | 'transfer' | 'momo' | 'zalopay' | 'card' | string;

export type PaymentInput = {
  method: PaymentMethod;
  amount: number;
};

export type PaymentSummary = {
  cash: number;
  transfer: number;
  card: number;
  other: number;
};

export type ShiftCashSummary = {
  expected_cash: number;
  cash_difference: number;
};

export type OrderLineInput = {
  unit_price: number;
  quantity: number;
  discount?: number;
};

export type OrderTotals = {
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  points_earned: number;
};

export type StoreHealthInput = {
  low_stock_count: number;
  out_of_stock_count: number;
  cancelled_order_count: number;
  revenue_growth_percent: number;
  order_growth_percent: number;
};

export const toMoneyNumber = (value: unknown) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const summarizePayments = (payments: PaymentInput[]): PaymentSummary => {
  const totals: PaymentSummary = { cash: 0, transfer: 0, card: 0, other: 0 };

  for (const payment of payments) {
    const amount = toMoneyNumber(payment.amount);
    if (payment.method === 'cash') totals.cash += amount;
    else if (['transfer', 'momo', 'zalopay'].includes(payment.method)) totals.transfer += amount;
    else if (payment.method === 'card') totals.card += amount;
    else totals.other += amount;
  }

  return totals;
};

export const calculateShiftCash = (
  openingCash: number,
  cashPayments: number,
  closingCash: number
): ShiftCashSummary => {
  const expectedCash = toMoneyNumber(openingCash) + toMoneyNumber(cashPayments);
  const countedCash = toMoneyNumber(closingCash);

  return {
    expected_cash: expectedCash,
    cash_difference: countedCash - expectedCash,
  };
};

export const calculateOrderTotals = (
  lines: OrderLineInput[],
  discountAmount = 0
): OrderTotals => {
  const totalAmount = lines.reduce((sum, line) => {
    const gross = toMoneyNumber(line.unit_price) * Math.max(0, Math.trunc(toMoneyNumber(line.quantity)));
    const lineDiscount = Math.max(0, toMoneyNumber(line.discount));
    return sum + Math.max(gross - lineDiscount, 0);
  }, 0);

  const safeDiscount = Math.min(Math.max(0, toMoneyNumber(discountAmount)), totalAmount);
  const finalAmount = Math.max(totalAmount - safeDiscount, 0);

  return {
    total_amount: totalAmount,
    discount_amount: safeDiscount,
    final_amount: finalAmount,
    points_earned: Math.floor(finalAmount / 10000),
  };
};

export const calculateStoreHealthScore = (input: StoreHealthInput) => {
  let score = 100;
  score -= Math.min(Math.max(0, input.out_of_stock_count) * 10, 25);
  score -= Math.min(Math.max(0, input.low_stock_count - input.out_of_stock_count) * 4, 20);
  score -= Math.min(Math.max(0, input.cancelled_order_count) * 8, 16);
  if (input.revenue_growth_percent < 0) score -= 10;
  if (input.order_growth_percent < 0) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
};
