import api from './api';
import { ApiResponse } from '../types/user.type';
import { Category, Customer, ListResponse, Product, Supplier } from '../types/domain.type';
import { queryCache } from '../utils/queryCache';
import { useAuthStore } from '../stores/auth.store';
import { publishProductMutation } from './productEvents';

const CUSTOMER_CACHE_VERSION = 'v2';

const stripCustomerPhone = <T extends Customer | null>(customer: T): T => {
  if (!customer) return customer;
  const { phone: _phone, ...safeCustomer } = customer;
  void _phone;
  return safeCustomer as T;
};

const sanitizeCustomerResponse = <T extends Customer | ListResponse<Customer> | null>(
  response: ApiResponse<T>,
): ApiResponse<T> => {
  if (response.data && 'items' in response.data) {
    return {
      ...response,
      data: {
        ...response.data,
        items: response.data.items.map(stripCustomerPhone),
      } as T,
    };
  }

  return { ...response, data: stripCustomerPhone(response.data) as T };
};

export const buildQuery = (params: Record<string, unknown> = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const catalogAPI = {
  categories: {
    list: async (params?: Record<string, unknown>) => {
      const cacheKey = `categories:list:${buildQuery(params)}`;
      const cached = queryCache.get<ApiResponse<ListResponse<Category>>>(cacheKey);
      if (cached) return { data: cached } as any;

      const res = await api.get<ApiResponse<ListResponse<Category>>>(`/categories${buildQuery(params)}`);
      queryCache.set(cacheKey, res.data, 2 * 60 * 1000); // 2 min cache
      return res;
    },
    create: async (data: Partial<Category>) => {
      const res = await api.post<ApiResponse<Category>>('/categories', data);
      queryCache.invalidatePrefix('categories:');
      queryCache.invalidatePrefix('products:');
      return res;
    },
    update: async (id: string, data: Partial<Category>) => {
      const res = await api.put<ApiResponse<Category>>(`/categories/${id}`, data);
      queryCache.invalidatePrefix('categories:');
      queryCache.invalidatePrefix('products:');
      return res;
    },
    remove: async (id: string) => {
      const res = await api.delete<ApiResponse<null>>(`/categories/${id}`);
      queryCache.invalidatePrefix('categories:');
      queryCache.invalidatePrefix('products:');
      return res;
    },
  },
  suppliers: {
    list: async (params?: Record<string, unknown>) => {
      const cacheKey = `suppliers:list:${buildQuery(params)}`;
      const cached = queryCache.get<ApiResponse<ListResponse<Supplier>>>(cacheKey);
      if (cached) return { data: cached } as any;

      const res = await api.get<ApiResponse<ListResponse<Supplier>>>(`/suppliers${buildQuery(params)}`);
      queryCache.set(cacheKey, res.data, 2 * 60 * 1000);
      return res;
    },
    create: async (data: Partial<Supplier>) => {
      const res = await api.post<ApiResponse<Supplier>>('/suppliers', data);
      queryCache.invalidatePrefix('suppliers:');
      return res;
    },
    update: async (id: string, data: Partial<Supplier>) => {
      const res = await api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data);
      queryCache.invalidatePrefix('suppliers:');
      return res;
    },
    remove: async (id: string, params?: Record<string, unknown>) => {
      const res = await api.delete<ApiResponse<any>>(`/suppliers/${id}${buildQuery(params)}`);
      queryCache.invalidatePrefix('suppliers:');
      return res;
    },
  },
  customers: {
    list: async (params?: Record<string, unknown>) => {
      const role = useAuthStore.getState().user?.role || 'anonymous';
      const cacheKey = `customers:${CUSTOMER_CACHE_VERSION}:list:${role}:${buildQuery(params)}`;
      const cached = queryCache.get<ApiResponse<ListResponse<Customer>>>(cacheKey);
      if (cached) return { data: sanitizeCustomerResponse(cached) } as any;

      const res = await api.get<ApiResponse<ListResponse<Customer>>>(`/customers${buildQuery(params)}`);
      const safeResponse = sanitizeCustomerResponse(res.data);
      queryCache.set(cacheKey, safeResponse, 2 * 60 * 1000);
      return { ...res, data: safeResponse };
    },
    lookupByPhone: async (phone: string) => {
      const res = await api.get<ApiResponse<Customer | null>>(`/customers/lookup${buildQuery({ phone })}`);
      return { ...res, data: sanitizeCustomerResponse(res.data) };
    },
    create: async (data: Partial<Customer>) => {
      const res = await api.post<ApiResponse<Customer>>('/customers', data);
      queryCache.invalidatePrefix('customers:');
      return { ...res, data: sanitizeCustomerResponse(res.data) };
    },
    update: async (id: string, data: Partial<Customer>) => {
      const res = await api.put<ApiResponse<Customer>>(`/customers/${id}`, data);
      queryCache.invalidatePrefix('customers:');
      return { ...res, data: sanitizeCustomerResponse(res.data) };
    },
    remove: async (id: string) => {
      const res = await api.delete<ApiResponse<null>>(`/customers/${id}`);
      queryCache.invalidatePrefix('customers:');
      return res;
    },
  },
  products: {
    list: async (params?: Record<string, unknown>) => {
      const cacheKey = `products:list:${buildQuery(params)}`;
      const cached = queryCache.get<ApiResponse<ListResponse<Product>>>(cacheKey);
      if (cached) return { data: cached } as any;

      const res = await api.get<ApiResponse<ListResponse<Product>>>(`/products${buildQuery(params)}`);
      queryCache.set(cacheKey, res.data, 60 * 1000); // 1 min cache for products list
      return res;
    },
    get: (id: string) => api.get<ApiResponse<Product>>(`/products/${id}`),
    create: async (data: Partial<Product>) => {
      const res = await api.post<ApiResponse<Product>>('/products', data);
      queryCache.invalidatePrefix('products:');
      publishProductMutation({ action: 'created', product: res.data.data });
      return res;
    },
    createBulk: async (products: Partial<Product>[]) => {
      const res = await api.post<ApiResponse<{ imported: number; skipped: number; skippedSkus: string[] }>>('/products/bulk', { products });
      queryCache.invalidatePrefix('products:');
      publishProductMutation({ action: 'bulk' });
      return res;
    },
    update: async (id: string, data: Partial<Product>) => {
      const res = await api.put<ApiResponse<Product>>(`/products/${id}`, data);
      queryCache.invalidatePrefix('products:');
      publishProductMutation({ action: 'updated', product: res.data.data, productId: id });
      return res;
    },
    remove: async (id: string) => {
      const res = await api.delete<ApiResponse<null>>(`/products/${id}`);
      queryCache.invalidatePrefix('products:');
      publishProductMutation({ action: 'deleted', productId: id });
      return res;
    },
    /** Tra cứu nhanh bằng barcode hoặc SKU — 1 API call thay vì 3 */
    lookup: (code: string) =>
      api.get<ApiResponse<Product | null>>(`/stock/lookup?code=${encodeURIComponent(code)}`),
  },
};

