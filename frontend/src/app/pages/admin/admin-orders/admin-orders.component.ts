import { Component, OnInit, inject, DestroyRef, signal, computed, viewChild } from '@angular/core';
import { Popover } from 'primeng/popover';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { TableLoadingRowsComponent, LoadingColumn } from '../../../shared/components/table-loading-rows/table-loading-rows.component';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { ORDER_STATUS } from '../../../core/constants/order.constants';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';
import { PAGINATION } from '../../../core/constants';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { OrderPdfService } from '../../../services/order-pdf.service';
import { Order } from '../../../models/admin.model';
import { DriverProfileWithFlags } from '../../../models/driver.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { BaseAdminListComponent, ColumnOption } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    PopoverModule,
    DialogModule,
    SelectModule,
    TableSkeletonComponent,
    TableLoadingRowsComponent,
    InfiniteScrollDirective,
    AgroclikPageContainerComponent
  ],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss'
})
export class AdminOrdersComponent extends BaseAdminListComponent implements OnInit {
  // Infinite scroll configuration
  private readonly BATCH_SIZE = 50;

  // Data signals
  allOrders = signal<Order[]>([]);
  orders = signal<Order[]>([]);
  displayedOrders = signal<Order[]>([]);
  loadingMore = signal(false);
  hasMore = computed(() => this.displayedOrders().length < this.orders().length);

