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
import { ProductQuantitySelectorComponent } from '../../shared/components/product-quantity-selector/product-quantity-selector.component';

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
    TranslateModule,
    ProductQuantitySelectorComponent
  ],
  providers: [MessageService],
  templateUrl: './cart.component.html',
  styles: [`
    .quantity-grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
      gap: 0.5rem;
      padding: 1rem 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .qty-grid-item {
      background: var(--surface-50);
      border: 2px solid var(--surface-200);
      border-radius: 8px;
      padding: 0.75rem 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .qty-grid-item:hover {
      background: var(--surface-100);
      border-color: var(--primary-200);
      transform: translateY(-2px);
    }

    .qty-grid-item.selected {
      background: var(--primary-100);
      border-color: var(--primary-500);
      color: var(--primary-700);
    }

    .qty-value {
      font-size: 1rem;
      font-weight: 600;
    }

    .qty-unit {
      opacity: 0.7;
      font-size: 0.75rem;
    }

    /* Mobile specific styles */
    .quantity-grid-container-mobile {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
      gap: 0.25rem;
      padding: 0.5rem 0;
      max-height: 150px;
      overflow-y: auto;
    }

    .qty-grid-item-mobile {
      background: var(--surface-50);
      border: 2px solid var(--surface-200);
      border-radius: 6px;
      padding: 0.5rem 0.25rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.125rem;
    }

    .qty-grid-item-mobile:hover {
      background: var(--surface-100);
      border-color: var(--primary-200);
    }

    .qty-grid-item-mobile.selected {
      background: var(--primary-100);
      border-color: var(--primary-500);
      color: var(--primary-700);
    }
  `]
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
  showQuantityGridForItem: string | null = null;
  
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
      this.updateItemQuantity(item.id, item.quantity + 1);
    }
  }
  
  decreaseQuantity(item: CartItem) {
    if (item.quantity > 1) {
      this.updateItemQuantity(item.id, item.quantity - 1);
    }
  }
  
  updateItemQuantity(itemId: string, newQuantity: number) {
    const item = this.cartItems().find(i => i.id === itemId);
    if (!item) return;
    this.cartService.updateCartItem(itemId, newQuantity).subscribe({
      next: () => {
        // Update the local quantity in productQuantities
        this.productQuantities[itemId] = newQuantity;
      },
      error: (error) => {
        console.error('Error updating quantity:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('cart.errors.update_failed')
        });
        // Reset the select value to match the item's actual quantity
        this.productQuantities[itemId] = item.quantity;
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
        // Clear the local cart items signal immediately
        this.cartItems.set([]);
        // Reset quantities
        this.productQuantities = {};
        
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('cart.cart_cleared'),
          detail: this.translateService.instant('cart.cart_cleared_message')
        });
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
  
  // Quantity grid methods
  getQuantityOptionsForItem(item: CartItem): number[] {
    if (item.quantity_config?.type === 'list' && item.quantity_config.quantities) {
      // Return all available quantities from config
      return item.quantity_config.quantities.filter(qty => 
        !item.stock_quantity || qty <= item.stock_quantity
      );
    }
    
    // Default: generate range from 1 to maxStock
    const maxStock = item.stock_quantity || 99;
    return Array.from({ length: Math.min(maxStock, 20) }, (_, i) => i + 1);
  }
  
  selectQuantityForItem(itemId: string, quantity: number): void {
    this.productQuantities[itemId] = quantity;
  }
  
  updateQuantityAndCloseGrid(item: CartItem): void {
    const newQuantity = this.productQuantities[item.id];
    if (newQuantity !== item.quantity) {
      this.updateItemQuantity(item.id, newQuantity);
    }
    this.showQuantityGridForItem = null;
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