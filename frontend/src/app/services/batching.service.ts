import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, timeout, forkJoin } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  Trip,
  TripWithStops,
  TripStatus,
  BatchingPreviewResponse,
  BatchingRunResponse,
  BatchingStats,
  AssignTripRequest,
  AssignTripResponse,
  PendingOrder,
  PendingOrdersResponse,
  CustomBatchingRequest
} from '../models/trip.model';
import { User } from '../models/user.model';

const API_ENDPOINTS = {
  PREVIEW: '/admin/batching/preview',
  RUN: '/admin/batching/run',
  RUN_CUSTOM: '/admin/batching/run-custom',
  ORDERS: '/admin/batching/orders',
  STATS: '/admin/batching/stats',
  TRIPS: '/admin/batching/trips',
  RESET: '/admin/batching/reset',
  tripDetail: (tripId: number) => `/admin/batching/trips/${tripId}`,
  assignTrip: (tripId: number) => `/admin/batching/trips/${tripId}/assign`,
  unassignTrip: (tripId: number) => `/admin/batching/trips/${tripId}/unassign`,
  cancelTrip: (tripId: number) => `/admin/batching/trips/${tripId}`,
  DRIVERS: '/users?role=DRIVER',
  // Smart batching endpoints
  SMART_PREVIEW: '/admin/batching/smart-preview',
  SMART_RUN: '/admin/batching/smart-run',
  SMART_DRIVERS: '/admin/batching/smart-drivers',
  // Customer routes (for map display)
  CUSTOMER_ROUTES: '/admin/routes/',
  CUSTOMER_ROUTES_WITH_GEOMETRY: '/admin/routes/with-geometry'
};

