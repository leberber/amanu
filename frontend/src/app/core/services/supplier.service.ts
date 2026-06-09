import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map, of } from 'rxjs';
import {
  Supplier, SupplierCreate, SupplierUpdate,
  SupplierStats, SupplierPayment, SupplierPaymentCreate,
  SupplierProductPrice, SupplierPurchaseOrder, ProductPriceHistoryPoint
} from '../../models/supplier.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/suppliers`;

  // Cache for suppliers
  private suppliersCache$ = new BehaviorSubject<Supplier[]>([]);
  public suppliers$ = this.suppliersCache$.asObservable();

  /**
   * Get all suppliers
   */
  getSuppliers(activeOnly: boolean = true): Observable<Supplier[]> {
    const params = new HttpParams().set('active_only', activeOnly.toString());

    return this.http.get<Supplier[]>(this.apiUrl, { params }).pipe(
      map(suppliers => suppliers.sort((a, b) => a.name.localeCompare(b.name))),
      tap(suppliers => this.suppliersCache$.next(suppliers))
    );
  }

  /**
   * Get supplier by ID - checks cache first, falls back to API
   */
  getSupplier(id: number): Observable<Supplier> {
    const cached = this.suppliersCache$.getValue().find(s => s.id === id);
    if (cached) {
      return of(cached);
    }

    return this.http.get<Supplier>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create new supplier (staff only)
   */
  createSupplier(supplier: SupplierCreate): Observable<Supplier> {
    return this.http.post<Supplier>(this.apiUrl, supplier);
  }

  /**
   * Update supplier (staff only)
   */
  updateSupplier(id: number, supplier: SupplierUpdate): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.apiUrl}/${id}`, supplier);
  }

  /**
   * Delete supplier (staff only)
   */
  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Clear suppliers cache
   */
  clearCache(): void {
    this.suppliersCache$.next([]);
  }

  getStats(id: number): Observable<SupplierStats> {
    return this.http.get<SupplierStats>(`${this.apiUrl}/${id}/stats`);
  }

  getPayments(id: number): Observable<SupplierPayment[]> {
    return this.http.get<SupplierPayment[]>(`${this.apiUrl}/${id}/payments`);
  }

  addPayment(id: number, payment: SupplierPaymentCreate): Observable<SupplierPayment> {
    return this.http.post<SupplierPayment>(`${this.apiUrl}/${id}/payments`, payment);
  }

  deletePayment(supplierId: number, paymentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${supplierId}/payments/${paymentId}`);
  }

  getProductPrices(id: number, productId?: number): Observable<SupplierProductPrice[]> {
    let params = new HttpParams();
    if (productId) params = params.set('product_id', productId.toString());
    return this.http.get<SupplierProductPrice[]>(`${this.apiUrl}/${id}/product-prices`, { params });
  }

  getPurchaseOrders(id: number): Observable<SupplierPurchaseOrder[]> {
    return this.http.get<SupplierPurchaseOrder[]>(`${this.apiUrl}/${id}/purchase-orders`);
  }

  getProductPriceHistory(productId: number): Observable<ProductPriceHistoryPoint[]> {
    return this.http.get<ProductPriceHistoryPoint[]>(
      `${environment.apiUrl}/products/${productId}/price-history`
    );
  }
}
