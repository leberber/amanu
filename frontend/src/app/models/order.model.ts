import { ORDER_STATUS } from '../core/constants/order.constants';

// Derive OrderStatus type from ORDER_STATUS constant
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image_url?: string;
  unit_price: number;
  quantity: number;
  product_unit: string;
  pieces_per_box?: number;
}

export interface OrderCreateItem {
  product_id: number;
  quantity: number;
}

export interface OrderCreate {
  user_id: number;
  shipping_address: string;
  contact_phone: string;
  items: OrderCreateItem[];
  promotion_code?: string;
}

export interface PromotionInfo {
  id: number;
  name: string;
  code?: string;
  discount_type: string;
  discount_value: number;
}

export interface UserInfo {
  id: number;
  full_name: string;
  email: string;
}

export interface DriverInfo {
  id: number;
  full_name: string;
  phone?: string;
}

export interface Order {
  id: number;
  user_id: number;
  status: OrderStatus;
  shipping_address: string;
  contact_phone: string;
  subtotal?: number;
  discount_amount?: number;
  cross_sell_discount_amount?: number;
  volume_discount_amount?: number;
  total_amount: number;
  promotion_id?: number;
  promotion_info?: PromotionInfo;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];

  // User info
  user?: UserInfo;

  // Driver assignment fields
  driver_id?: number;
  driver?: DriverInfo;
  assigned_at?: string;
  assignment_expires_at?: string;
  picked_up_at?: string;
  in_transit_at?: string;
  delivered_at?: string;
  delivery_notes?: string;
  estimated_delivery_minutes?: number;
  actual_delivery_minutes?: number;
}