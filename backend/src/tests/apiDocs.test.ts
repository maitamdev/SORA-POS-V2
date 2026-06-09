import test from 'node:test';
import assert from 'node:assert/strict';
import { openApiSpec } from '../docs/apiDocs';

test('OpenAPI spec exposes critical POS endpoints', () => {
  const requiredPaths = [
    '/auth/login',
    '/products',
    '/orders',
    '/orders/{id}/cancel',
    '/stock/alerts',
    '/reports/dashboard',
    '/ai/recommend-restock',
    '/settings/operation',
  ];

  for (const path of requiredPaths) {
    assert.ok(openApiSpec.paths[path], `Missing OpenAPI path: ${path}`);
  }
});

test('OpenAPI spec documents authentication and core domain tags', () => {
  const tagNames = new Set(openApiSpec.tags.map((tag) => tag.name));

  for (const tag of ['Auth', 'Products', 'Orders', 'Stock', 'Reports', 'AI', 'Settings']) {
    assert.ok(tagNames.has(tag), `Missing OpenAPI tag: ${tag}`);
  }

  assert.deepEqual(openApiSpec.components.securitySchemes, {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  });
});
