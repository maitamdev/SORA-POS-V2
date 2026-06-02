import api from './api';
import { ApiResponse } from '../types/user.type';
import { AIRecommendation, ListResponse } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export const aiAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<AIRecommendation>>>(`/ai/recommendations${buildQuery(params)}`),
  generate: (data: { target_days?: number; product_id?: string }) =>
    api.post<ApiResponse<{ generated: number; recommendations: AIRecommendation[]; ai_provider: string }>>(
      '/ai/recommend-restock',
      data
    ),
  updateStatus: (id: string, status: 'approved' | 'rejected') =>
    api.patch<ApiResponse<AIRecommendation>>(`/ai/recommendations/${id}`, { status }),
  generateDescription: (productName: string) =>
    api.post<ApiResponse<{ description: string }>>('/ai/generate-description', { productName }),
  suggestCategory: (productName: string, categories: Array<{ id: string; name: string }>) =>
    api.post<ApiResponse<{ categoryId: string | null }>>('/ai/suggest-category', { productName, categories }),
};
