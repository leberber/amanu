import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Order } from '../models/order.model';
import {
  AvailableOrder,
  PickupOrderResponse,
  TripWithStops,
  TripStop,
  StopStatus
} from '../models/trip.model';
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

  // New routing endpoints
  AVAILABLE_ORDERS: '/drivers/available-orders',
  pickupOrder: (orderId: number) => `/drivers/orders/${orderId}/pickup`,

  // Multi-stop trip endpoints
  MULTI_TRIPS: '/driver/multi-trips',
  multiTripDetail: (tripId: number) => `/driver/multi-trips/${tripId}`,
  updateStopStatus: (tripId: number, stopId: number) => `/driver/multi-trips/${tripId}/stops/${stopId}`,
  startMultiTrip: (tripId: number) => `/driver/multi-trips/${tripId}/start`,
  completeMultiTrip: (tripId: number) => `/driver/multi-trips/${tripId}/complete`,

  // Batched trip endpoints (pending trips suggested to driver)
  BATCHED_PENDING: '/driver/trips/batched/pending',
  BATCHED_ACTIVE: '/driver/trips/batched/active',
  batchedTripDetail: (tripId: number) => `/driver/trips/batched/${tripId}`,
  acceptBatchedTrip: (tripId: number) => `/driver/trips/batched/${tripId}/accept`,
  declineBatchedTrip: (tripId: number) => `/driver/trips/batched/${tripId}/decline`,
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

  // Routing-specific state
  private readonly _availableOrders = signal<AvailableOrder[]>([]);
  private readonly _activeMultiTrips = signal<TripWithStops[]>([]);
  private readonly _pendingBatchedTrips = signal<TripWithStops[]>([]);

  // Public computed signals
  readonly profile = this._profile.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly availableTrips = this._availableTrips.asReadonly();
  readonly activeTrips = this._activeTrips.asReadonly();
  readonly loading = this._loading.asReadonly();

  // Routing signals
  readonly availableOrders = this._availableOrders.asReadonly();
  readonly activeMultiTrips = this._activeMultiTrips.asReadonly();
  readonly pendingBatchedTrips = this._pendingBatchedTrips.asReadonly();

  // Access driver data - supports both 'driver' (new) and 'driver_profile' (deprecated)
  readonly driverData = computed(() => this._profile()?.driver ?? this._profile()?.driver_profile);
  /** @deprecated Use driverData instead */
  readonly driverProfile = computed(() => this.driverData());
  readonly isAvailable = computed(() => this.driverData()?.status === DRIVER_STATUS.AVAILABLE);
  readonly isBusy = computed(() => this.driverData()?.status === DRIVER_STATUS.BUSY);
  readonly isOffline = computed(() => this.driverData()?.status === DRIVER_STATUS.OFFLINE);
  readonly isSuspended = computed(() => this.driverData()?.status === DRIVER_STATUS.SUSPENDED);
  readonly canAcceptOrders = computed(() => {
    const driver = this.driverData();
    if (!driver) return false;
    return (
      driver.status !== DRIVER_STATUS.SUSPENDED &&
      driver.active_orders_count < driver.max_active_orders
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
      tap(updatedDriver => {
        const currentProfile = this._profile();
        if (currentProfile) {
          this._profile.set({
            ...currentProfile,
            driver: updatedDriver,
            driver_profile: updatedDriver // Keep for backward compatibility
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
          const currentDriver = profile?.driver ?? profile?.driver_profile;
          if (profile && currentDriver) {
            const updatedDriver = {
              ...currentDriver,
              status: response.status,
              is_available: response.is_available
            };
            this._profile.set({
              ...profile,
              driver: updatedDriver,
              driver_profile: updatedDriver // Keep for backward compatibility
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
  // ROUTING - AVAILABLE ORDERS (Capacity Filtered)
  // ==========================================================================

  /**
   * Get orders available for pickup, filtered by driver's vehicle capacity.
   * Full load orders are only shown to drivers with sufficient capacity.
   */
  getAvailableOrders(): Observable<AvailableOrder[]> {
    this._loading.set(true);
    return this.api.get<AvailableOrder[]>(ENDPOINTS.AVAILABLE_ORDERS).pipe(
      tap(orders => {
        this._availableOrders.set(orders);
        this._loading.set(false);
      })
    );
  }

  /**
   * Driver picks up (accepts) an available order.
   */
  pickupAvailableOrder(orderId: number): Observable<PickupOrderResponse> {
    return this.api.post<PickupOrderResponse>(ENDPOINTS.pickupOrder(orderId), {}).pipe(
      tap(response => {
        if (response.success && response.order) {
          // Remove from available orders
          this._availableOrders.update(orders =>
            orders.filter(o => o.order.id !== orderId)
          );
          // Add to active trips
          this._activeTrips.update(trips => [...trips, response.order!]);
          // Refresh profile stats
          this.refreshProfile();
        }
      })
    );
  }

  // ==========================================================================
  // MULTI-STOP TRIPS (Batched Orders)
  // ==========================================================================

  /**
   * Get active multi-stop trips for the driver.
   */
  getActiveMultiTrips(): Observable<TripWithStops[]> {
    return this.api.get<TripWithStops[]>(ENDPOINTS.MULTI_TRIPS).pipe(
      tap(trips => this._activeMultiTrips.set(trips))
    );
  }

  /**
   * Get details of a specific multi-stop trip.
   */
  getMultiTripDetail(tripId: number): Observable<TripWithStops> {
    return this.api.get<TripWithStops>(ENDPOINTS.multiTripDetail(tripId));
  }

  /**
   * Start a multi-stop trip.
   */
  startMultiTrip(tripId: number): Observable<TripWithStops> {
    return this.api.post<TripWithStops>(ENDPOINTS.startMultiTrip(tripId), {}).pipe(
      tap(trip => {
        this._activeMultiTrips.update(trips =>
          trips.map(t => t.id === tripId ? trip : t)
        );
      })
    );
  }

  /**
   * Update the status of a stop within a trip.
   */
  updateStopStatus(tripId: number, stopId: number, status: StopStatus, notes?: string): Observable<TripWithStops> {
    return this.api.put<TripWithStops>(
      ENDPOINTS.updateStopStatus(tripId, stopId),
      { status, notes }
    ).pipe(
      tap(trip => {
        this._activeMultiTrips.update(trips =>
          trips.map(t => t.id === tripId ? trip : t)
        );
      })
    );
  }

  /**
   * Mark a stop as arrived.
   */
  markStopArrived(tripId: number, stopId: number): Observable<TripWithStops> {
    return this.updateStopStatus(tripId, stopId, 'arrived');
  }

  /**
   * Mark a stop as delivered.
   */
  markStopDelivered(tripId: number, stopId: number, notes?: string): Observable<TripWithStops> {
    return this.updateStopStatus(tripId, stopId, 'delivered', notes);
  }

  /**
   * Complete a multi-stop trip (all stops delivered).
   */
  completeMultiTrip(tripId: number): Observable<TripWithStops> {
    return this.api.post<TripWithStops>(ENDPOINTS.completeMultiTrip(tripId), {}).pipe(
      tap(() => {
        // Remove from active multi-trips
        this._activeMultiTrips.update(trips =>
          trips.filter(t => t.id !== tripId)
        );
        // Refresh stats
        this.refreshStats();
        this.refreshProfile();
      })
    );
  }

  // ==========================================================================
  // BATCHED TRIPS (Pending trips suggested to driver)
  // ==========================================================================

  /**
   * Get pending batched trips suggested to this driver.
   */
  getPendingBatchedTrips(): Observable<TripWithStops[]> {
    return this.api.get<TripWithStops[]>(ENDPOINTS.BATCHED_PENDING).pipe(
      tap(trips => this._pendingBatchedTrips.set(trips))
    );
  }

  /**
   * Accept a batched trip (multi-stop delivery).
   */
  acceptBatchedTrip(tripId: number): Observable<{ success: boolean; message: string; trip?: TripWithStops }> {
    return this.api.post<{ success: boolean; message: string; trip?: TripWithStops }>(
      ENDPOINTS.acceptBatchedTrip(tripId), {}
    ).pipe(
      tap(response => {
        if (response.success && response.trip) {
          // Remove from pending
          this._pendingBatchedTrips.update(trips => trips.filter(t => t.id !== tripId));
          // Add to active multi-trips
          this._activeMultiTrips.update(trips => [...trips, response.trip!]);
          // Refresh profile
          this.refreshProfile();
        }
      })
    );
  }

  /**
   * Decline a batched trip (cancels trip, orders return to pending).
   */
  declineBatchedTrip(tripId: number, reason?: string): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>(
      ENDPOINTS.declineBatchedTrip(tripId),
      { reason }
    ).pipe(
      tap(response => {
        if (response.success) {
          // Remove from pending
          this._pendingBatchedTrips.update(trips => trips.filter(t => t.id !== tripId));
        }
      })
    );
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
    this._availableOrders.set([]);
    this._activeMultiTrips.set([]);
  }
}
