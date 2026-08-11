import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import app from '../app';

let server: Server;
let baseUrl = '';

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Smoke server did not bind');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const request = async (path: string, init?: RequestInit) => fetch(`${baseUrl}${path}`, init);

const readJson = async <T>(response: Response): Promise<T> => response.json() as Promise<T>;

test('health and OpenAPI discovery endpoints are reachable', async () => {
  const health = await request('/api/health', { headers: { 'x-request-id': 'smoke-health-1' } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-request-id'), 'smoke-health-1');
  const healthBody = await readJson<{ success?: boolean }>(health);
  assert.equal(healthBody.success, true);

  const openApi = await request('/api/openapi.json');
  assert.equal(openApi.status, 200);
  const spec = await readJson<{ paths: Record<string, unknown> }>(openApi);
  assert.ok(spec.paths['/orders']);
  assert.ok(spec.paths['/stock/receipts']);
  assert.ok(spec.paths['/promotions/validate']);
});

test('invalid API requests expose the trace id for support correlation', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': 'smoke-validation-1',
    },
    body: JSON.stringify({}),
  });

  const body = await readJson<{ request_id?: string }>(response);
  assert.equal(response.headers.get('x-request-id'), 'smoke-validation-1');
  assert.equal(body.request_id, 'smoke-validation-1');
});

test('protected API domains reject requests without a bearer token', async () => {
  const protectedPaths = [
    '/api/products',
    '/api/categories',
    '/api/suppliers',
    '/api/customers',
    '/api/orders',
    '/api/stock/inventory',
    '/api/stock/summary',
    '/api/stock/receipts',
    '/api/reports/dashboard',
    '/api/ai/recommendations',
    '/api/staff',
    '/api/settings/operation',
    '/api/shifts',
    '/api/audit-logs',
    '/api/promotions',
  ];

  const responses = await Promise.all(protectedPaths.map((path) => request(path)));
  assert.deepEqual(responses.map((response) => response.status), protectedPaths.map(() => 401));
});

test('authenticated catalog routes never advertise public caching', async () => {
  const response = await request('/api/products');
  const cacheControl = response.headers.get('cache-control') || '';

  assert.match(cacheControl, /^private,/);
  assert.doesNotMatch(cacheControl, /public/);
  assert.match(response.headers.get('vary') || '', /Authorization/);
});

test('validation runs before external/database work on login', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 422);
  const body = await readJson<{ success?: boolean; errors?: unknown }>(response);
  assert.equal(body.success, false);
  assert.ok(Array.isArray(body.errors));
});
