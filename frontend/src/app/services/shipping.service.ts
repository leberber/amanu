import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ShippingPriceConfig,
  ShippingPriceConfigCreate,
  ShippingPriceConfigUpdate,
  ShippingCostRequest,
  ShippingCostResponse,
  DeliveryZoneStats
} from '../models/shipping.model';

@Injectable({
  providedIn: 'root'
})
export class ShippingService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/shipping`;

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
