import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { RouteHelpers } from '../../../core/constants/routes.constants';
import { ORDER_STATUS, ORDER_STATUS_CONFIG } from '../../../core/constants/order.constants';
import { Order } from '../../../models/order.model';
import { TripWithStops, TripStopOrderItem } from '../../../models/trip.model';
import { getOrderCartonDisplay } from '../../../shared/utils/quantity.utils';
import { PhoneFormatPipe } from '../../../shared/pipes/phone-format.pipe';

@Component({
  selector: 'app-driver-active',
  standalone: true,
  imports: [TranslateModule, DecimalPipe, NgClass, PhoneFormatPipe],
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

  // Expanded stops tracking (tripId-stopId)
  expandedStops = signal<Set<string>>(new Set());

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
    this.driverService.getActiveMultiTrips().subscribe({
      next: (trips) => {
        // Auto-expand the current stop (first non-delivered) for each trip
        this.expandCurrentStops(trips);
      }
    });
  }

  /**
   * Auto-expand the current stop (first non-delivered) for each trip
   */
  private expandCurrentStops(trips: TripWithStops[]): void {
    const expanded = new Set<string>();
    for (const trip of trips) {
      if (trip.stops && trip.stops.length > 0) {
        // Sort by sequence and find first non-delivered stop
        const sortedStops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);
        const currentStop = sortedStops.find(s => s.status !== 'delivered');
        if (currentStop) {
          expanded.add(`${trip.id}-${currentStop.id}`);
        }
      }
    }
    this.expandedStops.set(expanded);
  }

  toggleStop(tripId: number, stopId: number): void {
    const key = `${tripId}-${stopId}`;
    const current = new Set(this.expandedStops());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.expandedStops.set(current);
  }

  isStopExpanded(tripId: number, stopId: number): boolean {
    return this.expandedStops().has(`${tripId}-${stopId}`);
  }

  viewDetails(order: Order): void {
    this.router.navigate([RouteHelpers.driverTripDetail(order.id)]);
  }

  viewMultiTripDetails(trip: TripWithStops): void {
    this.router.navigate([RouteHelpers.driverTripDetail(trip.id)]);
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

  getCartonDisplay(item: TripStopOrderItem): string {
    return getOrderCartonDisplay(item.quantity, item.pieces_per_box);
  }
}
