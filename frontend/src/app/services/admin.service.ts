// src/app/services/admin.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

import { map } from 'rxjs/operators';

import { 
  DashboardStats, 
  SalesReport, 
  LowStockProduct,
  Order,
  UserManage,
  UsersResponse,
  OrdersResponse
} from '../models/admin.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private apiService: ApiService) {}

  getDashboardStats(): Observable<DashboardStats> {
    return this.apiService.get<DashboardStats>('/admin/dashboard');
  }

  getSalesReport(period: 'daily' | 'weekly' | 'monthly' | 'yearly', startDate?: string, endDate?: string): Observable<SalesReport> {
    let params: any = { period };
    
    if (startDate) {
      params.start_date = startDate;
    }
    
    if (endDate) {
      params.end_date = endDate;
    }
    
    return this.apiService.get<SalesReport>('/admin/sales-report', { params });
  }

  getLowStockProducts(threshold: number = 10): Observable<LowStockProduct[]> {
    return this.apiService.get<LowStockProduct[]>('/admin/low-stock', { 
      params: { threshold }
    });
  }

  // Orders management
  getAllOrders(status?: string, page: number = 1, pageSize: number = 10): Observable<OrdersResponse> {
    let params: any = { skip: (page - 1) * pageSize, limit: pageSize };
    
    if (status) {
      params.status = status;
    }
    
    return this.apiService.get<Order[]>('/orders', { params }).pipe(
      map(response => {
        // The API returns an array of orders, but we need to transform it
        // to an object with orders and total properties
        return {
          orders: response,
          total: response.length // For now we'll use the array length as the total
        };
      })
    );
  }
  

  getOrderById(orderId: number): Observable<Order> {
    return this.apiService.get<Order>(`/orders/${orderId}`);
  }

  updateOrderStatus(orderId: number, status: string): Observable<Order> {
    return this.apiService.patch<Order>(`/orders/${orderId}`, { status });
  }

  // Users management - UPDATED to use new response format
  getAllUsers(page: number = 1, pageSize: number = 10): Observable<UsersResponse> {
    return this.apiService.get<UsersResponse>('/users', { 
      params: { skip: (page - 1) * pageSize, limit: pageSize }
    });
  }

  getUserById(userId: number): Observable<UserManage> {
    return this.apiService.get<UserManage>(`/users/${userId}`);
  }

  updateUser(userId: number, userData: Partial<UserManage>): Observable<UserManage> {
    return this.apiService.patch<UserManage>(`/users/${userId}`, userData);
  }

  deleteUser(userId: number): Observable<void> {
    return this.apiService.delete<void>(`/users/${userId}`);
  }
}