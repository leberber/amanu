import { Component, inject, OnInit, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';
import { TripWithStops } from '../../../models/trip.model';
import { Order } from '../../../models/order.model';

// Unified item type for the list
export interface AvailableItem {
  id: number;
  type: 'suggested' | 'priority' | 'standard';
  address: string;
  earnings: number;
  stops?: number;
  weight?: number;
  customerName?: string;
  // Original data
  trip?: TripWithStops;
  order?: Order;
}

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [RouterLink, TranslateModule, DecimalPipe],
  templateUrl: './driver-dashboard.component.html',
  styleUrl: './driver-dashboard.component.scss'
})
export class DriverDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly routes = ROUTES;
  readonly DRIVER_STATUS = DRIVER_STATUS;

  // Data from service
  stats = this.driverService.stats;
  profile = this.driverService.profile;
  driverProfile = this.driverService.driverProfile;
  activeTrips = this.driverService.activeTrips;
  activeMultiTrips = this.driverService.activeMultiTrips;
  pendingBatchedTrips = this.driverService.pendingBatchedTrips;
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
  activeCount = computed(() => this.activeTrips().length + this.activeMultiTrips().length);
  multiTripCount = computed(() => this.activeMultiTrips().length);

  // Unified available items list (sorted: suggested → priority → standard)
  availableItems = computed<AvailableItem[]>(() => {
    const userId = this.profile()?.id;
    const items: AvailableItem[] = [];

    // 1. Suggested trips (batched trips suggested to this driver)
    for (const trip of this.pendingBatchedTrips()) {
      if (trip.suggested_driver_id === userId) {
        items.push({
          id: trip.id,
          type: 'suggested',
          address: trip.corridor || trip.h3_zone || '',
          earnings: trip.total_earnings || 0,
          stops: trip.total_stops,
          weight: trip.total_weight_kg,
          trip
        });
      }
    }

    // 2. Priority orders (individual urgent orders)
    for (const order of this.availableTrips()) {
      items.push({
        id: order.id,
        type: 'priority',
        address: order.shipping_address || '',
        earnings: order.shipping_cost || 0,
        customerName: order.user?.full_name || order.user?.store_name,
        order
      });
    }

    // 3. Standard batched trips (not suggested to this driver)
    for (const trip of this.pendingBatchedTrips()) {
      if (trip.suggested_driver_id !== userId) {
        items.push({
          id: trip.id,
          type: 'standard',
          address: trip.corridor || trip.h3_zone || '',
          earnings: trip.total_earnings || 0,
          stops: trip.total_stops,
          weight: trip.total_weight_kg,
          trip
        });
      }
    }

    return items;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.driverService.getStats().subscribe();
    this.driverService.getActiveTrips().subscribe();
    this.driverService.getActiveMultiTrips().subscribe();
    this.driverService.getPendingBatchedTrips().subscribe();
    this.driverService.getAvailableTrips().subscribe();
  }

  goOnline(): void {
    this.driverService.goOnline().subscribe();
  }

  goOffline(): void {
    this.driverService.goOffline().subscribe();
  }

  openTripDetail(item: AvailableItem): void {
    // For trips (suggested/standard), navigate to trip detail
    // For priority orders, also navigate to trip detail (will show order)
    if (item.trip) {
      this.router.navigate([RouteHelpers.driverTripDetail(item.trip.id)]);
    } else if (item.order) {
      // Priority orders use the same trip detail route
      this.router.navigate([RouteHelpers.driverTripDetail(item.order.id)]);
    }
  }

  openMultiTripDetail(trip: TripWithStops): void {
    this.router.navigate([RouteHelpers.driverTripDetail(trip.id)]);
  }
}
