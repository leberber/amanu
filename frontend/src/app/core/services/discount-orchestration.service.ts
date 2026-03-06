import { Injectable, inject, computed, signal } from '@angular/core';
import { forkJoin, of, catchError, map, Observable, tap } from 'rxjs';

import { CartService, CartItem } from '../../services/cart.service';
import { PromotionService } from '../../services/promotion.service';
import { CrossSellPromotionService } from '../../services/cross-sell-promotion.service';
import { VolumeDiscountService, AppliedVolumeDiscount } from '../../services/volume-discount.service';
import { AppliedPromotion } from '../../models/promotion.model';
import { CrossSellDiscountItem } from '../../models/cross-sell-promotion.model';

/**
 * Unified discount type for aggregating all discount sources
 */
export type DiscountSource = 'product' | 'promotion' | 'cross_sell' | 'volume';

export interface AggregatedDiscount {
  source: DiscountSource;
  productId?: number;
  amount: number;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'free_units';
  freeUnits?: number;
}

export interface DiscountSummary {
  subtotal: number;
  productDiscounts: number;
  promotionDiscount: number;
  crossSellDiscount: number;
  volumeDiscount: number;
  totalDiscount: number;
  finalTotal: number;
  freeUnits: number;
  discounts: AggregatedDiscount[];
}

/**
 * Orchestrates all discount calculations for the cart.
 * Provides a unified interface for:
 * - Product promotions (per-item discounts)
 * - Cart promotions (code-based or auto-applied)
 * - Cross-sell promotions (buy X get Y discounted)
 * - Volume discounts (buy X cartons get discount)
 */
@Injectable({ providedIn: 'root' })
export class DiscountOrchestrationService {
  private cartService = inject(CartService);
  private promotionService = inject(PromotionService);
  private crossSellService = inject(CrossSellPromotionService);
  private volumeDiscountService = inject(VolumeDiscountService);

  // Loading state
  private _isCalculating = signal(false);
  readonly isCalculating = this._isCalculating.asReadonly();

  /**
   * Calculate all discounts for current cart items.
   * Returns an observable that completes when all discount calculations are done.
   */
  calculateAllDiscounts(): Observable<DiscountSummary> {
    const items = this.cartService.items();

    if (items.length === 0) {
      this.clearAllDiscounts();
      return of(this.getEmptySummary());
    }

    this._isCalculating.set(true);

    // Run promotion and cross-sell calculations in parallel
    return forkJoin({
      promotion: this.calculatePromotion(items),
      crossSell: this.calculateCrossSell(items),
      volume: of(this.calculateVolume(items)) // Synchronous, uses cached data
    }).pipe(
      tap(({ promotion, crossSell, volume }) => {
        // Apply results to cart service
        if (promotion) {
          this.cartService.applyPromotion(promotion);
        } else {
          this.cartService.removePromotion();
        }

        this.cartService.setCrossSellDiscounts(crossSell);
        this.cartService.setVolumeDiscounts(volume);
      }),
      map(({ promotion, crossSell, volume }) =>
        this.buildSummary(items, promotion, crossSell, volume)
      ),
      tap(() => this._isCalculating.set(false)),
      catchError(error => {
        this._isCalculating.set(false);
        console.error('Discount calculation error:', error);
        return of(this.getEmptySummary());
      })
    );
  }

  /**
   * Clear all applied discounts
   */
  clearAllDiscounts(): void {
    this.cartService.removePromotion();
    this.cartService.clearCrossSellDiscounts();
    this.cartService.clearVolumeDiscounts();
  }

  /**
   * Get current discount summary from cart service state
   */
  getCurrentSummary(): DiscountSummary {
    const items = this.cartService.items();
    const promotion = this.cartService.appliedPromotion();
    const crossSell = this.cartService.crossSellDiscounts();
    const volume = this.cartService.volumeDiscounts();

    return this.buildSummary(items, promotion, crossSell, volume);
  }

