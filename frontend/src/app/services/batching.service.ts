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
  tripDetail: (tripId: number) => `/admin/batching/trips/${tripId}`,
  assignTrip: (tripId: number) => `/admin/batching/trips/${tripId}/assign`,
  unassignTrip: (tripId: number) => `/admin/batching/trips/${tripId}/unassign`,
  cancelTrip: (tripId: number) => `/admin/batching/trips/${tripId}`,
  DRIVERS: '/users?role=DRIVER'
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
}
