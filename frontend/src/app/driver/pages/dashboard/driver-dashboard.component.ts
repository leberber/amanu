import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';
import { TripWithStops } from '../../../models/trip.model';
import { Order } from '../../../models/order.model';

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
  imports: [RouterLink, TranslateModule, DecimalPipe, NgClass],
  templateUrl: './driver-dashboard.component.html',
  styleUrl: './driver-dashboard.component.scss'
})
export class DriverDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  readonly routes = ROUTES;

  // Data from service
  activeMultiTrips = this.driverService.activeMultiTrips;

  // Computed values
  isOnline = computed(() => {
    const status = this.driverService.driverProfile()?.status;
    return status === DRIVER_STATUS.AVAILABLE || status === DRIVER_STATUS.BUSY;
  });

  // Stats computed from service
  todayDeliveries = computed(() => this.driverService.stats()?.deliveries_today || 0);
  todayEarnings = computed(() => this.driverService.stats()?.earnings_today || 0);
  activeCount = computed(() =>
    this.driverService.activeTrips().length + this.driverService.activeMultiTrips().length
  );
  multiTripCount = computed(() => this.activeMultiTrips().length);

  availableItems = computed<AvailableItem[]>(() => {
    const userId = this.driverService.profile()?.id;
    const suggested: AvailableItem[] = [];
    const standard: AvailableItem[] = [];

    for (const trip of this.driverService.pendingBatchedTrips()) {
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

  // Pull-to-refresh
  pullDistance = signal(0);
  isRefreshing = signal(false);
  private isPulling = false;
  private startY = 0;
  private readonly PULL_THRESHOLD = 60;
  private readonly PULL_MAX = 80;
  private readonly PULL_RESISTANCE = 0.4;
  private readonly REFRESH_INDICATOR_HEIGHT = 40;
  private readonly REFRESH_DURATION = 1000;

  ngOnInit(): void {
    this.loadData();
  }

  onTouchStart(event: TouchEvent): void {
    const scrollTop = document.querySelector('.driver-content')?.scrollTop || 0;
    if (scrollTop === 0) {
      this.startY = event.touches[0].clientY;
      this.isPulling = true;
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isPulling || this.isRefreshing()) return;

    const diff = event.touches[0].clientY - this.startY;
    if (diff > 0) {
      this.pullDistance.set(Math.min(diff * this.PULL_RESISTANCE, this.PULL_MAX));
    }
  }

  onTouchEnd(): void {
    if (!this.isPulling) return;

    if (this.pullDistance() >= this.PULL_THRESHOLD) {
      this.isRefreshing.set(true);
      this.pullDistance.set(this.REFRESH_INDICATOR_HEIGHT);
      this.loadData();
      setTimeout(() => {
        this.pullDistance.set(0);
        this.isRefreshing.set(false);
      }, this.REFRESH_DURATION);
    } else {
      this.pullDistance.set(0);
    }
    this.isPulling = false;
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
}