@Injectable({
  providedIn: 'root'
})
export class BatchingService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // State signals
  private _stats = signal<BatchingStats | null>(null);
  private _trips = signal<Trip[]>([]);
  private _preview = signal<BatchingPreviewResponse | null>(null);
  private _drivers = signal<User[]>([]);
  private _pendingOrders = signal<PendingOrder[]>([]);

  // Public readonly signals
  readonly stats = this._stats.asReadonly();
  readonly trips = this._trips.asReadonly();
  readonly preview = this._preview.asReadonly();
  readonly drivers = this._drivers.asReadonly();
  readonly pendingOrders = this._pendingOrders.asReadonly();

  /**
   * Get batching statistics
   */
  getStats(): Observable<BatchingStats> {
    return this.http.get<BatchingStats>(`${this.apiUrl}${API_ENDPOINTS.STATS}`).pipe(
      tap(stats => this._stats.set(stats))
    );
  }

  /**
   * Refresh both stats and trips in parallel (single combined call)
   */
  refreshData(): Observable<[BatchingStats, Trip[]]> {
    return forkJoin([this.getStats(), this.getTrips()]);
  }

  /**
   * Preview batching without creating trips
   */
  previewBatching(): Observable<BatchingPreviewResponse> {
    return this.http.get<BatchingPreviewResponse>(`${this.apiUrl}${API_ENDPOINTS.PREVIEW}`).pipe(
      tap(preview => this._preview.set(preview))
    );
  }

  /**
   * Run batching to create trips
   */
  runBatching(): Observable<BatchingRunResponse> {
    return this.http.post<BatchingRunResponse>(`${this.apiUrl}${API_ENDPOINTS.RUN}`, {}).pipe(
      tap(() => {
        // Refresh stats and trips after batching
        this.refreshData().subscribe();
        // Clear preview since it's no longer valid
        this._preview.set(null);
      })
    );
  }

  /**
   * Normalize trip status to lowercase (API returns uppercase)
   */
  private normalizeTrip(trip: Trip): Trip {
    return {
      ...trip,
      status: trip.status.toLowerCase() as TripStatus
    };
  }

  /**
   * Get all trips with optional filters
   */
  getTrips(status?: TripStatus, driverId?: number): Observable<Trip[]> {
    let url = `${this.apiUrl}${API_ENDPOINTS.TRIPS}`;
    const params: string[] = [];

    if (status) params.push(`status_filter=${status.toUpperCase()}`);
    if (driverId) params.push(`driver_id=${driverId}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.http.get<Trip[]>(url).pipe(
      map(trips => trips.map(t => this.normalizeTrip(t))),
      tap(trips => this._trips.set(trips))
    );
  }

  /**
   * Get trip details with stops
   */
  getTripDetail(tripId: number): Observable<TripWithStops> {
    return this.http.get<TripWithStops>(`${this.apiUrl}${API_ENDPOINTS.tripDetail(tripId)}`).pipe(
      map(trip => ({
        ...this.normalizeTrip(trip),
        stops: trip.stops
      }) as TripWithStops)
    );
  }

  /**
   * Assign trip to a driver
   */
  assignTrip(tripId: number, driverId: number): Observable<AssignTripResponse> {
    const request: AssignTripRequest = { driver_id: driverId };
    return this.http.post<AssignTripResponse>(
      `${this.apiUrl}${API_ENDPOINTS.assignTrip(tripId)}`,
      request
    ).pipe(
      map(response => ({
        ...response,
        trip: response.trip ? {
          ...this.normalizeTrip(response.trip),
          stops: response.trip.stops
        } as TripWithStops : undefined
      })),
      tap(response => {
        if (response.success && response.trip) {
          // Update the trip in the list
          this._trips.update(trips =>
            trips.map(t => t.id === tripId ? response.trip! : t)
          );
        }
      })
    );
  }

  /**
   * Unassign trip from driver
   */
  unassignTrip(tripId: number): Observable<AssignTripResponse> {
    return this.http.post<AssignTripResponse>(
      `${this.apiUrl}${API_ENDPOINTS.unassignTrip(tripId)}`,
      {}
    ).pipe(
      map(response => ({
        ...response,
        trip: response.trip ? {
          ...this.normalizeTrip(response.trip),
          stops: response.trip.stops
        } as TripWithStops : undefined
      })),
      tap(response => {
        if (response.success && response.trip) {
          this._trips.update(trips =>
            trips.map(t => t.id === tripId ? response.trip! : t)
          );
        }
      })
    );
  }

  /**
   * Cancel a trip
   */
  cancelTrip(tripId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}${API_ENDPOINTS.cancelTrip(tripId)}`
    ).pipe(
      tap(() => {
        this._trips.update(trips => trips.filter(t => t.id !== tripId));
        this.getStats().subscribe();  // Only stats needed, trips already updated locally
      })
    );
  }

  /**
   * Get available drivers
   */
  getDrivers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}${API_ENDPOINTS.DRIVERS}`).pipe(
      tap(drivers => this._drivers.set(drivers))
    );
  }

  /**
   * Get all pending batchable orders for drag-drop UI
   * @param limit Optional limit for simulation (5, 10, 15, etc.)
   * @param randomSample If true with limit, returns random orders
   */
  getPendingOrders(limit?: number, randomSample = true): Observable<PendingOrder[]> {
    let url = `${this.apiUrl}${API_ENDPOINTS.ORDERS}`;
    const params: string[] = [];

    if (limit && limit > 0) {
      params.push(`limit=${limit}`);
      params.push(`random_sample=${randomSample}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.http.get<PendingOrdersResponse>(url).pipe(
      map(response => response.orders),
      tap(orders => this._pendingOrders.set(orders))
    );
  }

  /**
   * Run custom batching with user-defined batches
   */
  runCustomBatching(batches: { order_ids: number[]; driver_id?: number }[]): Observable<BatchingRunResponse> {
    const request: CustomBatchingRequest = { batches };
    return this.http.post<BatchingRunResponse>(
      `${this.apiUrl}${API_ENDPOINTS.RUN_CUSTOM}`,
      request
    ).pipe(
      tap(() => {
        // Refresh stats and trips after batching
        this.refreshData().subscribe();
        // Clear pending orders and preview
        this._pendingOrders.set([]);
        this._preview.set(null);
      })
    );
  }

  /**
   * Clear pending orders state
   */
  clearPendingOrders(): void {
    this._pendingOrders.set([]);
  }

  // ==================== Smart Batching ====================

  /**
   * Smart batching algorithm parameters
   */
  buildSmartBatchingParams(params: SmartBatchingParams): string {
    const queryParams: string[] = [];
    if (params.strategy) queryParams.push(`strategy=${params.strategy}`);
    if (params.maxWeight) queryParams.push(`max_weight=${params.maxWeight}`);
    if (params.maxOrders) queryParams.push(`max_orders=${params.maxOrders}`);
    if (params.simulationLimit) queryParams.push(`simulation_limit=${params.simulationLimit}`);
    if (params.corridorFilter) queryParams.push(`corridor_filter=${encodeURIComponent(params.corridorFilter)}`);
    if (params.maxCapacityPercent) queryParams.push(`max_capacity_percent=${params.maxCapacityPercent}`);
    if (params.batchingMode) queryParams.push(`batching_mode=${params.batchingMode}`);
    return queryParams.length > 0 ? '?' + queryParams.join('&') : '';
  }

  /**
   * Preview smart corridor-based batching
   * Groups orders by corridor (road) and sorts by distance
   */
  previewSmartBatching(params: SmartBatchingParams = {}): Observable<SmartBatchingResponse> {
    const queryString = this.buildSmartBatchingParams(params);
    return this.http.get<SmartBatchingResponse>(
      `${this.apiUrl}${API_ENDPOINTS.SMART_PREVIEW}${queryString}`
    ).pipe(
      timeout(30000)
    );
  }

  /**
   * Run smart batching and create trips
   * Uses corridors, driver capacity, and distance-based ordering
   */
  runSmartBatching(params: SmartBatchingParams = {}): Observable<SmartBatchingResponse> {
    const queryString = this.buildSmartBatchingParams(params);
    return this.http.post<SmartBatchingResponse>(
      `${this.apiUrl}${API_ENDPOINTS.SMART_RUN}${queryString}`,
      {}
    ).pipe(
      tap(() => {
        this.refreshData().subscribe();
        this._pendingOrders.set([]);
      })
    );
  }

  /**
   * Get available drivers with their vehicle capacity
   */
  getSmartDrivers(): Observable<SmartDriversResponse> {
    return this.http.get<SmartDriversResponse>(`${this.apiUrl}${API_ENDPOINTS.SMART_DRIVERS}`);
  }

  /**
   * Get all customer routes with geometry coordinates for map display
   */
  getCustomerRoutes(): Observable<CustomerRoute[]> {
    return this.http.get<CustomerRoute[]>(`${this.apiUrl}${API_ENDPOINTS.CUSTOMER_ROUTES_WITH_GEOMETRY}`);
  }

  /**
   * Update a customer route (corridor, distance, duration)
   */
  updateCustomerRoute(userId: number, data: UpdateRouteRequest): Observable<CustomerRoute> {
    return this.http.patch<CustomerRoute>(
      `${this.apiUrl}${API_ENDPOINTS.CUSTOMER_ROUTES}${userId}`,
      data
    );
  }

  /**
   * Reset all trips - delete trips/stops and return orders to pending
   * Used to reinitialize smart batching
   */
  resetAllTrips(): Observable<ResetTripsResponse> {
    return this.http.post<ResetTripsResponse>(
      `${this.apiUrl}${API_ENDPOINTS.RESET}`,
      {}
    ).pipe(
      tap(() => {
        this._trips.set([]);
        this._pendingOrders.set([]);
        this.getStats().subscribe();  // Only stats needed, trips already cleared
      })
    );
  }
}

