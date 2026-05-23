import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { AdminService } from '../../../services/admin.service';
import { Order } from '../../../models/admin.model';
import { DriverProfileWithFlags } from '../../../models/driver.model';
import { StatusSeverityService } from '../../../core/services/status-severity.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ROUTES } from '../../../core/constants/routes.constants';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { PhoneFormatPipe } from '../../../shared/pipes/phone-format.pipe';
import { UnitPipe } from '../../../shared/pipes/unit.pipe';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { DateService } from '../../../core/services/date.service';
import { OrderPdfService } from '../../../services/order-pdf.service';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';
import { ORDER_STATUS } from '../../../core/constants/order.constants';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TranslateModule,
    SelectModule,
    TooltipModule,
    PageLayoutComponent,
    CurrencyPipe,
    PhoneFormatPipe,
    UnitPipe,
    DateFormatPipe
  ],
  templateUrl: './admin-order-detail.component.html',
  styleUrl: './admin-order-detail.component.scss'
})
export class AdminOrderDetailComponent implements OnInit {
  // Services
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);
  private readonly translateService = inject(TranslateService);
  private readonly statusSeverity = inject(StatusSeverityService);
  private readonly toast = inject(ToastMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateService = inject(DateService);
  private readonly orderPdf = inject(OrderPdfService);

  // Route constant for back navigation
  readonly ROUTES = ROUTES;

  // State signals
  order = signal<Order | null>(null);
  loading = signal(true);
  selectedNewStatus = signal<string | null>(null);

  // Driver assignment state
  availableDrivers = signal<DriverProfileWithFlags[]>([]);
  loadingDrivers = signal(false);
  assigning = signal(false);

  // Computed values
  pageTitle = computed(() => {
    const order = this.order();
    return order ? `${this.translateService.instant('admin.orders.order_number')} #${order.id}` : '';
  });

  pageSubtitle = computed(() => {
    const order = this.order();
    return order ? this.dateService.formatDate(order.created_at) : '';
  });

  // Driver options for dropdown
  driverOptions = computed(() => {
    return this.availableDrivers()
      .filter(d => d.status !== DRIVER_STATUS.SUSPENDED && d.is_available)
      .map(d => ({
        label: d.full_name
          ? `${d.full_name} (${this.translateService.instant('driver.vehicle.' + d.vehicle_type)}) - ${d.active_orders_count}/${d.max_active_orders}`
          : `${this.translateService.instant('driver.vehicle.' + d.vehicle_type)} - ${d.active_orders_count}/${d.max_active_orders}`,
        value: d.user_id,
        driver: d
      }));
  });

  // Check if driver selection is required (when "assigned" status is selected)
  needsDriverSelection = computed(() => this.selectedNewStatus() === ORDER_STATUS.ASSIGNED);

  // Selected driver for status change flow
  selectedStatusDriverId = signal<number | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOrder(+id);
      this.loadAvailableDrivers();
    } else {
      this.router.navigate([ROUTES.ADMIN.ORDERS]);
    }
  }

  private loadOrder(id: number): void {
    this.loading.set(true);
    this.adminService.getOrderById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          if (error.status === 404) {
            this.toast.showError('admin.orders.order_not_found');
          } else if (error.status === 403) {
            this.toast.showPermissionDenied();
          } else {
            this.toast.showApiError(error, 'admin.orders.load_error');
          }
          this.router.navigate([ROUTES.ADMIN.ORDERS]);
        }
      });
  }

  printing = signal(false);

  async printOrder(): Promise<void> {
    const order = this.order();
    if (order) {
      this.printing.set(true);
      await this.orderPdf.generateOrderPdf(order);
      this.printing.set(false);
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      const icon = document.createElement('i');
      icon.className = 'pi pi-box';
      parent.appendChild(icon);
    }
  }

  getStatusIcon(status: string): string {
    return this.statusSeverity.getOrderStatusIcon(status);
  }

  canEditStatus(status: string): boolean {
    return this.statusSeverity.canEditOrderStatus(status);
  }

  getNextStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
    return this.statusSeverity.getNextOrderStatuses(currentStatus);
  }

  getStatusIndex(status: string): number {
    const statusOrder = ['pending', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered'];
    return statusOrder.indexOf(status);
  }

  selectStatus(status: string): void {
    this.selectedNewStatus.set(status);
    this.selectedStatusDriverId.set(null);
  }

  onStatusDriverSelect(driverId: number): void {
    this.selectedStatusDriverId.set(driverId);
  }

  canConfirmStatusChange(): boolean {
    if (!this.selectedNewStatus()) return false;
    if (this.needsDriverSelection() && !this.selectedStatusDriverId()) return false;
    return true;
  }

  confirmStatusChange(): void {
    const order = this.order();
    const newStatus = this.selectedNewStatus();

    if (!order || !newStatus) return;

    // If assigning to a driver, use the assign API
    if (newStatus === ORDER_STATUS.ASSIGNED) {
      const driverId = this.selectedStatusDriverId();
      if (!driverId) return;
      this.assignOrderToDriverFromStatus(order.id, driverId);
    } else {
      this.selectedNewStatus.set(null);
      this.selectedStatusDriverId.set(null);
      this.updateOrderStatus(order.id, newStatus);
    }
  }

  private assignOrderToDriverFromStatus(orderId: number, driverId: number): void {
    this.assigning.set(true);
    this.adminService.assignOrderToDriver(orderId, { driver_id: driverId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success && response.order) {
            const currentOrder = this.order();
            this.order.set({
              ...response.order,
              items: currentOrder?.items
            });
            this.selectedNewStatus.set(null);
            this.selectedStatusDriverId.set(null);
            this.toast.showSuccess('admin.orders.driver_assigned');
          }
          this.assigning.set(false);
        },
        error: (error) => {
          this.assigning.set(false);
          this.toast.showApiError(error, 'admin.orders.assign_error');
        }
      });
  }

  private updateOrderStatus(orderId: number, newStatus: string): void {
    this.adminService.updateOrderStatus(orderId, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedOrder) => {
          const currentOrder = this.order();
          this.order.set({
            ...updatedOrder,
            items: currentOrder?.items
          });
          this.toast.showSuccess('admin.orders.status_update_message', {
            orderId: orderId,
            status: this.translateService.instant('admin.orders.status.' + newStatus)
          });
        },
        error: (error) => {
          this.toast.showApiError(error, 'admin.orders.update_error');
        }
      });
  }

  // Driver loading
  loadAvailableDrivers(): void {
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
        }
      });
  }
}
