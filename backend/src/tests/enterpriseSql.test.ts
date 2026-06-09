import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const findEnterpriseSql = () => {
  const candidates = [
    resolve(process.cwd(), '..', 'database', 'enterprise_pos_core.sql'),
    resolve(process.cwd(), 'database', 'enterprise_pos_core.sql'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  assert.ok(file, 'database/enterprise_pos_core.sql must exist');
  return readFileSync(file, 'utf8');
};

test('enterprise POS SQL defines transaction-safe checkout and cancel functions', () => {
  const sql = findEnterpriseSql();

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_pos_order/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.cancel_pos_order/);
  assert.match(sql, /FOR UPDATE OF p/);
  assert.match(sql, /INSERT INTO public\.stock_transactions/);
  assert.match(sql, /PERFORM public\.write_audit_log/);
});

test('enterprise POS SQL records loyalty and cancellation audit columns', () => {
  const sql = findEnterpriseSql();

  assert.match(sql, /ADD COLUMN IF NOT EXISTS loyalty_points_used/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS loyalty_points_earned/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS cancelled_at/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.audit_logs/);
});
