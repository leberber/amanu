import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Order } from '../models/order.model';
import {
  DriverProfileWithFlags,
  DriverProfileAdminUpdate,
  DriverSystemConfig,
  DriverSystemConfigUpdate,
  DriverSystemStats,
  AssignOrderRequest,
  AssignOrderResponse,
  FlagDriverRequest,
  SuspendDriverRequest,
  DriverWithProfile
} from '../models/driver.model';
import { DriverStatus } from '../core/constants/driver.constants';

/**
 * API Endpoints for admin driver management
 */
const ENDPOINTS = {
  // Config
  CONFIG: '/admin/drivers/config',

  // Driver profiles
  PROFILES: '/admin/drivers/profiles',
  profile: (driverId: number) => `/admin/drivers/profiles/${driverId}`,
  flagDriver: (driverId: number) => `/admin/drivers/profiles/${driverId}/flag`,
  unflagDriver: (driverId: number) => `/admin/drivers/profiles/${driverId}/unflag`,
  suspendDriver: (driverId: number) => `/admin/drivers/profiles/${driverId}/suspend`,
  unsuspendDriver: (driverId: number) => `/admin/drivers/profiles/${driverId}/unsuspend`,

  // Orders
  ORDER_POOL: '/admin/drivers/orders/pool',
  ORDERS_ASSIGNED: '/admin/drivers/orders/assigned',
  assignOrder: (orderId: number) => `/admin/drivers/orders/${orderId}/assign`,
  unassignOrder: (orderId: number) => `/admin/drivers/orders/${orderId}/unassign`,
  reassignOrder: (orderId: number) => `/admin/drivers/orders/${orderId}/reassign`,

  // Stats
  STATS: '/admin/drivers/stats',

  // Legacy driver endpoints (list, activate, deactivate)
  DRIVERS: '/drivers',
  driver: (driverId: number) => `/drivers/${driverId}`,
  activateDriver: (driverId: number) => `/drivers/${driverId}/activate`,
  deactivateDriver: (driverId: number) => `/drivers/${driverId}/deactivate`,
} as const;

@Injectable({
  providedIn: 'root'
})
export class DriverAdminService {
  private readonly api = inject(ApiService);

  // Reactive state
  private readonly _config = signal<DriverSystemConfig | null>(null);
  private readonly _stats = signal<DriverSystemStats | null>(null);
  private readonly _orderPool = signal<Order[]>([]);
  private readonly _assignedOrders = signal<Order[]>([]);
  private readonly _drivers = signal<DriverWithProfile[]>([]);
  private readonly _loading = signal(false);

  // Public signals
  readonly config = this._config.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly orderPool = this._orderPool.asReadonly();
  readonly assignedOrders = this._assignedOrders.asReadonly();
  readonly drivers = this._drivers.asReadonly();
  readonly loading = this._loading.asReadonly();

  // ==========================================================================
  // SYSTEM CONFIGURATION
  // ==========================================================================

  getConfig(): Observable<DriverSystemConfig> {
    return this.api.get<DriverSystemConfig>(ENDPOINTS.CONFIG).pipe(
      tap(config => this._config.set(config))
    );
  }

  updateConfig(data: DriverSystemConfigUpdate): Observable<DriverSystemConfig> {
    return this.api.patch<DriverSystemConfig>(ENDPOINTS.CONFIG, data).pipe(
      tap(config => this._config.set(config))
    );
  }

  // ==========================================================================
  // DRIVER MANAGEMENT
  // ==========================================================================

  getDrivers(skip = 0, limit = 100): Observable<DriverWithProfile[]> {
    this._loading.set(true);
    return this.api.get<DriverWithProfile[]>(`${ENDPOINTS.DRIVERS}?skip=${skip}&limit=${limit}`).pipe(
      tap(drivers => {
        this._drivers.set(drivers);
        this._loading.set(false);
      })
    );
  }

  getDriver(driverId: number): Observable<DriverWithProfile> {
    return this.api.get<DriverWithProfile>(ENDPOINTS.driver(driverId));
  }

  activateDriver(driverId: number): Observable<DriverWithProfile> {
    return this.api.patch<DriverWithProfile>(ENDPOINTS.activateDriver(driverId), {}).pipe(
      tap(driver => this.updateDriverInList(driver))
    );
  }

  deactivateDriver(driverId: number): Observable<DriverWithProfile> {
    return this.api.patch<DriverWithProfile>(ENDPOINTS.deactivateDriver(driverId), {}).pipe(
      tap(driver => this.updateDriverInList(driver))
    );
  }

  deleteDriver(driverId: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(ENDPOINTS.driver(driverId)).pipe(
      tap(() => {
        this._drivers.update(drivers => drivers.filter(d => d.id !== driverId));
      })
    );
  }

