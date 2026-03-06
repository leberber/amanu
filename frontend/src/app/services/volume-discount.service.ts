import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, interval, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { VolumeDiscount, VolumeDiscountCreate, VolumeDiscountUpdate } from '../models/volume-discount.model';
import { CACHE_TTL, isCacheExpired } from '../core/constants/cache.constants';

export interface AppliedVolumeDiscount {
  discount: VolumeDiscount;
  freeUnits: number;
  savedAmount: number;
  discountType: 'percentage' | 'fixed_amount' | 'free_units';
}

export interface CartItemForDiscount {
  product_id: number;
  quantity: number;
  unit_price: number;
  pieces_per_box: number;
}

@Injectable({
  providedIn: 'root'
})
export class VolumeDiscountService implements OnDestroy {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/volume-discounts`;

  // Cache for active volume discounts
  private cachedDiscounts = signal<VolumeDiscount[]>([]);
  private lastFetchTime: number | null = null;
  private refreshSubscription: Subscription | null = null;
  private initialized = false;

  /**
   * Initialize the service - fetch data and start auto-refresh
   * Call this once from AppComponent
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Initial fetch
    this.fetchAndCache();

    // Set up auto-refresh every 20 minutes
    this.refreshSubscription = interval(CACHE_TTL.VOLUME_DISCOUNTS).subscribe(() => {
      this.fetchAndCache();
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  private fetchAndCache(): void {
    this.getActive().subscribe({
      next: (discounts) => {
        this.cachedDiscounts.set(discounts);
        this.lastFetchTime = Date.now();
      },
      error: () => {
        // Silent fail - keep existing cache
      }
    });
  }

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

  // ============================================
  // Cached Methods for Cart Integration
  // ============================================

  /**
   * Get active volume discounts with caching (TTL: 20 minutes)
   * Use this method in the cart for efficient lookups
   */
  getActiveCached(): Observable<VolumeDiscount[]> {
    // Return cached data if still valid
    if (!isCacheExpired(this.lastFetchTime, CACHE_TTL.VOLUME_DISCOUNTS)) {
      return of(this.cachedDiscounts());
    }

    // Fetch fresh data and cache it
    return this.getActive().pipe(
      tap(discounts => {
        this.cachedDiscounts.set(discounts);
        this.lastFetchTime = Date.now();
      })
    );
  }

  /**
   * Force refresh the cache (useful after admin changes)
   */
  refreshCache(): Observable<VolumeDiscount[]> {
    this.lastFetchTime = null;
    return this.getActiveCached();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cachedDiscounts.set([]);
    this.lastFetchTime = null;
  }

  /**
   * Get cached discounts synchronously (for calculations)
   * Returns empty array if not yet fetched
   */
  getCachedDiscounts(): VolumeDiscount[] {
    return this.cachedDiscounts();
  }

  /**
   * Check if cache needs refresh
   */
  needsRefresh(): boolean {
    return isCacheExpired(this.lastFetchTime, CACHE_TTL.VOLUME_DISCOUNTS);
  }

  // ============================================
  // Discount Calculation Methods
  // ============================================

  /**
   * Calculate applicable volume discounts for cart items
   * Call this after fetching cached discounts
   */
  calculateDiscounts(cartItems: CartItemForDiscount[]): AppliedVolumeDiscount[] {
    const discounts = this.cachedDiscounts();
    const appliedDiscounts: AppliedVolumeDiscount[] = [];

    for (const item of cartItems) {
      // Convert quantity to cartons for comparison (min_quantity is in cartons)
      const cartonsOrdered = Math.floor(item.quantity / item.pieces_per_box);

      // Find applicable discount for this product
      const discount = discounts.find(d =>
        d.product_id === item.product_id &&
        cartonsOrdered >= d.min_quantity
      );

      if (discount) {
        const applied = this.calculateSingleDiscount(discount, item, cartonsOrdered);
        if (applied) {
          appliedDiscounts.push(applied);
        }
      }
    }

    return appliedDiscounts;
  }

  /**
   * Calculate discount for a single cart item
   */
  private calculateSingleDiscount(
    discount: VolumeDiscount,
    item: CartItemForDiscount,
    cartonsOrdered: number
  ): AppliedVolumeDiscount | null {
    // Calculate how many qualifying sets (e.g., if min is 3 cartons and ordered 6, sets = 2)
    const sets = Math.floor(cartonsOrdered / discount.min_quantity);

    switch (discount.discount_type) {
      case 'percentage': {
        const totalPrice = item.quantity * item.unit_price;
        const savedAmount = totalPrice * (discount.discount_value / 100);
        return {
          discount,
          freeUnits: 0,
          savedAmount,
          discountType: 'percentage'
        };
      }

      case 'fixed_amount': {
        // Fixed amount discount per qualifying set (e.g., buy 3 cartons, get 50 DZD off total)
        const savedAmount = sets * discount.discount_value;
        return {
          discount,
          freeUnits: 0,
          savedAmount,
          discountType: 'fixed_amount'
        };
      }

      case 'free_units': {
        // Free cartons per qualifying set (e.g., buy 5 cartons get 1 free)
        // discount_value is in cartons, convert to pieces for savedAmount
        const freeCartons = sets * discount.discount_value;
        const freeUnits = freeCartons * item.pieces_per_box;
        const savedAmount = freeUnits * item.unit_price;
        return {
          discount,
          freeUnits,
          savedAmount,
          discountType: 'free_units'
        };
      }

      default:
        return null;
    }
  }

  /**
   * Get total savings from all applied discounts
   */
  getTotalSavings(appliedDiscounts: AppliedVolumeDiscount[]): number {
    return appliedDiscounts.reduce((total, d) => total + d.savedAmount, 0);
  }

  /**
   * Get total free units from all applied discounts
   */
  getTotalFreeUnits(appliedDiscounts: AppliedVolumeDiscount[]): number {
    return appliedDiscounts.reduce((total, d) => total + d.freeUnits, 0);
  }
}
