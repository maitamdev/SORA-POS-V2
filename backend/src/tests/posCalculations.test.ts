import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderTotals,
  calculateShiftCash,
  calculateStoreHealthScore,
  summarizePayments,
} from '../utils/posCalculations';

test('summarizePayments groups cash, transfer wallets, card and other methods', () => {
  const summary = summarizePayments([
    { method: 'cash', amount: 150000 },
    { method: 'transfer', amount: 300000 },
    { method: 'momo', amount: 50000 },
    { method: 'zalopay', amount: 25000 },
    { method: 'card', amount: 120000 },
    { method: 'voucher', amount: 10000 },
  ]);

  assert.deepEqual(summary, {
    cash: 150000,
    transfer: 375000,
    card: 120000,
    other: 10000,
  });
});

test('calculateShiftCash returns expected cash and cash difference', () => {
  assert.deepEqual(calculateShiftCash(500000, 1250000, 1710000), {
    expected_cash: 1750000,
    cash_difference: -40000,
  });
});

test('calculateOrderTotals clamps discounts and calculates loyalty points', () => {
  const totals = calculateOrderTotals(
    [
      { unit_price: 12000, quantity: 3 },
      { unit_price: 99000, quantity: 1, discount: 9000 },
    ],
    20000
  );

  assert.deepEqual(totals, {
    total_amount: 126000,
    discount_amount: 20000,
    final_amount: 106000,
    points_earned: 10,
  });
});

test('calculateOrderTotals never returns negative final amount', () => {
  const totals = calculateOrderTotals([{ unit_price: 10000, quantity: 1 }], 50000);

  assert.equal(totals.total_amount, 10000);
  assert.equal(totals.discount_amount, 10000);
  assert.equal(totals.final_amount, 0);
  assert.equal(totals.points_earned, 0);
});

test('calculateStoreHealthScore penalizes stock, cancellations and negative growth', () => {
  const score = calculateStoreHealthScore({
    low_stock_count: 7,
    out_of_stock_count: 2,
    cancelled_order_count: 1,
    revenue_growth_percent: -12,
    order_growth_percent: -5,
  });

  assert.equal(score, 34);
});