// ==================== Smart Batching Interfaces ====================

export interface SmartBatchStop {
  sequence: number;
  order_id: number;
  user_id: number;
  customer_name: string;
  address: string;
  phone: string;
  weight_kg: number;
  distance_km: number;
  corridor?: string;
  duration_min?: number;
  latitude?: number;
  longitude?: number;
}

export interface SmartBatch {
  corridor: string;
  order_count: number;
  order_ids: number[];
  total_weight_kg: number;
  total_distance_km: number;
  total_earnings: number;
  capacity_kg: number;
  capacity_used_pct: number;
  assigned_driver?: {
    id: number;
    name: string;
    capacity_kg: number;
    vehicle_type: string;
  };
  stops: SmartBatchStop[];
}

export interface LeftoverOrder {
  order_id: number;
  customer_name: string;
  address: string;
  weight_kg: number;
  corridor: string;
  distance_km: number;
  efficiency_kg_km?: number;
  reason: 'no_capacity' | 'low_efficiency';
}

export interface UnusableTruck {
  id: number;
  name: string;
  capacity_kg: number;
  effective_capacity_kg: number;
}

export interface SmartBatchingResponse {
  success: boolean;
  message?: string;
  error?: string;
  batches: SmartBatch[];
  leftover_orders: LeftoverOrder[];
  summary: {
    total_orders: number;
    orders_assigned: number;
    orders_leftover: number;
    total_batches: number;
    trucks_available: number;
    trucks_used: number;
    by_corridor?: Record<string, number>;
    strategy?: string;
    smallest_order_kg?: number;
    unusable_trucks?: UnusableTruck[];
  };
  trips_created?: number;
  trips?: Array<{
    id: number;
    corridor: string;
    stops: number;
    driver_id?: number;
    status: string;
  }>;
}

export interface SmartDriver {
  id: number;
  name: string;
  phone: string;
  capacity_kg: number;
  vehicle_type: string;
}

export interface SmartDriversResponse {
  drivers: SmartDriver[];
  total: number;
  min_capacity_kg: number;
  max_capacity_kg: number;
}

export interface CustomerRoute {
  id: number;
  user_id: number;
  distance_meters: number;
  duration_seconds: number;
  distance_km: number;
  duration_min: number;
  heading?: number;
  corridor?: string;
  coordinates: [number, number][];  // [[lng, lat], [lng, lat], ...]
}

export interface UpdateRouteRequest {
  corridor?: string;
  distance_km?: number;
  duration_min?: number;
}

export interface ResetTripsResponse {
  success: boolean;
  message: string;
  trips_deleted: number;
  orders_reset: number;
}

export interface SmartBatchingParams {
  strategy?: 'farthest_first' | 'nearest_first';
  maxWeight?: number;
  maxOrders?: number;
  simulationLimit?: number;
  corridorFilter?: string;
  maxCapacityPercent?: number;
  batchingMode?: 'available' | 'all_drivers';
}
