import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';

import { DriverService } from '../../../services/driver.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { RouteHelpers, ROUTES } from '../../../core/constants/routes.constants';
import { ORDER_STATUS, ORDER_STATUS_CONFIG, DRIVER_ORDER_TRANSITIONS } from '../../../core/constants/order.constants';
import { Order } from '../../../models/order.model';

@Component({
  selector: 'app-driver-trip-detail',
  standalone: true,
  imports: [TranslateModule, DecimalPipe],
  templateUrl: './driver-trip-detail.component.html',
  styleUrl: './driver-trip-detail.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class DriverTripDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);
  private readonly toast = inject(ToastMessageService);

  readonly ORDER_STATUS = ORDER_STATUS;
  readonly orderStatusConfig = ORDER_STATUS_CONFIG;
  readonly driverTransitions = DRIVER_ORDER_TRANSITIONS;

  // State
  order = signal<Order | null>(null);
  loading = signal(true);
  updating = signal(false);
  showItemsModal = signal(false);

  // Computed values
  canUpdateStatus = computed(() => {
    const current = this.order()?.status;
    if (!current) return false;
    return !!this.getNextStatus(current);
  });

  nextStatus = computed(() => {
    const current = this.order()?.status;
    if (!current) return null;
    return this.getNextStatus(current);
  });

  statusProgress = computed(() => {
    const status = this.order()?.status;
    if (!status) return 0;

    const statuses: string[] = [
      ORDER_STATUS.ASSIGNED,
      ORDER_STATUS.PICKED_UP,
      ORDER_STATUS.IN_TRANSIT,
      ORDER_STATUS.DELIVERED
    ];

    const index = statuses.indexOf(status);
    if (index === -1) return 0;
    return ((index + 1) / statuses.length) * 100;
  });

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (orderId) {
      this.loadOrder(+orderId);
    }
  }

  loadOrder(id: number): void {
    this.loading.set(true);
    this.driverService.getTripDetail(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => {
        this.toast.showError('driver.messages.trip_load_failed');
        this.loading.set(false);
        this.goBack();
      }
    });
  }

  goBack(): void {
    this.router.navigate([ROUTES.DRIVER.ACTIVE]);
  }

  updateStatus(): void {
    const next = this.nextStatus();
    const orderId = this.order()?.id;
    
    if (!next || !orderId || this.updating()) return;

    this.updating.set(true);

    this.driverService.updateTripStatus(orderId, next).subscribe({
      next: (response) => {
        this.updating.set(false);
        if (response.success) {
          this.toast.showSuccess('driver.messages.status_updated');
          // Reload order to get fresh data
          this.loadOrder(orderId);
        }
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.showError(err.error?.detail || 'driver.messages.status_update_failed');
      }
    });
  }

  reportIssue(): void {
    // TODO: Implement issue reporting dialog
    this.toast.showInfo('driver.messages.feature_coming_soon');
  }

  callCustomer(): void {
    const phone = this.order()?.contact_phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }

  openNavigation(): void {
    const address = this.order()?.shipping_address;
    if (address) {
      // Open in Google Maps
      const encodedAddress = encodeURIComponent(address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  }

  toggleItemsModal(): void {
    this.showItemsModal.update(v => !v);
  }

  getStatusIcon(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.icon || 'pi pi-circle';
  }

  getStatusColor(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.color || '#6b7280';
  }

  getStatusLabel(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.label || status;
  }

  getNextStatus(current: string): string | null {
    return this.driverTransitions[current as keyof typeof this.driverTransitions] || null;
  }

  getNextStatusLabel(): string {
    const next = this.nextStatus();
    if (!next) return '';
    
    const labels: Record<string, string> = {
      [ORDER_STATUS.PICKED_UP]: 'driver.action.mark_picked_up',
      [ORDER_STATUS.IN_TRANSIT]: 'driver.action.start_delivery',
      [ORDER_STATUS.DELIVERED]: 'driver.action.mark_delivered'
    };
    
    return labels[next] || 'driver.action.update_status';
  }

  getItemsCount(): number {
    return this.order()?.items?.length || 0;
  }

  getTotalQuantity(): number {
    return this.order()?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  }
}
