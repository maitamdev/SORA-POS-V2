import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOrderMargin } from '../utils/orderMargin';

test('order margin includes order-level discounts and detects a loss', () => {
  const summary = calculateOrderMargin(
    [{
      product_id: 'p1',
      quantity: 10,
      unit_price: 200000,
      cost_price: 160000,
    }],
    1000000,
  );

  assert.equal(summary.merchandiseTotal, 2000000);
  assert.equal(summary.finalAmount, 1000000);
  assert.equal(summary.cogs, 1600000);
  assert.equal(summary.grossProfit, -600000);
  assert.equal(summary.isLoss, true);
});

test('order margin accepts a profitable discounted order', () => {
  const summary = calculateOrderMargin(
    [{
      product_id: 'p1',
      quantity: 2,
      unit_price: 200000,
      cost_price: 160000,
    }],
    50000,
  );

  assert.equal(summary.finalAmount, 350000);
  assert.equal(summary.cogs, 320000);
  assert.equal(summary.grossProfit, 30000);
  assert.equal(summary.isLoss, false);
});

