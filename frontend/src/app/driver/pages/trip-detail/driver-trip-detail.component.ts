import { Component, inject, OnInit, signal, computed, ChangeDetectorRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DriverService } from '../../../services/driver.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { ROUTES } from '../../../core/constants/routes.constants';
import { TripWithStops, TripStop, StopStatus } from '../../../models/trip.model';
import { AnimatedRouteMapComponent } from '../../components/animated-route-map/animated-route-map.component';

const ANIMATION_FALLBACK_MS = 7000;
const MAP_RESIZE_DELAY_MS = 300;
const MAP_ANIMATION_DURATION_MS = 4000;

type StopAction = 'arrived' | 'delivered';

@Component({
  selector: 'app-driver-trip-detail',
  standalone: true,
  imports: [TranslateModule, DecimalPipe, AnimatedRouteMapComponent],
  templateUrl: './driver-trip-detail.component.html',
  styleUrl: './driver-trip-detail.component.scss'
})
export class DriverTripDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly driverService = inject(DriverService);
  private readonly toast = inject(ToastMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

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

  // Constants for template
  readonly mapAnimationDuration = MAP_ANIMATION_DURATION_MS;

  // Computed: trip status helpers
  private tripStatus = computed(() => this.trip()?.status?.toLowerCase() || '');

  isPendingTrip = computed(() => this.tripStatus() === 'pending');
  canStartTrip = computed(() => this.tripStatus() === 'assigned');
  isTripInProgress = computed(() => this.tripStatus() === 'in_progress');
  isTripCompleted = computed(() => this.tripStatus() === 'completed');

  canCompleteTrip = computed(() => {
    if (!this.isTripInProgress()) return false;
    const stops = this.trip()?.stops || [];
    return stops.every(s => this.isStopStatus(s, 'delivered'));
  });

  tripProgress = computed(() => {
    const stops = this.trip()?.stops || [];
    if (stops.length === 0) return 0;
    const delivered = stops.filter(s => this.isStopStatus(s, 'delivered')).length;
    return (delivered / stops.length) * 100;
  });

  currentStop = computed(() => {
    const stops = this.trip()?.stops || [];
    return stops.find(s => !this.isStopStatus(s, 'delivered')) || null;
  });

  sortedStops = computed(() => {
    const stops = this.trip()?.stops || [];
    return [...stops].sort((a, b) => a.sequence - b.sequence);
  });

  routeCoords = computed(() => this.trip()?.route_coords || []);

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
        this.handleMapAnimation(trip);
      },
      error: () => {
        this.toast.showError('driver.messages.trip_load_failed');
        this.loading.set(false);
        this.goBack();
      }
    });
  }

  private handleMapAnimation(trip: TripWithStops): void {
    const hasRouteCoords = trip.route_coords && trip.route_coords.length >= 2;

    if (!hasRouteCoords) {
      this.showFullScreenMap.set(false);
      this.animationComplete.set(true);
      return;
    }

    setTimeout(() => {
      if (this.showFullScreenMap()) {
        this.onAnimationComplete();
      }
    }, ANIMATION_FALLBACK_MS);
  }

  onAnimationComplete(): void {
    if (this.animationComplete()) return;

    this.animationComplete.set(true);
    this.showFullScreenMap.set(false);
    this.cdr.detectChanges();

    setTimeout(() => this.mapComponent()?.resizeMap(), MAP_RESIZE_DELAY_MS);
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
        this.loadTrip(tripId);
      },
      error: (err) => {
        this.accepting.set(false);
        this.toast.showError(this.getErrorMessage(err, 'driver.messages.accept_failed'));
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
        this.toast.showError(this.getErrorMessage(err, 'driver.messages.trip_start_failed'));
      }
    });
  }

  updateStopStatus(stop: TripStop, action: StopAction): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.updatingStopId()) return;

    this.updatingStopId.set(stop.id);

    const serviceCall = action === 'arrived'
      ? this.driverService.markStopArrived(tripId, stop.id)
      : this.driverService.markStopDelivered(tripId, stop.id);

    const successMessage = action === 'arrived'
      ? 'driver.messages.arrived_at_stop'
      : 'driver.messages.delivery_completed';

    serviceCall.subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.updatingStopId.set(null);
        this.toast.showSuccess(successMessage);
      },
      error: (err) => {
        this.updatingStopId.set(null);
        this.toast.showError(this.getErrorMessage(err, 'driver.messages.status_update_failed'));
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
        this.toast.showError(this.getErrorMessage(err, 'driver.messages.trip_complete_failed'));
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
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  }

  // Stop status helpers
  isStopStatus(stop: TripStop, status: StopStatus): boolean {
    return stop.status?.toLowerCase() === status;
  }

  canMarkArrived(stop: TripStop): boolean {
    return this.isTripInProgress() && this.isStopStatus(stop, 'pending');
  }

  canMarkDelivered(stop: TripStop): boolean {
    return this.isTripInProgress() && this.isStopStatus(stop, 'arrived');
  }

  isStopUpdating(stopId: number): boolean {
    return this.updatingStopId() === stopId;
  }

  isStopDelivered(stop: TripStop): boolean {
    return this.isStopStatus(stop, 'delivered');
  }

  private getErrorMessage(err: { error?: { detail?: string } }, fallback: string): string {
    return err.error?.detail || fallback;
  }
}
