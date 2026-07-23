import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { StatusSeverityService } from '../core/services/status-severity.service';

// ============================================================================
// Models
// ============================================================================

export interface PriceTier {
  unit_price: number;       // DA/unité
  total_cartons: number;
  units_per_carton: number;
}

export interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  action: string;
  changes: Record<string, any> | null;
  created_at: string;
}

export interface ProductPurchaseLot {
  id: number;
  purchase_order_id: number;
  stock_before: number;
  quantity_added: number;
  quantity_rejected: number;
  units_per_carton: number;
  unit_price_per_carton: number;
  unit_price: number;
  cmup: number;
  made_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface PurchaseOrderItem {
  id?: number;
  product_id?: number;  // Link to products table for stock sync
  product_name: string;
  brand: string;
  units_per_carton: number;
  quantity_ordered: number;      // Original quantity ordered
  quantity_received?: number;    // Actual quantity received (for partial deliveries)
  facture_quantity?: number;     // Units received with official invoice
  facture_unit_price?: number;   // Price per unit on supplier's official invoice
  unit_price: number;
  total_price: number;
  made_date?: string | null;
  expiry_date?: string | null;
  quantity_rejected?: number | null;
}

export interface PurchaseOrder {
  id: number;
  reference: string;
  supplier_name: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  supplier_city?: string;
  status: PurchaseOrderStatus;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  sent_at?: string;
  confirmed_at?: string;
  delivered_at?: string;
  items: PurchaseOrderItem[];
  item_count: number;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';

export interface PurchaseOrderCreate {
  supplier_name: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  supplier_city?: string;
  notes?: string;
  items: PurchaseOrderItemCreate[];
}

export interface PurchaseOrderItemCreate {
  product_id?: number;
  product_name: string;
  brand: string;
  units_per_carton: number;
  quantity_ordered: number;
  unit_price: number;
  total_price: number;
}

export interface PurchaseOrderUpdate {
  supplier_id?: number;
  supplier_name?: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  supplier_city?: string;
  notes?: string;
  items?: PurchaseOrderItemUpdate[];
}

export interface PurchaseOrderItemUpdate {
  id?: number;
  product_id?: number;
  product_name?: string;
  brand?: string;
  units_per_carton?: number;
  quantity_ordered?: number;
  quantity_received?: number;
  unit_price?: number;
  total_price?: number;
}

export interface PurchaseOrdersResponse {
  orders: PurchaseOrder[];
  total: number;
}

export interface DeliveryConfirmation {
  items: {
    item_id: number;
    quantity_received: number;
    facture_quantity: number;
    facture_unit_price: number;
    units_per_carton?: number;
    unit_price?: number;
  }[];
  notes?: string;
}

// ============================================================================
// Service
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  private api = inject(ApiService);
  private statusSeverity = inject(StatusSeverityService);

  // ---------------------------------------------------------------------------
  // CRUD Operations
  // ---------------------------------------------------------------------------

  getOrders(params?: {
    status?: string;
    supplier?: string;
    skip?: number;
    limit?: number;
  }): Observable<PurchaseOrdersResponse> {
    const queryParams: Record<string, string | number> = {};
    if (params?.status) queryParams['status'] = params.status;
    if (params?.supplier) queryParams['supplier'] = params.supplier;
    if (params?.skip !== undefined) queryParams['skip'] = params.skip;
    if (params?.limit !== undefined) queryParams['limit'] = params.limit;

    return this.api.get<PurchaseOrdersResponse>('/purchase-orders', { params: queryParams });
  }

  getOrder(id: number): Observable<PurchaseOrder> {
    return this.api.get<PurchaseOrder>(`/purchase-orders/${id}`);
  }

  createOrder(data: PurchaseOrderCreate): Observable<PurchaseOrder> {
    return this.api.post<PurchaseOrder>('/purchase-orders', data);
  }

  updateOrder(id: number, data: PurchaseOrderUpdate): Observable<PurchaseOrder> {
    return this.api.put<PurchaseOrder>(`/purchase-orders/${id}`, data);
  }

  deleteOrder(id: number): Observable<void> {
    return this.api.delete<void>(`/purchase-orders/${id}`);
  }

  deleteItem(orderId: number, itemId: number): Observable<PurchaseOrder> {
    return this.api.delete<PurchaseOrder>(`/purchase-orders/${orderId}/items/${itemId}`);
  }

  // ---------------------------------------------------------------------------
  // Status Operations
  // ---------------------------------------------------------------------------

  updateStatus(id: number, status: PurchaseOrderStatus): Observable<PurchaseOrder> {
    return this.api.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, null, {
      params: { status }
    });
  }

  // ---------------------------------------------------------------------------
  // Delivery Operations (with stock sync)
  // ---------------------------------------------------------------------------

  /**
   * Confirm delivery with received quantities.
   * This will update stock in the products table.
   */
  confirmDelivery(id: number, delivery: DeliveryConfirmation): Observable<PurchaseOrder> {
    return this.api.post<PurchaseOrder>(`/purchase-orders/${id}/deliver`, delivery);
  }

  updateFactureItems(orderId: number, items: { item_id: number; quantity_ordered?: number; facture_quantity: number; facture_unit_price: number; units_per_carton?: number; unit_price?: number; quantity_rejected?: number; made_date?: string | null; expiry_date?: string | null }[]): Observable<PurchaseOrder> {
    return this.api.patch<PurchaseOrder>(`/purchase-orders/${orderId}/facture-items`, { items });
  }

  getCurrentCmup(): Observable<Record<number, number>> {
    return this.api.get<Record<number, number>>('/purchase-orders/current-cmup');
  }

  getCmupTiers(): Observable<Record<number, PriceTier[]>> {
    return this.api.get<Record<number, PriceTier[]>>('/purchase-orders/cmup-tiers');
  }

  getProductLifecycles(): Observable<Record<number, { made_date: string; expiry_date: string }[]>> {
    return this.api.get('/purchase-orders/product-lifecycles');
  }

  getProductLots(productId: number): Observable<ProductPurchaseLot[]> {
    return this.api.get<ProductPurchaseLot[]>(`/purchase-orders/product-lots/${productId}`);
  }

  getOrderAuditLogs(orderId: number): Observable<AuditLog[]> {
    return this.api.get<AuditLog[]>(`/purchase-orders/${orderId}/audit-logs`);
  }

  updateCmup(productId: number, cmup: number): Observable<{ cmup: number }> {
    return this.api.patch<{ cmup: number }>(`/purchase-orders/cmup/${productId}`, { cmup });
  }


  // ---------------------------------------------------------------------------
  // Helpers (delegating to StatusSeverityService)
  // ---------------------------------------------------------------------------

  getStatusLabel(status: PurchaseOrderStatus): string {
    return this.statusSeverity.getPurchaseOrderStatusLabel(status);
  }

  getStatusSeverity(status: PurchaseOrderStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    return this.statusSeverity.getPurchaseOrderStatusSeverity(status) as 'success' | 'info' | 'warn' | 'danger' | 'secondary';
  }

  canDelete(order: PurchaseOrder): boolean {
    return order.status === 'draft';
  }
}
