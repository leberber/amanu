import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  CrossSellPromotion,
  CrossSellPromotionCreate,
  CrossSellPromotionUpdate,
  CrossSellCalculationRequest,
  CrossSellCalculationResponse
} from '../models/cross-sell-promotion.model';

@Injectable({
  providedIn: 'root'
})
export class CrossSellPromotionService {
  private apiService = inject(ApiService);

  /**
   * Get all cross-sell promotions (staff only)
   */
  getPromotions(activeOnly = false): Observable<CrossSellPromotion[]> {
    const params = { active_only: activeOnly };
    return this.apiService.get<CrossSellPromotion[]>('/cross-sell-promotions', { params });
  }

  /**
   * Get all cross-sell promotions
   */
  getAllPromotions(): Observable<CrossSellPromotion[]> {
    return this.getPromotions(false);
  }

  /**
   * Get active cross-sell promotions only (staff endpoint)
   */
  getActivePromotions(): Observable<CrossSellPromotion[]> {
    return this.getPromotions(true);
  }

  /**
   * Get active cross-sell promotions (public endpoint for customers)
   */
  getActivePromotionsPublic(): Observable<CrossSellPromotion[]> {
    return this.apiService.get<CrossSellPromotion[]>('/cross-sell-promotions/active');
  }

  /**
   * Get a single cross-sell promotion by ID (staff only)
   */
  getPromotion(id: number): Observable<CrossSellPromotion> {
    return this.apiService.get<CrossSellPromotion>(`/cross-sell-promotions/${id}`);
  }

  /**
   * Create a new cross-sell promotion (staff only)
   */
  createPromotion(promotion: CrossSellPromotionCreate): Observable<CrossSellPromotion> {
    return this.apiService.post<CrossSellPromotion>('/cross-sell-promotions', promotion);
  }

  /**
   * Update a cross-sell promotion (staff only)
   */
  updatePromotion(id: number, promotion: CrossSellPromotionUpdate): Observable<CrossSellPromotion> {
    return this.apiService.patch<CrossSellPromotion>(`/cross-sell-promotions/${id}`, promotion);
  }

  /**
   * Delete a cross-sell promotion (staff only)
   */
  deletePromotion(id: number): Observable<{ message: string }> {
    return this.apiService.delete<{ message: string }>(`/cross-sell-promotions/${id}`);
  }

  /**
   * Calculate cross-sell discounts for cart items (public endpoint)
   */
  calculateDiscounts(request: CrossSellCalculationRequest): Observable<CrossSellCalculationResponse> {
    return this.apiService.post<CrossSellCalculationResponse>('/cross-sell-promotions/calculate', request);
  }
}
