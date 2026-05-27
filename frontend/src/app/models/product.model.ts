
export type { Category } from './category.model';

export interface ProductPromotion {
  id: number;
  name: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  discounted_price: number;
}


export type PackagingType = 'BOX' | 'CARTON' | 'CRATE' | 'PACK' | 'BAG' | 'BUNDLE';

export interface Product {
    id: number;
    name: string;
    description?: string;
    price: number;
    unit: 'kg' | 'gram' | 'piece' | 'bunch' | 'dozen' | 'pound' | 'box';
    stock_quantity: number;
    image_url?: string;
    is_organic: boolean;
    is_active: boolean;
    category_id: number;
    brand_id?: number;
    created_at: string;
    updated_at?: string;
    tempQuantity?: number;
    name_translations?: { [key: string]: string };
    description_translations?: { [key: string]: string };
    pieces_per_box?: number;  // Number of pieces per box for dropdown selection
    packaging_type?: PackagingType;  // Type of packaging (box, carton, crate, etc.)
    volume?: number;  // in liters (L)
    weight?: number;  // in kilograms (kg)
    promotion?: ProductPromotion;  // Active promotion applied to this product
    // Fiscal
    is_facture?: boolean;
    tva_rate?: number;  // 0, 9, or 19
  }
  
  

  export interface ProductFilter {
    category_id?: number;
    brand_id?: number;
    is_organic?: boolean;
    active_only?: boolean;
    search?: string;
    min_price?: number;
    max_price?: number;
    sort_by?: 'name' | 'price' | 'created_at';
    sort_order?: 'asc' | 'desc';
    limit?: number;
    skip?: number;
  }

  export interface PaginatedProductsResponse {
    items: Product[];
    total: number;
    active_count: number;
    inactive_count: number;
    skip: number;
    limit: number;
  }

  export interface AdminProductFilter {
    skip?: number;
    limit?: number;
    category_id?: number;
    brand_id?: number;
    status_filter?: 'all' | 'active' | 'inactive';
    search?: string;
  }