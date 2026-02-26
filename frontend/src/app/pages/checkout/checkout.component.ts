import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastModule } from 'primeng/toast';
import { TranslateModule } from '@ngx-translate/core';

import { ROUTES, RouteHelpers } from '../../core/constants/routes.constants';
import { AuthService } from '../../services/auth.service';
import { CartService, CartItem } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { TranslationService } from '../../services/translation.service';
import { CartTranslationService } from '../../core/services/cart-translation.service';
import { LightboxService } from '../../core/services/lightbox.service';
import { OrderCreate } from '../../models/order.model';
import { User } from '../../models/user.model';
import { VALIDATION, UI_DELAY } from '../../core/constants/app.constants';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { getCartonDisplay } from '../../shared/utils/quantity.utils';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ToastModule,
    TranslateModule,
    PageLayoutComponent,
    ImageLightboxComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    CurrencyPipe,
    ImageFallbackDirective
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit {
  // Services
  readonly lightbox = inject(LightboxService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private toast = inject(ToastMessageService);
  private translationService = inject(TranslationService);
  private cartTranslation = inject(CartTranslationService);
  private destroyRef = inject(DestroyRef);

  // Constants
  readonly ROUTES = ROUTES;
  readonly SKELETON_ITEMS = [1, 2, 3];
  readonly SKELETON_SIDEBAR_ITEMS = [1, 2, 3];

  // Form
  checkoutForm!: FormGroup;

  // State
  cartItems = signal<CartItem[]>([]);
  currentUser = signal<User | null>(null);
  isSubmitting = signal(false);
  loading = signal(true);
  error = signal(false);

  // Computed from service
  cartItemCount = computed(() => this.cartItems().length);
  cartTotal = this.cartService.subtotal;
  discountAmount = this.cartService.discountAmount;
  finalTotal = this.cartService.finalTotal;
  appliedPromotion = this.cartService.appliedPromotion;

  ngOnInit(): void {
    this.initForm();
    this.checkAuthentication();
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
        this.cartService.clearAll();
        setTimeout(() => {
          this.router.navigate([RouteHelpers.orderDetail(order.id)], { queryParams: { success: 'true' } });
        }, UI_DELAY.TOAST_BEFORE_NAVIGATE);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toast.showApiError(err, 'checkout.order_error_default');
      }
    });
  }

  formatCartonCount(item: CartItem): string {
    return getCartonDisplay(item.quantity, item.pieces_per_box);
  }

  openImage(item: CartItem): void {
    this.lightbox.openImage(item);
  }

  closeImage(): void {
    this.lightbox.closeImage();
  }

  retryLoad(): void {
    this.error.set(false);
    this.loading.set(true);
    this.loadCartItems();
  }

  goBack(): void {
    this.router.navigate([ROUTES.CART]);
  }

  // Private methods
  private initForm(): void {
    this.checkoutForm = this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(VALIDATION.PHONE_PATTERN)]],
      address: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_ADDRESS_LENGTH)]]
    });
  }

  private checkAuthentication(): void {
    const user = this.authService.currentUserValue;
    this.currentUser.set(user);

    if (!user) {
      this.toast.showError('checkout.auth_required_message');
      this.router.navigate([ROUTES.LOGIN], { queryParams: { returnUrl: ROUTES.CHECKOUT } });
      return;
    }

    this.prefillForm(user);
    this.loadCartItems();
    this.subscribeToLanguageChanges();
  }

  private prefillForm(user: User): void {
    this.checkoutForm.patchValue({
      fullName: user.full_name,
      phone: user.phone || '',
      address: user.address || ''
    });
  }

  private loadCartItems(): void {
    const items = this.cartService.items();
    this.cartItems.set(items);
    this.loading.set(false);

    if (items.length === 0) {
      return;
    }

    this.loadTranslatedNames();
  }

  private subscribeToLanguageChanges(): void {
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTranslatedNames());
  }

  private loadTranslatedNames(): void {
    const items = this.cartItems();
    if (items.length === 0) return;
    this.cartTranslation.loadTranslatedNames(items).subscribe(updated => this.cartItems.set(updated));
  }
}
