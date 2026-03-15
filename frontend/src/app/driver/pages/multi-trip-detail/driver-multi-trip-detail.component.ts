import { Component, inject, OnInit, signal, computed, ChangeDetectorRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, Location, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';
import { TripWithStops, TripStop, TripStatus, StopStatus } from '../../../models/trip.model';
import { AnimatedRouteMapComponent } from '../../components/animated-route-map/animated-route-map.component';

// Trip status configuration
const TRIP_STATUS_CONFIG: Record<TripStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: 'pi pi-clock', color: '#6b7280', label: 'driver.trip_status.pending' },
  assigned: { icon: 'pi pi-user', color: '#3b82f6', label: 'driver.trip_status.assigned' },
  in_progress: { icon: 'pi pi-truck', color: '#f59e0b', label: 'driver.trip_status.in_progress' },
  completed: { icon: 'pi pi-check-circle', color: '#22c55e', label: 'driver.trip_status.completed' },
  cancelled: { icon: 'pi pi-times-circle', color: '#ef4444', label: 'driver.trip_status.cancelled' }
};

const STOP_STATUS_CONFIG: Record<StopStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: 'pi pi-circle', color: '#6b7280', label: 'driver.stop_status.pending' },
  arrived: { icon: 'pi pi-map-marker', color: '#3b82f6', label: 'driver.stop_status.arrived' },
  delivered: { icon: 'pi pi-check-circle', color: '#22c55e', label: 'driver.stop_status.delivered' },
  failed: { icon: 'pi pi-times-circle', color: '#ef4444', label: 'driver.stop_status.failed' }
};

