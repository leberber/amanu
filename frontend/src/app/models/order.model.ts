export interface OrderItem {
    id: number;
    product_id: number;
    product_name: string;
    unit_price: number;
    quantity: number;
    product_unit: string;
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
  }
  
  export interface Order {
    id: number;
    user_id: number;
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
    shipping_address: string;
    contact_phone: string;
    total_amount: number;
    created_at: string;
    updated_at?: string;
    items?: OrderItem[];
  }