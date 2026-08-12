import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, Order } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface PublicReceiptOrder {
  id: string;
  order_number: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  payment_status: string;
  note?: string | null;
  loyalty_points_used?: number;
  loyalty_points_earned?: number;
  created_at: string;
  customers?: { id: string; name: string } | null;
  order_details?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    subtotal: number;
  }>;
  payments?: Array<{
    method: string;
    amount: number;
    received_amount?: number;
    change_amount?: number;
    reference_code?: string | null;
    status: string;
  }>;
}

export interface CreateOrderPayload {
  client_order_number?: string;
  customer_id?: string | null;
  shift_code?: string;
  discount_amount?: number;
  manual_discount_amount?: number;
  promotion_ids?: string[];
  used_points?: number;
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
  getPublicReceipt: (id: string, token: string) =>
    api.get<ApiResponse<PublicReceiptOrder>>(`/orders/public/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`),
  create: (data: CreateOrderPayload) => api.post<ApiResponse<Order>>('/orders', data),
  cancel: (id: string, note?: string) => api.patch<ApiResponse<Order>>(`/orders/${id}/cancel`, { note, restock: true }),
  sendInvoiceEmail: (id: string, email: string) => api.post<ApiResponse<null>>(`/orders/${id}/send-email`, { email }),
};
