/**
 * Shipping models for cost calculation and pricing configuration
 */

export interface ShippingDiscountTier {
  min_order: number;
  discount_percent: number;
}

export interface ShippingPriceConfig {
  id: number;
  warehouse_id: string;
  base_cost: number;
  price_per_km: number;
  price_per_kg: number;
  price_per_m3: number;
  price_per_min: number;
  min_shipping_cost: number;
  max_shipping_cost: number;
  shipping_discount_tiers: ShippingDiscountTier[] | null;
  driver_commission_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ShippingPriceConfigCreate {
  warehouse_id: string;
  base_cost?: number;
  price_per_km?: number;
  price_per_kg?: number;
  price_per_m3?: number;
  price_per_min?: number;
  min_shipping_cost?: number;
  max_shipping_cost?: number;
  shipping_discount_tiers?: ShippingDiscountTier[];
  driver_commission_percent?: number;
}

export interface ShippingPriceConfigUpdate {
  base_cost?: number;
  price_per_km?: number;
  price_per_kg?: number;
  price_per_m3?: number;
  price_per_min?: number;
  min_shipping_cost?: number;
  max_shipping_cost?: number;
  shipping_discount_tiers?: ShippingDiscountTier[];
  driver_commission_percent?: number;
  is_active?: boolean;
}

export interface ShippingCostRequest {
  h3_index: string;
  weight_kg?: number;
  volume_m3?: number;
  order_total?: number;
  warehouse_id?: string;
}

export interface DeliveryPricing {
  cost: number;
  original_cost: number;
  discount_percent: number;
  description: string;
}

export interface ShippingCostResponse {
  deliverable: boolean;
  shipping_cost: number;
  original_cost: number;
  distance_km: number;
  duration_min: number;
  discount_applied: boolean;
  discount_percent: number;
  free_shipping: boolean;
  breakdown: ShippingBreakdown;
  next_tier: ShippingNextTier | null;
  message: string | null;

  // Delivery type pricing
  priority_price: DeliveryPricing | null;
  standard_price: DeliveryPricing | null;
}

export interface ShippingBreakdown {
  base_cost: number;
  distance_cost: number;
  weight_cost: number;
  volume_cost: number;
  time_cost: number;
  total_before_bounds: number;
  discount_amount?: number;
}

export interface ShippingNextTier {
  min_order: number;
  discount_percent: number;
  amount_needed: number;
}

export interface DeliveryZoneStats {
  warehouse_id: string;
  total_zones: number;
  distance_range: {
    min_km: number;
    max_km: number;
  };
  duration_range: {
    min_min: number;
    max_min: number;
  };
}