  /**
   * Get discount summary as a computed signal
   */
  readonly summary = computed(() => this.getCurrentSummary());

  // ============================================
  // Item-level discount helpers
  // ============================================

  /**
   * Get all discounts for a specific cart item
   */
  getItemDiscounts(item: CartItem): AggregatedDiscount[] {
    const discounts: AggregatedDiscount[] = [];

    // Product promotion (built into item price)
    if (item.product_discounted_price && item.product_discounted_price < item.product_price) {
      const savings = (item.product_price - item.product_discounted_price) * item.quantity;
      discounts.push({
        source: 'product',
        productId: item.product_id,
        amount: savings,
        description: 'Product promotion',
        type: 'fixed_amount'
      });
    }

    // Cross-sell discount
    const crossSell = this.cartService.getCrossSellDiscountForProduct(item.product_id);
    if (crossSell) {
      discounts.push({
        source: 'cross_sell',
        productId: item.product_id,
        amount: crossSell.total_discount,
        description: crossSell.promotion_name,
        type: 'fixed_amount'
      });
    }

    // Volume discount
    const volume = this.cartService.getVolumeDiscountForProduct(item.product_id);
    if (volume) {
      discounts.push({
        source: 'volume',
        productId: item.product_id,
        amount: volume.savedAmount,
        description: volume.discount.name,
        type: volume.discountType,
        freeUnits: volume.freeUnits
      });
    }

    return discounts;
  }

  /**
   * Get discounted total for a specific item (considering all discount types)
   */
  getItemDiscountedTotal(item: CartItem): number {
    // Start with discounted price if available, otherwise original
    const unitPrice = item.product_discounted_price ?? item.product_price;
    let total = unitPrice * item.quantity;

    // Subtract cross-sell discount
    const crossSell = this.cartService.getCrossSellDiscountForProduct(item.product_id);
    if (crossSell) {
      total -= crossSell.total_discount;
    }

    // Subtract volume discount (for percentage/fixed_amount, not free_units)
    const volume = this.cartService.getVolumeDiscountForProduct(item.product_id);
    if (volume && volume.discountType !== 'free_units') {
      total -= volume.savedAmount;
    }

    return Math.max(0, total);
  }

  /**
   * Get original total for item display (for crossed-out price)
   */
  getItemOriginalTotal(item: CartItem): number {
    const volume = this.cartService.getVolumeDiscountForProduct(item.product_id);

    if (volume && volume.discountType === 'free_units') {
      // For free units: show price as if paying for all cartons including free ones
      const piecesPerBox = item.pieces_per_box || 1;
      const orderedCartons = Math.floor(item.quantity / piecesPerBox);
      const freeCartons = Math.floor(volume.freeUnits / piecesPerBox);
      const totalCartons = orderedCartons + freeCartons;
      return totalCartons * piecesPerBox * item.product_price;
    }

    return item.product_price * item.quantity;
  }

  /**
   * Check if item has any discount applied
   */
  itemHasDiscount(item: CartItem): boolean {
    return !!item.product_discounted_price ||
           !!this.cartService.getCrossSellDiscountForProduct(item.product_id) ||
           !!this.cartService.getVolumeDiscountForProduct(item.product_id);
  }

  /**
   * Get total cartons including free units for an item
   */
  getItemTotalCartons(item: CartItem): number {
    const piecesPerBox = item.pieces_per_box || 1;
    const orderedCartons = Math.floor(item.quantity / piecesPerBox);

    const volume = this.cartService.getVolumeDiscountForProduct(item.product_id);
    if (volume && volume.discountType === 'free_units') {
      const freeCartons = Math.floor(volume.freeUnits / piecesPerBox);
      return orderedCartons + freeCartons;
    }

    return orderedCartons;
  }

  // ============================================
  // Private calculation methods
  // ============================================

