import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, Order } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface CreateOrderPayload {
  customer_id?: string | null;
  discount_amount?: number;
  note?: string | null;
  payment?: {
    method?: string;
    received_amount?: number;
    reference_code?: string | null;
  };
  items: Array<{
    product_id: string;
    quantity: number;
    discount?: number;
  }>;
}

export const orderAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<Order>>>(`/orders${buildQuery(params)}`),
  get: (id: string) => api.get<ApiResponse<Order>>(`/orders/${id}`),
  create: (data: CreateOrderPayload) => api.post<ApiResponse<Order>>('/orders', data),
  cancel: (id: string, note?: string) => api.patch<ApiResponse<Order>>(`/orders/${id}/cancel`, { note, restock: true }),
  remove: (id: string) => api.delete<ApiResponse<null>>(`/orders/${id}`),
  removeAll: () => api.delete<ApiResponse<null>>('/orders/all'),
};
