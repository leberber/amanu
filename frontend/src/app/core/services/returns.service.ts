import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReturnItem {
  id: number;
  order_item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  pieces_per_box?: number;
  packaging_type?: string;
}

export interface OrderReturn {
  id: number;
  order_id: number;
  reason?: string;
  notes?: string;
  restocked: boolean;
  refund_amount: number;
  margin_impact?: number;
  created_at: string;
  creator_name?: string;
  customer_name?: string;
  customer_segment_id?: number;
  items: ReturnItem[];
}

export interface OrderReturnCreate {
  order_id: number;
  reason?: string;
  notes?: string;
  restock: boolean;
  items: { order_item_id: number; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/returns`;

  list(): Observable<OrderReturn[]> {
    return this.http.get<OrderReturn[]>(this.apiUrl);
  }

  create(data: OrderReturnCreate): Observable<OrderReturn> {
    return this.http.post<OrderReturn>(this.apiUrl, data);
  }
}