@Component({
  selector: 'app-driver-multi-trip-detail',
  standalone: true,
  imports: [TranslateModule, DecimalPipe, NgClass, AnimatedRouteMapComponent],
  templateUrl: './driver-multi-trip-detail.component.html',
  styleUrl: './driver-multi-trip-detail.component.scss'
})
export class DriverMultiTripDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly driverService = inject(DriverService);
  private readonly toast = inject(ToastMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly tripStatusConfig = TRIP_STATUS_CONFIG;
  readonly stopStatusConfig = STOP_STATUS_CONFIG;

  // State
  trip = signal<TripWithStops | null>(null);
  loading = signal(true);
  updating = signal(false);
  updatingStopId = signal<number | null>(null);
  accepting = signal(false);

  // Animation state
  animationComplete = signal(false);
  showFullScreenMap = signal(true);

  // Reference to map component
  mapComponent = viewChild<AnimatedRouteMapComponent>('mapComponent');

  // Computed values
  isPendingTrip = computed(() => {
    const t = this.trip();
    return t?.status === 'pending' && !t?.driver_id;
  });

  canStartTrip = computed(() => {
    const t = this.trip();
    return t?.status === 'assigned';
  });

  canCompleteTrip = computed(() => {
    const t = this.trip();
    if (!t || t.status !== 'in_progress') return false;
    return t.stops.every(s => s.status === 'delivered');
  });

  tripProgress = computed(() => {
    const t = this.trip();
    if (!t || t.stops.length === 0) return 0;
    const delivered = t.stops.filter(s => s.status === 'delivered').length;
    return (delivered / t.stops.length) * 100;
  });

  currentStop = computed(() => {
    const t = this.trip();
    if (!t) return null;
    return t.stops.find(s => s.status !== 'delivered') || null;
  });

  sortedStops = computed(() => {
    const t = this.trip();
    if (!t) return [];
    return [...t.stops].sort((a, b) => a.sequence - b.sequence);
  });

  routeCoords = computed(() => {
    const t = this.trip();
    return t?.route_coords || [];
  });

  ngOnInit(): void {
    const tripId = this.route.snapshot.paramMap.get('id');
    if (tripId) {
      this.loadTrip(+tripId);
    }
  }

  loadTrip(id: number): void {
    this.loading.set(true);
    this.driverService.getMultiTripDetail(id).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.loading.set(false);

        // Check if we have route coords for animation
        const hasRouteCoords = trip.route_coords && trip.route_coords.length >= 2;

        if (!hasRouteCoords) {
          // No route data - skip animation and show content immediately
          console.log('No route coords, skipping animation');
          this.showFullScreenMap.set(false);
          this.animationComplete.set(true);
        } else {
          // Fallback timeout in case animation doesn't complete
          setTimeout(() => {
            if (this.showFullScreenMap()) {
              this.onAnimationComplete();
            }
          }, 6000); // 6 seconds fallback (4s animation + 2s buffer)
        }
      },
      error: () => {
        this.toast.showError('driver.messages.trip_load_failed');
        this.loading.set(false);
        this.goBack();
      }
    });
  }

  onAnimationComplete(): void {
    if (this.animationComplete()) return;

    this.animationComplete.set(true);
    this.showFullScreenMap.set(false);
    this.cdr.detectChanges();

    // Resize map after container shrinks
    setTimeout(() => {
      this.mapComponent()?.resizeMap();
    }, 300);
  }

  goBack(): void {
    this.location.back();
  }

  acceptTrip(): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.accepting()) return;

    this.accepting.set(true);
    this.driverService.acceptBatchedTrip(tripId).subscribe({
      next: () => {
        this.accepting.set(false);
        this.toast.showSuccess('driver.batched.accepted');
        // Reload trip to get updated status
        this.loadTrip(tripId);
      },
      error: (err) => {
        this.accepting.set(false);
        this.toast.showError(err.error?.detail || 'driver.messages.accept_failed');
      }
    });
  }

  startTrip(): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.updating()) return;

    this.updating.set(true);
    this.driverService.startMultiTrip(tripId).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.updating.set(false);
        this.toast.showSuccess('driver.messages.trip_started');
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.showError(err.error?.detail || 'driver.messages.trip_start_failed');
      }
    });
  }

  markArrived(stop: TripStop): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.updatingStopId()) return;

    this.updatingStopId.set(stop.id);
    this.driverService.markStopArrived(tripId, stop.id).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.updatingStopId.set(null);
        this.toast.showSuccess('driver.messages.arrived_at_stop');
      },
      error: (err) => {
        this.updatingStopId.set(null);
        this.toast.showError(err.error?.detail || 'driver.messages.status_update_failed');
      }
    });
  }

  markDelivered(stop: TripStop): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.updatingStopId()) return;

    this.updatingStopId.set(stop.id);
    this.driverService.markStopDelivered(tripId, stop.id).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.updatingStopId.set(null);
        this.toast.showSuccess('driver.messages.delivery_completed');
      },
      error: (err) => {
        this.updatingStopId.set(null);
        this.toast.showError(err.error?.detail || 'driver.messages.status_update_failed');
      }
    });
  }

  completeTrip(): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.updating()) return;

    this.updating.set(true);
    this.driverService.completeMultiTrip(tripId).subscribe({
      next: () => {
        this.updating.set(false);
        this.toast.showSuccess('driver.messages.trip_completed');
        this.router.navigate([ROUTES.DRIVER.ROOT]);
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.showError(err.error?.detail || 'driver.messages.trip_complete_failed');
      }
    });
  }

  callCustomer(phone: string | undefined): void {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }

  openNavigation(address: string | undefined): void {
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  }

  getStopStatusIcon(status: StopStatus): string {
    return this.stopStatusConfig[status]?.icon || 'pi pi-circle';
  }

  getStopStatusColor(status: StopStatus): string {
    return this.stopStatusConfig[status]?.color || '#6b7280';
  }

  getTripStatusIcon(status: TripStatus): string {
    return this.tripStatusConfig[status]?.icon || 'pi pi-circle';
  }

  getTripStatusColor(status: TripStatus): string {
    return this.tripStatusConfig[status]?.color || '#6b7280';
  }

  getTripStatusLabel(status: TripStatus): string {
    return this.tripStatusConfig[status]?.label || status;
  }

  canMarkArrived(stop: TripStop): boolean {
    const t = this.trip();
    if (!t || t.status !== 'in_progress') return false;
    return stop.status === 'pending';
  }

  canMarkDelivered(stop: TripStop): boolean {
    const t = this.trip();
    if (!t || t.status !== 'in_progress') return false;
    return stop.status === 'arrived';
  }

  isStopUpdating(stopId: number): boolean {
    return this.updatingStopId() === stopId;
  }
}
