import { Component, OnInit, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { Router } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';
import { DrawerModule } from 'primeng/drawer';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ROUTES } from '../../core/constants/routes.constants';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { ShippingService } from '../../services/shipping.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { StickyFooterComponent } from '../../shared/components/sticky-footer/sticky-footer.component';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';
import { ShippingCostResponse } from '../../models/shipping.model';
import { DeliveryType } from '../../models/order.model';

export type DeliveryMethod = 'delivery' | 'pickup';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [
    TranslateModule,
    ToastModule,
    DrawerModule,
    FormsModule,
    DatePickerModule,
    DecimalPipe,
    DatePipe,
    PageLayoutComponent,
    StickyFooterComponent,
    CurrencyDisplayComponent
  ],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss',
  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({ height: '0', opacity: '0' })),
      state('expanded', style({ height: '*', opacity: '1' })),
      transition('collapsed <=> expanded', animate('200ms ease-out'))
    ])
  ]
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
  isLoggedIn = computed(() => this.authService.isLoggedIn);

  // State
  pickupDate: Date | null = null;
  minPickupDate = new Date();
  deliveryMethod = signal<DeliveryMethod>('pickup');
  deliveryType = signal<DeliveryType>('PICKUP');
  shippingLoading = signal(false);
  shippingResponse = signal<ShippingCostResponse | null>(null);
  shippingError = signal<string | null>(null);
  showShippingDetails = signal(false);
  showPricingInfo = signal(false);

  // Can proceed to checkout
  canProceed = computed(() => {
    if (!this.authService.isLoggedIn) return false;
    if (this.deliveryMethod() === 'delivery' && this.shippingError()) return false;
    return true;
  });

  // Computed pricing based on delivery type
  priorityPrice = computed(() => this.shippingResponse()?.priority_price ?? null);
  standardPrice = computed(() => this.shippingResponse()?.standard_price ?? null);
  hasDeliveryOptions = computed(() => !!(this.priorityPrice() || this.standardPrice()));

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
  private discountedSubtotal = this.cartService.discountedSubtotal;
  productSavings = computed(() => this.cartSubtotal() - this.discountedSubtotal());
  discountAmount = this.cartService.discountAmount;
  crossSellSavings = this.cartService.crossSellSavings;
  volumeDiscountSavings = this.cartService.volumeDiscountSavings;
  appliedPromotion = this.cartService.appliedPromotion;
  cartItemCount = computed(() => this.cartItems().length);

  // Computed delivery cost - use selected delivery type pricing or fallback to API response
  deliveryCost = computed(() => {
    if (this.deliveryMethod() === 'pickup') return 0;

    // Use pricing based on selected delivery type
    const type = this.deliveryType();
    if (type === 'PRIORITY' && this.priorityPrice()) {
      return this.priorityPrice()!.cost;
    }
    if (type === 'STANDARD' && this.standardPrice()) {
      return this.standardPrice()!.cost;
    }

    // Fallback to the default shipping cost from response
    return this.shippingResponse()?.shipping_cost ?? 0;
  });

  // Check if user has a saved route (deliverable=true will be returned from API if not)
  hasUserLocation = computed(() => {
    return !!this.authService.currentUserValue?.id;
  });

  // Computed total discount (promo + cross-sell)
  totalDiscount = computed(() => this.discountAmount() + this.crossSellSavings());

  // Computed final total including delivery
  finalTotal = computed(() => {
    const base = this.discountedSubtotal();
    const discount = this.discountAmount();
    const crossSell = this.crossSellSavings();
    const volumeDiscount = this.volumeDiscountSavings();
    const delivery = this.deliveryCost();
    return base - discount - crossSell - volumeDiscount + delivery;
  });

  // Delivery method
  setDeliveryMethod(method: DeliveryMethod): void {
    this.deliveryMethod.set(method);
    if (method === 'pickup') {
      this.deliveryType.set('PICKUP');
    } else {
      this.deliveryType.set('STANDARD');
    }
  }

  // Delivery type (standard vs priority)
  selectDeliveryType(type: DeliveryType): void {
    this.deliveryType.set(type);
  }

  selectTypeAndClose(type: DeliveryType): void {
    this.deliveryType.set(type);
    setTimeout(() => this.showPricingInfo.set(false), 220);
  }

  // Toggle shipping details
  toggleShippingDetails(): void {
    this.showShippingDetails.update(v => !v);
  }

  // Calculate shipping cost from API
  private calculateShipping(): void {
    const user = this.authService.currentUserValue;

    // If user is not logged in, show login message
    if (!user) {
      this.shippingError.set('order_summary.login_required');
      return;
    }

    this.shippingLoading.set(true);
    this.shippingError.set(null);

    // Volume in cart is in liters, API expects m³ (divide by 1000)
    const volumeM3 = this.cartService.totalVolume() / 1000;

    this.shippingService.calculateCost({
      user_id: user.id,
      weight_kg: this.cartService.totalWeight(),
      volume_m3: volumeM3,
      order_total: this.discountedSubtotal()
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

  goToLogin(): void {
    this.router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: ROUTES.ORDER_SUMMARY } });
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
      // Save shipping cost, delivery type, pickup date, and pricing for checkout to use
      this.shippingService.setShippingCost(this.deliveryCost());
      this.shippingService.setDeliveryType(this.deliveryType());
      this.shippingService.setDeliveryPricing(this.priorityPrice(), this.standardPrice());
      this.shippingService.setPickupDate(this.pickupDate);
      // replaceUrl to keep history clean during checkout flow
      this.router.navigate([ROUTES.CHECKOUT], { replaceUrl: true });
    } else {
      this.toast.showInfo('cart.login_message');
      this.router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: ROUTES.CHECKOUT } });
    }
  }

}
