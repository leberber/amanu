export type VolumeDiscountType = 'percentage' | 'fixed_amount' | 'free_units';

export interface VolumeDiscount {
  id: number;
  name: string;
  description?: string;
  product_id: number;
  min_quantity: number;
  discount_type: VolumeDiscountType;
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // Product info for display
  product_name?: string;
  product_image?: string;
  product_pieces_per_box?: number;
  product_packaging_type?: string;
}

export interface VolumeDiscountCreate {
  name: string;
  description?: string;
  product_id: number;
  min_quantity: number;
  discount_type: VolumeDiscountType;
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

export interface VolumeDiscountUpdate {
  name?: string;
  description?: string;
  product_id?: number;
  min_quantity?: number;
  discount_type?: VolumeDiscountType;
  discount_value?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}