  private calculatePromotion(items: CartItem[]): Observable<AppliedPromotion | null> {
    const cartItems = items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      category_id: item.category_id,
      brand_id: item.brand_id
    }));

    if (cartItems.length === 0) {
      return of(null);
    }

    return this.promotionService.autoApplyPromotions({ cart_items: cartItems }).pipe(
      map(response => {
        if (response.best_promotion && response.best_discount_amount > 0) {
          return {
            code: '',
            promotion: response.best_promotion,
            discount_amount: response.best_discount_amount
          };
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  private calculateCrossSell(items: CartItem[]): Observable<CrossSellDiscountItem[]> {
    const cartItems = items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      pieces_per_box: item.pieces_per_box || 1
    }));

    if (cartItems.length === 0) {
      return of([]);
    }

    return this.crossSellService.calculateDiscounts({ cart_items: cartItems }).pipe(
      map(response => response.cross_sell_discounts),
      catchError(() => of([]))
    );
  }

  private calculateVolume(items: CartItem[]): AppliedVolumeDiscount[] {
    const cartItems = items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      pieces_per_box: item.pieces_per_box || 1
    }));

    if (cartItems.length === 0) {
      return [];
    }

    return this.volumeDiscountService.calculateDiscounts(cartItems);
  }

  private buildSummary(
    items: CartItem[],
    promotion: AppliedPromotion | null,
    crossSell: CrossSellDiscountItem[],
    volume: AppliedVolumeDiscount[]
  ): DiscountSummary {
    const subtotal = items.reduce((sum, item) => sum + item.product_price * item.quantity, 0);

    // Product-level discounts (already applied to prices)
    const productDiscounts = items.reduce((sum, item) => {
      if (item.product_discounted_price) {
        return sum + (item.product_price - item.product_discounted_price) * item.quantity;
      }
      return sum;
    }, 0);

    const promotionDiscount = promotion?.discount_amount ?? 0;
    const crossSellDiscount = crossSell.reduce((sum, d) => sum + d.total_discount, 0);
    const volumeDiscount = volume.reduce((sum, d) => sum + d.savedAmount, 0);
    const freeUnits = volume.reduce((sum, d) => sum + d.freeUnits, 0);

    const totalDiscount = productDiscounts + promotionDiscount + crossSellDiscount + volumeDiscount;
    const finalTotal = Math.max(0, subtotal - totalDiscount);

    // Build aggregated discounts list
    const discounts: AggregatedDiscount[] = [];

    if (productDiscounts > 0) {
      discounts.push({
        source: 'product',
        amount: productDiscounts,
        description: 'Product promotions',
        type: 'fixed_amount'
      });
    }

    if (promotion && promotionDiscount > 0) {
      discounts.push({
        source: 'promotion',
        amount: promotionDiscount,
        description: promotion.promotion.name,
        type: promotion.promotion.discount_type as 'percentage' | 'fixed_amount'
      });
    }

    crossSell.forEach(d => {
      discounts.push({
        source: 'cross_sell',
        productId: d.target_product_id,
        amount: d.total_discount,
        description: d.promotion_name,
        type: 'fixed_amount'
      });
    });

    volume.forEach(d => {
      discounts.push({
        source: 'volume',
        productId: d.discount.product_id,
        amount: d.savedAmount,
        description: d.discount.name,
        type: d.discountType,
        freeUnits: d.freeUnits
      });
    });

    return {
      subtotal,
      productDiscounts,
      promotionDiscount,
      crossSellDiscount,
      volumeDiscount,
      totalDiscount,
      finalTotal,
      freeUnits,
      discounts
    };
  }

  private getEmptySummary(): DiscountSummary {
    return {
      subtotal: 0,
      productDiscounts: 0,
      promotionDiscount: 0,
      crossSellDiscount: 0,
      volumeDiscount: 0,
      totalDiscount: 0,
      finalTotal: 0,
      freeUnits: 0,
      discounts: []
    };
  }
}