  // Computed counts
  pendingCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.PENDING).length);
  confirmedCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.CONFIRMED).length);
  inTransitCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.IN_TRANSIT).length);
  deliveredCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.DELIVERED).length);
  cancelledCount = computed(() => this.allOrders().filter(o => o.status === ORDER_STATUS.CANCELLED).length);

  // Status editing signals
  editingStatusOrderId = signal<number | null>(null);
  editingOrder = signal<Order | null>(null);
  selectedNewStatus = signal<string | null>(null);
  pulseConfirm = signal(false);
  showStatusDialog = signal(false);

  // Driver assignment signals
  availableDrivers = signal<DriverProfileWithFlags[]>([]);
  loadingDrivers = signal(false);
  selectedDriverId = signal<number | null>(null);
  assigning = signal(false);

  // Driver options for dropdown
  driverOptions = computed(() => {
    return this.availableDrivers()
      .filter(d => d.status !== DRIVER_STATUS.SUSPENDED && d.is_available)
      .map(d => ({
        label: d.full_name
          ? `${d.full_name} (${this.translateService.instant('driver.vehicle.' + d.vehicle_type)}) - ${d.active_orders_count}/${d.max_active_orders}`
          : `${this.translateService.instant('driver.vehicle.' + d.vehicle_type)} - ${d.active_orders_count}/${d.max_active_orders}`,
        value: d.user_id
      }));
  });

  // Check if driver selection is required (when "assigned" status is selected)
  needsDriverSelection = computed(() => this.selectedNewStatus() === ORDER_STATUS.ASSIGNED);

  // Override status filter type for orders
  override statusFilter: string = 'all';

  // Skeleton configuration
  skeletonColumns: SkeletonColumn[] = [
    { width: '8%', type: 'text', headerWidth: '60px' },
    { width: '20%', type: 'text-multi', headerWidth: '80px' },
    { width: '12%', type: 'text', headerWidth: '60px' },
    { width: '12%', type: 'pill', headerWidth: '60px' },
    { width: '18%', type: 'text-multi', headerWidth: '60px' },
    { width: '12%', type: 'text', headerWidth: '60px' },
    { width: '18%', type: 'actions', headerWidth: '60px' }
  ];

  // Column visibility options - with mobile defaults (initialized in ngOnInit)
  override columnOptions: ColumnOption[] = [];

  // Services
  private readonly adminService = inject(AdminService);
  private readonly orderPdf = inject(OrderPdfService);
  private readonly translateService = inject(TranslateService);
  private readonly statusSeverity = inject(StatusSeverityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly breakpoint = inject(BreakpointService);

  // ViewChild for status popover
  statusPopover = viewChild<Popover>('statusPopover');

  // ViewChild for driver assignment popover
  driverPopover = viewChild<Popover>('driverPopover');

  // Driver assignment from driver column
  assigningOrderId = signal<number | null>(null);

  private getInitialColumnOptions(): ColumnOption[] {
    const isMobile = this.breakpoint.isMobile();

    return [
      { field: 'order_id', label: 'admin.orders.table.order_id', visible: !isMobile },
      { field: 'customer', label: 'admin.orders.table.customer', visible: true },
      { field: 'date', label: 'admin.orders.table.date', visible: !isMobile },
      { field: 'status', label: 'admin.orders.table.status', visible: true },
      { field: 'driver', label: 'admin.orders.table.driver', visible: !isMobile },
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
    // Not used - using client-side infinite scroll
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
          this.displayedOrders.set(orders.slice(0, this.BATCH_SIZE));
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
    this.displayedOrders.set(filtered.slice(0, this.BATCH_SIZE));
  }

  override clearFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.filterItems();
  }

  /** Called by InfiniteScrollDirective when user scrolls near bottom */
  loadMoreOrders(): void {
    if (this.loadingMore() || !this.hasMore()) return;

    this.loadingMore.set(true);
    const current = this.displayedOrders().length;
    const next = this.orders().slice(current, current + this.BATCH_SIZE);

    setTimeout(() => {
      this.displayedOrders.update(orders => [...orders, ...next]);
      this.loadingMore.set(false);
    }, 300);
  }

  getLoadingColumns(): LoadingColumn[] {
    return [
      { type: 'text', visible: this.isColumnVisible('order_id') },
      { type: 'text-multi', visible: this.isColumnVisible('customer') },
      { type: 'text', visible: this.isColumnVisible('date') },
      { type: 'pill', visible: this.isColumnVisible('status') },
      { type: 'text-multi', visible: this.isColumnVisible('driver') },
      { type: 'text', visible: this.isColumnVisible('total') },
      { type: 'actions', visible: this.isColumnVisible('actions') }
    ];
  }

  printingOrderId = signal<number | null>(null);

  async printOrder(order: Order): Promise<void> {
    this.printingOrderId.set(order.id);
    this.adminService.getOrderById(order.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (fullOrder) => {
          await this.orderPdf.generateOrderPdf(fullOrder);
          this.printingOrderId.set(null);
        },
        error: () => {
          this.printingOrderId.set(null);
          this.baseToast.showError('admin.orders.load_error');
        }
      });
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

  // Get status index for timeline visualization
  getStatusIndex(status: string, order?: Order): number {
    const statusOrder = order && this.isPickupOrder(order)
      ? ['pending', 'confirmed', 'ready', 'delivered']
      : ['pending', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered'];
    return statusOrder.indexOf(status);
  }

  isPickupOrder(order: Order): boolean {
    return order.delivery_type?.toLowerCase() === 'pickup';
  }

  // Status editing - delegate to service
  getNextStatuses(currentStatus: string, order?: Order): { value: string; label: string; icon: string }[] {
    const isPickup = order ? this.isPickupOrder(order) : false;
    return this.statusSeverity.getNextOrderStatuses(currentStatus, isPickup);
  }

  canEditStatus(status: string): boolean {
    return this.statusSeverity.canEditOrderStatus(status);
  }

  openStatusPopover(event: Event, order: Order): void {
    this.editingOrder.set(order);
    this.editingStatusOrderId.set(order.id);
    this.selectedNewStatus.set(null);
    this.selectedDriverId.set(null);
    this.loadAvailableDrivers();
    this.statusPopover()?.toggle(event);
  }

  startEditStatus(order: Order): void {
    if (this.canEditStatus(order.status)) {
      this.editingOrder.set(order);
      this.editingStatusOrderId.set(order.id);
      this.selectedNewStatus.set(null);
      this.selectedDriverId.set(null);
    }
  }

  cancelEditStatus(): void {
    this.editingStatusOrderId.set(null);
    this.editingOrder.set(null);
    this.selectedNewStatus.set(null);
    this.selectedDriverId.set(null);
  }

  isEditingStatus(orderId: number): boolean {
    return this.editingStatusOrderId() === orderId;
  }

  isStatusSelected(status: string): boolean {
    return this.selectedNewStatus() === status;
  }

  selectNewStatus(newStatus: string): void {
    this.selectedNewStatus.set(newStatus);
    this.selectedDriverId.set(null);
    this.pulseConfirm.set(false);
    setTimeout(() => this.pulseConfirm.set(true), 10);
  }

  onDriverSelect(driverId: number): void {
    this.selectedDriverId.set(driverId);
  }

  canConfirmStatusChange(): boolean {
    if (!this.selectedNewStatus()) return false;
    if (this.needsDriverSelection() && !this.selectedDriverId()) return false;
    return true;
  }

  confirmStatusChange(): void {
    const orderId = this.editingStatusOrderId();
    const newStatus = this.selectedNewStatus();

    if (!orderId || !newStatus) return;

    // If assigning to a driver, use the assign API
    if (newStatus === ORDER_STATUS.ASSIGNED) {
      const driverId = this.selectedDriverId();
      if (!driverId) return;
      this.assignOrderToDriver(orderId, driverId);
    } else {
      this.cancelEditStatus();
      this.updateOrderStatus(orderId, newStatus);
    }
  }

  private loadAvailableDrivers(): void {
    this.loadingDrivers.set(true);
    this.adminService.getAvailableDrivers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (drivers) => {
          this.availableDrivers.set(drivers);
          this.loadingDrivers.set(false);
        },
        error: () => {
          this.loadingDrivers.set(false);
          this.availableDrivers.set([]);
        }
      });
  }

  private assignOrderToDriver(orderId: number, driverId: number): void {
    this.assigning.set(true);
    this.adminService.assignOrderToDriver(orderId, { driver_id: driverId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assigning.set(false);
          if (response.order) {
            this.allOrders.update(orders => {
              const index = orders.findIndex(o => o.id === orderId);
              if (index !== -1) {
                const updated = [...orders];
                updated[index] = response.order!;
                return updated;
              }
              return orders;
            });
            this.filterItems();
          }
          this.statusPopover()?.hide();
          this.cancelEditStatus();
          this.baseToast.showSuccess('admin.orders.driver_assigned');
        },
        error: (error) => {
          this.assigning.set(false);
          this.baseToast.showApiError(error, 'admin.orders.assign_error');
        }
      });
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

  // Driver column popover methods
  openDriverPopover(event: Event, order: Order): void {
    event.stopPropagation();
    this.assigningOrderId.set(order.id);
    this.selectedDriverId.set(null);
    this.loadAvailableDrivers();
    this.driverPopover()?.toggle(event);
  }

  assignDriverFromColumn(): void {
    const orderId = this.assigningOrderId();
    const driverId = this.selectedDriverId();

    if (!orderId || !driverId) return;

    this.assigning.set(true);
    this.adminService.assignOrderToDriver(orderId, { driver_id: driverId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assigning.set(false);
          if (response.order) {
            this.allOrders.update(orders => {
              const index = orders.findIndex(o => o.id === orderId);
              if (index !== -1) {
                const updated = [...orders];
                updated[index] = response.order!;
                return updated;
              }
              return orders;
            });
            this.filterItems();
          }
          this.driverPopover()?.hide();
          this.assigningOrderId.set(null);
          this.selectedDriverId.set(null);
          this.baseToast.showSuccess('admin.orders.driver_assigned');
        },
        error: (error) => {
          this.assigning.set(false);
          this.baseToast.showApiError(error, 'admin.orders.assign_error');
        }
      });
  }

  cancelDriverAssignment(): void {
    this.driverPopover()?.hide();
    this.assigningOrderId.set(null);
    this.selectedDriverId.set(null);
  }
}
