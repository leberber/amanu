import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PAGINATION } from '../core/constants';

import { map } from 'rxjs/operators';

import {
  DashboardStats,
  SalesReport,
  LowStockProduct,
  Order,
  UserManage,
  UsersResponse,
  OrdersResponse,
  LogsResponse,
  SystemMetrics,
  SystemHealth
} from '../models/admin.model';
import {
  DriverProfileWithFlags,
  AssignOrderRequest,
  AssignOrderResponse
} from '../models/driver.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private apiService: ApiService) {}

  getDashboardStats(): Observable<DashboardStats> {
    return this.apiService.get<DashboardStats>('/admin/dashboard');
  }

  getSalesReport(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate?: string,
    endDate?: string,
    categoryLimit?: number,
    productLimit?: number,
    categoryId?: number,
    brandId?: number
  ): Observable<SalesReport> {
    let params: any = { period };

    if (startDate) {
      params.start_date = startDate;
    }

    if (endDate) {
      params.end_date = endDate;
    }

    if (categoryLimit) {
      params.category_limit = categoryLimit;
    }

    if (productLimit) {
      params.product_limit = productLimit;
    }

    if (categoryId) {
      params.category_id = categoryId;
    }

    if (brandId) {
      params.brand_id = brandId;
    }

    return this.apiService.get<SalesReport>('/admin/sales-report', { params });
  }

  getLowStockProducts(threshold: number = 10): Observable<LowStockProduct[]> {
    return this.apiService.get<LowStockProduct[]>('/admin/low-stock', { 
      params: { threshold }
    });
  }

  // Orders management
  getAllOrders(status?: string, page: number = 1, pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE): Observable<OrdersResponse> {
    let params: any = { skip: (page - 1) * pageSize, limit: pageSize };
    
    if (status) {
      params.status = status;
    }
    
    return this.apiService.get<Order[]>('/orders', { params }).pipe(
      map(response => ({
        orders: response,
        total: response.length
      }))
    );
  }
  

  getOrderById(orderId: number): Observable<Order> {
    return this.apiService.get<Order>(`/orders/${orderId}`);
  }

  updateOrderStatus(orderId: number, status: string): Observable<Order> {
    return this.apiService.patch<Order>(`/orders/${orderId}`, { status });
  }

  // Users management - UPDATED to use new response format
  getAllUsers(page: number = 1, pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE): Observable<UsersResponse> {
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

  createUser(userData: any): Observable<UserManage> {
    return this.apiService.post<UserManage>('/auth/register', userData);
  }

  // Driver management
  getAvailableDrivers(): Observable<DriverProfileWithFlags[]> {
    return this.apiService.get<DriverProfileWithFlags[]>('/admin/drivers/profiles');
  }

  assignOrderToDriver(orderId: number, request: AssignOrderRequest): Observable<AssignOrderResponse> {
    return this.apiService.post<AssignOrderResponse>(`/admin/drivers/orders/${orderId}/assign`, request);
  }

  unassignOrder(orderId: number): Observable<AssignOrderResponse> {
    return this.apiService.post<AssignOrderResponse>(`/admin/drivers/orders/${orderId}/unassign`, {});
  }

  reassignOrder(orderId: number, request: AssignOrderRequest): Observable<AssignOrderResponse> {
    return this.apiService.post<AssignOrderResponse>(`/admin/drivers/orders/${orderId}/reassign`, request);
  }

  // Logs
  getLogs(lines: number = 100, level?: string): Observable<LogsResponse> {
    const params: Record<string, string | number> = { lines };
    if (level) {
      params['level'] = level;
    }
    return this.apiService.get<LogsResponse>('/admin/logs', { params });
  }

  // System Metrics
  getSystemMetrics(): Observable<SystemMetrics> {
    return this.apiService.get<SystemMetrics>('/admin/system');
  }

  getSystemHealth(): Observable<SystemHealth> {
    return this.apiService.get<SystemHealth>('/admin/system/health');
  }
}