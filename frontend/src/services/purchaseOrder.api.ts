import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, PurchaseOrder } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface CreatePurchaseOrderPayload {
  supplier_id: string;
  expected_at?: string | null;
  note?: string | null;
  items: Array<{ product_id: string; quantity: number; unit_cost: number }>;
}

export interface ReceivePurchaseOrderPayload {
  receipt_number?: string;
  paid_amount: number;
  note?: string | null;
  items: Array<{
    purchase_order_item_id: string;
    quantity: number;
    unit_price?: number;
    expiry_date: string;
    batch_number: string;
  }>;
}

export const purchaseOrderAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<PurchaseOrder>>>(`/stock/purchase-orders${buildQuery(params)}`),
  get: (id: string) => api.get<ApiResponse<PurchaseOrder>>(`/stock/purchase-orders/${id}`),
  create: (payload: CreatePurchaseOrderPayload) =>
    api.post<ApiResponse<PurchaseOrder>>('/stock/purchase-orders', payload),
  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<PurchaseOrder>>(`/stock/purchase-orders/${id}/status`, { status }),
  receive: (id: string, payload: ReceivePurchaseOrderPayload) =>
    api.post<ApiResponse<{ purchase_order: PurchaseOrder; receipt: unknown }>>(`/stock/purchase-orders/${id}/receive`, payload),
};
