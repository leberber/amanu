// src/app/pages/checkout/checkout.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { ProgressBarModule } from 'primeng/progressbar';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { CartService, CartItem } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { CurrencyService } from '../../core/services/currency.service';
import { UnitsService } from '../../core/services/units.service';
import { TranslationService } from '../../services/translation.service';
import { CartTranslationService } from '../../core/services/cart-translation.service';
import { OrderCreate } from '../../models/order.model';
import { User } from '../../models/user.model';
import { AppliedPromotion } from '../../models/promotion.model';
import { VALIDATION } from '../../core/constants/app.constants';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    DividerModule,
    TableModule,
    AccordionModule,
    ProgressBarModule,
    BadgeModule,
    TagModule,
    TranslateModule,
    BackButtonComponent,
    CurrencyPipe
  ],
    templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit, OnDestroy {
  checkoutForm!: FormGroup;
  cartItems: CartItem[] = [];
  currentUser: User | null = null;
  isSubmitting = false;
  accordionExpanded = false;
  appliedPromotion: AppliedPromotion | null = null;
  private languageSubscription?: Subscription;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  private translationService = inject(TranslationService);
  private cartTranslation = inject(CartTranslationService);

  toggleShippingAccordion() {
    this.accordionExpanded = !this.accordionExpanded;
  }

  getFormCompletionPercentage() {
    const controls = ['fullName', 'phone', 'address'];
    const completed = controls.filter(control => 
      this.checkoutForm.get(control)?.value?.trim()
    ).length;
    return Math.round((completed / controls.length) * 100);
  }

  ngOnInit() {
    this.checkoutForm = this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(VALIDATION.PHONE_PATTERN)]],
      address: ['', [Validators.required, Validators.minLength(VALIDATION.MIN_ADDRESS_LENGTH)]]
    });
    
    this.currentUser = this.authService.currentUserValue;
    
    if (!this.currentUser) {
      this.toast.showError('checkout.auth_required_message');
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' }});
      return;
    }
    
    // Get cart items
    this.cartService.getCartItems().subscribe(items => {
      this.cartItems = items;

      if (items.length === 0) {
        this.toast.showInfo('checkout.empty_cart_message');
        this.router.navigate(['/products']);
        return;
      }

      // Load translated names after loading cart items
      this.loadTranslatedNames();
    });

    // Load applied promotion from cart
    this.appliedPromotion = this.cartService.getAppliedPromotion();

    // 🆕 NEW: Subscribe to language changes
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      this.loadTranslatedNames();
    });
    
    // Pre-fill form with user data
    if (this.currentUser) {
      this.checkoutForm.patchValue({
        fullName: this.currentUser.full_name,
        phone: this.currentUser.phone || '',
        address: this.currentUser.address || ''
      });
    }
  }

  // 🆕 NEW: Cleanup subscription
  ngOnDestroy() {
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  private loadTranslatedNames(): void {
    if (this.cartItems.length === 0) return;

    this.cartTranslation.loadTranslatedNames(this.cartItems).subscribe(updatedItems => {
      this.cartItems = updatedItems;
    });
  }
  
  // Convenience getter for easy access to form fields
  get f() { return this.checkoutForm.controls; }

  getCartTotal(): number {
    return this.cartItems.reduce((total, item) =>
      total + (item.product_price * item.quantity), 0);
  }

  getDiscountAmount(): number {
    return this.appliedPromotion?.discount_amount || 0;
  }

  getFinalTotal(): number {
    return Math.max(0, this.getCartTotal() - this.getDiscountAmount());
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitDisplay(unit);
  }

  placeOrder() {
    if (this.checkoutForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      this.checkoutForm.markAllAsTouched();
      return;
    }
    
    if (!this.currentUser) {
      this.toast.showError('checkout.auth_required_message');
      return;
    }
    
    this.isSubmitting = true;
    
    // Create order data
    const orderData: OrderCreate = {
      user_id: this.currentUser.id,
      shipping_address: this.checkoutForm.value.address,
      contact_phone: this.checkoutForm.value.phone,
      items: this.orderService.cartItemsToOrderItems(this.cartItems),
      promotion_code: this.appliedPromotion?.code
    };

    // Submit order
    this.orderService.createOrder(orderData).subscribe({
      next: (order) => {
        this.toast.showSuccess('checkout.order_placed_message', { orderNumber: order.id });

        // Clear cart and promotion after successful order
        this.cartService.clearCartAndPromotion().subscribe(() => {
          setTimeout(() => {
            this.router.navigate(['/orders', order.id], {
              queryParams: { success: 'true' }
            });
          }, 1500);
        });
      },
      error: (error) => {
        console.error('Error creating order:', error);
        this.isSubmitting = false;
        this.toast.showApiError(error, 'checkout.order_error_default');
      }
    });
  }

  // Get carton count based on quantity config
  getCartonCount(item: CartItem): number {
    const baseQty = item.quantity_config?.quantities?.[0] || 10;
    return item.quantity / baseQty;
  }

  // Format carton count with leading zeros (e.g., "03x")
  formatCartonCount(item: CartItem): string {
    const count = this.getCartonCount(item);
    return count.toString().padStart(2, '0') + 'x';
  }
}