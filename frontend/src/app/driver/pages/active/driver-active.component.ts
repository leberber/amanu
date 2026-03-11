import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '../../../core/constants/order.constants';
import { Order } from '../../../models/order.model';
import { TripWithStops } from '../../../models/trip.model';

@Component({
  selector: 'app-driver-active',
  standalone: true,
  imports: [TranslateModule, DecimalPipe],
  templateUrl: './driver-active.component.html',
  styleUrl: './driver-active.component.scss'
})
export class DriverActiveComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly ORDER_STATUS = ORDER_STATUS;
  readonly orderStatusConfig = ORDER_STATUS_CONFIG;

  // State from service
  activeTrips = this.driverService.activeTrips;
  activeMultiTrips = this.driverService.activeMultiTrips;

  // Local loading state - only shows if request takes > 300ms
  loading = signal(false);
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    // Only show skeleton if request takes longer than 300ms
    this.loadingTimeout = setTimeout(() => {
      this.loading.set(true);
    }, 300);

    // Fetch both single orders and multi-trips
    this.driverService.getActiveTrips().subscribe({
      next: () => {
        if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
        this.loading.set(false);
      },
      error: () => {
        if (this.loadingTimeout) clearTimeout(this.loadingTimeout);
        this.loading.set(false);
      }
    });
    this.driverService.getActiveMultiTrips().subscribe();
  }

  viewDetails(order: Order): void {
    this.router.navigate([RouteHelpers.driverTripDetail(order.id)]);
  }

  viewMultiTripDetails(trip: TripWithStops): void {
    this.router.navigate([RouteHelpers.driverMultiTripDetail(trip.id)]);
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

  getItemsCount(order: Order): number {
    return order.items?.length || 0;
  }
}
