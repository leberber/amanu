import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Brand, BrandCreate, BrandUpdate } from '../../models/brand.model';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private http = inject(HttpClient);
  private translateService = inject(TranslateService);
  private apiUrl = '/api/v1/brands/';

  // Cache for brands
  private brandsCache$ = new BehaviorSubject<Brand[]>([]);
  public brands$ = this.brandsCache$.asObservable();

  /**
   * Get all brands
   */
  getBrands(activeOnly: boolean = true): Observable<Brand[]> {
    const lang = this.translateService.currentLang || 'en';
    let params = new HttpParams()
      .set('active_only', activeOnly.toString())
      .set('lang', lang);

    return this.http.get<Brand[]>(this.apiUrl, { params }).pipe(
      tap(brands => this.brandsCache$.next(brands))
    );
  }

  /**
   * Get brand by ID
   */
  getBrand(id: number): Observable<Brand> {
    const lang = this.translateService.currentLang || 'en';
    let params = new HttpParams().set('lang', lang);

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
