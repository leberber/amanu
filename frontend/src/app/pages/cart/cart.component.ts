// src/app/pages/cart/cart.component.ts
import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { CartService, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { UnitsService } from '../../core/services/units.service';
import { ProductService } from '../../services/product.service'; // Add this import
import { TranslationService } from '../../services/translation.service'; // Add this import

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    TableModule,
    ToastModule,
    TagModule,
    DividerModule,
    TooltipModule,
    SelectModule,
    TranslateModule
  ],
  providers: [MessageService],
  templateUrl: './cart.component.html',
})
export class CartComponent implements OnInit, OnDestroy {
  // Dependency injection
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  private productService = inject(ProductService); // Add this
  private translationService = inject(TranslationService); // Add this
  
  // Signals
  cartItems = signal<CartItem[]>([]);
  loading = signal(false);
  
  // For quantity selection
  productQuantities: { [key: string]: number } = {};
  
  // Computed values
  cartTotal = computed(() => {
    return this.cartItems().reduce((total, item) => 
      total + (item.product_price * item.quantity), 0);
  });
  
  cartItemCount = computed(() => this.cartItems().length);
  
  // Subscription management
  private cartSubscription?: Subscription;
  private languageSubscription?: Subscription;
  
  ngOnInit() {
    this.loadCart();
    
    // Subscribe to cart changes
    this.cartSubscription = this.cartService.cartItems$.subscribe(items => {
      this.cartItems.set(items);
      // Initialize quantities
      items.forEach(item => {
        this.productQuantities[item.id] = item.quantity;
      });
      
      // 🆕 Load translated names for cart items
      this.loadTranslatedNames();
    });

    // 🆕 Subscribe to language changes
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      console.log('Language changed in cart, reloading translated names...');
      this.loadTranslatedNames();
    });
  }
  
  ngOnDestroy() {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  // 🆕 NEW: Load translated names for cart items
  private loadTranslatedNames(): void {
    const currentItems = this.cartItems();
    if (currentItems.length === 0) return;

    const currentLanguage = this.translationService.getCurrentLanguage();
    
    // Create observables to fetch each product with translations
    const productObservables = currentItems.map(item => 
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
      const updatedItems = currentItems.map(item => {
        const translation = results.find(r => r.cartItemId === item.id);
        if (translation) {
          return {
            ...item,
            product_name: translation.translatedName // Update with translated name
          };
        }
        return item;
      });

      this.cartItems.set(updatedItems);
      console.log('Cart items updated with translations:', updatedItems);
    });
  }
  
  loadCart() {
    this.loading.set(true);
    
    this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems.set(items);
        // Initialize quantities
        items.forEach(item => {
          this.productQuantities[item.id] = item.quantity;
        });
        this.loading.set(false);
        
        // 🆕 Load translated names after loading cart
        this.loadTranslatedNames();
      },
      error: (error) => {
        console.error('Error loading cart:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('cart.errors.failed_to_load')
        });
        this.loading.set(false);
      }
    });
  }
  
  increaseQuantity(item: CartItem) {
    const maxStock = item.stock_quantity || 99;
    if (item.quantity < maxStock) {
      this.updateItemQuantity(item, item.quantity + 1);
    }
  }
  
  decreaseQuantity(item: CartItem) {
    if (item.quantity > 1) {
      this.updateItemQuantity(item, item.quantity - 1);
    }
  }
  
  updateItemQuantity(item: CartItem, newQuantity: number) {
    this.cartService.updateCartItem(item.id, newQuantity).subscribe({
      next: () => {
        // Update the local quantity in productQuantities
        this.productQuantities[item.id] = newQuantity;
      },
      error: (error) => {
        console.error('Error updating quantity:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('cart.errors.update_failed')
        });
        // Reset the select value to match the item's actual quantity
        this.productQuantities[item.id] = item.quantity;
      }
    });
  }
  
  removeItem(itemId: string) {
    this.cartService.removeCartItem(itemId).subscribe({
      next: () => {
        // Clean up the quantities object
        delete this.productQuantities[itemId];
      },
      error: (error) => {
        console.error('Error removing item:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('cart.errors.remove_failed')
        });
      }
    });
  }
  
  clearCart() {
    this.cartService.clearCart().subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('cart.cart_cleared'),
          detail: this.translateService.instant('cart.cart_cleared_message')
        });
        // Reset quantities
        this.productQuantities = {};
      },
      error: (error) => {
        console.error('Error clearing cart:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('cart.errors.clear_failed')
        });
      }
    });
  }
  
  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitDisplay(unit);
  }
  
  getQuantityOptions(maxQuantity: number | undefined, itemId?: string): any[] {
    // Find the item by id
    const item = this.cartItems().find(i => i.id === itemId);
    const unitDisplay = item ? this.getUnitDisplay(item.product_unit) : 'units';
    
    // Generate options with increments of 1 up to maxQuantity (or 99 if not specified)
    const maxStock = maxQuantity || 99;
    return Array.from({ length: Math.min(maxStock, 99) }, (_, i) => {
      const value = i + 1; // Start from 1
      return { 
        label: `${value} ${unitDisplay}`, 
        value 
      };
    });
  }
  
  getSelectedQuantityLabel(itemId: string): string {
    const quantity = this.productQuantities[itemId];
    if (!quantity) return this.translateService.instant('products.product.qty');
    
    const item = this.cartItems().find(i => i.id === itemId);
    if (!item) return `${quantity} units`;
    
    return `${quantity} ${this.getUnitDisplay(item.product_unit)}`;
  }
  
  isOutOfStock(item: CartItem): boolean {
    return item.stock_quantity !== undefined && item.stock_quantity <= 0;
  }
  
  proceedToCheckout() {
    if (this.cartItemCount() === 0) {
      this.messageService.add({
        severity: 'info',
        summary: this.translateService.instant('cart.empty'),
        detail: this.translateService.instant('cart.empty_checkout_message')
      });
      return;
    }
    
    if (this.authService.isLoggedIn) {
      // User is logged in, proceed to checkout
      this.router.navigate(['/checkout']);
    } else {
      // User is not logged in, redirect to login with returnUrl
      this.messageService.add({
        severity: 'info', 
        summary: this.translateService.instant('cart.login_required'), 
        detail: this.translateService.instant('cart.login_message')
      });
      
      // Save the return URL
      this.router.navigate(['/login'], { 
        queryParams: { returnUrl: '/checkout' } 
      });
    }
  }

  // Format price using CurrencyService
  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }
}