  // ==========================================================================
  // DRIVER PROFILES (with flags)
  // ==========================================================================

  getDriverProfiles(
    skip = 0,
    limit = 100,
    statusFilter?: DriverStatus,
    flaggedOnly = false
  ): Observable<DriverProfileWithFlags[]> {
    let url = `${ENDPOINTS.PROFILES}?skip=${skip}&limit=${limit}`;
    if (statusFilter) {
      url += `&status_filter=${statusFilter}`;
    }
    if (flaggedOnly) {
      url += '&flagged_only=true';
    }
    return this.api.get<DriverProfileWithFlags[]>(url);
  }

  getDriverProfile(driverId: number): Observable<DriverProfileWithFlags> {
    return this.api.get<DriverProfileWithFlags>(ENDPOINTS.profile(driverId));
  }

  updateDriverProfile(driverId: number, data: DriverProfileAdminUpdate): Observable<DriverProfileWithFlags> {
    return this.api.patch<DriverProfileWithFlags>(ENDPOINTS.profile(driverId), data);
  }

  flagDriver(driverId: number, data: FlagDriverRequest): Observable<DriverProfileWithFlags> {
    return this.api.post<DriverProfileWithFlags>(ENDPOINTS.flagDriver(driverId), data);
  }

  unflagDriver(driverId: number): Observable<DriverProfileWithFlags> {
    return this.api.post<DriverProfileWithFlags>(ENDPOINTS.unflagDriver(driverId), {});
  }

  suspendDriver(driverId: number, data: SuspendDriverRequest): Observable<DriverProfileWithFlags> {
    return this.api.post<DriverProfileWithFlags>(ENDPOINTS.suspendDriver(driverId), data);
  }

  unsuspendDriver(driverId: number): Observable<DriverProfileWithFlags> {
    return this.api.post<DriverProfileWithFlags>(ENDPOINTS.unsuspendDriver(driverId), {});
  }

  // ==========================================================================
  // ORDER ASSIGNMENT
  // ==========================================================================

  getOrderPool(): Observable<Order[]> {
    this._loading.set(true);
    return this.api.get<Order[]>(ENDPOINTS.ORDER_POOL).pipe(
      tap(orders => {
        this._orderPool.set(orders);
        this._loading.set(false);
      })
    );
  }

  getAssignedOrders(driverId?: number): Observable<Order[]> {
    let url = ENDPOINTS.ORDERS_ASSIGNED;
    if (driverId) {
      url += `?driver_id=${driverId}`;
    }
    return this.api.get<Order[]>(url).pipe(
      tap(orders => this._assignedOrders.set(orders))
    );
  }

  assignOrder(orderId: number, data: AssignOrderRequest): Observable<AssignOrderResponse> {
    return this.api.post<AssignOrderResponse>(ENDPOINTS.assignOrder(orderId), data).pipe(
      tap(response => {
        if (response.success && response.order) {
          // Remove from pool
          this._orderPool.update(orders => orders.filter(o => o.id !== orderId));
          // Add to assigned
          this._assignedOrders.update(orders => [...orders, response.order!]);
        }
      })
    );
  }

  unassignOrder(orderId: number): Observable<AssignOrderResponse> {
    return this.api.post<AssignOrderResponse>(ENDPOINTS.unassignOrder(orderId), {}).pipe(
      tap(response => {
        if (response.success && response.order) {
          // Remove from assigned
          this._assignedOrders.update(orders => orders.filter(o => o.id !== orderId));
          // Add back to pool
          this._orderPool.update(orders => [...orders, response.order!]);
        }
      })
    );
  }

  reassignOrder(orderId: number, data: AssignOrderRequest): Observable<AssignOrderResponse> {
    return this.api.post<AssignOrderResponse>(ENDPOINTS.reassignOrder(orderId), data).pipe(
      tap(response => {
        if (response.success && response.order) {
          this._assignedOrders.update(orders =>
            orders.map(o => o.id === orderId ? response.order! : o)
          );
        }
      })
    );
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  getSystemStats(): Observable<DriverSystemStats> {
    return this.api.get<DriverSystemStats>(ENDPOINTS.STATS).pipe(
      tap(stats => this._stats.set(stats))
    );
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private updateDriverInList(driver: DriverWithProfile): void {
    this._drivers.update(drivers =>
      drivers.map(d => d.id === driver.id ? driver : d)
    );
  }

  /**
   * Initialize admin driver data
   */
  initialize(): void {
    this.getConfig().subscribe();
    this.getSystemStats().subscribe();
    this.getDrivers().subscribe();
  }
}
