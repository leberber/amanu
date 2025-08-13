// src/app/models/product.model.ts
export interface Product {
    id: number;
    name: string;
    description?: string;
    price: number;
    unit: 'kg' | 'gram' | 'piece' | 'bunch' | 'dozen' | 'pound';
    stock_quantity: number;
    image_url?: string;
    is_organic: boolean;
    is_active: boolean;
    category_id: number;
    created_at: string;
    updated_at?: string;
    tempQuantity?: number;
    name_translations?: { [key: string]: string };
    description_translations?: { [key: string]: string };
    quantity_config?: QuantityConfig;
  }
  
  export interface QuantityConfig {
    type: 'list' | 'range';
    quantities?: number[];  // For 'list' type
    min?: number;          // For 'range' type
    max?: number;          // For 'range' type
  }
  
  export interface Category {
    id: number;
    name: string;
    description?: string;
    image_url?: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
    product_count?: number;
  }
  
  export interface ProductFilter {
    category_id?: number;
    is_organic?: boolean;
    active_only?: boolean;
    search?: string;
    min_price?: number;
    max_price?: number;
    sort_by?: 'name' | 'price' | 'created_at';
    sort_order?: 'asc' | 'desc';
  }