import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { replenishmentMath } from '../services/inventoryReplenishment.service';

test('replenishment rounds quantities up to the supplier order multiple', () => {
  assert.equal(replenishmentMath.roundUpToMultiple(0, 6), 0);
  assert.equal(replenishmentMath.roundUpToMultiple(1, 6), 6);
  assert.equal(replenishmentMath.roundUpToMultiple(12, 6), 12);
  assert.equal(replenishmentMath.roundUpToMultiple(13, 6), 18);
});

test('safety stock increases with demand volatility and service level', () => {
  const stable = replenishmentMath.calculateSafetyStock(0, 3, 7, 0.95);
  const volatile = replenishmentMath.calculateSafetyStock(4, 3, 7, 0.95);
  const critical = replenishmentMath.calculateSafetyStock(4, 3, 7, 0.99);

  assert.equal(stable, 0);
  assert.ok(volatile > stable);
  assert.ok(critical > volatile);
});

test('service level z-score stays conservative for supported policy levels', () => {
  assert.equal(replenishmentMath.zScoreForServiceLevel(0.9), 1.282);
  assert.equal(replenishmentMath.zScoreForServiceLevel(0.95), 1.645);
  assert.equal(replenishmentMath.zScoreForServiceLevel(0.99), 2.326);
});

test('healthy inventory does not create a purchase recommendation', () => {
  assert.equal(replenishmentMath.calculateOrderQuantity(true, 20, 10, 40, 5, 3), 0);
  assert.equal(replenishmentMath.calculateOrderQuantity(false, 0, 10, 40, 5, 3), 0);
  assert.equal(replenishmentMath.calculateOrderQuantity(true, 8, 10, 20, 5, 3), 12);
});

test('replenishment migration contains policy, incoming-order and RLS safeguards', () => {
  const migrationPath = path.resolve(__dirname, '../../../database/inventory_replenishment_v2.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.product_supply_policies/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.purchase_orders/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.purchase_order_items/);
  assert.match(migration, /ALTER TABLE public\.product_supply_policies ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS forecast_confidence/);
});
