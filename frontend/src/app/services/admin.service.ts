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
  SystemHealth,
  CustomerRoute,
  SystemErrorsResponse,
  PurchaseOrder,
  PurchaseOrderCreate,
  PurchaseOrdersResponse,
  OrderPayment,
  OrderPaymentsResponse,
  OrderAuditLog,
  OrderItemCreate
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

  // Order Payments
  getOrderPayments(orderId: number): Observable<OrderPaymentsResponse> {
    return this.apiService.get<OrderPaymentsResponse>(`/orders/${orderId}/payments`);
  }

  recordPayment(orderId: number, data: { amount: number; method: string; note?: string }): Observable<OrderPayment> {
    return this.apiService.post<OrderPayment>(`/orders/${orderId}/payments`, data);
  }

  // Order Audit Log
  getOrderAuditLog(orderId: number): Observable<OrderAuditLog[]> {
    return this.apiService.get<OrderAuditLog[]>(`/orders/${orderId}/audit-log`);
  }

  // Order Item Editing
  addOrderItem(orderId: number, item: OrderItemCreate): Observable<Order> {
    return this.apiService.post<Order>(`/orders/${orderId}/items`, item);
  }

  removeOrderItem(orderId: number, itemId: number): Observable<Order> {
    return this.apiService.delete<Order>(`/orders/${orderId}/items/${itemId}`);
  }

  updateOrderItemQty(orderId: number, itemId: number, quantity: number): Observable<Order> {
    return this.apiService.patch<Order>(`/orders/${orderId}/items/${itemId}`, { quantity });
  }

  updateOrderItemPrice(orderId: number, itemId: number, customUnitPrice: number | null): Observable<Order> {
    return this.apiService.patch<Order>(`/orders/${orderId}/items/${itemId}`, { custom_unit_price: customUnitPrice });
  }

  // Users management - UPDATED to use new response format
  getAllUsers(page: number = 1, pageSize: number = PAGINATION.DEFAULT_PAGE_SIZE): Observable<UsersResponse> {
    return this.apiService.get<UsersResponse>('/users', {
      params: { skip: (page - 1) * pageSize, limit: pageSize }
    });
  }

  searchUsers(search: string, limit: number = 10): Observable<UsersResponse> {
    return this.apiService.get<UsersResponse>('/users', {
      params: { skip: 0, limit, search }
    });
  }

  createOrderForUser(userId: number, items: { product_id: number; quantity: number; custom_unit_price?: number | null }[], deliveryType: 'pickup' | 'delivery' = 'pickup'): Observable<{ order_id: number }> {
    return this.apiService.post<{ order_id: number }>('/admin/create-order', { user_id: userId, items, delivery_type: deliveryType });
  }

  getUserById(userId: number): Observable<UserManage> {
    return this.apiService.get<UserManage>(`/users/${userId}`);
  }

  updateUser(userId: number, userData: Partial<UserManage>): Observable<UserManage> {
    return this.apiService.patch<UserManage>(`/users/${userId}`, userData);
  }

  setUserPassword(userId: number, password: string): Observable<UserManage> {
    return this.apiService.post<UserManage>(`/users/${userId}/set-password`, { password });
  }

  deleteUser(userId: number): Observable<void> {
    return this.apiService.delete<void>(`/users/${userId}`);
  }

  createUser(userData: any): Observable<UserManage> {
    return this.apiService.post<UserManage>('/auth/register', userData);
  }

  // Customer Routes
  getCustomerRoutes(): Observable<CustomerRoute[]> {
    return this.apiService.get<CustomerRoute[]>('/admin/routes/');
  }

  getCustomerRoute(userId: number): Observable<CustomerRoute> {
    return this.apiService.get<CustomerRoute>(`/admin/routes/${userId}`);
  }

  fetchAndSaveCustomerRoute(userId: number): Observable<CustomerRoute> {
    return this.apiService.post<CustomerRoute>('/admin/routes/fetch', { user_id: userId });
  }

  deleteCustomerRoute(userId: number): Observable<void> {
    return this.apiService.delete<void>(`/admin/routes/${userId}`);
  }

  updateCustomerRoute(userId: number, data: { corridor?: string }): Observable<CustomerRoute> {
    return this.apiService.patch<CustomerRoute>(`/admin/routes/${userId}`, data);
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

  getSystemErrors(limit: number = 50): Observable<SystemErrorsResponse> {
    return this.apiService.get<SystemErrorsResponse>('/admin/system/errors', { params: { limit } });
  }

  clearSystemErrors(): Observable<void> {
    return this.apiService.delete<void>('/admin/system/errors');
  }

  // Purchase Orders (Bon de Commande)
  getPurchaseOrders(status?: string, supplier?: string, skip = 0, limit = 50): Observable<PurchaseOrdersResponse> {
    const params: Record<string, string | number> = { skip, limit };
    if (status) params['status'] = status;
    if (supplier) params['supplier'] = supplier;
    return this.apiService.get<PurchaseOrdersResponse>('/purchase-orders', { params });
  }

  getPurchaseOrder(orderId: number): Observable<PurchaseOrder> {
    return this.apiService.get<PurchaseOrder>(`/purchase-orders/${orderId}`);
  }

  createPurchaseOrder(data: PurchaseOrderCreate): Observable<PurchaseOrder> {
    return this.apiService.post<PurchaseOrder>('/purchase-orders', data);
  }

  updatePurchaseOrderStatus(orderId: number, status: string): Observable<PurchaseOrder> {
    return this.apiService.patch<PurchaseOrder>(`/purchase-orders/${orderId}/status`, null, { params: { status } });
  }

  deletePurchaseOrder(orderId: number): Observable<void> {
    return this.apiService.delete<void>(`/purchase-orders/${orderId}`);
  }
}