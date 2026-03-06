import { Component, OnInit, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES } from '../../core/constants/routes.constants';
import { ANIMATION, UI } from '../../core/constants/ui.constants';
import { CartService, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { TranslationService } from '../../services/translation.service';
import { CartTranslationService } from '../../core/services/cart-translation.service';
import { PromotionService } from '../../services/promotion.service';
import { CrossSellPromotionService } from '../../services/cross-sell-promotion.service';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';
import { StickyFooterComponent } from '../../shared/components/sticky-footer/sticky-footer.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PackagingTypeService } from '../../core/services/packaging-type.service';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';
import { UnitPipe } from '../../shared/pipes/unit.pipe';
import { getCartonCount as calcCartonCount } from '../../shared/utils/quantity.utils';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { isOutOfStock as checkOutOfStock } from '../../shared/utils/stock.utils';


@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    FormsModule,
    ToastModule,
    TooltipModule,
    TranslateModule,
    ButtonModule,
    PageLayoutComponent,
    EmptyStateComponent,
    ImageLightboxComponent,
    StickyFooterComponent,
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
  private translationService = inject(TranslationService);
  private promotionService = inject(PromotionService);
  private crossSellService = inject(CrossSellPromotionService);
  private cartTranslation = inject(CartTranslationService);
  private destroyRef = inject(DestroyRef);

  // Constants
  readonly ROUTES = ROUTES;
  readonly ANIMATION = ANIMATION;
  readonly SKELETON_ITEMS = Array.from({ length: UI.SKELETON_CART_ITEMS }, (_, i) => i);

  // State
  cartItems = signal<CartItem[]>([]);
  loading = signal(false);
  productQuantities: Record<string, number> = {};
  // Computed
  cartSubtotal = this.cartService.subtotal;
  appliedPromotion = this.cartService.appliedPromotion;
  discountAmount = this.cartService.discountAmount;
  crossSellDiscounts = this.cartService.crossSellDiscounts;
  crossSellSavings = this.cartService.crossSellSavings;
  cartItemCount = computed(() => this.cartItems().length);

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

  // Order Summary - Navigate to separate page
  openOrderSummary(): void {
    this.router.navigate([ROUTES.ORDER_SUMMARY]);
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

  // Discount helpers
  getCrossSellDiscount(productId: number) {
    return this.cartService.getCrossSellDiscountForProduct(productId);
  }

  hasDiscount(item: CartItem): boolean {
    return !!item.product_discounted_price || !!this.getCrossSellDiscount(item.product_id);
  }

  getDiscountedTotal(item: CartItem): number {
    // Use discounted price if exists, otherwise original
    const price = item.product_discounted_price ?? item.product_price;
    let total = price * item.quantity;

    // Cross-sell discount on top
    const crossSell = this.getCrossSellDiscount(item.product_id);
    if (crossSell) {
      total -= crossSell.total_discount;
    }

    return total;
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

  private handlePromotionChange(items: CartItem[]): void {
    if (items.length === 0) {
      this.cartService.removePromotion();
      this.cartService.clearCrossSellDiscounts();
    } else {
      this.autoApplyBestPromotion();
      this.calculateCrossSellDiscounts();
    }
  }

  private autoApplyBestPromotion(): void {
    const items = this.cartService.getItemsForDiscount();
    if (items.length === 0) {
      this.cartService.removePromotion();
      return;
    }

    this.promotionService.autoApplyPromotions({ cart_items: items }).subscribe({
      next: (response) => {
        if (response.best_promotion && response.best_discount_amount > 0) {
          this.cartService.applyPromotion({
            code: '',
            promotion: response.best_promotion,
            discount_amount: response.best_discount_amount
          });
        } else {
          this.cartService.removePromotion();
        }
      },
      error: () => this.cartService.removePromotion()
    });
  }

  private calculateCrossSellDiscounts(): void {
    const items = this.cartService.getItemsForCrossSellCalculation();
    if (items.length === 0) {
      this.cartService.clearCrossSellDiscounts();
      return;
    }

    this.crossSellService.calculateDiscounts({ cart_items: items }).subscribe({
      next: (response) => {
        this.cartService.setCrossSellDiscounts(response.cross_sell_discounts);
      },
      error: () => {
        this.cartService.clearCrossSellDiscounts();
      }
    });
  }
}
