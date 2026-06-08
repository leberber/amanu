export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SupplierCreate {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  is_active?: boolean;
}

export interface SupplierUpdate {
  name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  is_active?: boolean;
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  amount: number;
  payment_date: string;
  payment_method: 'espece' | 'cheque' | 'virement';
  notes?: string;
  created_at: string;
}

export interface SupplierPaymentCreate {
  amount: number;
  payment_date?: string;
  payment_method: 'espece' | 'cheque' | 'virement';
  notes?: string;
}

export interface SupplierProductPrice {
  id: number;
  supplier_id: number;
  product_id: number;
  product_name: string;
  product_image?: string;
  purchase_order_id: number;
  purchase_order_reference: string;
  unit_price: number;
  quantity_received: number;
  date: string;
}

export interface SupplierStats {
  supplier: Supplier;
  total_ordered: number;
  total_paid: number;
  balance_owed: number;
  order_count: number;
  pending_order_count: number;
}

export interface SupplierPurchaseOrder {
  id: number;
  reference: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivered_at?: string;
  item_count: number;
}
