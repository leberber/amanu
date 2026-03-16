import { Component, inject, OnInit, signal, computed, ChangeDetectorRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, Location, UpperCasePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, state, style, animate, transition } from '@angular/animations';

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
  imports: [TranslateModule, DecimalPipe, UpperCasePipe, AnimatedRouteMapComponent],
  templateUrl: './driver-trip-detail.component.html',
  styleUrl: './driver-trip-detail.component.scss',
  animations: [
    trigger('mapSlideOut', [
      state('visible', style({
        height: '*',
        opacity: 1,
        transform: 'translateY(0)'
      })),
      state('hidden', style({
        height: '0',
        opacity: 0,
        transform: 'translateY(-100%)'
      })),
      transition('visible => hidden', [
        animate('400ms ease-out')
      ])
    ])
  ]
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
  cancelling = signal(false);
  pickingUp = signal(false);

  // Animation state
  animationComplete = signal(false);
  showFullScreenMap = signal(true);
  mapVisible = signal(true);

  // Reference to map component
  mapComponent = viewChild<AnimatedRouteMapComponent>('mapComponent');

  // Constants for template
  readonly mapAnimationDuration = MAP_ANIMATION_DURATION_MS;

  // Computed: derived from trip
  private tripStatus = computed(() => this.trip()?.status?.toLowerCase() || '');
  private stops = computed(() => this.trip()?.stops || []);

  // Trip status checks
  isPendingTrip = computed(() => this.tripStatus() === 'pending');
  canStartTrip = computed(() => this.tripStatus() === 'assigned');
  isTripInProgress = computed(() => this.tripStatus() === 'in_progress');
  isTripCompleted = computed(() => this.tripStatus() === 'completed');

  // Pickup state
  isPickedUp = computed(() => !!this.trip()?.picked_up_at);
  needsPickup = computed(() => this.isTripInProgress() && !this.isPickedUp());

  // Show map only for pending trips (before accepting)
  shouldShowMap = computed(() => this.isPendingTrip() && this.mapVisible());

  canCompleteTrip = computed(() =>
    this.isTripInProgress() && this.stops().every(s => this.isStopStatus(s, 'delivered'))
  );

  tripProgress = computed(() => {
    const stops = this.stops();
    if (stops.length === 0) return 0;
    return (stops.filter(s => this.isStopStatus(s, 'delivered')).length / stops.length) * 100;
  });

  currentStop = computed(() =>
    this.stops().find(s => !this.isStopStatus(s, 'delivered')) || null
  );

  sortedStops = computed(() =>
    [...this.stops()].sort((a, b) => a.sequence - b.sequence)
  );

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
        // Animate map out, then reload trip
        this.mapVisible.set(false);
        setTimeout(() => {
          this.loadTrip(tripId);
        }, 450); // Wait for animation to complete
      },
      error: (err) => {
        this.accepting.set(false);
        this.toast.showError(this.getErrorMessage(err, 'driver.messages.accept_failed'));
      }
    });
  }

  cancelTrip(): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.cancelling()) return;

    this.cancelling.set(true);
    this.driverService.cancelBatchedTrip(tripId).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.toast.showSuccess('driver.messages.trip_cancelled');
        this.router.navigate([ROUTES.DRIVER.ROOT]);
      },
      error: (err) => {
        this.cancelling.set(false);
        this.toast.showError(this.getErrorMessage(err, 'driver.messages.trip_cancel_failed'));
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

  pickupTrip(): void {
    const tripId = this.trip()?.id;
    if (!tripId || this.pickingUp()) return;

    this.pickingUp.set(true);
    this.driverService.pickupBatchedTrip(tripId).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.pickingUp.set(false);
        this.toast.showSuccess('driver.messages.orders_picked_up');
      },
      error: (err) => {
        this.pickingUp.set(false);
        this.toast.showError(this.getErrorMessage(err, 'driver.messages.pickup_failed'));
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

  openNavigation(stop: TripStop): void {
    // Use coordinates for precise navigation, fallback to address
    if (stop.latitude && stop.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`, '_blank');
    } else if (stop.shipping_address) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.shipping_address)}`, '_blank');
    }
  }

  navigateToWarehouse(): void {
    // AgroClik Depot coordinates
    const depotLat = 36.549608;
    const depotLng = 4.099945;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${depotLat},${depotLng}`, '_blank');
  }

  // Stop status helpers
  isStopStatus(stop: TripStop, status: StopStatus): boolean {
    return stop.status?.toLowerCase() === status;
  }

  getAvailableStopAction(stop: TripStop): StopAction | null {
    if (!this.isTripInProgress()) return null;
    if (!this.isPickedUp()) return null; // Must pickup before marking stops
    if (this.isStopStatus(stop, 'pending')) return 'arrived';
    if (this.isStopStatus(stop, 'arrived')) return 'delivered';
    return null;
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
