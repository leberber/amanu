export type DiscountType = 'percentage' | 'fixed_amount';
export type PromotionScope = 'global' | 'category' | 'brand' | 'product';

export interface Promotion {
  id: number;
  name: string;
  description?: string;
  code?: string;
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
  discount_type: DiscountType;
  discount_value: number;
  scope: PromotionScope;
  category_id?: number;
  brand_id?: number;
  product_id?: number;
  min_order_amount: number;
  max_discount?: number;
  usage_limit?: number;
  usage_count: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at?: string;
}

export interface PromotionCreate {
  name: string;
  description?: string;
  code?: string;
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
  discount_type: DiscountType;
  discount_value: number;
  scope: PromotionScope;
  category_id?: number;
  brand_id?: number;
  product_id?: number;
  min_order_amount?: number;
  max_discount?: number;
  usage_limit?: number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

export interface PromotionUpdate {
  name?: string;
  description?: string;
  code?: string;
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
  discount_type?: DiscountType;
  discount_value?: number;
  scope?: PromotionScope;
  category_id?: number;
  brand_id?: number;
  product_id?: number;
  min_order_amount?: number;
  max_discount?: number;
  usage_limit?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

export interface PromotionValidation {
  valid: boolean;
  promotion?: Promotion;
  error?: string;
}

export interface CartItemForDiscount {
  product_id: number;
  quantity: number;
  unit_price: number;
  category_id?: number;
  brand_id?: number;
}

export interface DiscountCalculationRequest {
  promotion_code: string;
  cart_items: CartItemForDiscount[];
}

export interface DiscountCalculationResponse {
  subtotal: number;
  discount_amount: number;
  total: number;
  promotion?: Promotion;
  error?: string;
}

export interface AppliedPromotion {
  code: string;
  promotion: Promotion;
  discount_amount: number;
}
