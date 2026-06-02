import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, Product, StockAlert, StockTransaction } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export const stockAPI = {
  inventory: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<Product>>>(`/stock/inventory${buildQuery(params)}`),
  alerts: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<StockAlert>>>(`/stock/alerts${buildQuery(params)}`),
  transactions: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<StockTransaction>>>(`/stock/transactions${buildQuery(params)}`),
  importStock: (data: { product_id: string; quantity: number; note?: string }) =>
    api.post<ApiResponse<StockTransaction>>('/stock/import', data),
  adjustStock: (data: { product_id: string; new_stock: number; note?: string }) =>
    api.post<ApiResponse<StockTransaction>>('/stock/adjust', data),
  resolveAlert: (id: string) => api.patch<ApiResponse<StockAlert>>(`/stock/alerts/${id}/resolve`, { status: 'resolved' }),
};
