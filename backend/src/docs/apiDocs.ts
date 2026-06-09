import { Request, Response } from 'express';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type ApiOperation = {
  tags: string[];
  summary: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
};

type OpenApiSpec = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: Record<string, unknown>;
  paths: Record<string, Partial<Record<HttpMethod, ApiOperation>>>;
};

const ok = (description = 'Success') => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ApiResponse' },
    },
  },
});

const auth = [{ bearerAuth: [] }];

const idParam = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
});

const pagingParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
  { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
];

const jsonBody = (schema: unknown) => ({
  required: true,
  content: {
    'application/json': { schema },
  },
});

const refBody = (name: string) => jsonBody({ $ref: `#/components/schemas/${name}` });

export const openApiSpec: OpenApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Sora POS API',
    version: '1.0.0',
    description: 'Internal API documentation for Sora POS backend.',
  },
  servers: [
    { url: '/api', description: 'Current server' },
    { url: 'http://localhost:4000/api', description: 'Local development' },
  ],
  tags: [
    { name: 'System', description: 'Health and API discovery' },
    { name: 'Auth', description: 'Login and current account' },
    { name: 'Products', description: 'Product catalog' },
    { name: 'Categories', description: 'Product categories' },
    { name: 'Suppliers', description: 'Suppliers' },
    { name: 'Customers', description: 'Customers' },
    { name: 'Orders', description: 'Orders and payments' },
    { name: 'Stock', description: 'Inventory and stock alerts' },
    { name: 'Reports', description: 'Dashboard and reporting' },
    { name: 'AI', description: 'AI helpers and recommendations' },
    { name: 'Staff', description: 'Staff management' },
    { name: 'Settings', description: 'Operational settings' },
    { name: 'Shifts', description: 'Cashier shift sessions' },
    { name: 'Audit', description: 'Enterprise audit trail' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'staff-code-or-email' },
          password: { type: 'string', example: 'password123' },
        },
      },
      Category: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          image_url: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
        },
      },
      Supplier: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          contact_person: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          tax_code: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
        },
      },
      Customer: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          points: { type: 'integer', minimum: 0 },
          total_spent: { type: 'number', minimum: 0 },
          is_active: { type: 'boolean' },
        },
      },
      Product: {
        type: 'object',
        required: ['sku', 'name', 'cost_price', 'sell_price'],
        properties: {
          sku: { type: 'string' },
          barcode: { type: 'string', nullable: true },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          category_id: { type: 'string', format: 'uuid', nullable: true },
          supplier_id: { type: 'string', format: 'uuid', nullable: true },
          cost_price: { type: 'number', minimum: 0 },
          sell_price: { type: 'number', minimum: 0 },
          stock_quantity: { type: 'integer', minimum: 0 },
          min_stock_level: { type: 'integer', minimum: 0 },
          unit: { type: 'string' },
          image_url: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
        },
      },
      OrderCreate: {
        type: 'object',
        required: ['items'],
        properties: {
          customer_id: { type: 'string', format: 'uuid', nullable: true },
          discount_amount: { type: 'number', minimum: 0 },
          note: { type: 'string', nullable: true },
          payment: { $ref: '#/components/schemas/PaymentCreate' },
          items: {
            type: 'array',
            minItems: 1,
            items: { $ref: '#/components/schemas/OrderItemCreate' },
          },
        },
      },
      OrderItemCreate: {
        type: 'object',
        required: ['product_id', 'quantity'],
        properties: {
          product_id: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1 },
          discount: { type: 'number', minimum: 0 },
        },
      },
      PaymentCreate: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['cash', 'card', 'transfer', 'momo', 'zalopay'] },
          received_amount: { type: 'number', minimum: 0 },
          reference_code: { type: 'string', nullable: true },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          actor_id: { type: 'string', format: 'uuid', nullable: true },
          action: { type: 'string', example: 'order.create' },
          entity_type: { type: 'string', example: 'orders' },
          entity_id: { type: 'string', format: 'uuid', nullable: true },
          metadata: { type: 'object' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ShiftOpen: {
        type: 'object',
        required: ['employee_id'],
        properties: {
          employee_id: { type: 'string', format: 'uuid' },
          shift_date: { type: 'string', format: 'date' },
          shift_name: { type: 'string', nullable: true },
        },
      },
      ShiftCheckIn: {
        type: 'object',
        required: ['opening_cash'],
        properties: {
          opening_cash: { type: 'number', minimum: 0 },
        },
      },
      ShiftClose: {
        type: 'object',
        required: ['closing_cash'],
        properties: {
          closing_cash: { type: 'number', minimum: 0 },
          note: { type: 'string', nullable: true },
        },
      },
      StockImport: {
        type: 'object',
        required: ['product_id', 'quantity'],
        properties: {
          product_id: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1 },
          note: { type: 'string' },
        },
      },
      StockAdjust: {
        type: 'object',
        required: ['product_id', 'new_stock'],
        properties: {
          product_id: { type: 'string', format: 'uuid' },
          new_stock: { type: 'integer', minimum: 0 },
          note: { type: 'string' },
        },
      },
      StaffCreate: {
        type: 'object',
        required: ['password', 'full_name'],
        properties: {
          password: { type: 'string', minLength: 6 },
          full_name: { type: 'string' },
          phone: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
        },
      },
      StaffUpdate: {
        type: 'object',
        properties: {
          password: { type: 'string', minLength: 6 },
          full_name: { type: 'string' },
          phone: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
        },
      },
      OperationSettings: {
        type: 'object',
        required: ['storeName'],
        properties: {
          storeName: { type: 'string' },
          branchName: { type: 'string' },
          taxCode: { type: 'string' },
          address: { type: 'string' },
          hotline: { type: 'string' },
          businessHours: { type: 'string' },
          currency: { type: 'string', example: 'VND' },
          locale: { type: 'string', example: 'vi-VN' },
          defaultPaymentMethod: { type: 'string', enum: ['cash', 'transfer', 'card'] },
          allowDiscount: { type: 'boolean' },
          maxDiscountPercent: { type: 'number', minimum: 0, maximum: 100 },
          requireCustomerPhone: { type: 'boolean' },
          autoPrintReceipt: { type: 'boolean' },
          receiptPaperSize: { type: 'string', enum: ['k80', 'a5'] },
          receiptCopies: { type: 'integer', minimum: 1, maximum: 5 },
          receiptFooter: { type: 'string' },
          lowStockWarning: { type: 'boolean' },
          defaultMinStockLevel: { type: 'integer', minimum: 0, maximum: 9999 },
          allowSellOutOfStock: { type: 'boolean' },
          barcodeAutoAdd: { type: 'boolean' },
          productPageSize: { type: 'integer', minimum: 8, maximum: 100 },
          confirmBeforeCheckout: { type: 'boolean' },
          sessionLockMinutes: { type: 'integer', minimum: 5, maximum: 240 },
          compactMode: { type: 'boolean' },
        },
      },
    },
  },
  paths: {
    '/': { get: { tags: ['System'], summary: 'API index', responses: { '200': ok() } } },
    '/health': { get: { tags: ['System'], summary: 'Health check', responses: { '200': ok() } } },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: refBody('LoginRequest'),
        responses: { '200': ok('Authenticated'), '401': ok('Invalid credentials') },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Logout', security: auth, responses: { '200': ok() } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user', security: auth, responses: { '200': ok() } },
    },
    '/products': {
      get: { tags: ['Products'], summary: 'List products', security: auth, parameters: pagingParams, responses: { '200': ok() } },
      post: { tags: ['Products'], summary: 'Create product', description: 'Roles: admin, manager', security: auth, requestBody: refBody('Product'), responses: { '201': ok('Created') } },
    },
    '/products/{id}': {
      get: { tags: ['Products'], summary: 'Get product', security: auth, parameters: [idParam()], responses: { '200': ok() } },
      put: { tags: ['Products'], summary: 'Update product', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: refBody('Product'), responses: { '200': ok() } },
      delete: { tags: ['Products'], summary: 'Delete product', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], responses: { '200': ok() } },
    },
    '/products/bulk': {
      post: { tags: ['Products'], summary: 'Bulk create products', description: 'Roles: admin, manager', security: auth, requestBody: jsonBody({ type: 'object', properties: { products: { type: 'array', items: { $ref: '#/components/schemas/Product' } } } }), responses: { '201': ok('Created') } },
    },
    '/products/all': {
      delete: { tags: ['Products'], summary: 'Blocked hard delete all products', description: 'Enterprise mode returns 403. Products should be deactivated or adjusted with audit trail.', security: auth, responses: { '403': ok('Forbidden') } },
    },
    '/categories': {
      get: { tags: ['Categories'], summary: 'List categories', security: auth, parameters: pagingParams, responses: { '200': ok() } },
      post: { tags: ['Categories'], summary: 'Create category', description: 'Roles: admin, manager', security: auth, requestBody: refBody('Category'), responses: { '201': ok('Created') } },
    },
    '/categories/{id}': {
      put: { tags: ['Categories'], summary: 'Update category', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: refBody('Category'), responses: { '200': ok() } },
      delete: { tags: ['Categories'], summary: 'Delete category', description: 'Roles: admin only', security: auth, parameters: [idParam()], responses: { '200': ok() } },
    },
    '/suppliers': {
      get: { tags: ['Suppliers'], summary: 'List suppliers', security: auth, parameters: pagingParams, responses: { '200': ok() } },
      post: { tags: ['Suppliers'], summary: 'Create supplier', description: 'Roles: admin, manager', security: auth, requestBody: refBody('Supplier'), responses: { '201': ok('Created') } },
    },
    '/suppliers/{id}': {
      put: { tags: ['Suppliers'], summary: 'Update supplier', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: refBody('Supplier'), responses: { '200': ok() } },
      delete: { tags: ['Suppliers'], summary: 'Delete supplier', description: 'Roles: admin only', security: auth, parameters: [idParam()], responses: { '200': ok() } },
    },
    '/customers': {
      get: { tags: ['Customers'], summary: 'List customers', security: auth, parameters: pagingParams, responses: { '200': ok() } },
      post: { tags: ['Customers'], summary: 'Create customer', security: auth, requestBody: refBody('Customer'), responses: { '201': ok('Created') } },
    },
    '/customers/{id}': {
      put: { tags: ['Customers'], summary: 'Update customer', security: auth, parameters: [idParam()], requestBody: refBody('Customer'), responses: { '200': ok() } },
      delete: { tags: ['Customers'], summary: 'Delete customer', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], responses: { '200': ok() } },
    },
    '/orders': {
      get: { tags: ['Orders'], summary: 'List orders', security: auth, parameters: pagingParams, responses: { '200': ok() } },
      post: { tags: ['Orders'], summary: 'Create order', description: 'Roles: admin, manager, cashier', security: auth, requestBody: refBody('OrderCreate'), responses: { '201': ok('Created') } },
    },
    '/orders/{id}': {
      get: { tags: ['Orders'], summary: 'Get order', security: auth, parameters: [idParam()], responses: { '200': ok() } },
      delete: { tags: ['Orders'], summary: 'Blocked hard delete order', description: 'Enterprise mode returns 403. Use cancel/refund to preserve audit trail.', security: auth, parameters: [idParam()], responses: { '403': ok('Forbidden') } },
    },
    '/orders/{id}/cancel': {
      patch: { tags: ['Orders'], summary: 'Cancel order and optionally restock', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: jsonBody({ type: 'object', properties: { note: { type: 'string' }, restock: { type: 'boolean' } } }), responses: { '200': ok() } },
    },
    '/stock/inventory': {
      get: { tags: ['Stock'], summary: 'Inventory list', security: auth, parameters: pagingParams, responses: { '200': ok() } },
    },
    '/stock/alerts': {
      get: { tags: ['Stock'], summary: 'Low stock alerts', security: auth, parameters: pagingParams, responses: { '200': ok() } },
    },
    '/stock/transactions': {
      get: { tags: ['Stock'], summary: 'Stock transactions', description: 'Roles: admin, manager', security: auth, parameters: pagingParams, responses: { '200': ok() } },
    },
    '/stock/import': {
      post: { tags: ['Stock'], summary: 'Import stock', description: 'Roles: admin, manager', security: auth, requestBody: refBody('StockImport'), responses: { '200': ok() } },
    },
    '/stock/adjust': {
      post: { tags: ['Stock'], summary: 'Adjust stock', description: 'Roles: admin, manager', security: auth, requestBody: refBody('StockAdjust'), responses: { '200': ok() } },
    },
    '/stock/alerts/{id}/resolve': {
      patch: { tags: ['Stock'], summary: 'Resolve stock alert', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: jsonBody({ type: 'object', properties: { note: { type: 'string' } } }), responses: { '200': ok() } },
    },
    '/reports/dashboard': {
      get: { tags: ['Reports'], summary: 'Dashboard report', security: auth, parameters: [{ name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': ok() } },
    },
    '/reports/revenue': {
      get: { tags: ['Reports'], summary: 'Revenue report', description: 'Roles: admin, manager', security: auth, responses: { '200': ok() } },
    },
    '/reports/top-products': {
      get: { tags: ['Reports'], summary: 'Top products report', description: 'Roles: admin, manager', security: auth, responses: { '200': ok() } },
    },
    '/ai/recommendations': {
      get: { tags: ['AI'], summary: 'List AI recommendations', description: 'Roles: admin, manager', security: auth, responses: { '200': ok() } },
    },
    '/ai/recommend-restock': {
      post: { tags: ['AI'], summary: 'Generate restock recommendation', description: 'Roles: admin, manager', security: auth, requestBody: jsonBody({ type: 'object', properties: { product_id: { type: 'string', format: 'uuid' } } }), responses: { '200': ok() } },
    },
    '/ai/recommendations/{id}': {
      patch: { tags: ['AI'], summary: 'Update recommendation status', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: jsonBody({ type: 'object', properties: { status: { type: 'string' } } }), responses: { '200': ok() } },
    },
    '/ai/generate-description': {
      post: { tags: ['AI'], summary: 'Generate product description', description: 'Roles: admin, manager', security: auth, requestBody: jsonBody({ type: 'object', properties: { name: { type: 'string' }, category: { type: 'string' } } }), responses: { '200': ok() } },
    },
    '/ai/suggest-category': {
      post: { tags: ['AI'], summary: 'Suggest product category', description: 'Roles: admin, manager', security: auth, requestBody: jsonBody({ type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } }), responses: { '200': ok() } },
    },
    '/staff': {
      get: { tags: ['Staff'], summary: 'List staff', description: 'Roles: admin, manager', security: auth, parameters: pagingParams, responses: { '200': ok() } },
      post: { tags: ['Staff'], summary: 'Create staff', description: 'Roles: admin, manager', security: auth, requestBody: refBody('StaffCreate'), responses: { '201': ok('Created') } },
    },
    '/staff/{id}': {
      put: { tags: ['Staff'], summary: 'Update staff', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: refBody('StaffUpdate'), responses: { '200': ok() } },
      delete: { tags: ['Staff'], summary: 'Deactivate staff', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], responses: { '200': ok() } },
    },
    '/settings/operation': {
      get: { tags: ['Settings'], summary: 'Get operation settings', description: 'Roles: admin, manager', security: auth, responses: { '200': ok() } },
      put: { tags: ['Settings'], summary: 'Update operation settings', description: 'Roles: admin, manager', security: auth, requestBody: refBody('OperationSettings'), responses: { '200': ok() } },
    },
    '/settings/operation/defaults': {
      get: { tags: ['Settings'], summary: 'Operation setting defaults', description: 'Roles: admin, manager', security: auth, responses: { '200': ok() } },
    },
    '/shifts': {
      get: { tags: ['Shifts'], summary: 'List shift sessions', description: 'Roles: admin, manager', security: auth, parameters: pagingParams, responses: { '200': ok() } },
      post: { tags: ['Shifts'], summary: 'Open shift for cashier', description: 'Roles: admin, manager', security: auth, requestBody: refBody('ShiftOpen'), responses: { '201': ok('Created') } },
    },
    '/shifts/active': {
      get: { tags: ['Shifts'], summary: 'Get active cashier shift', description: 'Roles: cashier', security: auth, responses: { '200': ok() } },
    },
    '/shifts/my': {
      get: { tags: ['Shifts'], summary: 'List my cashier shifts', description: 'Roles: cashier', security: auth, parameters: pagingParams, responses: { '200': ok() } },
    },
    '/shifts/active/check-in': {
      post: { tags: ['Shifts'], summary: 'Cashier check-in with opening cash', description: 'Roles: cashier', security: auth, requestBody: refBody('ShiftCheckIn'), responses: { '200': ok() } },
    },
    '/shifts/active/close': {
      post: { tags: ['Shifts'], summary: 'Cashier close active shift', description: 'Roles: cashier', security: auth, requestBody: refBody('ShiftClose'), responses: { '200': ok() } },
    },
    '/shifts/{id}': {
      get: { tags: ['Shifts'], summary: 'Get shift detail', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], responses: { '200': ok() } },
    },
    '/shifts/{id}/close': {
      post: { tags: ['Shifts'], summary: 'Manager closes a cashier shift', description: 'Roles: admin, manager', security: auth, parameters: [idParam()], requestBody: refBody('ShiftClose'), responses: { '200': ok() } },
    },
    '/audit-logs': {
      get: { tags: ['Audit'], summary: 'List audit logs', description: 'Roles: admin, manager. Requires database/enterprise_pos_core.sql.', security: auth, parameters: pagingParams, responses: { '200': ok() } },
    },
  },
};

