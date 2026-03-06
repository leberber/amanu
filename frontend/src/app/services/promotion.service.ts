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
  DiscountCalculationResponse,
  AutoApplyRequest,
  AutoApplyResponse
} from '../models/promotion.model';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private apiService = inject(ApiService);
  private translationService = inject(TranslationService);

  getPromotions(activeOnly = false): Observable<Promotion[]> {
    const params = {
      active_only: activeOnly,
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion[]>('/promotions/', { params });
  }

  getAllPromotions(): Observable<Promotion[]> {
    const params = {
      active_only: false,
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion[]>('/promotions/', { params });
  }

  getActivePromotions(): Observable<Promotion[]> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion[]>('/promotions/active', { params });
  }

  getPromotion(id: number): Observable<Promotion> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Promotion>(`/promotions/${id}`, { params });
  }

  validateCode(code: string): Observable<PromotionValidation> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<PromotionValidation>(`/promotions/code/${code}`, { params });
  }

  calculateDiscount(request: DiscountCalculationRequest): Observable<DiscountCalculationResponse> {
    return this.apiService.post<DiscountCalculationResponse>('/promotions/calculate', request);
  }

  autoApplyPromotions(request: AutoApplyRequest): Observable<AutoApplyResponse> {
    return this.apiService.post<AutoApplyResponse>('/promotions/auto-apply', request);
  }

  createPromotion(promotion: PromotionCreate): Observable<Promotion> {
    return this.apiService.post<Promotion>('/promotions/', promotion);
  }

  updatePromotion(id: number, promotion: PromotionUpdate): Observable<Promotion> {
    return this.apiService.patch<Promotion>(`/promotions/${id}`, promotion);
  }

  deletePromotion(id: number): Observable<any> {
    return this.apiService.delete<any>(`/promotions/${id}`);
  }
}
