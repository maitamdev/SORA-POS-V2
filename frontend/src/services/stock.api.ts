import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, Product, StockAlert, StockTransaction, ProductBatch } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface StockSummary {
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  safe_count: number;
  total_stock_value: number;
  total_retail_value: number;
  alerts_pending: number;
  top_low_stock: {
    id: string;
    name: string;
    sku: string;
    stock_quantity: number;
    min_stock_level: number;
    category: string | null;
  }[];
  category_breakdown: {
    id: string;
    name: string;
    product_count: number;
    low_stock_count: number;
    total_stock: number;
  }[];
}

export const stockAPI = {
  inventory: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<Product>>>(`/stock/inventory${buildQuery(params)}`),
  alerts: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<StockAlert>>>(`/stock/alerts${buildQuery(params)}`),
  expiryAlerts: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<ProductBatch>>>(`/stock/expiry-alerts${buildQuery(params)}`),
  transactions: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<StockTransaction>>>(`/stock/transactions${buildQuery(params)}`),
  importStock: (data: { product_id: string; quantity: number; batch_number: string; expiry_date: string; note?: string }) =>
    api.post<ApiResponse<StockTransaction>>('/stock/import', data),
  adjustStock: (data: { product_id: string; new_stock: number; note?: string }) =>
    api.post<ApiResponse<StockTransaction>>('/stock/adjust', data),
  resolveAlert: (id: string) => api.patch<ApiResponse<StockAlert>>(`/stock/alerts/${id}/resolve`, { status: 'resolved' }),
  /** Tổng quan kho hàng — thống kê, top low stock, phân bố danh mục */
  summary: () => api.get<ApiResponse<StockSummary>>('/stock/summary'),
  /** Tra cứu sản phẩm bằng barcode/SKU — single API call cho POS scanner */
  lookupProduct: (code: string) =>
    api.get<ApiResponse<Product | null>>(`/stock/lookup?code=${encodeURIComponent(code)}`),
};
