import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, Promotion } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export const promotionAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<Promotion>>>(`/promotions${buildQuery(params)}`),

  get: (id: string) =>
    api.get<ApiResponse<Promotion>>(`/promotions/${id}`),

  create: (data: Partial<Promotion>) =>
    api.post<ApiResponse<Promotion>>('/promotions', data),

  update: (id: string, data: Partial<Promotion>) =>
    api.put<ApiResponse<Promotion>>(`/promotions/${id}`, data),

  remove: (id: string) =>
    api.delete<ApiResponse<null>>(`/promotions/${id}`),

  validate: (data: { code: string; order_total: number; items?: Array<{ product_id: string; category_id?: string | null; quantity: number; unit_price: number }> }) =>
    api.post<ApiResponse<{
      valid: boolean;
      promotion: { id: string; name: string; code: string; discount_type: string; discount_value: number; max_discount: number | null; apply_to: string };
      discount_amount: number;
      applicable_total: number;
    }>>('/promotions/validate', data),

  getAutoPromotions: (data: { order_total: number; items?: Array<{ product_id: string; category_id?: string | null; quantity: number; unit_price: number }> }) =>
    api.post<ApiResponse<Array<{
      promotion: {
        id: string;
        name: string;
        discount_type: string;
        discount_value: number;
        max_discount: number | null;
        apply_to: string;
        apply_to_ids?: string[];
        bundle_product_ids?: string[];
        get_product_ids?: string[];
        buy_quantity?: number;
        get_quantity?: number;
        combo_quantity?: number;
      };
      discount_amount: number;
      applicable_product_ids?: string[];
      description?: string;
    }>>>('/promotions/auto', data),
};
