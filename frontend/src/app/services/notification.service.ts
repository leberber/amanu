// src/app/services/notification.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  SegmentInfo,
  CityStat,
  NotificationHistory,
  TargetedNotificationRequest,
  SendNotificationResponse,
  PromotionItem,
  ProductItem,
  CategoryItem,
  BrandItem,
  SegmentType,
  Wilaya,
  Daira,
  Commune
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private api = inject(ApiService);

  // ==========================================================================
  // SEGMENTS & TARGETING
  // ==========================================================================

  getSegments(): Observable<SegmentInfo[]> {
    return this.api.get<SegmentInfo[]>('/push/segments');
  }

  getCities(): Observable<CityStat[]> {
    return this.api.get<CityStat[]>('/push/cities');
  }

  getWilayas(): Observable<Wilaya[]> {
    return this.api.get<Wilaya[]>('/push/wilayas');
  }

  getDairas(wilaya: string): Observable<Daira[]> {
    return this.api.get<Daira[]>(`/push/dairas?wilaya=${encodeURIComponent(wilaya)}`);
  }

  getCommunes(daira: string): Observable<Commune[]> {
    return this.api.get<Commune[]>(`/push/communes?daira=${encodeURIComponent(daira)}`);
  }

  getPreviewCount(segmentType: SegmentType, segmentValue?: string): Observable<{ count: number }> {
    let url = `/push/preview-count?segment_type=${segmentType}`;
    if (segmentValue) {
      url += `&segment_value=${encodeURIComponent(segmentValue)}`;
    }
    return this.api.get<{ count: number }>(url);
  }

  // ==========================================================================
  // SEND NOTIFICATIONS
  // ==========================================================================

  sendTargetedNotification(request: TargetedNotificationRequest): Observable<SendNotificationResponse> {
    return this.api.post<SendNotificationResponse>('/push/send-targeted', request);
  }

  // ==========================================================================
  // HISTORY
  // ==========================================================================

  getHistory(skip = 0, limit = 20): Observable<NotificationHistory[]> {
    return this.api.get<NotificationHistory[]>(`/push/history?skip=${skip}&limit=${limit}`);
  }

  getHistoryDetail(id: number): Observable<NotificationHistory> {
    return this.api.get<NotificationHistory>(`/push/history/${id}`);
  }

  // ==========================================================================
  // BUILDER DATA
  // ==========================================================================

  getPromotions(): Observable<PromotionItem[]> {
    return this.api.get<PromotionItem[]>('/push/promotions-list');
  }

  getProducts(): Observable<ProductItem[]> {
    return this.api.get<ProductItem[]>('/push/products-list');
  }

  getCategories(): Observable<CategoryItem[]> {
    return this.api.get<CategoryItem[]>('/push/categories-list');
  }

  getBrands(): Observable<BrandItem[]> {
    return this.api.get<BrandItem[]>('/push/brands-list');
  }
}
