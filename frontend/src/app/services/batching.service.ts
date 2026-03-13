import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';

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
        this.getStats().subscribe();
        this.getTrips().subscribe();
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
        this.getStats().subscribe();
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
   */
  getPendingOrders(): Observable<PendingOrder[]> {
    return this.http.get<PendingOrdersResponse>(`${this.apiUrl}${API_ENDPOINTS.ORDERS}`).pipe(
      map(response => response.orders),
      tap(orders => this._pendingOrders.set(orders))
    );
  }

  /**
   * Run custom batching with user-defined batches
   */
  runCustomBatching(batches: { order_ids: number[] }[]): Observable<BatchingRunResponse> {
    const request: CustomBatchingRequest = { batches };
    return this.http.post<BatchingRunResponse>(
      `${this.apiUrl}${API_ENDPOINTS.RUN_CUSTOM}`,
      request
    ).pipe(
      tap(() => {
        // Refresh stats and trips after batching
        this.getStats().subscribe();
        this.getTrips().subscribe();
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
   * Preview smart corridor-based batching
   * Groups orders by corridor (road) and sorts by distance
   */
  previewSmartBatching(strategy: 'farthest_first' | 'nearest_first' = 'farthest_first'): Observable<SmartBatchingResponse> {
    return this.http.get<SmartBatchingResponse>(
      `${this.apiUrl}${API_ENDPOINTS.SMART_PREVIEW}?strategy=${strategy}`
    );
  }

  /**
   * Run smart batching and create trips
   * Uses corridors, driver capacity, and distance-based ordering
   */
  runSmartBatching(strategy: 'farthest_first' | 'nearest_first' = 'farthest_first'): Observable<SmartBatchingResponse> {
    return this.http.post<SmartBatchingResponse>(
      `${this.apiUrl}${API_ENDPOINTS.SMART_RUN}?strategy=${strategy}`,
      {}
    ).pipe(
      tap(() => {
        this.getStats().subscribe();
        this.getTrips().subscribe();
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
        this.getStats().subscribe();
      })
    );
  }
}

// ==================== Smart Batching Interfaces ====================

export interface SmartBatchStop {
  sequence: number;
  order_id: number;
  customer_name: string;
  address: string;
  phone: string;
  weight_kg: number;
  distance_km: number;
  heading: number;
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
  heading_range?: {
    min: number;
    max: number;
  };
  assigned_driver?: {
    id: number;
    name: string;
    capacity_kg: number;
    vehicle_type: string;
  };
  stops: SmartBatchStop[];
}

export interface SmartBatchingResponse {
  success: boolean;
  message?: string;
  error?: string;
  batches: SmartBatch[];
  summary: {
    total_orders: number;
    total_batches: number;
    by_corridor?: Record<string, number>;
    drivers_available?: number;
    batch_capacity_kg?: number;
    strategy?: string;
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

export interface ResetTripsResponse {
  success: boolean;
  message: string;
  trips_deleted: number;
  orders_reset: number;
}
