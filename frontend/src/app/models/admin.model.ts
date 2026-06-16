import { UserGroupBasic } from './user-group.model';
import { DriverInfo } from './order.model';

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
    sales_by_brand: SalesByBrand[];
  }
  
  export interface TopSellingProduct {
    product_id: number;
    name: string;
    total_quantity: number;
    total_sales: number;
    category: string;
    image_url?: string;
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

  export interface SalesByBrand {
    brand_id: number;
    name: string;
    total_sales: number;
  }

  export interface SalesReport {
    period: string;
    data: SalesData[];
    total_sales: number;
    sales_by_category: SalesByCategory[];
    sales_by_brand?: SalesByBrand[];
    top_products: TopSellingProduct[];
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
    subtotal?: number;
    discount_amount?: number;
    shipping_cost?: number;
    original_shipping_cost?: number;
    total_amount: number;
    promotion_id?: number;
    created_at: string;
    updated_at?: string;
    items?: OrderItem[];
    user?: {
      full_name: string;
      email: string;
    };
    pickup_date?: string;
    delivery_type?: string;
    delivery_notes?: string;
    // Driver fields
    driver_id?: number;
    driver?: DriverInfo;
    assigned_at?: string;
    // Payment
    payment_status?: string; // unpaid | partial | paid
    total_paid?: number;
  }

  export interface OrderPayment {
    id: number;
    order_id: number;
    amount: number; // negative = refund
    method: 'cash' | 'virement' | 'cheque';
    note?: string;
    recorded_by: number;
    recorded_at: string;
    recorder_name?: string;
  }

  export interface OrderPaymentsResponse {
    payments: OrderPayment[];
    total_paid: number;
    payment_status: string;
  }

  export interface OrderAuditLog {
    id: number;
    order_id: number;
    user_id?: number;
    actor_name?: string;
    action: string;
    details?: Record<string, unknown>;
    created_at: string;
  }

  export interface OrderItemCreate {
    product_id: number;
    quantity: number;
    custom_unit_price?: number;
  }

  export interface OrderItem {
    id: number;
    product_id: number;
    product_name: string;
    unit_price: number;
    custom_unit_price?: number;
    quantity: number;
    product_unit: string;
    image_url?: string;
    brand_name?: string;
    pieces_per_box?: number;
    packaging_type?: string;
  }
  
  export interface UserManage {
    id: number;
    email: string;
    full_name: string;
    phone?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    store_name?: string;
    wilaya?: string;
    daira?: string;
    commune?: string;
    role: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
    groups?: UserGroupBasic[];
    fiscal_info?: { rc?: string; na?: string; nif?: string; nis?: string };
    remaining_balance?: number;
  }

  // Customer Route (for delivery route optimization)
  export interface CustomerRoute {
    id: number;
    user_id: number;
    distance_meters: number;
    duration_seconds: number;
    distance_km: number;
    duration_min: number;
    heading?: number;
    corridor?: string;
  }

  // Customer Route with geometry coordinates for map display
  export interface CustomerRouteWithGeometry extends CustomerRoute {
    coordinates: Array<[number, number]>; // [[lng, lat], ...]
  }

  // Consistent response models
  export interface UsersResponse {
    users: UserManage[];
    total: number;
  }

  export interface OrdersResponse {
    orders: Order[];
    total: number;
  }

  // Logs
  export interface LogEntry {
    timestamp: string;
    level: string;
    logger: string;
    message: string;
  }

  export interface LogStats {
    file_size: number;
    file_size_human: string;
    total_lines: number;
    log_file: string;
  }

  export interface LogsResponse {
    entries: LogEntry[];
    stats: LogStats;
  }

  // System Metrics
  export interface SystemCpu {
    percent: number;
    count: number;
    status: 'normal' | 'medium' | 'high';
  }

  export interface SystemMemory {
    total: number;
    available: number;
    used: number;
    percent: number;
    total_human: string;
    available_human: string;
    used_human: string;
    status: 'normal' | 'medium' | 'high';
  }

  export interface SystemDisk {
    total: number;
    used: number;
    free: number;
    percent: number;
    total_human: string;
    used_human: string;
    free_human: string;
    status: 'normal' | 'medium' | 'high';
  }

  export interface SystemProcess {
    memory_rss: number;
    memory_rss_human: string;
    pid: number;
    threads: number;
  }

  export interface ApiEndpointStat {
    endpoint: string;
    count?: number;
    avg_time_ms?: number;
  }

  export interface ApiStats {
    total_requests: number;
    total_errors: number;
    error_rate: number;
    avg_response_time_ms: number;
    recent_avg_response_time_ms: number;
    requests_per_minute: number;
    current_minute_requests: number;
    slowest_endpoints: ApiEndpointStat[];
    top_endpoints: ApiEndpointStat[];
    status: 'normal' | 'medium' | 'high';
  }

  export interface SystemUptime {
    started_at: string;
    uptime_seconds: number;
    uptime_human: string;
  }

  export interface SystemMetrics {
    timestamp: string;
    uptime: SystemUptime;
    system: {
      cpu: SystemCpu;
      memory: SystemMemory;
      disk: SystemDisk;
      process: SystemProcess;
      network?: {
        bytes_sent: number;
        bytes_recv: number;
        bytes_sent_human: string;
        bytes_recv_human: string;
      };
    };
    api: ApiStats;
  }

  export interface SystemHealth {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: string;
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    error_rate: number;
    requests_per_minute: number;
  }

  export interface ApiError {
    timestamp: string;
    method: string;
    path: string;
    status_code: number;
    response_time_ms: number;
    error_message: string | null;
  }

  export interface SystemErrorsResponse {
    errors: ApiError[];
    total_errors: number;
  }

  // Purchase Orders (Bon de Commande)
  export interface PurchaseOrderItem {
    id: number;
    product_name: string;
    brand: string;
    units_per_carton: number;
    quantity: number;
    unit_price: number;
    total_price: number;
  }

  export interface PurchaseOrder {
    id: number;
    reference: string;
    supplier_name: string;
    supplier_address?: string;
    supplier_phone?: string;
    supplier_email?: string;
    supplier_city?: string;
    status: 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';
    total_amount: number;
    notes?: string;
    created_at: string;
    updated_at?: string;
    sent_at?: string;
    confirmed_at?: string;
    delivered_at?: string;
    items: PurchaseOrderItem[];
    item_count: number;
  }

  export interface PurchaseOrderItemCreate {
    product_name: string;
    brand: string;
    units_per_carton: number;
    quantity: number;
    unit_price: number;
    total_price: number;
  }

  export interface PurchaseOrderCreate {
    supplier_name: string;
    supplier_address?: string;
    supplier_phone?: string;
    supplier_email?: string;
    supplier_city?: string;
    notes?: string;
    items: PurchaseOrderItemCreate[];
  }

  export interface PurchaseOrdersResponse {
    orders: PurchaseOrder[];
    total: number;
  }