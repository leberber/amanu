import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Order } from '../models/order.model';
import {
  DriverProfile,
  DriverProfileUpdate,
  DriverWithProfile,
  DriverStats,
  DriverEarningsResponse,
  DriverStatusUpdate,
  DriverStatusResponse,
  AcceptTripResponse,
  TripStatusUpdate,
  CancelTripRequest,
  ConvertToDriver,
  DriverRegister
} from '../models/driver.model';
import { DriverStatus, DRIVER_STATUS } from '../core/constants/driver.constants';

/**
 * API Endpoints
 */
const ENDPOINTS = {
  // Driver profile endpoints
  REGISTER: '/drivers/register',
  CONVERT: '/drivers/convert',
  ME: '/drivers/me',
  UPDATE_ME: '/drivers/me',

  // Trip endpoints
  AVAILABLE: '/driver/trips/available',
  ACTIVE: '/driver/trips/active',
  HISTORY: '/driver/trips/history',
  STATS: '/driver/trips/stats',
  EARNINGS: '/driver/trips/earnings',
  STATUS: '/driver/trips/status',

  // Trip actions
  tripDetail: (orderId: number) => `/driver/trips/${orderId}`,
  accept: (orderId: number) => `/driver/trips/${orderId}/accept`,
  pickup: (orderId: number) => `/driver/trips/${orderId}/pickup`,
  startDelivery: (orderId: number) => `/driver/trips/${orderId}/start-delivery`,
  complete: (orderId: number) => `/driver/trips/${orderId}/complete`,
  cancel: (orderId: number) => `/driver/trips/${orderId}/cancel`,
  updateStatus: (orderId: number) => `/driver/trips/${orderId}/status`,
} as const;

@Injectable({
  providedIn: 'root'
})
export class DriverService {
  private readonly api = inject(ApiService);

  // Reactive state
  private readonly _profile = signal<DriverWithProfile | null>(null);
  private readonly _stats = signal<DriverStats | null>(null);
  private readonly _availableTrips = signal<Order[]>([]);
  private readonly _activeTrips = signal<Order[]>([]);
  private readonly _loading = signal(false);

  // Public computed signals
  readonly profile = this._profile.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly availableTrips = this._availableTrips.asReadonly();
  readonly activeTrips = this._activeTrips.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly driverProfile = computed(() => this._profile()?.driver_profile);
  readonly isAvailable = computed(() => this.driverProfile()?.status === DRIVER_STATUS.AVAILABLE);
  readonly isBusy = computed(() => this.driverProfile()?.status === DRIVER_STATUS.BUSY);
  readonly isOffline = computed(() => this.driverProfile()?.status === DRIVER_STATUS.OFFLINE);
  readonly isSuspended = computed(() => this.driverProfile()?.status === DRIVER_STATUS.SUSPENDED);
  readonly canAcceptOrders = computed(() => {
    const profile = this.driverProfile();
    if (!profile) return false;
    return (
      profile.status !== DRIVER_STATUS.SUSPENDED &&
      profile.active_orders_count < profile.max_active_orders
    );
  });

  // ==========================================================================
  // REGISTRATION
  // ==========================================================================

  registerDriver(data: DriverRegister): Observable<DriverWithProfile> {
    return this.api.post<DriverWithProfile>(ENDPOINTS.REGISTER, data);
  }

  convertToDriver(data: ConvertToDriver): Observable<DriverWithProfile> {
    return this.api.post<DriverWithProfile>(ENDPOINTS.CONVERT, data).pipe(
      tap(profile => this._profile.set(profile))
    );
  }

  // ==========================================================================
  // PROFILE
  // ==========================================================================

  getProfile(): Observable<DriverWithProfile> {
    return this.api.get<DriverWithProfile>(ENDPOINTS.ME).pipe(
      tap(profile => this._profile.set(profile))
    );
  }

  updateProfile(data: DriverProfileUpdate): Observable<DriverProfile> {
    return this.api.patch<DriverProfile>(ENDPOINTS.UPDATE_ME, data).pipe(
      tap(updatedProfile => {
        const currentProfile = this._profile();
        if (currentProfile) {
          this._profile.set({
            ...currentProfile,
            driver_profile: updatedProfile
          });
        }
      })
    );
  }

  // ==========================================================================
  // TRIPS
  // ==========================================================================

  getAvailableTrips(): Observable<Order[]> {
    this._loading.set(true);
    return this.api.get<Order[]>(ENDPOINTS.AVAILABLE).pipe(
      tap(trips => {
        this._availableTrips.set(trips);
        this._loading.set(false);
      })
    );
  }

  getActiveTrips(): Observable<Order[]> {
    this._loading.set(true);
    return this.api.get<Order[]>(ENDPOINTS.ACTIVE).pipe(
      tap(trips => {
        this._activeTrips.set(trips);
        this._loading.set(false);
      })
    );
  }

