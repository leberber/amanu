import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ============================================================================
// Models
// ============================================================================

export interface PurchaseOrderItem {
  id?: number;
  product_id?: number;  // Link to products table for stock sync
  product_name: string;
  brand: string;
  units_per_carton: number;
  quantity_ordered: number;      // Original quantity ordered
  quantity_received?: number;    // Actual quantity received (for partial deliveries)
  unit_price: number;
  total_price: number;
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  getStatusLabel(status: PurchaseOrderStatus): string {
    const labels: Record<PurchaseOrderStatus, string> = {
      'draft': 'Brouillon',
      'sent': 'Envoyée',
      'confirmed': 'Confirmée',
      'delivered': 'Livrée',
      'cancelled': 'Annulée'
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: PurchaseOrderStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const severities: Record<PurchaseOrderStatus, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      'draft': 'secondary',
      'sent': 'info',
      'confirmed': 'warn',
      'delivered': 'success',
      'cancelled': 'danger'
    };
    return severities[status] || 'secondary';
  }

  canDelete(order: PurchaseOrder): boolean {
    return order.status === 'draft';
  }
}
