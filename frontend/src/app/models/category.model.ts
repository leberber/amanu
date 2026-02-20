// frontend/src/app/models/category.model.ts
// Single source of truth for Category interface
export interface Category {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  name_translations?: { [key: string]: string };
  description_translations?: { [key: string]: string };
  product_count?: number;  // Used in product listings
}