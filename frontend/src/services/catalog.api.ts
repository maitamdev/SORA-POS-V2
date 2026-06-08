import api from './api';
import { ApiResponse } from '../types/user.type';
import { Category, Customer, ListResponse, Product, Supplier } from '../types/domain.type';

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
    list: (params?: Record<string, unknown>) =>
      api.get<ApiResponse<ListResponse<Category>>>(`/categories${buildQuery(params)}`),
    create: (data: Partial<Category>) => api.post<ApiResponse<Category>>('/categories', data),
    update: (id: string, data: Partial<Category>) => api.put<ApiResponse<Category>>(`/categories/${id}`, data),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/categories/${id}`),
  },
  suppliers: {
    list: (params?: Record<string, unknown>) =>
      api.get<ApiResponse<ListResponse<Supplier>>>(`/suppliers${buildQuery(params)}`),
    create: (data: Partial<Supplier>) => api.post<ApiResponse<Supplier>>('/suppliers', data),
    update: (id: string, data: Partial<Supplier>) => api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/suppliers/${id}`),
  },
  customers: {
    list: (params?: Record<string, unknown>) =>
      api.get<ApiResponse<ListResponse<Customer>>>(`/customers${buildQuery(params)}`),
    create: (data: Partial<Customer>) => api.post<ApiResponse<Customer>>('/customers', data),
    update: (id: string, data: Partial<Customer>) => api.put<ApiResponse<Customer>>(`/customers/${id}`, data),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/customers/${id}`),
  },
  products: {
    list: (params?: Record<string, unknown>) =>
      api.get<ApiResponse<ListResponse<Product>>>(`/products${buildQuery(params)}`),
    get: (id: string) => api.get<ApiResponse<Product>>(`/products/${id}`),
    create: (data: Partial<Product>) => api.post<ApiResponse<Product>>('/products', data),
    createBulk: (products: Partial<Product>[]) =>
      api.post<ApiResponse<{ imported: number; skipped: number; skippedSkus: string[] }>>('/products/bulk', { products }),
    update: (id: string, data: Partial<Product>) => api.put<ApiResponse<Product>>(`/products/${id}`, data),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/products/${id}`),
  },
};
