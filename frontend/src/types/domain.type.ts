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
  average_daily_sales: number;
  target_stock: number;
  recommended_quantity: number;
  priority: 'low' | 'medium' | 'high';
  alert_status: 'out_of_stock' | 'low_stock' | 'needs_restock' | 'healthy';
  stock_days: number | null;
  reason: string;
  ai_insight: string;
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
  };
  items: RestockAnalysisItem[];
  ai_provider: string;
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
}

export interface GoodsReceiptDetail {
  id: string;
  goods_receipt_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
