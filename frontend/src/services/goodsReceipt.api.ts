import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, GoodsReceipt } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface CreateGoodsReceiptPayload {
  supplier_id: string;
  note?: string | null;
  paid_amount: number;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
}

export const goodsReceiptAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<GoodsReceipt>>>(`/stock/receipts${buildQuery(params)}`),
    
  getById: (id: string) =>
    api.get<ApiResponse<GoodsReceipt>>(`/stock/receipts/${id}`),
    
  create: (data: CreateGoodsReceiptPayload) =>
    api.post<ApiResponse<GoodsReceipt>>('/stock/receipts', data),
};
