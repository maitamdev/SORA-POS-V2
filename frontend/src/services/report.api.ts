import api from './api';
import { ApiResponse } from '../types/user.type';
import { buildQuery } from './catalog.api';

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
  cogs?: number;
  profit?: number;
}

export interface CategorySale {
  name: string;
  value: number;
}

export interface PaymentStat {
  name: string;
  percentage: number;
  count: number;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  payment_method: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  alert_status: string;
  image_url: string;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface TopProductExtended {
  rank: number;
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  image_url: string;
}

export interface DashboardData {
  summary: {
    today_revenue: number;
    today_revenue_growth: number;
    today_orders: number;
    today_orders_growth: number;
    today_sold_products: number;
    today_sold_growth: number;
    low_stock_count: number;
    new_low_stock_count: number;
    today_cogs?: number;
    today_profit?: number;
    today_profit_growth?: number;
  };
  revenue: RevenuePoint[];
  category_sales: CategorySale[];
  payment_stats: PaymentStat[];
  recent_orders: RecentOrder[];
  low_stock_products: LowStockProduct[];
  top_products: TopProductExtended[];
}

export interface AiChartData {
  title: string;
  type: 'pie' | 'bar' | 'line';
  data: { name: string; value: number }[];
}

export interface AiAnalysisResult {
  health_score?: number;
  summary: string;
  insights: string[];
  recommendations: string[];
  charts: AiChartData[];
}

export const reportAPI = {
  dashboard: (date?: string, days = 7) => api.get<ApiResponse<DashboardData>>(`/reports/dashboard${buildQuery({ date, days })}`),
  revenue: (days = 30) => api.get<ApiResponse<RevenuePoint[]>>(`/reports/revenue${buildQuery({ days })}`),
  topProducts: (days = 30, limit = 10) =>
    api.get<ApiResponse<TopProduct[]>>(`/reports/top-products${buildQuery({ days, limit })}`),
  aiAnalysis: (days = 30) =>
    api.post<ApiResponse<{ analysis: AiAnalysisResult; generated_at: string; days: number }>>('/reports/ai-analysis', { days }),
};
