import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
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
import { DateService } from '../../../core/services/date.service';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TranslateModule,
    SelectModule,
    PageLayoutComponent,
    CurrencyPipe,
    PhoneFormatPipe,
    UnitPipe
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

  // Route constant for back navigation
  readonly ROUTES = ROUTES;

  // State signals
  order = signal<Order | null>(null);
  loading = signal(true);
  selectedNewStatus = signal<string | null>(null);

  // Driver assignment state
  availableDrivers = signal<DriverProfileWithFlags[]>([]);
  loadingDrivers = signal(false);
  selectedDriverId: number | null = null;  // Regular property for ngModel
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

  // Check if order can be assigned to a driver
  canAssignDriver = computed(() => {
    const order = this.order();
    if (!order) return false;
    return ['pending', 'confirmed'].includes(order.status) && !order.driver;
  });

  // Check if order can be unassigned
  canUnassignDriver = computed(() => {
    const order = this.order();
    if (!order) return false;
    return order.driver && !['delivered', 'cancelled'].includes(order.status);
  });

  // Driver options for dropdown
  driverOptions = computed(() => {
    return this.availableDrivers()
      .filter(d => d.status !== DRIVER_STATUS.SUSPENDED)
      .map(d => ({
        label: `${d.user_id} - ${d.vehicle_type}`,
        value: d.user_id,
        driver: d
      }));
  });

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

  getStatusIcon(status: string): string {
    return this.statusSeverity.getOrderStatusIcon(status);
  }

  canEditStatus(status: string): boolean {
    return this.statusSeverity.canEditOrderStatus(status);
  }

  getNextStatuses(currentStatus: string): { value: string; label: string; icon: string }[] {
    return this.statusSeverity.getNextOrderStatuses(currentStatus);
  }

  selectStatus(status: string): void {
    this.selectedNewStatus.set(status);
  }

  confirmStatusChange(): void {
    const order = this.order();
    const newStatus = this.selectedNewStatus();

    if (order && newStatus) {
      this.selectedNewStatus.set(null);
      this.updateOrderStatus(order.id, newStatus);
    }
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

  // Driver assignment methods
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
          this.toast.showError('admin.orders.load_drivers_error');
        }
      });
  }

  assignToDriver(): void {
    const order = this.order();
    const driverId = this.selectedDriverId;

    if (!order || !driverId) return;

    this.assigning.set(true);
    this.adminService.assignOrderToDriver(order.id, { driver_id: driverId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success && response.order) {
            const currentOrder = this.order();
            this.order.set({
              ...response.order,
              items: currentOrder?.items
            });
            this.selectedDriverId = null;
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

  unassignDriver(): void {
    const order = this.order();
    if (!order) return;

    this.assigning.set(true);
    this.adminService.unassignOrder(order.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success && response.order) {
            const currentOrder = this.order();
            this.order.set({
              ...response.order,
              items: currentOrder?.items
            });
            this.toast.showSuccess('admin.orders.driver_unassigned');
          }
          this.assigning.set(false);
        },
        error: (error) => {
          this.assigning.set(false);
          this.toast.showApiError(error, 'admin.orders.unassign_error');
        }
      });
  }
}
