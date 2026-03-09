import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopoverModule } from 'primeng/popover';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { ORDER_STATUS } from '../../../core/constants/order.constants';
import { PAGINATION } from '../../../core/constants';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';
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

  // Computed counts
  pendingCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.PENDING).length);
  confirmedCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.CONFIRMED).length);
  inTransitCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.IN_TRANSIT).length);
  deliveredCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.DELIVERED).length);
  cancelledCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.CANCELLED).length);

  // Mobile load more
  mobileVisibleCount = signal(10);
  mobileOrders = computed(() => this.orders().slice(0, this.mobileVisibleCount()));
  hasMoreOrders = computed(() => this.mobileVisibleCount() < this.orders().length);

  // Display orders - uses mobile list on mobile, paginated on desktop
  displayOrders = computed(() => this.isMobile() ? this.mobileOrders() : this.paginatedOrders());

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

  // Column visibility options - with mobile defaults (initialized in ngOnInit)
  override columnOptions: ColumnOption[] = [];

  // Services
  private readonly adminService = inject(AdminService);
  private readonly translateService = inject(TranslateService);
  private readonly statusSeverity = inject(StatusSeverityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

  // Expose breakpoint signal for template and computed properties
  isMobile = this.breakpoint.isMobile;

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'order_id', label: 'admin.orders.table.order_id', visible: !isMobile },
      { field: 'customer', label: 'admin.orders.table.customer', visible: true },
      { field: 'date', label: 'admin.orders.table.date', visible: !isMobile },
      { field: 'status', label: 'admin.orders.table.status', visible: true },
      { field: 'total', label: 'admin.orders.table.total', visible: true },
      { field: 'actions', label: 'admin.orders.table.actions', visible: !isMobile }
    ];
  }

  ngOnInit() {
    this.loading = true;
    this.columnOptions = this.getInitialColumnOptions();
    this.loadAllOrders();
    onLanguageChange(this.translateService, this.destroyRef, () => this.filterItems());
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
  loadAllOrders(): void {
    this.adminService.getAllOrders('', 1, PAGINATION.FETCH_ALL_LIMIT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const orders = response?.orders || [];
          this.allOrders.set(orders);
          this.orders.set(orders);
          this.updatePaginatedItems();
          this.loading = false;
          this.markTableInitialized();
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

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

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
    this.mobileVisibleCount.set(PAGINATION.DEFAULT_PAGE_SIZE);
  }

  override clearFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.resetPagination();
    this.filterItems();
  }

  loadMoreOrders(): void {
    this.mobileVisibleCount.update(count => count + PAGINATION.DEFAULT_PAGE_SIZE);
  }

  openOrderDetails(order: Order): void {
    if (this.isFullscreen()) {
      this.toggleFullscreen();
    }
    this.baseRouter.navigate([RouteHelpers.adminOrderDetail(order.id)]);
  }

  getStatusIcon(status: string): string {
    return this.statusSeverity.getOrderStatusIcon(status);
  }

  // Status editing - delegate to service
  getNextStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
    return this.statusSeverity.getNextOrderStatuses(currentStatus);
  }

  canEditStatus(status: string): boolean {
    return this.statusSeverity.canEditOrderStatus(status);
  }

  startEditStatus(order: Order): void {
    if (this.canEditStatus(order.status)) {
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

  private updateOrderStatus(orderId: number, newStatus: string): void {
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
        },
        error: (error) => {
          this.baseToast.showApiError(error, 'admin.orders.update_error');
        }
      });
  }
}
