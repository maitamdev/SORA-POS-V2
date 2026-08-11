import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('stock summary migration keeps dashboard aggregation in PostgreSQL', () => {
  const migrationPath = path.resolve(__dirname, '../../../database/stock_summary_rpc.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_stock_summary/);
  assert.match(migration, /jsonb_build_object/);
  assert.match(migration, /COUNT\(\*\) FILTER \(WHERE stock_quantity <= 0\)/);
  assert.match(migration, /category_breakdown/);
});

