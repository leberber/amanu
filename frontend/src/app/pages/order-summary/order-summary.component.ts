import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';

import { ROUTES } from '../../core/constants/routes.constants';
import { SHIPPING } from '../../core/constants/order.constants';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { StickyFooterComponent } from '../../shared/components/sticky-footer/sticky-footer.component';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';

export type DeliveryMethod = 'delivery' | 'pickup';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [
    TranslateModule,
    ToastModule,
    PageLayoutComponent,
    StickyFooterComponent,
    CurrencyPipe
  ],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss'
})
export class OrderSummaryComponent implements OnInit {
  // Services
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastMessageService);

  // Constants
  readonly ROUTES = ROUTES;
  readonly SHIPPING = SHIPPING;

  // State
  deliveryMethod = signal<DeliveryMethod>('delivery');

  ngOnInit(): void {
    // Redirect to products if cart is empty (e.g., after order placed and user presses back)
    if (this.cartService.items().length === 0) {
      this.router.navigate([ROUTES.PRODUCTS], { replaceUrl: true });
    }
  }

  // Computed from CartService
  cartItems = this.cartService.items;
  cartSubtotal = this.cartService.subtotal;
  discountAmount = this.cartService.discountAmount;
  crossSellSavings = this.cartService.crossSellSavings;
  appliedPromotion = this.cartService.appliedPromotion;
  cartItemCount = computed(() => this.cartItems().length);

  // Computed delivery cost
  deliveryCost = computed(() => this.deliveryMethod() === 'delivery' ? SHIPPING.STANDARD_COST : 0);

  // Computed total discount (promo + cross-sell)
  totalDiscount = computed(() => this.discountAmount() + this.crossSellSavings());

  // Computed final total including delivery
  finalTotal = computed(() => {
    const subtotal = this.cartSubtotal();
    const discount = this.discountAmount();
    const crossSell = this.crossSellSavings();
    const delivery = this.deliveryCost();
    return subtotal - discount - crossSell + delivery;
  });

  // Delivery method
  setDeliveryMethod(method: DeliveryMethod): void {
    this.deliveryMethod.set(method);
  }

  proceedToCheckout(): void {
    if (this.cartItemCount() === 0) {
      this.toast.showInfo('cart.empty_checkout_message');
      return;
    }

    if (this.authService.isLoggedIn) {
      // replaceUrl to keep history clean during checkout flow
      this.router.navigate([ROUTES.CHECKOUT], { replaceUrl: true });
    } else {
      this.toast.showInfo('cart.login_message');
      this.router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: ROUTES.CHECKOUT } });
    }
  }

}
