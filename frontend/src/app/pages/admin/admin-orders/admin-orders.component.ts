// src/app/pages/admin/admin-orders/admin-orders.component.ts
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { ROUTES } from '../../../core/constants/routes.constants';
import { ORDER_STATUS } from '../../../core/constants/app.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { UnitsService } from '../../../core/services/units.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss'
})
export class AdminOrdersComponent extends BaseAdminListComponent implements OnInit {
  allOrders: Order[] = [];
  orders: Order[] = [];
  paginatedOrders: Order[] = [];
  users: any[] = [];
  products: any[] = [];

  // Override status filter type for orders
  override statusFilter: string = 'all';

  selectedOrder: Order | null = null;
  displayOrderDialog = false;

  // Inline status editing
  editingStatusOrderId: number | null = null;

  // Services
  private adminService = inject(AdminService);
  private confirmationService = inject(ConfirmationService);
  private translateService = inject(TranslateService);
  private productService = inject(ProductService);
  private translationHelper = inject(TranslationHelperService);
  private unitsService = inject(UnitsService);
  private statusSeverity = inject(StatusSeverityService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadUsersAndOrders();
    this.loadProducts();
    onLanguageChange(this.translateService, this.destroyRef, () => this.filterItems());
  }

  loadProducts() {
    this.loadDataSilent(
      () => this.productService.getProducts(),
      (products) => { this.products = products || []; }
    );
  }

  loadUsersAndOrders() {
    this.loading = true;

    this.adminService.getAllUsers().subscribe({
      next: (usersResponse) => {
        this.users = Array.isArray(usersResponse) ? usersResponse : usersResponse.users;
        this.loadAllOrders();
      },
      error: () => {
        this.users = [];
        this.loadAllOrders();
      }
    });
  }

  getUserById(userId: number) {
    return this.users.find(user => user.id === userId);
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.statusFilter !== 'all');
  }

  getPendingCount(): number {
    return this.getCountByPredicate(this.allOrders, o => o.status === ORDER_STATUS.PENDING);
  }

  getConfirmedCount(): number {
    return this.getCountByPredicate(this.allOrders, o => o.status === ORDER_STATUS.CONFIRMED);
  }

  getShippedCount(): number {
    return this.getCountByPredicate(this.allOrders, o => o.status === ORDER_STATUS.SHIPPED);
  }

  getDeliveredCount(): number {
    return this.getCountByPredicate(this.allOrders, o => o.status === ORDER_STATUS.DELIVERED);
  }

  getCancelledCount(): number {
    return this.getCountByPredicate(this.allOrders, o => o.status === ORDER_STATUS.CANCELLED);
  }

  // === Abstract method implementations ===

  updatePaginatedItems(): void {
    this.paginatedOrders = this.orders.slice(this.first, this.first + this.rows);
  }

  getSearchDebounceKey(): string {
    return 'orders-search';
  }

  // === Data loading ===

  loadAllOrders() {
    this.adminService.getAllOrders('', 1, 1000).subscribe({
      next: (response) => {
        if (response && response.orders) {
          this.allOrders = response.orders;
          this.orders = response.orders;
          this.updatePaginatedItems();
        } else {
          this.allOrders = [];
          this.orders = [];
        }
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;

        if (error.status === 403) {
          this.baseToast.showPermissionDenied();
          this.baseRouter.navigate([ROUTES.HOME]);
        } else {
          this.baseToast.showError('admin.orders.load_error');
        }

        this.allOrders = [];
        this.orders = [];
      }
    });
  }

  filterItems(): void {
    let filtered = [...this.allOrders];

    // Status filter (custom for orders: pending/confirmed/shipped/delivered/cancelled)
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

    // Search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.id.toString().includes(search) ||
        order.user?.full_name?.toLowerCase().includes(search) ||
        order.user?.email?.toLowerCase().includes(search) ||
        order.status.toLowerCase().includes(search) ||
        order.total_amount.toString().includes(search) ||
        order.contact_phone?.toLowerCase().includes(search)
      );
    }

    this.orders = filtered;
    this.resetPagination();
    this.updatePaginatedItems();
  }

  override clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.resetPagination();
    this.filterItems();
  }

  refreshOrderData() {
    this.loadAllOrders();
  }

  exportOrders() {
    this.baseToast.showInfo('admin.orders.export_coming_soon');
  }

  openOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.displayOrderDialog = true;
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.statusSeverity.getOrderStatusSeverity(status);
  }

  getStatusIcon(status: string): string {
    return this.statusSeverity.getOrderStatusIcon(status);
  }

  getProductName(item: any): string {
    if (item.name_translations || item.name) {
      return this.translationHelper.getProductName(item);
    }

    if (item.product_id && this.products.length > 0) {
      const fullProduct = this.products.find(p => p.id === item.product_id);
      if (fullProduct) {
        return this.translationHelper.getProductName(fullProduct);
      }
    }

    return item.product_name || item.name;
  }

  updateOrderStatus(orderId: number, newStatus: string) {
    const statusText = this.translateService.instant('admin.orders.status.' + newStatus);
    const message = this.translateService.instant('admin.orders.confirm_status_update', { status: statusText });

    this.confirmationService.confirm({
      message: message,
      header: this.translateService.instant('common.warning'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: this.translateService.instant('common.proceed'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => {
        this.adminService.updateOrderStatus(orderId, newStatus).subscribe({
          next: (updatedOrder) => {
            const allIndex = this.allOrders.findIndex(o => o.id === orderId);
            if (allIndex !== -1) {
              this.allOrders[allIndex] = updatedOrder;
            }

            this.filterItems();

            this.baseToast.showSuccess('admin.orders.status_update_message', {
              orderId: orderId,
              status: this.translateService.instant('admin.orders.status.' + newStatus)
            });

            if (this.selectedOrder && this.selectedOrder.id === orderId) {
              this.selectedOrder = updatedOrder;
            }
          },
          error: (error) => {
            this.baseToast.showApiError(error, 'admin.orders.update_error');
          }
        });
      }
    });
  }

  // ===== INLINE STATUS EDITING =====

  startEditStatus(order: Order): void {
    // Only allow editing if there are next statuses available
    if (this.getNextStatuses(order.status).length > 0) {
      this.editingStatusOrderId = order.id;
    }
  }

  cancelEditStatus(): void {
    this.editingStatusOrderId = null;
  }

  isEditingStatus(orderId: number): boolean {
    return this.editingStatusOrderId === orderId;
  }

  getNextStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
    // Allow skipping steps - show all forward statuses
    const statusTransitions: Record<string, string[]> = {
      [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.DELIVERED]: [],
      [ORDER_STATUS.CANCELLED]: []
    };

    const nextStatuses = statusTransitions[currentStatus] || [];

    return nextStatuses.map(status => ({
      value: status,
      label: this.translateService.instant('admin.orders.status.' + status),
      icon: this.getStatusIcon(status)
    }));
  }

  selectNewStatus(orderId: number, newStatus: string): void {
    this.cancelEditStatus();
    this.updateOrderStatus(orderId, newStatus);
  }

  canEditStatus(status: string): boolean {
    return this.getNextStatuses(status).length > 0;
  }
}
