export interface Brand {
  id: number;
  name: string;
  description?: string;
  name_translations?: {
    en?: string;
    fr?: string;
    ar?: string;
  };
  description_translations?: {
    en?: string;
    fr?: string;
    ar?: string;
  };
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BrandCreate {
  name: string;
  description?: string;
  name_translations?: {
    en?: string;
    fr?: string;
    ar?: string;
  };
  description_translations?: {
    en?: string;
    fr?: string;
    ar?: string;
  };
  logo_url?: string;
  is_active?: boolean;
}

export interface BrandUpdate {
  name?: string;
  description?: string;
  name_translations?: {
    en?: string;
    fr?: string;
    ar?: string;
  };
  description_translations?: {
    en?: string;
    fr?: string;
    ar?: string;
  };
  logo_url?: string;
  is_active?: boolean;
}
