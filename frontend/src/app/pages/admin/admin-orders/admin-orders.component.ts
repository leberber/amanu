import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ROUTES } from '../../../core/constants/routes.constants';
import { ORDER_STATUS } from '../../../core/constants/app.constants';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { Order, OrderItem, UserManage } from '../../../models/admin.model';
import { Product } from '../../../models/product.model';
import { ProductService } from '../../../services/product.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    PopoverModule,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
    templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss'
})
export class AdminOrdersComponent extends BaseAdminListComponent implements OnInit {
  // Data signals
  allOrders = signal<Order[]>([]);
  orders = signal<Order[]>([]);
  paginatedOrders = signal<Order[]>([]);
  users = signal<UserManage[]>([]);
  products = signal<Product[]>([]);

  // Computed counts
  pendingCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.PENDING).length);
  confirmedCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.CONFIRMED).length);
  shippedCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.SHIPPED).length);
  deliveredCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.DELIVERED).length);
  cancelledCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.CANCELLED).length);

  // Animation state
  tableInitialized = signal(false);

  // UI state signals
  isFullscreen = signal(false);
  selectedOrder = signal<Order | null>(null);
  displayOrderDialog = signal(false);

  // Inline status editing signals
  editingStatusOrderId = signal<number | null>(null);
  selectedNewStatus = signal<string | null>(null);
  pulseConfirm = signal(false);

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

  // Services
  private adminService = inject(AdminService);
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
    this.productService.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => this.products.set(products || []),
        error: () => this.products.set([])
      });
  }

  loadUsersAndOrders() {
    this.loading = true;

    this.adminService.getAllUsers(1, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (usersResponse) => {
          this.users.set(usersResponse?.users || []);
          this.loadAllOrders();
        },
        error: () => {
          this.users.set([]);
          this.loadAllOrders();
        }
      });
  }

  getUserById(userId: number) {
    return this.users().find(user => user.id === userId);
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.statusFilter !== 'all');
  }

  // Abstract method implementations
  updatePaginatedItems(): void {
    this.paginatedOrders.set(this.orders().slice(this.first, this.first + this.rows));
  }

  getSearchDebounceKey(): string {
    return 'orders-search';
  }

  // Data loading
  loadAllOrders() {
    this.adminService.getAllOrders('', 1, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response && response.orders) {
            this.allOrders.set(response.orders);
            this.orders.set(response.orders);
            this.updatePaginatedItems();
          } else {
            this.allOrders.set([]);
            this.orders.set([]);
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

          this.allOrders.set([]);
          this.orders.set([]);
        }
      });
  }

  filterItems(): void {
    let filtered = [...this.allOrders()];

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

    this.orders.set(filtered);
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
    this.isFullscreen.update(v => !v);
    if (this.isFullscreen()) {
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
    this.selectedOrder.set(order);
    this.displayOrderDialog.set(true);
  }

  closeOrderDialog() {
    this.displayOrderDialog.set(false);
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.statusSeverity.getOrderStatusSeverity(status);
  }

  getStatusIcon(status: string): string {
    return this.statusSeverity.getOrderStatusIcon(status);
  }

  getProductName(item: OrderItem): string {
    // Try to find the full product for translated name
    const products = this.products();
    if (item.product_id && products.length > 0) {
      const fullProduct = products.find(p => p.id === item.product_id);
      if (fullProduct) {
        return this.translationHelper.getProductName(fullProduct);
      }
    }

    // Fallback to stored product name
    return item.product_name;
  }

  updateOrderStatus(orderId: number, newStatus: string) {
    this.adminService.updateOrderStatus(orderId, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedOrder) => {
          this.allOrders.update(orders => {
            const index = orders.findIndex(o => o.id === orderId);
            if (index !== -1) {
              const updated = [...orders];
              updated[index] = updatedOrder;
              return updated;
            }
            return orders;
          });

          this.filterItems();

          this.baseToast.showSuccess('admin.orders.status_update_message', {
            orderId: orderId,
            status: this.translateService.instant('admin.orders.status.' + newStatus)
          });

          const currentSelected = this.selectedOrder();
          if (currentSelected && currentSelected.id === orderId) {
            this.selectedOrder.set(updatedOrder);
          }
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.orders.update_error');
        }
      });
  }

  // Inline status editing
  startEditStatus(order: Order): void {
    if (this.getNextStatuses(order.status).length > 0) {
      this.editingStatusOrderId.set(order.id);
      this.selectedNewStatus.set(null);
    }
  }

  cancelEditStatus(): void {
    this.editingStatusOrderId.set(null);
    this.selectedNewStatus.set(null);
  }

  isEditingStatus(orderId: number): boolean {
    return this.editingStatusOrderId() === orderId;
  }

  isStatusSelected(status: string): boolean {
    return this.selectedNewStatus() === status;
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
    this.selectedNewStatus.set(newStatus);
    this.pulseConfirm.set(false);
    setTimeout(() => this.pulseConfirm.set(true), 10);
  }

  confirmStatusChange(): void {
    const orderId = this.editingStatusOrderId();
    const newStatus = this.selectedNewStatus();
    if (orderId && newStatus) {
      this.cancelEditStatus();
      this.updateOrderStatus(orderId, newStatus);
    }
  }

  canEditStatus(status: string): boolean {
    return this.getNextStatuses(status).length > 0;
  }
}
