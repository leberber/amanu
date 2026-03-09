import { Component, inject, OnInit, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';

import { DriverService } from '../../../services/driver.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { DRIVER_STATUS, DRIVER_STATUS_CONFIG } from '../../../core/constants/driver.constants';
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '../../../core/constants/order.constants';
import { Order } from '../../../models/order.model';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [RouterLink, TranslateModule, DecimalPipe],
  templateUrl: './driver-dashboard.component.html',
  styleUrl: './driver-dashboard.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('listAnimation', [
      transition(':enter', [
        query('.stat-card, .order-card', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(50, [
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ],
  host: {
    '[@fadeIn]': ''
  }
})
export class DriverDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly routes = ROUTES;
  readonly DRIVER_STATUS = DRIVER_STATUS;
  readonly ORDER_STATUS = ORDER_STATUS;
  readonly orderStatusConfig = ORDER_STATUS_CONFIG;

  // Data from service
  stats = this.driverService.stats;
  profile = this.driverService.profile;
  driverProfile = this.driverService.driverProfile;
  activeTrips = this.driverService.activeTrips;
  availableTrips = this.driverService.availableTrips;
  loading = this.driverService.loading;

  // Computed values
  currentStatus = computed(() => this.driverProfile()?.status || DRIVER_STATUS.OFFLINE);
  isOnline = computed(() => {
    const status = this.currentStatus();
    return status === DRIVER_STATUS.AVAILABLE || status === DRIVER_STATUS.BUSY;
  });

  // Stats display
  todayDeliveries = computed(() => this.stats()?.deliveries_today || 0);
  todayEarnings = computed(() => this.stats()?.earnings_today || 0);
  averageRating = computed(() => this.stats()?.average_rating?.toFixed(1) || '-');
  activeCount = computed(() => this.activeTrips().length);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.driverService.getStats().subscribe();
    this.driverService.getActiveTrips().subscribe();
    this.driverService.getAvailableTrips().subscribe();
  }

  goOnline(): void {
    this.driverService.goOnline().subscribe();
  }

  goOffline(): void {
    this.driverService.goOffline().subscribe();
  }

  viewTrip(order: Order): void {
    this.router.navigate([RouteHelpers.driverTripDetail(order.id)]);
  }

  getStatusIcon(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.icon || 'pi pi-circle';
  }

  getStatusColor(status: string): string {
    return this.orderStatusConfig[status as keyof typeof this.orderStatusConfig]?.color || '#6b7280';
  }
}
