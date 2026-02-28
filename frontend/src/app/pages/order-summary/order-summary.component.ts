import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';

import { ROUTES } from '../../core/constants/routes.constants';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { PromotionService } from '../../services/promotion.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { StickyFooterComponent } from '../../shared/components/sticky-footer/sticky-footer.component';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    ToastModule,
    PageLayoutComponent,
    StickyFooterComponent,
    CurrencyPipe
  ],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss'
})
export class OrderSummaryComponent {
  // Services
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private promotionService = inject(PromotionService);
  private toast = inject(ToastMessageService);

  // Constants
  readonly ROUTES = ROUTES;

  // State
  promoCode = signal('');
  promoLoading = signal(false);
  promoError = signal<string | null>(null);
  promoInputFocused = signal(false);

  // Computed from CartService
  cartItems = this.cartService.items;
  cartSubtotal = this.cartService.subtotal;
  discountAmount = this.cartService.discountAmount;
  finalTotal = this.cartService.finalTotal;
  appliedPromotion = this.cartService.appliedPromotion;
  cartItemCount = computed(() => this.cartItems().length);

  constructor() {
    // Sync promo code from cart service
    const promo = this.cartService.appliedPromotion();
    if (promo) {
      this.promoCode.set(promo.code);
    }
  }

  // Promo operations
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

  private getCartItemsForDiscount() {
    return this.cartService.items().map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      category_id: item.category_id,
      brand_id: item.brand_id
    }));
  }
}
