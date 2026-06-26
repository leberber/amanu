import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map, of } from 'rxjs';
import { Brand, BrandCreate, BrandUpdate } from '../../models/brand.model';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private http = inject(HttpClient);
  private translateService = inject(TranslateService);
  private apiUrl = `${environment.apiUrl}/brands`;

  // Cache for brands
  private brandsCache$ = new BehaviorSubject<Brand[]>([]);
  public brands$ = this.brandsCache$.asObservable();

  /**
   * Get all brands
   */
  getBrands(activeOnly: boolean = true): Observable<Brand[]> {
    const lang = this.translateService.currentLang || 'en';
    const params = new HttpParams()
      .set('active_only', activeOnly.toString())
      .set('lang', lang);

    return this.http.get<Brand[]>(this.apiUrl, { params }).pipe(
      map(brands => brands.sort((a, b) => a.name.localeCompare(b.name))),
      tap(brands => this.brandsCache$.next(brands))
    );
  }

  /**
   * Get brands that have active products in a given category.
   * Does NOT update the global brands cache.
   */
  getBrandsByCategory(categoryId: number): Observable<Brand[]> {
    const lang = this.translateService.currentLang || 'en';
    const params = new HttpParams()
      .set('active_only', 'true')
      .set('lang', lang)
      .set('category_id', categoryId.toString());

    return this.http.get<Brand[]>(this.apiUrl, { params }).pipe(
      map(brands => brands.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  /**
   * Get brands that have active products in a given segment.
   */
  getBrandsBySegment(segmentId: number): Observable<Brand[]> {
    const lang = this.translateService.currentLang || 'en';
    const params = new HttpParams()
      .set('active_only', 'true')
      .set('lang', lang)
      .set('segment_id', segmentId.toString());

    return this.http.get<Brand[]>(this.apiUrl, { params }).pipe(
      map(brands => brands.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  /**
   * Get brands that have active products in both a given category and segment.
   */
  getBrandsByCategoryAndSegment(categoryId: number, segmentId: number): Observable<Brand[]> {
    const lang = this.translateService.currentLang || 'en';
    const params = new HttpParams()
      .set('active_only', 'true')
      .set('lang', lang)
      .set('category_id', categoryId.toString())
      .set('segment_id', segmentId.toString());

    return this.http.get<Brand[]>(this.apiUrl, { params }).pipe(
      map(brands => brands.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  /**
   * Get brand by ID - checks cache first, falls back to API
   */
  getBrand(id: number): Observable<Brand> {
    const cached = this.brandsCache$.getValue().find(b => b.id === id);
    if (cached) {
      return of(cached);
    }

    const lang = this.translateService.currentLang || 'en';
    const params = new HttpParams().set('lang', lang);
    return this.http.get<Brand>(`${this.apiUrl}/${id}`, { params });
  }

  /**
   * Create new brand (staff only)
   */
  createBrand(brand: BrandCreate): Observable<Brand> {
    return this.http.post<Brand>(this.apiUrl, brand);
  }

  /**
   * Update brand (staff only)
   */
  updateBrand(id: number, brand: BrandUpdate): Observable<Brand> {
    return this.http.patch<Brand>(`${this.apiUrl}/${id}`, brand);
  }

  /**
   * Delete brand (staff only)
   */
  deleteBrand(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Clear brands cache
   */
  clearCache(): void {
    this.brandsCache$.next([]);
  }
}
