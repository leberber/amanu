import { Injectable, inject, signal, DestroyRef, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CrossSellPromotionService } from '../../services/cross-sell-promotion.service';
import { CrossSellPromotion } from '../../models/cross-sell-promotion.model';
import { CartService, CartItem } from '../../services/cart.service';
import { CurrencyService } from './currency.service';

export type CrossSellNotificationType = 'potential_discount' | 'discount_earned';

export interface CrossSellNotification {
  id: string;
  type: CrossSellNotificationType;
  targetProductName: string;
  triggerProductNames: string[];
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  savingsAmount?: number; // For 'discount_earned' type
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class CrossSellNotificationService implements OnDestroy {
  private readonly crossSellService = inject(CrossSellPromotionService);
  private readonly cartService = inject(CartService);
  private readonly currencyService = inject(CurrencyService);
  private readonly destroyRef = inject(DestroyRef);

  // Active cross-sell promotions cache
  private promotions = signal<CrossSellPromotion[]>([]);
  private promotionsLoaded = signal(false);

  // Current notification state
  readonly currentNotification = signal<CrossSellNotification | null>(null);
  readonly isVisible = signal(false);

  // Auto-dismiss timeout
  private dismissTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly AUTO_DISMISS_MS = 5000;

  constructor() {
    this.loadPromotions();
  }

  ngOnDestroy(): void {
    this.clearTimeout();
  }

  /**
   * Load active cross-sell promotions
   */
  private loadPromotions(): void {
    this.crossSellService.getActivePromotionsPublic()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          this.promotions.set(promotions);
          this.promotionsLoaded.set(true);
        },
        error: () => {
          this.promotionsLoaded.set(true);
        }
      });
  }

  /**
   * Check and show notification when a product is added to cart
   * @param productId The product being added
   * @param productName The product name
   */
  checkAndNotify(productId: number, productName: string): void {
    if (!this.promotionsLoaded()) return;

    const promotions = this.promotions();
    const cartItems = this.cartService.items();

    // Scenario 1: Adding a TARGET product
    const asTargetPromo = promotions.find(p => p.target_product_id === productId);
    if (asTargetPromo) {
      // Check if any trigger product is already in cart - discount is active!
      const triggerInCart = cartItems.find(item =>
        asTargetPromo.trigger_product_ids.includes(item.product_id)
      );

      if (triggerInCart) {
        // Trigger already in cart - show "You saved!" message
        const targetItem: CartItem = {
          id: '',
          product_id: productId,
          product_name: productName,
          product_price: cartItems.find(i => i.product_id === productId)?.product_price || 0,
          product_unit: '',
          quantity: cartItems.find(i => i.product_id === productId)?.quantity || 1
        };
        this.showDiscountEarnedNotification(asTargetPromo, targetItem, triggerInCart.product_name);
      } else {
        // No trigger in cart - show "Get discount if you buy..." message
        this.showPotentialDiscountNotification(asTargetPromo, productName);
      }
      return;
    }

    // Scenario 2: Adding a TRIGGER product when TARGET is already in cart
    const asTriggerPromos = promotions.filter(p => p.trigger_product_ids.includes(productId));
    for (const promo of asTriggerPromos) {
      const targetInCart = cartItems.find(item => item.product_id === promo.target_product_id);
      if (targetInCart) {
        this.showDiscountEarnedNotification(promo, targetInCart, productName);
        return;
      }
    }
  }

  /**
   * Show notification: "Get X% off [product] if you buy [triggers]"
   */
  private showPotentialDiscountNotification(promo: CrossSellPromotion, targetProductName: string): void {
    const notification: CrossSellNotification = {
      id: Date.now().toString(),
      type: 'potential_discount',
      targetProductName,
      triggerProductNames: promo.trigger_product_names || [],
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      timestamp: Date.now()
    };

    this.showNotification(notification);
  }

  /**
   * Show notification: "You saved X on [target]!"
   */
  private showDiscountEarnedNotification(
    promo: CrossSellPromotion,
    targetItem: CartItem,
    triggerProductName: string
  ): void {
    // Calculate savings based on target item
    let savingsAmount = 0;
    const targetPrice = targetItem.product_price;
    const targetQuantity = targetItem.quantity;

    if (promo.discount_type === 'percentage') {
      savingsAmount = (targetPrice * targetQuantity * promo.discount_value) / 100;
    } else {
      savingsAmount = promo.discount_value * targetQuantity;
    }

    const notification: CrossSellNotification = {
      id: Date.now().toString(),
      type: 'discount_earned',
      targetProductName: promo.target_product_name || targetItem.product_name,
      triggerProductNames: [triggerProductName],
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      savingsAmount,
      timestamp: Date.now()
    };

    this.showNotification(notification);
  }

  /**
   * Display notification
   */
  private showNotification(notification: CrossSellNotification): void {
    this.clearTimeout();
    this.currentNotification.set(notification);
    this.isVisible.set(true);

    // Auto-dismiss after timeout
    this.dismissTimeout = setTimeout(() => {
      this.dismiss();
    }, this.AUTO_DISMISS_MS);
  }

  /**
   * Dismiss current notification
   */
  dismiss(): void {
    this.clearTimeout();
    this.isVisible.set(false);
    // Delay clearing notification to allow exit animation
    setTimeout(() => {
      if (!this.isVisible()) {
        this.currentNotification.set(null);
      }
    }, 300);
  }

  /**
   * Format currency for display
   */
  formatCurrency(value: number): string {
    return this.currencyService.formatCurrency(value);
  }

  private clearTimeout(): void {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }
  }
}
