import { DiscountType } from './promotion.model';

export interface CrossSellPromotion {
  id: number;
  name: string;
  target_product_id: number;
  trigger_product_ids: number[];
  discount_type: DiscountType;
  discount_value: number;
  min_trigger_quantity: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // Display fields
  target_product_name?: string;
  target_product_image?: string;
  target_product_pieces_per_box?: number;
  trigger_product_names?: string[];
  trigger_product_images?: string[];
}

export interface CrossSellPromotionCreate {
  name: string;
  target_product_id: number;
  trigger_product_ids: number[];
  discount_type: DiscountType;
  discount_value: number;
  min_trigger_quantity?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

export interface CrossSellPromotionUpdate {
  name?: string;
  target_product_id?: number;
  trigger_product_ids?: number[];
  discount_type?: DiscountType;
  discount_value?: number;
  min_trigger_quantity?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

// Cart calculation types
export interface CrossSellCartItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CrossSellCalculationRequest {
  cart_items: CrossSellCartItem[];
}

export interface CrossSellDiscountItem {
  target_product_id: number;
  triggered_by_product_id: number;
  promotion_id: number;
  promotion_name: string;
  discount_per_unit: number;
  units_discounted: number;
  total_discount: number;
}

export interface CrossSellCalculationResponse {
  cross_sell_discounts: CrossSellDiscountItem[];
  total_savings: number;
}
