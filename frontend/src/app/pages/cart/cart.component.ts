import { Component, OnInit, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PackagingTypeService } from '../../core/services/packaging-type.service';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';
import { UnitPipe } from '../../shared/pipes/unit.pipe';
import { getCartonCount as calcCartonCount } from '../../shared/utils/quantity.utils';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { isOutOfStock as checkOutOfStock } from '../../shared/utils/stock.utils';

// Constants
const ANIMATION_DELAY_MS = 50;
const SKELETON_COUNT = 3;

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
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
  // Services
  readonly cartService = inject(CartService);
  readonly lightbox = inject(LightboxService);
  private authService = inject(AuthService);
  private toast = inject(ToastMessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private packagingTypeService = inject(PackagingTypeService);
  private currencyService = inject(CurrencyService);
  private translationService = inject(TranslationService);
  private promotionService = inject(PromotionService);
  private cartTranslation = inject(CartTranslationService);
  private destroyRef = inject(DestroyRef);

  // Constants
  readonly ROUTES = ROUTES;
  readonly ANIMATION_DELAY = ANIMATION_DELAY_MS;
  readonly SKELETON_ITEMS = Array.from({ length: SKELETON_COUNT }, (_, i) => i);

  // State
  cartItems = signal<CartItem[]>([]);
  loading = signal(false);
  productQuantities: Record<string, number> = {};
  promoCode = signal('');
  promoLoading = signal(false);
  promoError = signal<string | null>(null);
  promoInputFocused = signal(false);

  // Computed
  cartSubtotal = this.cartService.subtotal;
  discountAmount = this.cartService.discountAmount;
  finalTotal = this.cartService.finalTotal;
  appliedPromotion = this.cartService.appliedPromotion;
  cartItemCount = computed(() => this.cartItems().length);
  shippingCost = computed(() => 0);
  isShippingFree = computed(() => this.shippingCost() === 0);

  pageSubtitle = computed(() => {
    const count = this.cartItemCount();
    if (count === 0) return '';
    const key = count === 1 ? 'common.item' : 'common.items';
    return `${count} ${this.translateService.instant(key)}`;
  });

  // Private
  private prevTotalQuantity = 0;
  private isFirstLoad = true;

  constructor() {
    effect(() => {
      const items = this.cartService.items();
      this.cartItems.set(items);
      this.syncQuantities(items);

      if (this.isFirstLoad && items.length > 0) {
        this.loadTranslatedNames();
        this.isFirstLoad = false;
      }

      const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
      if (totalQty !== this.prevTotalQuantity) {
        this.prevTotalQuantity = totalQty;
        this.handlePromotionChange(items);
      }
    });

    effect(() => {
      const promo = this.cartService.appliedPromotion();
      if (promo) this.promoCode.set(promo.code);
    });
  }

  ngOnInit(): void {
    this.loadTranslatedNames();
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTranslatedNames());
  }

  // Cart operations
  updateItemQuantity(itemId: string, newQuantity: number): void {
    const item = this.cartItems().find(i => i.id === itemId);
    if (!item) return;

    const updated = this.cartService.updateItem(itemId, newQuantity);
    if (updated) {
      this.productQuantities[itemId] = newQuantity;
    } else {
      this.toast.showError('cart.errors.update_failed');
      this.productQuantities[itemId] = item.quantity;
    }
  }

  removeItem(itemId: string): void {
    if (this.cartService.removeItem(itemId)) {
      delete this.productQuantities[itemId];
    } else {
      this.toast.showError('cart.errors.remove_failed');
    }
  }

  clearCart(): void {
    this.cartService.clear();
    this.productQuantities = {};
    this.toast.showSuccess('cart.cart_cleared_message');
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
      this.router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: ROUTES.CHECKOUT } });
    }
  }

  goToProducts(): void {
    this.router.navigate([ROUTES.PRODUCTS]);
  }

  // Promotion operations
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
          this.cartService.applyPromotion({
            code,
            promotion: response.promotion,
            discount_amount: response.discount_amount
          });
          this.toast.showSuccess('promotions.discount_applied', {
            amount: this.currencyService.formatCurrency(response.discount_amount)
          });
        } else {
          this.promoError.set(this.translateService.instant('promotions.no_discount'));
        }
      },
      error: (err) => {
        this.promoLoading.set(false);
        this.promoError.set(err?.error?.detail || this.translateService.instant('promotions.invalid_code'));
      }
    });
  }

  removePromoCode(): void {
    this.promoCode.set('');
    this.promoError.set(null);
    this.cartService.removePromotion();
  }

  // Item utilities
  isOutOfStock(item: CartItem): boolean {
    return checkOutOfStock(item);
  }

  getCartonCount(item: CartItem): number {
    return calcCartonCount(item.quantity, item.pieces_per_box);
  }

  getQuantityStep(item: CartItem): number {
    return item.pieces_per_box || 1;
  }

  getPackagingTypeForCount(item: CartItem, count: number): string {
    return this.packagingTypeService.getPackagingTypeForCount(item.packaging_type || 'carton', count);
  }

  // Lightbox
  openImage(item: CartItem): void {
    this.lightbox.openImage(item);
  }

  closeImage(): void {
    this.lightbox.closeImage();
  }

  // Private
  private syncQuantities(items: CartItem[]): void {
    items.forEach(item => this.productQuantities[item.id] = item.quantity);
  }

  private loadTranslatedNames(): void {
    const items = this.cartItems();
    if (items.length === 0) return;
    this.cartTranslation.loadTranslatedNames(items).subscribe(updated => this.cartItems.set(updated));
  }

  private getCartItemsForDiscount() {
    return this.cartService.items().map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      category_id: item.category_id,
      brand_id: item.brand_id
    }));
  }

  private handlePromotionChange(items: CartItem[]): void {
    const promo = this.cartService.appliedPromotion();
    if (items.length === 0 && promo) {
      this.removePromoCode();
    } else if (promo && items.length > 0) {
      this.recalculateDiscount(promo.code);
    }
  }

  private recalculateDiscount(code: string): void {
    this.promotionService.calculateDiscount({
      promotion_code: code,
      cart_items: this.getCartItemsForDiscount()
    }).subscribe({
      next: (response) => {
        if (response.promotion && response.discount_amount > 0) {
          this.cartService.applyPromotion({
            code,
            promotion: response.promotion,
            discount_amount: response.discount_amount
          });
        } else {
          this.removePromoCode();
        }
      },
      error: () => this.removePromoCode()
    });
  }
}
