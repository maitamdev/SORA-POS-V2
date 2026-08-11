export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_active: boolean;
  products?: { count: number }[];
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_code?: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  cost_price: number;
  sell_price: number;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  image_url?: string | null;
  is_active: boolean;
  categories?: Pick<Category, 'id' | 'name'> | null;
  suppliers?: Pick<Supplier, 'id' | 'name'> | null;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  points: number;
  total_spent: number;
  is_active: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string | null;
  user_id: string;
  shift_id?: string | null;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  payment_status: string;
  note?: string | null;
  created_at: string;
  customers?: Customer | null;
  users?: { id: string; full_name: string; email?: string | null } | null;
  order_details?: OrderDetail[];
  payments?: Payment[];
}

export interface OrderDetail {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  discount: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  method: string;
  amount: number;
  received_amount: number;
  change_amount: number;
  status: string;
}

export interface StockAlert {
  id: string;
  product_id: string;
  current_stock: number;
  min_stock_level: number;
  status: 'low_stock' | 'out_of_stock' | 'resolved';
  created_at: string;
  products?: Product;
}

export interface StockTransaction {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  note?: string | null;
  created_at: string;
  products?: Product;
  users?: { full_name: string } | null;
}

export interface AIRecommendation {
  id: string;
  product_id: string;
  current_stock: number;
  min_stock_level: number;
  average_daily_sales: number;
  recommended_quantity: number;
  priority: 'low' | 'medium' | 'high';
  reason?: string | null;
  ai_insight?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  products?: Product;
}

export interface RestockAnalysisItem {
  id: string;
  sku: string;
  name: string;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  cost_price?: number;
  sell_price?: number;
  average_daily_sales: number;
  target_stock: number;
  recommended_quantity: number;
  priority: 'low' | 'medium' | 'high';
  alert_status: 'out_of_stock' | 'low_stock' | 'needs_restock' | 'healthy';
  stock_days: number | null;
  reason: string;
  ai_insight: string;
  sales_speed_7d?: number;
  sales_speed_30d?: number;
  sales_speed_90d?: number;
  demand_stddev?: number;
  sales_days_90d?: number;
  sales_trend?: 'up' | 'down' | 'stable';
  forecast_confidence?: 'high' | 'medium' | 'low';
  forecast_method?: 'weighted_velocity' | 'insufficient_demand';
  lead_time_days?: number;
  review_period_days?: number;
  safety_stock?: number;
  reorder_point?: number;
  inventory_position?: number;
  on_hand_quantity?: number;
  available_quantity?: number;
  incoming_quantity?: number;
  reserved_quantity?: number;
  expired_quantity?: number;
  expiring_soon_quantity?: number;
  target_cover_days?: number;
  moq?: number;
  order_multiple?: number;
  service_level?: number;
  restock_cost?: number;
  estimated_lost_revenue_7d?: number;
  manual_review?: boolean;
  data_quality?: 'ready' | 'low_confidence' | 'insufficient_demand' | 'missing_policy';
  assumptions?: string[];
}

export interface RestockAnalysis {
  target_days: number;
  sales_window_days: number;
  summary: {
    total_products: number;
    out_of_stock: number;
    low_stock: number;
    needs_restock: number;
    healthy: number;
    total_recommended_quantity: number;
    urgent_items: number;
    low_confidence_items?: number;
    manual_review_items?: number;
    estimated_restock_cost?: number;
    estimated_lost_revenue_7d?: number;
  };
  items: RestockAnalysisItem[];
  ai_provider: string;
  engine_version?: string;
  generated_at?: string;
  warnings?: string[];
  policy?: {
    default_lead_time_days: number;
    default_service_level: number;
    default_review_period_days: number;
    default_target_cover_days: number;
    policy_table_available: boolean;
    incoming_orders_available: boolean;
  };
}

export interface BarcodeProductSuggestion {
  source: string;
  source_url?: string;
  barcode: string;
  sku: string;
  name: string;
  brand?: string | null;
  category_name?: string | null;
  unit: string;
  image_url?: string | null;
  description: string;
  confidence: 'medium' | 'high';
  exists?: boolean;
  raw?: any;
}

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: 'cashier' | 'manager' | 'admin';
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftPaymentSummary {
  cash: number;
  transfer: number;
  card: number;
  other: number;
}

export interface CashDrawerTransaction {
  id: string;
  shift_id: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  reason?: string | null;
  created_by: string;
  created_at: string;
  users?: {
    id: string;
    full_name: string;
  } | null;
}

export interface ShiftSummary {
  revenue: number;
  gross_revenue: number;
  discount: number;
  order_count: number;
  cancelled_count: number;
  average_order_value: number;
  payments: ShiftPaymentSummary;
  hourly: Array<{ hour: string; revenue: number; orders: number }>;
  top_products: Array<{ product_id: string; product_name: string; quantity: number; revenue: number }>;
  cash_drawer_tx_total?: number;
}

export interface ShiftSession {
  id: string;
  employee_id: string;
  opened_by: string;
  shift_date: string;
  shift_name?: string | null;
  shift_code: string;
  status: 'opened' | 'checked_in' | 'closed' | 'cancelled';
  opening_cash: number;
  closing_cash?: number | null;
  expected_cash?: number | null;
  cash_difference?: number | null;
  note?: string | null;
  manager_note?: string | null;
  started_at?: string | null;
  checked_in_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  employee?: Pick<StaffUser, 'id' | 'full_name' | 'email'> | null;
  opener?: Pick<StaffUser, 'id' | 'full_name' | 'email'> | null;
  summary?: ShiftSummary;
  orders?: Order[];
  cash_drawer_transactions?: CashDrawerTransaction[];
}

export interface GoodsReceiptDetail {
  id: string;
  goods_receipt_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  expiry_date?: string | null;
  batch_number?: string | null;
  created_at: string;
  products?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    unit: string;
  } | null;
}

export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  supplier_id?: string | null;
  user_id: string;
  total_amount: number;
  paid_amount: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  note?: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: Pick<Supplier, 'id' | 'name'> | null;
  users?: { id: string; full_name: string; email?: string } | null;
  items?: GoodsReceiptDetail[];
}

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string;
  original_quantity: number;
  quantity: number;
  created_at: string;
  updated_at: string;
  products?: Product;
}

export interface Promotion {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  discount_type: 'percent' | 'fixed_amount' | 'buy_x_get_y' | 'fixed_price' | 'nth_item_discount' | 'happy_hour' | 'bundle';
  discount_value: number;
  max_discount?: number | null;
  min_order_amount: number;
  buy_quantity?: number;
  get_quantity?: number;
  get_product_ids?: string[];
  combo_quantity?: number;
  nth_item?: number;
  happy_hour_start?: string | null;
  happy_hour_end?: string | null;
  bundle_product_ids?: string[];
  apply_to: 'all' | 'category' | 'product';
  apply_to_ids: string[];
  start_date: string;
  end_date?: string | null;
  usage_limit?: number | null;
  usage_count: number;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