export const sendOpenApiSpec = (_req: Request, res: Response) => {
  res.json(openApiSpec);
};

export const sendApiDocsPage = (_req: Request, res: Response) => {
  res.type('html').send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sora POS API Docs</title>
  <style>
    :root { color-scheme: light; --blue:#2563eb; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
    header { position:sticky; top:0; z-index:3; display:flex; gap:16px; align-items:center; justify-content:space-between; padding:14px 20px; background:#fff; border-bottom:1px solid var(--line); }
    h1 { margin:0; font-size:18px; font-weight:900; }
    .sub { color:var(--muted); font-size:12px; font-weight:700; }
    .shell { display:grid; grid-template-columns: 330px 1fr; min-height:calc(100vh - 65px); }
    aside { border-right:1px solid var(--line); background:#fff; overflow:auto; height:calc(100vh - 65px); position:sticky; top:65px; }
    main { padding:22px; min-width:0; }
    input, textarea, select { width:100%; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font:inherit; background:#fff; }
    textarea { min-height:150px; resize:vertical; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size:12px; }
    button { border:0; border-radius:8px; padding:10px 14px; font-weight:900; cursor:pointer; background:var(--blue); color:white; }
    .toolbar { display:grid; grid-template-columns: 1fr 360px; gap:12px; padding:14px; border-bottom:1px solid var(--line); }
    .endpoint { display:flex; gap:10px; align-items:center; width:100%; padding:10px 14px; border-bottom:1px solid #f1f5f9; cursor:pointer; }
    .endpoint:hover, .endpoint.active { background:#eff6ff; }
    .method { width:62px; text-align:center; border-radius:999px; padding:4px 0; color:#fff; font-size:11px; font-weight:900; }
    .get { background:#0284c7; } .post { background:#16a34a; } .put { background:#ca8a04; } .patch { background:#9333ea; } .delete { background:#dc2626; }
    .path { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size:12px; font-weight:800; word-break:break-all; }
    .summary { color:var(--muted); font-size:12px; margin-top:2px; }
    .panel { background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; margin-bottom:16px; }
    .panel-h { padding:14px 16px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:12px; align-items:center; }
    .panel-b { padding:16px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
    .pill { border:1px solid var(--line); border-radius:999px; padding:5px 9px; font-size:11px; font-weight:900; color:var(--muted); }
    pre { margin:0; white-space:pre-wrap; word-break:break-word; background:#0f172a; color:#e2e8f0; padding:14px; border-radius:10px; font-size:12px; }
    .muted { color:var(--muted); }
    .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    @media (max-width: 900px) { .shell { grid-template-columns:1fr; } aside { position:static; height:auto; max-height:360px; } .toolbar, .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Sora POS API Docs</h1>
      <div class="sub">OpenAPI + Try Request - /api/openapi.json</div>
    </div>
    <div class="row">
      <span class="pill" id="count"></span>
      <a href="/api/openapi.json" target="_blank" class="pill">OpenAPI JSON</a>
    </div>
  </header>
  <div class="shell">
    <aside>
      <div class="toolbar">
        <input id="search" placeholder="Search endpoint..." />
        <input id="token" placeholder="Bearer token" />
      </div>
      <div id="list"></div>
    </aside>
    <main>
      <section class="panel">
        <div class="panel-h">
          <div>
            <div class="row"><span class="method" id="method"></span><strong class="path" id="path"></strong></div>
            <div class="summary" id="summary"></div>
          </div>
          <span class="pill" id="tag"></span>
        </div>
        <div class="panel-b">
          <div class="grid">
            <label>Request path<input id="requestPath" /></label>
            <label>Method<input id="requestMethod" disabled /></label>
          </div>
          <div style="margin-top:12px">
            <label>JSON body<textarea id="body" spellcheck="false"></textarea></label>
          </div>
          <div class="row" style="margin-top:12px">
            <button id="send">Send request</button>
            <span class="muted" id="hint"></span>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-h"><strong>Response</strong><span class="pill" id="status">not sent</span></div>
        <div class="panel-b"><pre id="response">Choose an endpoint, add token if needed, then send.</pre></div>
      </section>
      <section class="panel">
        <div class="panel-h"><strong>Operation detail</strong></div>
        <div class="panel-b"><pre id="detail"></pre></div>
      </section>
    </main>
  </div>
  <script>
    const spec = ${JSON.stringify(openApiSpec)};
    const serverUrl = spec.servers[0].url;
    const endpoints = [];
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        endpoints.push({ path, method, operation });
      }
    }
    let selected = endpoints[0];
    const els = {
      list: document.getElementById('list'),
      search: document.getElementById('search'),
      token: document.getElementById('token'),
      count: document.getElementById('count'),
      method: document.getElementById('method'),
      path: document.getElementById('path'),
      summary: document.getElementById('summary'),
      tag: document.getElementById('tag'),
      requestPath: document.getElementById('requestPath'),
      requestMethod: document.getElementById('requestMethod'),
      body: document.getElementById('body'),
      send: document.getElementById('send'),
      hint: document.getElementById('hint'),
      response: document.getElementById('response'),
      status: document.getElementById('status'),
      detail: document.getElementById('detail'),
    };
    els.token.value = localStorage.getItem('sora-api-docs-token') || '';
    els.token.addEventListener('input', () => localStorage.setItem('sora-api-docs-token', els.token.value.trim()));
    els.count.textContent = endpoints.length + ' endpoints';

    function exampleFromSchema(schema) {
      if (!schema) return '';
      if (schema.$ref) return exampleFromRef(schema.$ref);
      if (schema.type === 'object') {
        const obj = {};
        for (const [key, value] of Object.entries(schema.properties || {})) obj[key] = exampleFromSchema(value);
        return obj;
      }
      if (schema.type === 'array') return [exampleFromSchema(schema.items || {})];
      if (schema.enum) return schema.enum[0];
      if (schema.example !== undefined) return schema.example;
      if (schema.type === 'integer') return 1;
      if (schema.type === 'number') return 0;
      if (schema.type === 'boolean') return true;
      return '';
    }
    function exampleFromRef(ref) {
      const name = ref.split('/').pop();
      return exampleFromSchema(spec.components.schemas[name]);
    }
    function bodyExample(operation) {
      const schema = operation.requestBody?.content?.['application/json']?.schema;
      if (!schema) return '';
      return JSON.stringify(exampleFromSchema(schema), null, 2);
    }
    function renderList() {
      const q = els.search.value.toLowerCase().trim();
      els.list.innerHTML = '';
      endpoints
        .filter((item) => !q || (item.method + ' ' + item.path + ' ' + item.operation.summary).toLowerCase().includes(q))
        .forEach((item) => {
          const div = document.createElement('div');
          div.className = 'endpoint' + (item === selected ? ' active' : '');
          div.innerHTML = '<span class="method ' + item.method + '">' + item.method.toUpperCase() + '</span><div><div class="path">' + item.path + '</div><div class="summary">' + item.operation.summary + '</div></div>';
          div.onclick = () => { selected = item; renderList(); renderSelected(); };
          els.list.appendChild(div);
        });
    }
    function renderSelected() {
      els.method.textContent = selected.method.toUpperCase();
      els.method.className = 'method ' + selected.method;
      els.path.textContent = selected.path;
      els.summary.textContent = selected.operation.summary + (selected.operation.description ? ' - ' + selected.operation.description : '');
      els.tag.textContent = selected.operation.tags?.[0] || 'API';
      els.requestPath.value = serverUrl + selected.path;
      els.requestMethod.value = selected.method.toUpperCase();
      els.body.value = bodyExample(selected.operation);
      els.hint.textContent = selected.operation.security ? 'Requires Bearer token' : 'Public endpoint';
      els.detail.textContent = JSON.stringify(selected.operation, null, 2);
    }
    async function sendRequest() {
      const headers = { 'Content-Type': 'application/json' };
      const token = els.token.value.trim();
      if (token) headers.Authorization = token.startsWith('Bearer ') ? token : 'Bearer ' + token;
      const init = { method: selected.method.toUpperCase(), headers };
      if (!['get', 'delete'].includes(selected.method) && els.body.value.trim()) init.body = els.body.value;
      els.status.textContent = 'sending...';
      els.response.textContent = '';
      try {
        const res = await fetch(els.requestPath.value, init);
        const text = await res.text();
        els.status.textContent = res.status + ' ' + res.statusText;
        try { els.response.textContent = JSON.stringify(JSON.parse(text), null, 2); }
        catch { els.response.textContent = text || '(empty response)'; }
      } catch (err) {
        els.status.textContent = 'request failed';
        els.response.textContent = String(err);
      }
    }
    els.search.addEventListener('input', renderList);
    els.send.addEventListener('click', sendRequest);
    renderList();
    renderSelected();
  </script>
</body>
</html>`);
};
