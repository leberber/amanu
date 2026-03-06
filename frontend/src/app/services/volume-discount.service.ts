import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VolumeDiscount, VolumeDiscountCreate, VolumeDiscountUpdate } from '../models/volume-discount.model';

@Injectable({
  providedIn: 'root'
})
export class VolumeDiscountService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/volume-discounts`;

  /**
   * Get all volume discounts (staff only)
   */
  getAll(activeOnly = false): Observable<VolumeDiscount[]> {
    return this.http.get<VolumeDiscount[]>(this.baseUrl, {
      params: { active_only: activeOnly.toString() }
    });
  }

  /**
   * Get active volume discounts (public)
   */
  getActive(): Observable<VolumeDiscount[]> {
    return this.http.get<VolumeDiscount[]>(`${this.baseUrl}/active`);
  }

  /**
   * Get volume discount by ID (staff only)
   */
  getById(id: number): Observable<VolumeDiscount> {
    return this.http.get<VolumeDiscount>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get volume discounts for a specific product (public)
   */
  getByProduct(productId: number): Observable<VolumeDiscount[]> {
    return this.http.get<VolumeDiscount[]>(`${this.baseUrl}/product/${productId}`);
  }

  /**
   * Create a new volume discount (staff only)
   */
  create(discount: VolumeDiscountCreate): Observable<VolumeDiscount> {
    return this.http.post<VolumeDiscount>(this.baseUrl, discount);
  }

  /**
   * Update a volume discount (staff only)
   */
  update(id: number, discount: VolumeDiscountUpdate): Observable<VolumeDiscount> {
    return this.http.patch<VolumeDiscount>(`${this.baseUrl}/${id}`, discount);
  }

  /**
   * Delete a volume discount (staff only)
   */
  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