  getTripHistory(period: 'week' | 'month' | 'all' = 'month'): Observable<Order[]> {
    return this.api.get<Order[]>(`${ENDPOINTS.HISTORY}?period=${period}`);
  }

  getTripDetail(orderId: number): Observable<Order> {
    return this.api.get<Order>(ENDPOINTS.tripDetail(orderId));
  }

  updateTripStatus(orderId: number, status: string): Observable<AcceptTripResponse> {
    return this.api.post<AcceptTripResponse>(ENDPOINTS.updateStatus(orderId), { status }).pipe(
      tap(response => {
        if (response.success && response.order) {
          this.updateTripInList(response.order);
        }
      })
    );
  }

  /**
   * Alias for getProfile - used by some components
   */
  getDriverProfile(): Observable<DriverWithProfile> {
    return this.getProfile();
  }

  // ==========================================================================
  // TRIP ACTIONS
  // ==========================================================================

  acceptTrip(orderId: number): Observable<AcceptTripResponse> {
    return this.api.post<AcceptTripResponse>(ENDPOINTS.accept(orderId), {}).pipe(
      tap(response => {
        if (response.success && response.order) {
          // Remove from available, add to active
          this._availableTrips.update(trips => trips.filter(t => t.id !== orderId));
          this._activeTrips.update(trips => [...trips, response.order!]);
          // Update profile stats
          this.refreshProfile();
        }
      })
    );
  }

  pickupOrder(orderId: number, data?: TripStatusUpdate): Observable<AcceptTripResponse> {
    return this.api.post<AcceptTripResponse>(ENDPOINTS.pickup(orderId), data || {}).pipe(
      tap(response => {
        if (response.success && response.order) {
          this.updateTripInList(response.order);
        }
      })
    );
  }

  startDelivery(orderId: number, data?: TripStatusUpdate): Observable<AcceptTripResponse> {
    return this.api.post<AcceptTripResponse>(ENDPOINTS.startDelivery(orderId), data || {}).pipe(
      tap(response => {
        if (response.success && response.order) {
          this.updateTripInList(response.order);
        }
      })
    );
  }

  completeDelivery(orderId: number, data?: TripStatusUpdate): Observable<AcceptTripResponse> {
    return this.api.post<AcceptTripResponse>(ENDPOINTS.complete(orderId), data || {}).pipe(
      tap(response => {
        if (response.success) {
          // Remove from active trips
          this._activeTrips.update(trips => trips.filter(t => t.id !== orderId));
          // Refresh profile stats
          this.refreshProfile();
          this.refreshStats();
        }
      })
    );
  }

  cancelTrip(orderId: number, data: CancelTripRequest): Observable<AcceptTripResponse> {
    return this.api.post<AcceptTripResponse>(ENDPOINTS.cancel(orderId), data).pipe(
      tap(response => {
        if (response.success) {
          // Remove from active, return to available
          this._activeTrips.update(trips => trips.filter(t => t.id !== orderId));
          this.refreshProfile();
          this.getAvailableTrips().subscribe();
        }
      })
    );
  }

  // ==========================================================================
  // STATUS
  // ==========================================================================

  updateStatus(status: DriverStatus): Observable<DriverStatusResponse> {
    const data: DriverStatusUpdate = { status };
    return this.api.post<DriverStatusResponse>(ENDPOINTS.STATUS, data).pipe(
      tap(response => {
        if (response.success) {
          const profile = this._profile();
          if (profile?.driver_profile) {
            this._profile.set({
              ...profile,
              driver_profile: {
                ...profile.driver_profile,
                status: response.status,
                is_available: response.is_available
              }
            });
          }
        }
      })
    );
  }

  goOnline(): Observable<DriverStatusResponse> {
    return this.updateStatus(DRIVER_STATUS.AVAILABLE);
  }

  goOffline(): Observable<DriverStatusResponse> {
    return this.updateStatus(DRIVER_STATUS.OFFLINE);
  }

  // ==========================================================================
  // STATS & EARNINGS
  // ==========================================================================

  getStats(): Observable<DriverStats> {
    return this.api.get<DriverStats>(ENDPOINTS.STATS).pipe(
      tap(stats => this._stats.set(stats))
    );
  }

  getEarnings(): Observable<DriverEarningsResponse> {
    return this.api.get<DriverEarningsResponse>(ENDPOINTS.EARNINGS);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private updateTripInList(order: Order): void {
    this._activeTrips.update(trips =>
      trips.map(t => t.id === order.id ? order : t)
    );
  }

  private refreshProfile(): void {
    this.getProfile().subscribe();
  }

  private refreshStats(): void {
    this.getStats().subscribe();
  }

  /**
   * Initialize driver data on login
   */
  initializeDriver(): void {
    this.getProfile().subscribe();
    this.getStats().subscribe();
    this.getActiveTrips().subscribe();
  }

  /**
   * Clear driver state on logout
   */
  clearState(): void {
    this._profile.set(null);
    this._stats.set(null);
    this._availableTrips.set([]);
    this._activeTrips.set([]);
  }
}
