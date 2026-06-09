import api from './api';
import { ApiResponse } from '../types/user.type';
import { AIRecommendation, BarcodeProductSuggestion, ListResponse, RestockAnalysis } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export const aiAPI = {
  restockAnalysis: (params?: { target_days?: number; product_id?: string }) =>
    api.get<ApiResponse<RestockAnalysis>>(`/ai/restock-analysis${buildQuery(params)}`),
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<AIRecommendation>>>(`/ai/recommendations${buildQuery(params)}`),
  generate: (data: { target_days?: number; product_id?: string }) =>
    api.post<
      ApiResponse<{
        generated: number;
        recommendations: AIRecommendation[];
        summary: RestockAnalysis['summary'];
        ai_provider: string;
      }>
    >(
      '/ai/recommend-restock',
      data
    ),
  updateStatus: (id: string, status: 'approved' | 'rejected') =>
    api.patch<ApiResponse<AIRecommendation>>(`/ai/recommendations/${id}`, { status }),
  identifyProductByBarcode: (barcode: string) =>
    api.get<ApiResponse<BarcodeProductSuggestion>>(`/ai/identify-product/${encodeURIComponent(barcode)}`),
  generateDescription: (productName: string) =>
    api.post<ApiResponse<{ description: string }>>('/ai/generate-description', { productName }),
  suggestCategory: (productName: string, categories: Array<{ id: string; name: string }>) =>
    api.post<ApiResponse<{ categoryId: string | null }>>('/ai/suggest-category', { productName, categories }),
  suggestCategoryImage: (categoryName: string) =>
    api.post<ApiResponse<{ imageUrl: string | null }>>('/ai/suggest-category-image', { categoryName }),
};
