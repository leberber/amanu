// src/app/pages/cart/cart.component.ts
import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { CartService, CartItem } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { UnitsService } from '../../core/services/units.service';
import { ProductService } from '../../services/product.service';
import { TranslationService } from '../../services/translation.service';
import { PromotionService } from '../../services/promotion.service';
import { AppliedPromotion } from '../../models/promotion.model';
import { ProductQuantitySelectorComponent } from '../../shared/components/product-quantity-selector/product-quantity-selector.component';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { ImageLightboxComponent } from '../../shared/components/image-lightbox/image-lightbox.component';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ButtonModule,
    TableModule,
    ToastModule,
    TagModule,
    DividerModule,
    TooltipModule,
    SelectModule,
    InputTextModule,
    TranslateModule,
    ProductQuantitySelectorComponent,
    BackButtonComponent,
    ImageLightboxComponent,
    CurrencyPipe
  ],
    templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit, OnDestroy {
  // Dependency injection
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private toast = inject(ToastMessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  private productService = inject(ProductService);
  private translationService = inject(TranslationService);
  private promotionService = inject(PromotionService);

  // Signals
  cartItems = signal<CartItem[]>([]);
  loading = signal(false);
  selectedImage = signal<string | null>(null);

  // Promotion signals
  promoCode = signal('');
  promoLoading = signal(false);
  promoError = signal<string | null>(null);
  appliedPromotion = signal<AppliedPromotion | null>(null);

  // For quantity selection
  productQuantities: { [key: string]: number } = {};
  showQuantityGridForItem: string | null = null;
  
  // Computed values
  cartSubtotal = computed(() => {
    return this.cartItems().reduce((total, item) =>
      total + (item.product_price * item.quantity), 0);
  });

  // Alias for backward compatibility
  cartTotal = this.cartSubtotal;

  discountAmount = computed(() => {
    const promo = this.appliedPromotion();
    return promo ? promo.discount_amount : 0;
  });

  finalTotal = computed(() => {
    return Math.max(0, this.cartSubtotal() - this.discountAmount());
  });

  cartItemCount = computed(() => this.cartItems().length);

  // Shipping cost (can be modified based on business logic)
  shippingCost = computed(() => {
    return 0;
  });

  isShippingFree = computed(() => this.shippingCost() === 0);

  // RTL detection
  isRTL = computed(() => this.translationService.isRTL());
  
  // Subscription management
  private cartSubscription?: Subscription;
  private languageSubscription?: Subscription;
  private promoSubscription?: Subscription;

  ngOnInit() {
    this.loadCart();

    // Track if this is the first load
    let isFirstLoad = true;

    // Subscribe to cart changes
    this.cartSubscription = this.cartService.cartItems$.subscribe(items => {
      this.cartItems.set(items);
      // Initialize quantities
      items.forEach(item => {
        this.productQuantities[item.id] = item.quantity;
      });

      // Load translated names for cart items
      // Only load on initial load, not on every update
      if (isFirstLoad && items.length > 0) {
        this.loadTranslatedNames();
        isFirstLoad = false;
      }

      // Recalculate discount when cart changes
      const promo = this.appliedPromotion();
      if (promo && items.length > 0) {
        this.recalculateDiscount(promo.code);
      } else if (items.length === 0) {
        this.removePromoCode();
      }
    });

    // Subscribe to language changes
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      if (this.cartItems().length > 0) {
        this.loadTranslatedNames();
      }
    });

    // Subscribe to saved promotion from cart service
    this.promoSubscription = this.cartService.appliedPromotion$.subscribe(promo => {
      this.appliedPromotion.set(promo);
      if (promo) {
        this.promoCode.set(promo.code);
      }
    });
  }
  
  ngOnDestroy() {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
    if (this.promoSubscription) {
      this.promoSubscription.unsubscribe();
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
    
    try {
      this.cartService.getCartItems().subscribe(items => {
        this.cartItems.set(items);
        // Initialize quantities
        items.forEach(item => {
          this.productQuantities[item.id] = item.quantity;
        });
        this.loading.set(false);
        
        // 🆕 Load translated names after loading cart
        if (items.length > 0) {
          this.loadTranslatedNames();
        }
      });
    } catch (error) {
      console.error('Error loading cart:', error);
      this.toast.showError('cart.errors.failed_to_load');
      this.loading.set(false);
    }
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
        
        this.toast.showError('cart.errors.update_failed');
        
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
        
        this.toast.showError('cart.errors.remove_failed');
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
        this.toast.showSuccess('cart.cart_cleared_message');
      },
      error: (error) => {
        console.error('Error clearing cart:', error);
        this.toast.showError('cart.errors.clear_failed');
      }
    });
  }
  
  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit, true);
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
      this.toast.showInfo('cart.empty_checkout_message');
      return;
    }

    if (this.authService.isLoggedIn) {
      // User is logged in, proceed to checkout
      this.router.navigate(['/checkout']);
    } else {
      // User is not logged in, redirect to login with returnUrl
      this.toast.showInfo('cart.login_message');

      // Save the return URL
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/checkout' }
      });
    }
  }

  // Get just the number part of the price
  formatPriceNumber(price: number): string {
    return Math.round(price).toString();
  }

  // Get the currency symbol
  getCurrencySymbol(): string {
    return 'DA';
  }

  // Get carton count based on quantity config
  getCartonCount(item: CartItem): number {
    const baseQty = item.quantity_config?.quantities?.[0] || 10;
    return item.quantity / baseQty;
  }

  // Promotion methods
  applyPromoCode(): void {
    const code = this.promoCode().trim();
    if (!code) {
      this.promoError.set(this.translateService.instant('promotions.enter_code'));
      return;
    }

    this.promoLoading.set(true);
    this.promoError.set(null);

    // Build cart items for discount calculation
    const cartItemsForDiscount = this.cartItems().map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      category_id: item.category_id,
      brand_id: item.brand_id
    }));

    this.promotionService.calculateDiscount({
      promotion_code: code,
      cart_items: cartItemsForDiscount
    }).subscribe({
      next: (response) => {
        this.promoLoading.set(false);

        if (response.error) {
          this.promoError.set(response.error);
          return;
        }

        if (response.promotion && response.discount_amount > 0) {
          const appliedPromo: AppliedPromotion = {
            code: code,
            promotion: response.promotion,
            discount_amount: response.discount_amount
          };
          this.appliedPromotion.set(appliedPromo);
          this.cartService.applyPromotion(appliedPromo);

          this.toast.showSuccess('promotions.discount_applied', {
            amount: this.currencyService.formatCurrency(response.discount_amount)
          });
        } else {
          this.promoError.set(this.translateService.instant('promotions.no_discount'));
        }
      },
      error: (error) => {
        this.promoLoading.set(false);
        this.promoError.set(error?.error?.detail || this.translateService.instant('promotions.invalid_code'));
      }
    });
  }

  removePromoCode(): void {
    this.appliedPromotion.set(null);
    this.promoCode.set('');
    this.promoError.set(null);
    this.cartService.removePromotion();
  }

  private recalculateDiscount(code: string): void {
    const cartItemsForDiscount = this.cartItems().map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      category_id: item.category_id,
      brand_id: item.brand_id
    }));

    this.promotionService.calculateDiscount({
      promotion_code: code,
      cart_items: cartItemsForDiscount
    }).subscribe({
      next: (response) => {
        if (response.promotion && response.discount_amount > 0) {
          const appliedPromo: AppliedPromotion = {
            code: code,
            promotion: response.promotion,
            discount_amount: response.discount_amount
          };
          this.appliedPromotion.set(appliedPromo);
          this.cartService.applyPromotion(appliedPromo);
        } else {
          // Promotion no longer valid for current cart
          this.removePromoCode();
        }
      },
      error: () => {
        this.removePromoCode();
      }
    });
  }

  // Image lightbox
  openImage(imageUrl: string | undefined): void {
    if (imageUrl) {
      this.selectedImage.set(imageUrl);
    }
  }

  closeImage(): void {
    this.selectedImage.set(null);
  }
}