// Restock/Purchasing models

export interface RestockRow {
  id: number;
  productId: number | null;
  brandId: number | null;
  categoryId: number | null;
  brand: string;
  category: string;
  name: string;
  image: string;
  description: string;
  supplier: string;
  phone: string;
  productUnit: string;
  packageType: string;
  volume: number | null;
  weight: number | null;
  prixUniteAchat: number;
  uniteParCarton: number;
  prixCarton: number;
  nmbCarton: number;
  carry: boolean;
  priority: number;
  hidden: boolean;
  synced: boolean;
}

export interface RestockData {
  items: RestockRow[];
}

export interface BrandOption {
  id: number;
  name: string;
}

export interface CategoryOption {
  id: number;
  name: string;
}

export interface CartItem extends RestockRow {
  // Cart items are RestockRows that have been added to cart
}
