import test from 'node:test';
import assert from 'node:assert/strict';
import { getStockAlertStatus } from '../utils/stockAlert';

test('stock alert status treats zero and negative stock as out of stock', () => {
  assert.equal(getStockAlertStatus(0, 5), 'out_of_stock');
  assert.equal(getStockAlertStatus(-1, 5), 'out_of_stock');
});

test('stock alert status treats positive stock at or below minimum as low stock', () => {
  assert.equal(getStockAlertStatus(1, 5), 'low_stock');
  assert.equal(getStockAlertStatus(5, 5), 'low_stock');
});

test('stock alert status is clear above the minimum', () => {
  assert.equal(getStockAlertStatus(6, 5), null);
});
