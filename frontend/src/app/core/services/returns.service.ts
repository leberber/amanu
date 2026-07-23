import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReturnItem {
  id: number;
  order_item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderReturn {
  id: number;
  order_id: number;
  status: 'pending' | 'approved' | 'received' | 'rejected';
  reason?: string;
  notes?: string;
  refund_amount: number;
  created_at: string;
  approved_at?: string;
  received_at?: string;
  creator_name?: string;
  customer_name?: string;
  items: ReturnItem[];
}

export interface OrderReturnCreate {
  order_id: number;
  reason?: string;
  notes?: string;
  items: { order_item_id: number; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/returns`;

  list(status?: string): Observable<OrderReturn[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<OrderReturn[]>(this.apiUrl, { params });
  }

  create(data: OrderReturnCreate): Observable<OrderReturn> {
    return this.http.post<OrderReturn>(this.apiUrl, data);
  }

  approve(id: number): Observable<OrderReturn> {
    return this.http.patch<OrderReturn>(`${this.apiUrl}/${id}/approve`, {});
  }

  receive(id: number): Observable<OrderReturn> {
    return this.http.patch<OrderReturn>(`${this.apiUrl}/${id}/receive`, {});
  }

  reject(id: number): Observable<OrderReturn> {
    return this.http.patch<OrderReturn>(`${this.apiUrl}/${id}/reject`, {});
  }
}
