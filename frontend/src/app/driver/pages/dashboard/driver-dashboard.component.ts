import { Component, inject, OnInit, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { DRIVER_STATUS } from '../../../core/constants/driver.constants';
import { TripWithStops } from '../../../models/trip.model';

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

  // Split batched trips into suggested (to this driver) and available (others)
  suggestedBatchedTrips = computed(() => {
    const userId = this.profile()?.id;
    if (!userId) return [];
    return this.pendingBatchedTrips().filter(t => t.suggested_driver_id === userId);
  });

  availableBatchedTrips = computed(() => {
    const userId = this.profile()?.id;
    if (!userId) return this.pendingBatchedTrips();
    return this.pendingBatchedTrips().filter(t => t.suggested_driver_id !== userId);
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.driverService.getStats().subscribe();
    this.driverService.getActiveTrips().subscribe();
    this.driverService.getActiveMultiTrips().subscribe();
    this.driverService.getPendingBatchedTrips().subscribe();
  }

  goOnline(): void {
    this.driverService.goOnline().subscribe();
  }

  goOffline(): void {
    this.driverService.goOffline().subscribe();
  }

  openMultiTripDetail(trip: TripWithStops): void {
    this.router.navigate([RouteHelpers.driverTripDetail(trip.id)]);
  }
}
