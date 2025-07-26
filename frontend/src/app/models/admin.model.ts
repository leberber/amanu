// src/app/models/admin.model.ts
export interface DashboardStats {
    total_users: number;
    total_products: number;
    total_categories: number;
    total_orders: number;
    total_revenue: number;
    pending_orders: number;
    low_stock_products: number;
    top_selling_products: TopSellingProduct[];
    recent_orders: RecentOrder[];
    sales_by_category: SalesByCategory[];
  }
  
  export interface TopSellingProduct {
    product_id: number;
    name: string;
    total_quantity: number;
    total_sales: number;
    category: string;
  }
  
  export interface RecentOrder {
    order_id: number;
    status: string;
    total_amount: number;
    created_at: string;
    customer_name: string;
  }
  
  export interface SalesByCategory {
    category_id: number;
    name: string;
    total_sales: number;
  }
  
  export interface SalesReport {
    period: string;
    data: SalesData[];
    total_sales: number;
  }
  
  export interface SalesData {
    date: string;
    sales: number;
  }
  
  export interface LowStockProduct {
    id: number;
    name: string;
    category: string;
    stock_quantity: number;
    price: number;
    unit: string;
  }
  
  export interface Order {
    id: number;
    user_id: number;
    status: string;
    shipping_address: string;
    contact_phone: string;
    total_amount: number;
    created_at: string;
    updated_at?: string;
    items?: OrderItem[];
    user?: {
      full_name: string;
      email: string;
    };
  }
  
  export interface OrderItem {
    id: number;
    product_id: number;
    product_name: string;
    unit_price: number;
    quantity: number;
    product_unit: string;
  }
  
  export interface UserManage {
    id: number;
    email: string;
    full_name: string;
    phone?: string;
    address?: string;
    role: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
  }

  // NEW: Add consistent response models
  export interface UsersResponse {
    users: UserManage[];
    total: number;
  }

  export interface OrdersResponse {
    orders: Order[];
    total: number;
  }