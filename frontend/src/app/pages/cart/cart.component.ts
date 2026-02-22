// src/app/pages/cart/cart.component.ts
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../core/constants/routes.constants';
import { CartService, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { TranslationService } from '../../services/translation.service';
import { CartTranslationService } from '../../core/services/cart-translation.service';
import { PromotionService } from '../../services/promotion.service';
import { AppliedPromotion } from '../../models/promotion.model';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';
import { UnitPipe } from '../../shared/pipes/unit.pipe';
import { getCartonCount as calcCartonCount } from '../../shared/utils/quantity.utils';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { isOutOfStock as checkOutOfStock } from '../../shared/utils/stock.utils';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    NgClass,
    RouterLink,
    FormsModule,
    TableModule,
    ToastModule,
    TooltipModule,
    TranslateModule,
    ButtonModule,
    PageLayoutComponent,
    EmptyStateComponent,
    ImageLightboxComponent,
    CurrencyPipe,
    UnitPipe,
    ImageFallbackDirective
  ],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  // Dependency injection
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private toast = inject(ToastMessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private translationService = inject(TranslationService);
  private promotionService = inject(PromotionService);
  private cartTranslation = inject(CartTranslationService);
  private destroyRef = inject(DestroyRef);
  readonly lightbox = inject(LightboxService);

  // Constants
  readonly ROUTES = ROUTES;

  // Signals
  cartItems = signal<CartItem[]>([]);
  loading = signal(true);

  // Promotion signals
  promoCode = signal('');
  promoLoading = signal(false);
  promoError = signal<string | null>(null);
  appliedPromotion = signal<AppliedPromotion | null>(null);

  // For quantity selection
  productQuantities: { [key: string]: number } = {};

  // Computed values
  cartSubtotal = computed(() => {
    return this.cartItems().reduce((total, item) =>
      total + (item.product_price * item.quantity), 0);
  });

  discountAmount = computed(() => {
    const promo = this.appliedPromotion();
    return promo ? promo.discount_amount : 0;
  });

  finalTotal = computed(() => {
    return Math.max(0, this.cartSubtotal() - this.discountAmount());
  });

  cartItemCount = computed(() => this.cartItems().length);

  shippingCost = computed(() => 0);

  isShippingFree = computed(() => this.shippingCost() === 0);

  ngOnInit() {
    this.loadCart();

    let isFirstLoad = true;

    // Subscribe to cart changes
    this.cartService.cartItems$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        this.cartItems.set(items);
        items.forEach(item => {
          this.productQuantities[item.id] = item.quantity;
        });

        if (isFirstLoad && items.length > 0) {
          this.loadTranslatedNames();
          isFirstLoad = false;
        }

        const promo = this.appliedPromotion();
        if (promo && items.length > 0) {
          this.recalculateDiscount(promo.code);
        } else if (items.length === 0) {
          this.removePromoCode();
        }
      });

    // Subscribe to language changes
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.cartItems().length > 0) {
          this.loadTranslatedNames();
        }
      });

    // Subscribe to saved promotion
    this.cartService.appliedPromotion$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(promo => {
        this.appliedPromotion.set(promo);
        if (promo) {
          this.promoCode.set(promo.code);
        }
      });
  }

  private loadTranslatedNames(): void {
    const currentItems = this.cartItems();
    if (currentItems.length === 0) return;

    this.cartTranslation.loadTranslatedNames(currentItems).subscribe(updatedItems => {
      this.cartItems.set(updatedItems);
    });
  }

  loadCart(): void {
    this.loading.set(true);

    this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems.set(items);
        items.forEach(item => {
          this.productQuantities[item.id] = item.quantity;
        });
        this.loading.set(false);

        if (items.length > 0) {
          this.loadTranslatedNames();
        }
      },
      error: () => {
        this.toast.showError('cart.errors.failed_to_load');
        this.loading.set(false);
      }
    });
  }

  updateItemQuantity(itemId: string, newQuantity: number): void {
    const item = this.cartItems().find(i => i.id === itemId);
    if (!item) return;

    this.cartService.updateCartItem(itemId, newQuantity).subscribe({
      next: () => {
        this.productQuantities[itemId] = newQuantity;
      },
      error: () => {
        this.toast.showError('cart.errors.update_failed');
        this.productQuantities[itemId] = item.quantity;
      }
    });
  }

  removeItem(itemId: string): void {
    this.cartService.removeCartItem(itemId).subscribe({
      next: () => {
        delete this.productQuantities[itemId];
      },
      error: () => {
        this.toast.showError('cart.errors.remove_failed');
      }
    });
  }

  clearCart(): void {
    this.cartService.clearCart().subscribe({
      next: () => {
        this.cartItems.set([]);
        this.productQuantities = {};
        this.toast.showSuccess('cart.cart_cleared_message');
      },
      error: () => {
        this.toast.showError('cart.errors.clear_failed');
      }
    });
  }

  isOutOfStock(item: CartItem): boolean {
    return checkOutOfStock(item);
  }

  getCartonCount(item: CartItem): number {
    return calcCartonCount(item.quantity, item.pieces_per_box);
  }

  getQuantityStep(item: CartItem): number {
    return item.pieces_per_box || 1;
  }

  // Get packaging type label based on count (singular or plural)
  getPackagingTypeForCount(item: CartItem, count: number): string {
    const type = (item.packaging_type || 'carton').toLowerCase();
    const suffix = count === 1 ? '' : '_plural';
    return this.translateService.instant(`products.product.packaging_types.${type}${suffix}`);
  }

  proceedToCheckout(): void {
    if (this.cartItemCount() === 0) {
      this.toast.showInfo('cart.empty_checkout_message');
      return;
    }

    if (this.authService.isLoggedIn) {
      this.router.navigate([ROUTES.CHECKOUT]);
    } else {
      this.toast.showInfo('cart.login_message');
      this.router.navigate([ROUTES.LOGIN], {
        queryParams: { returnUrl: ROUTES.CHECKOUT }
      });
    }
  }

  // Promotion methods
  private getCartItemsForDiscount() {
    return this.cartItems().map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      category_id: item.category_id,
      brand_id: item.brand_id
    }));
  }

  applyPromoCode(): void {
    const code = this.promoCode().trim();
    if (!code) {
      this.promoError.set(this.translateService.instant('promotions.enter_code'));
      return;
    }

    this.promoLoading.set(true);
    this.promoError.set(null);

    this.promotionService.calculateDiscount({
      promotion_code: code,
      cart_items: this.getCartItemsForDiscount()
    }).subscribe({
      next: (response) => {
        this.promoLoading.set(false);

        if (response.error) {
          this.promoError.set(response.error);
          return;
        }

        if (response.promotion && response.discount_amount > 0) {
          const appliedPromo: AppliedPromotion = {
            code: code,
            promotion: response.promotion,
            discount_amount: response.discount_amount
          };
          this.appliedPromotion.set(appliedPromo);
          this.cartService.applyPromotion(appliedPromo);

          this.toast.showSuccess('promotions.discount_applied', {
            amount: this.currencyService.formatCurrency(response.discount_amount)
          });
        } else {
          this.promoError.set(this.translateService.instant('promotions.no_discount'));
        }
      },
      error: (error) => {
        this.promoLoading.set(false);
        this.promoError.set(error?.error?.detail || this.translateService.instant('promotions.invalid_code'));
      }
    });
  }

  removePromoCode(): void {
    this.appliedPromotion.set(null);
    this.promoCode.set('');
    this.promoError.set(null);
    this.cartService.removePromotion();
  }

  private recalculateDiscount(code: string): void {
    this.promotionService.calculateDiscount({
      promotion_code: code,
      cart_items: this.getCartItemsForDiscount()
    }).subscribe({
      next: (response) => {
        if (response.promotion && response.discount_amount > 0) {
          const appliedPromo: AppliedPromotion = {
            code: code,
            promotion: response.promotion,
            discount_amount: response.discount_amount
          };
          this.appliedPromotion.set(appliedPromo);
          this.cartService.applyPromotion(appliedPromo);
        } else {
          this.removePromoCode();
        }
      },
      error: () => {
        this.removePromoCode();
      }
    });
  }

  // Image lightbox
  openImage(item: CartItem): void {
    this.lightbox.openImage(item);
  }

  closeImage(): void {
    this.lightbox.closeImage();
  }

  // Navigate to products
  goToProducts(): void {
    this.router.navigate([ROUTES.PRODUCTS]);
  }
}
