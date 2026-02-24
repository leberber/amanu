// src/app/pages/admin/admin-orders/admin-orders.component.ts
import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { ROUTES } from '../../../core/constants/routes.constants';
import { ORDER_STATUS } from '../../../core/constants/app.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    PopoverModule,
    TableSkeletonComponent
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

  // Animation state
  tableInitialized = signal(false);

  // Fullscreen mode
  isFullscreen = false;

  // Override status filter type for orders
  override statusFilter: string = 'all';

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '10%', type: 'text', headerWidth: '80px' },
    { width: '25%', type: 'text-multi', headerWidth: '100px' },
    { width: '15%', type: 'text', headerWidth: '60px' },
    { width: '15%', type: 'pill', headerWidth: '60px' },
    { width: '15%', type: 'text', headerWidth: '60px' },
    { width: '20%', type: 'actions', headerWidth: '80px' }
  ];

  // Column visibility options
  override columnOptions: ColumnOption[] = [
    { field: 'order_id', label: 'admin.orders.table.order_id', visible: true },
    { field: 'customer', label: 'admin.orders.table.customer', visible: true },
    { field: 'date', label: 'admin.orders.table.date', visible: true },
    { field: 'status', label: 'admin.orders.table.status', visible: true },
    { field: 'total', label: 'admin.orders.table.total', visible: true },
    { field: 'actions', label: 'admin.orders.table.actions', visible: true }
  ];

  selectedOrder: Order | null = null;
  displayOrderDialog = false;

  // Inline status editing
  editingStatusOrderId: number | null = null;
  selectedNewStatus: string | null = null;
  pulseConfirm = false;

  // Services
  private adminService = inject(AdminService);
  private confirmationService = inject(ConfirmationService);
  private translateService = inject(TranslateService);
  private productService = inject(ProductService);
  private translationHelper = inject(TranslationHelperService);
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
        setTimeout(() => this.tableInitialized.set(true), 100);
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

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      document.body.classList.add('fullscreen-active');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('fullscreen-active');
      document.body.style.overflow = '';
    }
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

  // ===== INLINE STATUS EDITING =====

  startEditStatus(order: Order): void {
    if (this.getNextStatuses(order.status).length > 0) {
      this.editingStatusOrderId = order.id;
      this.selectedNewStatus = null;
    }
  }

  cancelEditStatus(): void {
    this.editingStatusOrderId = null;
    this.selectedNewStatus = null;
  }

  isEditingStatus(orderId: number): boolean {
    return this.editingStatusOrderId === orderId;
  }

  isStatusSelected(status: string): boolean {
    return this.selectedNewStatus === status;
  }

  getNextStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
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

  selectNewStatus(newStatus: string): void {
    this.selectedNewStatus = newStatus;
    this.pulseConfirm = false;
    setTimeout(() => this.pulseConfirm = true, 10);
  }

  confirmStatusChange(): void {
    if (this.editingStatusOrderId && this.selectedNewStatus) {
      const orderId = this.editingStatusOrderId;
      const newStatus = this.selectedNewStatus;
      this.cancelEditStatus();
      this.updateOrderStatus(orderId, newStatus);
    }
  }

  canEditStatus(status: string): boolean {
    return this.getNextStatuses(status).length > 0;
  }
}
