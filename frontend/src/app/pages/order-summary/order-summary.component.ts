import { Component, OnInit, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ROUTES } from '../../core/constants/routes.constants';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { ShippingService } from '../../services/shipping.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { StickyFooterComponent } from '../../shared/components/sticky-footer/sticky-footer.component';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';
import { ShippingCostResponse } from '../../models/shipping.model';

export type DeliveryMethod = 'delivery' | 'pickup';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [
    TranslateModule,
    ToastModule,
    DecimalPipe,
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
  private shippingService = inject(ShippingService);
  private router = inject(Router);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  // Constants
  readonly ROUTES = ROUTES;

  // State
  deliveryMethod = signal<DeliveryMethod>('delivery');
  shippingLoading = signal(false);
  shippingResponse = signal<ShippingCostResponse | null>(null);
  shippingError = signal<string | null>(null);
  showShippingDetails = signal(false);

  constructor() {
    // Calculate shipping when delivery method changes to 'delivery'
    effect(() => {
      if (this.deliveryMethod() === 'delivery') {
        this.calculateShipping();
      } else {
        this.shippingResponse.set(null);
        this.shippingError.set(null);
      }
    });
  }

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

  // Computed delivery cost - use API response or 0 for pickup
  deliveryCost = computed(() => {
    if (this.deliveryMethod() === 'pickup') return 0;
    return this.shippingResponse()?.shipping_cost ?? 0;
  });

  // Check if user has location set
  hasUserLocation = computed(() => {
    return !!this.authService.currentUserValue?.h3_index;
  });

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

  // Toggle shipping details
  toggleShippingDetails(): void {
    this.showShippingDetails.update(v => !v);
  }

  // Calculate shipping cost from API
  private calculateShipping(): void {
    const user = this.authService.currentUserValue;

    // If user is not logged in or has no location, show fallback
    if (!user?.h3_index) {
      this.shippingError.set('order_summary.no_location');
      return;
    }

    this.shippingLoading.set(true);
    this.shippingError.set(null);

    // Volume in cart is in liters, API expects m³ (divide by 1000)
    const volumeM3 = this.cartService.totalVolume() / 1000;

    this.shippingService.calculateCost({
      h3_index: user.h3_index,
      weight_kg: this.cartService.totalWeight(),
      volume_m3: volumeM3,
      order_total: this.cartSubtotal()
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.shippingLoading.set(false);
        if (response.deliverable) {
          this.shippingResponse.set(response);
        } else {
          this.shippingError.set('order_summary.not_deliverable');
        }
      },
      error: () => {
        this.shippingLoading.set(false);
        this.shippingError.set('order_summary.shipping_error');
      }
    });
  }

  proceedToCheckout(): void {
    if (this.cartItemCount() === 0) {
      this.toast.showInfo('cart.empty_checkout_message');
      return;
    }

    // Check if delivery is selected but shipping couldn't be calculated
    if (this.deliveryMethod() === 'delivery' && this.shippingError()) {
      this.toast.showError(this.shippingError()!);
      return;
    }

    if (this.authService.isLoggedIn) {
      // Save shipping cost for checkout to use
      this.shippingService.setShippingCost(this.deliveryCost());
      // replaceUrl to keep history clean during checkout flow
      this.router.navigate([ROUTES.CHECKOUT], { replaceUrl: true });
    } else {
      this.toast.showInfo('cart.login_message');
      this.router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: ROUTES.CHECKOUT } });
    }
  }

}
