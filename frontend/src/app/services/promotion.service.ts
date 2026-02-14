import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { TranslationService } from './translation.service';
import {
  Promotion,
  PromotionCreate,
  PromotionUpdate,
  PromotionValidation,
  DiscountCalculationRequest,
  DiscountCalculationResponse
} from '../models/promotion.model';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private apiService = inject(ApiService);
  private translationService = inject(TranslationService);

  /**
   * Get all promotions (staff only)
   */
  getPromotions(activeOnly = false): Observable<Promotion[]> {
    const params = {
      active_only: activeOnly,
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion[]>('/promotions', { params });
  }

  /**
   * Get all promotions for admin (includes inactive)
   */
  getAllPromotions(): Observable<Promotion[]> {
    const params = {
      active_only: false,
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion[]>('/promotions', { params });
  }

  /**
   * Get currently active promotions (public)
   */
  getActivePromotions(): Observable<Promotion[]> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion[]>('/promotions/active', { params });
  }

  /**
   * Get promotion by ID (staff only)
   */
  getPromotion(id: number): Observable<Promotion> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion>(`/promotions/${id}`, { params });
  }

  /**
   * Validate a promotion code (public)
   */
  validateCode(code: string): Observable<PromotionValidation> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<PromotionValidation>(`/promotions/code/${code}`, { params });
  }

  /**
   * Calculate discount for cart items (public)
   */
  calculateDiscount(request: DiscountCalculationRequest): Observable<DiscountCalculationResponse> {
    return this.apiService.post<DiscountCalculationResponse>('/promotions/calculate', request);
  }

  /**
   * Create a new promotion (staff only)
   */
  createPromotion(promotion: PromotionCreate): Observable<Promotion> {
    return this.apiService.post<Promotion>('/promotions', promotion);
  }

  /**
   * Update a promotion (staff only)
   */
  updatePromotion(id: number, promotion: PromotionUpdate): Observable<Promotion> {
    return this.apiService.patch<Promotion>(`/promotions/${id}`, promotion);
  }

  /**
   * Delete a promotion (staff only)
   */
  deletePromotion(id: number): Observable<any> {
    return this.apiService.delete<any>(`/promotions/${id}`);
  }
}
