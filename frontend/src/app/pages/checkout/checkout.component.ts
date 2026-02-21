// src/app/pages/checkout/checkout.component.ts
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../core/constants/routes.constants';
import { AuthService } from '../../services/auth.service';
import { CartService, CartItem } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { CurrencyService } from '../../core/services/currency.service';
import { TranslationService } from '../../services/translation.service';
import { CartTranslationService } from '../../core/services/cart-translation.service';
import { OrderCreate } from '../../models/order.model';
import { User } from '../../models/user.model';
import { AppliedPromotion } from '../../models/promotion.model';
import { VALIDATION, UI_DELAY } from '../../core/constants/app.constants';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { ImageLightboxComponent, LightboxDetails } from '../../shared/components/image-lightbox/image-lightbox.component';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';
import { getCartonCount, getCartonDisplay } from '../../shared/utils/quantity.utils';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ToastModule,
    TranslateModule,
    PageLayoutComponent,
    ImageLightboxComponent,
    CurrencyPipe
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit {
  // Dependency injection
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private translationService = inject(TranslationService);
  private cartTranslation = inject(CartTranslationService);
  private destroyRef = inject(DestroyRef);

  // Constants
  readonly ROUTES = ROUTES;

  // Form
  checkoutForm!: FormGroup;

  // Signals
  loading = signal(true);
  cartItems = signal<CartItem[]>([]);
  currentUser = signal<User | null>(null);
  isSubmitting = signal(false);
  accordionExpanded = signal(false);
  appliedPromotion = signal<AppliedPromotion | null>(null);

  // Lightbox signals
  selectedImage = signal<string | null>(null);
  lightboxTitle = signal<string | null>(null);
  lightboxDetails = signal<LightboxDetails[]>([]);

  // Computed values
  cartItemCount = computed(() => this.cartItems().length);

  cartTotal = computed(() =>
    this.cartItems().reduce((total, item) =>
      total + (item.product_price * item.quantity), 0)
  );

  discountAmount = computed(() =>
    this.appliedPromotion()?.discount_amount || 0
  );

  finalTotal = computed(() =>
    Math.max(0, this.cartTotal() - this.discountAmount())
  );

  ngOnInit() {
    this.checkoutForm = this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(VALIDATION.PHONE_PATTERN)]],
      address: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_ADDRESS_LENGTH)]]
    });

    const user = this.authService.currentUserValue;
    this.currentUser.set(user);

    if (!user) {
      this.toast.showError('checkout.auth_required_message');
      this.router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: ROUTES.CHECKOUT }});
      return;
    }

    // Get cart items
    this.cartService.getCartItems().subscribe(items => {
      this.cartItems.set(items);
      this.loading.set(false);

      if (items.length === 0) {
        this.toast.showInfo('checkout.empty_cart_message');
        this.router.navigate([ROUTES.PRODUCTS]);
        return;
      }

      // Load translated names after loading cart items
      this.loadTranslatedNames();
    });

    // Load applied promotion from cart
    this.appliedPromotion.set(this.cartService.getAppliedPromotion());

    // Subscribe to language changes
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadTranslatedNames();
      });

    // Pre-fill form with user data
    if (user) {
      this.checkoutForm.patchValue({
        fullName: user.full_name,
        phone: user.phone || '',
        address: user.address || ''
      });
    }
  }

  private loadTranslatedNames(): void {
    const items = this.cartItems();
    if (items.length === 0) return;

    this.cartTranslation.loadTranslatedNames(items).subscribe(updatedItems => {
      this.cartItems.set(updatedItems);
    });
  }

  toggleShippingAccordion(): void {
    this.accordionExpanded.update(v => !v);
  }

  placeOrder(): void {
    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      return;
    }

    const user = this.currentUser();
    if (!user) {
      this.toast.showError('checkout.auth_required_message');
      return;
    }

    this.isSubmitting.set(true);

    const orderData: OrderCreate = {
      user_id: user.id,
      shipping_address: this.checkoutForm.value.address,
      contact_phone: this.checkoutForm.value.phone,
      items: this.orderService.cartItemsToOrderItems(this.cartItems()),
      promotion_code: this.appliedPromotion()?.code
    };

    this.orderService.createOrder(orderData).subscribe({
      next: (order) => {
        this.toast.showSuccess('checkout.order_placed_message', { orderNumber: order.id });

        this.cartService.clearCartAndPromotion().subscribe(() => {
          setTimeout(() => {
            this.router.navigate([RouteHelpers.orderDetail(order.id)], {
              queryParams: { success: 'true' }
            });
          }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
        });
      },
      error: (error) => {
        console.error('Error creating order:', error);
        this.isSubmitting.set(false);
        this.toast.showApiError(error, 'checkout.order_error_default');
      }
    });
  }

  // Get carton count based on quantity config
  getCartonCount(item: CartItem): number {
    return getCartonCount(item.quantity, item.quantity_config);
  }

  // Format carton display (e.g., "1x10" for 1 carton of 10 pieces)
  formatCartonCount(item: CartItem): string {
    return getCartonDisplay(item.quantity, item.quantity_config);
  }

  // Image lightbox methods
  openImage(item: CartItem): void {
    if (item.product_image) {
      this.selectedImage.set(item.product_image);
      this.lightboxTitle.set(item.product_name);

      const details: LightboxDetails[] = [
        {
          label: this.translateService.instant('common.quantity'),
          value: this.formatCartonCount(item)
        },
        {
          label: this.translateService.instant('common.price'),
          value: this.currencyService.formatCurrency(item.product_price)
        },
        {
          label: this.translateService.instant('common.total'),
          value: this.currencyService.formatCurrency(item.product_price * item.quantity)
        }
      ];

      this.lightboxDetails.set(details);
    }
  }

  closeImage(): void {
    this.selectedImage.set(null);
    this.lightboxTitle.set(null);
    this.lightboxDetails.set([]);
  }
}
