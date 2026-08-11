import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache, stableCacheKey } from '../utils/cache';
import { parsePagination } from '../utils/query';

test('stableCacheKey is deterministic regardless of query object order', () => {
  const first = stableCacheKey('catalog:products', { page: 1, limit: 20, search: 'milk' });
  const second = stableCacheKey('catalog:products', { search: 'milk', limit: 20, page: 1 });

  assert.equal(first, second);
});

test('MemoryCache returns values before TTL expires and removes expired values', async () => {
  const cache = new MemoryCache();
  cache.set('demo', { ok: true }, 20);

  assert.deepEqual(cache.get('demo'), { ok: true });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(cache.get('demo'), null);
});

test('MemoryCache can invalidate a namespace by prefix', () => {
  const cache = new MemoryCache();
  cache.set('catalog:products:a', 1, 1000);
  cache.set('catalog:products:b', 2, 1000);
  cache.set('catalog:categories:a', 3, 1000);

  cache.deletePrefix('catalog:products');

  assert.equal(cache.get('catalog:products:a'), null);
  assert.equal(cache.get('catalog:products:b'), null);
  assert.equal(cache.get('catalog:categories:a'), 3);
});

test('MemoryCache evicts old entries instead of growing without a bound', () => {
  const cache = new MemoryCache(2);
  cache.set('first', 1, 1000);
  cache.set('second', 2, 1000);
  cache.set('third', 3, 1000);

  assert.equal(cache.get('first'), null);
  assert.equal(cache.get('second'), 2);
  assert.equal(cache.get('third'), 3);
});

test('parsePagination caps untrusted page sizes', () => {
  const pagination = parsePagination({ page: '2', limit: '10000' });

  assert.equal(pagination.limit, 500);
  assert.equal(pagination.from, 500);
  assert.equal(pagination.to, 999);
});
