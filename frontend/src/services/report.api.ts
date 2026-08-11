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

export interface AiAnalysisReportSummary {
  id: string;
  days: number;
  period_start: string;
  period_end: string;
  health_score?: number | null;
  total_revenue: number;
  total_orders: number;
  total_profit: number;
  profit_margin: number;
  generated_at: string;
  generated_by?: string | null;
  generated_by_user?: { full_name?: string; email?: string } | null;
}

export interface AiAnalysisReportDetail extends AiAnalysisReportSummary {
  total_cogs: number;
  average_order_value: number;
  analysis: AiAnalysisResult;
  metrics_snapshot: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number };
}

export interface InventorySkuRow {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock_quantity: number;
  min_stock_level: number;
  cost_price: number;
  sell_price: number;
  category: string;
  supplier: string;
  stock_value: number;
  retail_value: number;
  sold_qty: number;
  sold_revenue: number;
  avg_daily_sales: number;
  sales_speed_recent: number;
  sales_trend: 'up' | 'down' | 'stable';
  stock_days: number | null;
  recommended_qty: number;
  restock_cost: number;
  status: 'out_of_stock' | 'low_stock' | 'needs_restock' | 'dead_stock' | 'overstock' | 'healthy';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface AiInventoryAnalysisResult {
  health_score: number;
  score_breakdown: {
    availability: number;
    capital_efficiency: number;
    turnover: number;
  };
  summary: string;
  insights: string[];
  recommendations: string[];
  charts: AiChartData[];
  kpis: {
    total_products: number;
    out_of_stock: number;
    low_stock: number;
    needs_restock: number;
    dead_stock: number;
    overstock: number;
    safe: number;
    total_stock_value: number;
    total_retail_value: number;
    estimated_restock_cost: number;
    estimated_lost_revenue_7d: number;
    health_score: number;
    score_breakdown: {
      availability: number;
      capital_efficiency: number;
      turnover: number;
    };
  };
  restock_plan: InventorySkuRow[];
  dead_stock: InventorySkuRow[];
  rising_demand: InventorySkuRow[];
  falling_demand: InventorySkuRow[];
  demand_mismatch: InventorySkuRow[];
  category_breakdown: Array<{
    id: string;
    name: string;
    product_count: number;
    low_count: number;
    stock_value: number;
    sold_qty: number;
  }>;
  status_distribution: Array<{ name: string; value: number; key: string }>;
  top_stock_value: InventorySkuRow[];
  forecast_quality?: {
    measured_items: number;
    average_wape: number | null;
    average_bias: number | null;
    high_error_items: number;
    method: 'rolling_origin_7d';
  };
  target_days: number;
  ai_provider?: string;
}

export interface AiInventoryReportSummary {
  id: string;
  days: number;
  period_start: string;
  period_end: string;
  health_score?: number | null;
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  safe_count: number;
  total_stock_value: number;
  total_retail_value: number;
  estimated_restock_cost: number;
  generated_at: string;
  generated_by?: string | null;
  generated_by_user?: { full_name?: string; email?: string } | null;
}

export interface AiInventoryReportDetail extends AiInventoryReportSummary {
  analysis: AiInventoryAnalysisResult;
  metrics_snapshot: Record<string, unknown>;
}

export const reportAPI = {
  dashboard: (date?: string, days = 7) => api.get<ApiResponse<DashboardData>>(`/reports/dashboard${buildQuery({ date, days })}`),
  revenue: (days = 30) => api.get<ApiResponse<RevenuePoint[]>>(`/reports/revenue${buildQuery({ days })}`),
  topProducts: (days = 30, limit = 10) =>
    api.get<ApiResponse<TopProduct[]>>(`/reports/top-products${buildQuery({ days, limit })}`),
  aiAnalysis: (days = 30) =>
    api.post<ApiResponse<{ analysis: AiAnalysisResult; generated_at: string; days: number; saved_report: AiAnalysisReportSummary }>>('/reports/ai-analysis', { days }),
  aiAnalysisHistory: (params: { page?: number; limit?: number; days?: number } = {}) =>
    api.get<ApiResponse<PaginatedResult<AiAnalysisReportSummary>>>(`/reports/ai-analysis/history${buildQuery(params)}`),
  aiAnalysisDetail: (id: string) =>
    api.get<ApiResponse<AiAnalysisReportDetail>>(`/reports/ai-analysis/${id}`),
  deleteAiAnalysis: (id: string) =>
    api.delete<ApiResponse<{ id: string }>>(`/reports/ai-analysis/${id}`),
  aiInventoryAnalysis: (days = 30) =>
    api.post<ApiResponse<{
      analysis: AiInventoryAnalysisResult;
      generated_at: string;
      days: number;
      saved_report: AiInventoryReportSummary | null;
      save_warning?: string;
    }>>('/reports/ai-inventory', { days }),
  aiInventoryHistory: (params: { page?: number; limit?: number; days?: number } = {}) =>
    api.get<ApiResponse<PaginatedResult<AiInventoryReportSummary>>>(`/reports/ai-inventory/history${buildQuery(params)}`),
  aiInventoryDetail: (id: string) =>
    api.get<ApiResponse<AiInventoryReportDetail>>(`/reports/ai-inventory/${id}`),
  deleteAiInventoryAnalysis: (id: string) =>
    api.delete<ApiResponse<{ id: string }>>(`/reports/ai-inventory/${id}`),
};
