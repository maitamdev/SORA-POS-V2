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

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: 'cashier';
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
  updated_at: string;
}
