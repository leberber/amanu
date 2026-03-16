import { Component, inject, OnInit, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';
import { TripWithStops, TripStop } from '../../../models/trip.model';
import { Order } from '../../../models/order.model';
import { PullToRefreshDirective } from '../../../shared/directives/pull-to-refresh.directive';

export interface AvailableItem {
  id: number;
  type: 'suggested' | 'priority' | 'standard';
  address: string;
  earnings: number;
  stops?: number;
  weight?: number;
  customerName?: string;
  trip?: TripWithStops;
  order?: Order;
}

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [RouterLink, TranslateModule, DecimalPipe, NgClass, PullToRefreshDirective],
  templateUrl: './driver-dashboard.component.html',
  styleUrl: './driver-dashboard.component.scss'
})
export class DriverDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly routes = ROUTES;

  // Data from service
  activeMultiTrips = this.driverService.activeMultiTrips;
  hasActiveTrip = this.driverService.hasActiveTrip;

  // Computed values
  isOnline = computed(() => {
    const status = this.driverService.driverProfile()?.status;
    return status === DRIVER_STATUS.AVAILABLE || status === DRIVER_STATUS.BUSY;
  });

  // Stats computed from service
  todayDeliveries = computed(() => this.driverService.stats()?.deliveries_today || 0);
  todayEarnings = computed(() => this.driverService.stats()?.earnings_today || 0);
  // Use active_orders_count from profile (backend source of truth)
  activeCount = computed(() => this.driverService.driverData()?.active_orders_count || 0);

  availableItems = computed<AvailableItem[]>(() => {
    const userId = this.driverService.profile()?.id;
    const suggested: AvailableItem[] = [];
    const standard: AvailableItem[] = [];

    // Use filteredPendingTrips to only show trips the driver can handle (capacity check)
    for (const trip of this.driverService.filteredPendingTrips()) {
      const isSuggested = trip.suggested_driver_id === userId;
      const item: AvailableItem = {
        id: trip.id,
        type: isSuggested ? 'suggested' : 'standard',
        address: trip.corridor || trip.h3_zone || '',
        earnings: trip.total_earnings || 0,
        stops: trip.total_stops,
        weight: trip.total_weight_kg,
        trip
      };
      (isSuggested ? suggested : standard).push(item);
    }

    const priority: AvailableItem[] = this.driverService.availableTrips().map(order => ({
      id: order.id,
      type: 'priority' as const,
      address: order.shipping_address || '',
      earnings: order.shipping_cost || 0,
      customerName: order.user?.full_name || order.user?.store_name,
      order
    }));

    return [...suggested, ...priority, ...standard];
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.driverService.loadDashboardData();
  }

  goOnline(): void {
    this.driverService.goOnline().subscribe();
  }

  navigateToTrip(id: number): void {
    this.router.navigate([RouteHelpers.driverTripDetail(id)]);
  }

  openTripDetail(item: AvailableItem): void {
    const id = item.trip?.id || item.order?.id;
    if (id) this.navigateToTrip(id);
  }

  openMultiTripDetail(trip: TripWithStops): void {
    this.navigateToTrip(trip.id);
  }

  getNextStop(trip: TripWithStops): TripStop | null {
    if (!trip.stops) return null;
    const sorted = [...trip.stops].sort((a, b) => a.sequence - b.sequence);
    return sorted.find(s => s.status !== 'delivered') || null;
  }

  getTripProgress(trip: TripWithStops): number {
    if (!trip.total_stops || trip.total_stops === 0) return 0;
    return (trip.completed_stops / trip.total_stops) * 100;
  }

  getTripStatusKey(trip: TripWithStops): string {
    const status = trip.status?.toLowerCase() || '';
    if (!trip.picked_up_at && status === 'in_progress') return 'driver.trip_status.heading_to_pickup';
    if (status === 'in_progress') return 'driver.trip_status.in_progress';
    if (status === 'assigned') return 'driver.trip_status.assigned';
    return 'driver.trip_status.' + status;
  }
}
