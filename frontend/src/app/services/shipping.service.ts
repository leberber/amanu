import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ShippingPriceConfig,
  ShippingPriceConfigCreate,
  ShippingPriceConfigUpdate,
  ShippingCostRequest,
  ShippingCostResponse,
  DeliveryZoneStats,
  DeliveryPricing
} from '../models/shipping.model';
import { DeliveryType } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class ShippingService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/shipping`;

  // Cache the last calculated shipping cost for use in checkout
  private readonly _lastShippingCost = signal<number>(0);
  readonly lastShippingCost = this._lastShippingCost.asReadonly();

  // Selected delivery type (STANDARD or PRIORITY)
  private readonly _deliveryType = signal<DeliveryType>('STANDARD');
  readonly deliveryType = this._deliveryType.asReadonly();

  // Pricing for each delivery type
  private readonly _priorityPrice = signal<DeliveryPricing | null>(null);
  private readonly _standardPrice = signal<DeliveryPricing | null>(null);
  readonly priorityPrice = this._priorityPrice.asReadonly();
  readonly standardPrice = this._standardPrice.asReadonly();

  /**
   * Set the shipping cost (called from order-summary)
   */
  setShippingCost(cost: number): void {
    this._lastShippingCost.set(cost);
  }

  /**
   * Set delivery type and pricing (called from order-summary)
   */
  setDeliveryType(type: DeliveryType): void {
    this._deliveryType.set(type);
  }

  /**
   * Set delivery pricing options (called from order-summary)
   */
  setDeliveryPricing(priority: DeliveryPricing | null, standard: DeliveryPricing | null): void {
    this._priorityPrice.set(priority);
    this._standardPrice.set(standard);
  }

  // Pickup date
  private readonly _pickupDate = signal<Date | null>(null);
  readonly pickupDate = this._pickupDate.asReadonly();

  setPickupDate(date: Date | null): void {
    this._pickupDate.set(date);
  }

  /**
   * Clear shipping cost (called after order is placed)
   */
  clearShippingCost(): void {
    this._lastShippingCost.set(0);
    this._deliveryType.set('STANDARD');
    this._priorityPrice.set(null);
    this._standardPrice.set(null);
    this._pickupDate.set(null);
  }

  /**
   * Calculate shipping cost for a location (public)
   */
  calculateCost(request: ShippingCostRequest): Observable<ShippingCostResponse> {
    return this.http.post<ShippingCostResponse>(`${this.baseUrl}/calculate`, request);
  }

  /**
   * Get all shipping price configurations (admin only)
   */
  getConfigs(): Observable<ShippingPriceConfig[]> {
    return this.http.get<ShippingPriceConfig[]>(`${this.baseUrl}/config`);
  }

  /**
   * Get shipping price config by warehouse ID (admin only)
   */
  getConfigByWarehouse(warehouseId: string): Observable<ShippingPriceConfig> {
    return this.http.get<ShippingPriceConfig>(`${this.baseUrl}/config/${warehouseId}`);
  }

  /**
   * Create a new shipping price configuration (admin only)
   */
  createConfig(config: ShippingPriceConfigCreate): Observable<ShippingPriceConfig> {
    return this.http.post<ShippingPriceConfig>(`${this.baseUrl}/config`, config);
  }

  /**
   * Update a shipping price configuration (admin only)
   */
  updateConfig(warehouseId: string, config: ShippingPriceConfigUpdate): Observable<ShippingPriceConfig> {
    return this.http.patch<ShippingPriceConfig>(`${this.baseUrl}/config/${warehouseId}`, config);
  }

  /**
   * Delete a shipping price configuration (admin only)
   */
  deleteConfig(warehouseId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/config/${warehouseId}`);
  }

  /**
   * Get delivery zone statistics for a warehouse (admin only)
   */
  getZoneStats(warehouseId: string): Observable<DeliveryZoneStats> {
    return this.http.get<DeliveryZoneStats>(`${this.baseUrl}/zones/${warehouseId}`);
  }
}
