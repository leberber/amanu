// src/app/pages/checkout/checkout.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { ProgressBarModule } from 'primeng/progressbar';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { CartService, CartItem } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { CurrencyService } from '../../core/services/currency.service';
import { ProductService } from '../../services/product.service'; // 🆕 ADD THIS
import { TranslationService } from '../../services/translation.service'; // 🆕 ADD THIS
import { OrderCreate } from '../../models/order.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
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
    TranslateModule
  ],
  providers: [MessageService],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent implements OnInit, OnDestroy {
  checkoutForm: FormGroup;
  cartItems: CartItem[] = [];
  currentUser: User | null = null;
  isSubmitting = false;
  accordionExpanded = false;

  // 🆕 NEW: Subscription management
  private languageSubscription?: Subscription;

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

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private cartService: CartService,
    private orderService: OrderService,
    private messageService: MessageService,
    private translateService: TranslateService,
    private currencyService: CurrencyService,
    private productService: ProductService, // 🆕 ADD THIS
    private translationService: TranslationService // 🆕 ADD THIS
  ) {
    this.checkoutForm = this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]+$/)]],
      address: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit() {
    // Get current user
    this.currentUser = this.authService.currentUserValue;
    
    if (!this.currentUser) {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant('checkout.auth_required'),
        detail: this.translateService.instant('checkout.auth_required_message')
      });
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' }});
      return;
    }
    
    // Get cart items
    this.cartService.getCartItems().subscribe(items => {
      this.cartItems = items;
      
      if (items.length === 0) {
        this.messageService.add({
          severity: 'info',
          summary: this.translateService.instant('checkout.empty_cart'),
          detail: this.translateService.instant('checkout.empty_cart_message')
        });
        this.router.navigate(['/products']);
        return;
      }

      // 🆕 Load translated names after loading cart items
      this.loadTranslatedNames();
    });

    // 🆕 NEW: Subscribe to language changes
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      console.log('Language changed in checkout, reloading translated names...');
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

  // 🆕 NEW: Load translated names for cart items
  private loadTranslatedNames(): void {
    if (this.cartItems.length === 0) return;

    const currentLanguage = this.translationService.getCurrentLanguage();
    
    // Create observables to fetch each product with translations
    const productObservables = this.cartItems.map(item => 
      this.productService.getProduct(item.product_id).pipe(
        map(product => ({
          cartItemId: item.id,
          translatedName: product.name, // This will be translated by the API
          translatedDescription: product.description || ''
        })),
        catchError(error => {
          console.error(`Error loading product ${item.product_id}:`, error);
          return of({
            cartItemId: item.id,
            translatedName: item.product_name, // Fallback to original name
            translatedDescription: ''
          });
        })
      )
    );

    // Execute all requests in parallel
    forkJoin(productObservables).subscribe(results => {
      // Update cart items with translated names
      this.cartItems = this.cartItems.map(item => {
        const translation = results.find(r => r.cartItemId === item.id);
        if (translation) {
          return {
            ...item,
            product_name: translation.translatedName // Update with translated name
          };
        }
        return item;
      });

      console.log('Checkout cart items updated with translations:', this.cartItems);
    });
  }
  
  // Convenience getter for easy access to form fields
  get f() { return this.checkoutForm.controls; }

  getCartTotal(): number {
    return this.cartItems.reduce((total, item) => 
      total + (item.product_price * item.quantity), 0);
  }

  getUnitDisplay(unit: string): string {
    switch (unit) {
      case 'kg': return 'Kg';
      case 'gram': return 'g';
      case 'piece': return 'Piece';
      case 'bunch': return 'Bunch';
      case 'dozen': return 'Dozen';
      case 'pound': return 'lb';
      default: return unit;
    }
  }

  placeOrder() {
    if (this.checkoutForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      this.checkoutForm.markAllAsTouched();
      return;
    }
    
    if (!this.currentUser) {
      this.messageService.add({
        severity: 'error',
        summary: this.translateService.instant('checkout.auth_required'),
        detail: this.translateService.instant('checkout.auth_required_message')
      });
      return;
    }
    
    this.isSubmitting = true;
    
    // Create order data
    const orderData: OrderCreate = {
      user_id: this.currentUser.id,
      shipping_address: this.checkoutForm.value.address,
      contact_phone: this.checkoutForm.value.phone,
      items: this.orderService.cartItemsToOrderItems(this.cartItems)
    };
    
    // Submit order
    this.orderService.createOrder(orderData).subscribe({
      next: (order) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('checkout.order_placed'),
          detail: this.translateService.instant('checkout.order_placed_message', { orderNumber: order.id })
        });
        
        // Clear cart after successful order
        this.cartService.clearCart().subscribe(() => {
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
        
        let errorMessage = this.translateService.instant('checkout.order_error_default');
        
        if (error.error && error.error.detail) {
          errorMessage = error.error.detail;
        }
        
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('checkout.order_error'),
          detail: errorMessage
        });
      }
    });
  }

  // Format price using CurrencyService
  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }
}