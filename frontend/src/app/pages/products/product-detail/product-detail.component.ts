// src/app/pages/products/product-detail/product-detail.component.ts
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// PrimeNG imports
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';

// Services and models
import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { UnitsService } from '../../../core/services/units.service';
import { TranslationService } from '../../../services/translation.service';
import { Product } from '../../../models/product.model';
import { Brand } from '../../../models/brand.model';
import { ROUTES } from '../../../core/constants/routes.constants';
import { getDefaultQuantity } from '../../../shared/utils/quantity.utils';
import { FlyToCartService } from '../../../core/services/fly-to-cart.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { BrandService } from '../../../core/services/brand.service';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';
import {
  isOutOfStock as checkOutOfStock,
  isLowStock as checkLowStock
} from '../../../shared/utils/stock.utils';
import {
  formatDiscountLabel,
  getEffectivePrice,
  hasPromotion as checkHasPromotion
} from '../../../shared/utils/discount.utils';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    ToastModule,
    ButtonModule,
    TranslateModule,
    PageLayoutComponent,
    ErrorStateComponent,
    CurrencyPipe,
    ImageFallbackDirective
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent implements OnInit {
  // Dependency injection
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private toast = inject(ToastMessageService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  private translationService = inject(TranslationService);
  private flyToCartService = inject(FlyToCartService);
  private brandService = inject(BrandService);
  private destroyRef = inject(DestroyRef);
  private translateService = inject(TranslateService);

  // Constants
  readonly ROUTES = ROUTES;

  // Signals
  product = signal<Product | null>(null);
  brand = signal<Brand | null>(null);
  loading = signal<boolean>(true);
  error = signal<boolean>(false);
  selectedQuantity = signal<number>(1);
  currentLanguage = signal<string>(this.translationService.getCurrentLanguage());
  cartVersion = signal<number>(0); // Triggers reactivity when cart changes

  // Computed values using shared utilities
  isOutOfStock = computed(() => checkOutOfStock(this.product()));

  isLowStock = computed(() => checkLowStock(this.product()));

  // Computed property for low stock translation parameters
  lowStockParams = computed(() => {
    const currentProduct = this.product();
    if (!currentProduct) return { count: 0 };

    return {
      count: currentProduct.stock_quantity
    };
  });

  // Computed property for unit display
  unitDisplay = computed(() => {
    const currentProduct = this.product();
    const lang = this.currentLanguage(); // Make it reactive to language changes
    if (!currentProduct) return '';

    return this.unitsService.getUnitDisplay(currentProduct.unit, true);
  });

  // Computed property to check if product is in cart
  isInCart = computed(() => {
    this.cartVersion(); // Subscribe to cart changes
    const currentProduct = this.product();
    if (!currentProduct) return false;
    return this.cartService.isProductInCart(currentProduct.id);
  });

  // Computed property to get quantity in cart
  quantityInCart = computed(() => {
    this.cartVersion(); // Subscribe to cart changes
    const currentProduct = this.product();
    if (!currentProduct) return 0;
    return this.cartService.getProductQuantityInCart(currentProduct.id);
  });

  // Check if selected quantity matches cart quantity
  quantityMatchesCart = computed(() => {
    const cartQty = this.quantityInCart();
    const selectedQty = this.selectedQuantity();
    return cartQty > 0 && cartQty === selectedQty;
  });

  // Computed properties using shared utilities
  hasPromotion = computed(() => checkHasPromotion(this.product()?.promotion));

  discountLabel = computed(() => formatDiscountLabel(this.product()?.promotion, this.currencyService));

  discountedPrice = computed(() => {
    const currentProduct = this.product();
    return getEffectivePrice(currentProduct?.price || 0, currentProduct?.promotion);
  });

  // Stock quantity in cartons
  stockInCartons = computed(() => {
    const currentProduct = this.product();
    if (!currentProduct) return 0;
    const piecesPerBox = currentProduct.pieces_per_box || 1;
    return Math.floor(currentProduct.stock_quantity / piecesPerBox);
  });

  // Packaging type display (singular)
  packagingType = computed(() => {
    this.currentLanguage(); // React to language changes
    const currentProduct = this.product();
    const type = (currentProduct?.packaging_type || 'carton').toLowerCase();
    return this.translateService.instant(`products.product.packaging_types.${type}`);
  });

  // Packaging type display (plural)
  packagingTypePlural = computed(() => {
    this.currentLanguage(); // React to language changes
    const currentProduct = this.product();
    const type = (currentProduct?.packaging_type || 'carton').toLowerCase();
    return this.translateService.instant(`products.product.packaging_types.${type}_plural`);
  });

  // Get packaging type based on count (singular or plural)
  getPackagingTypeForCount(count: number): string {
    return count === 1 ? this.packagingType() : this.packagingTypePlural();
  }

  ngOnInit() {
    // Subscribe to cart changes to update the button
    this.cartService.cartItems$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cartVersion.update(v => v + 1);
      });

    // Subscribe to language changes
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(lang => {
        this.currentLanguage.set(lang);
        // Reload product data when language changes
        const currentProduct = this.product();
        if (currentProduct) {
          this.loadProduct(currentProduct.id);
        }
      });

    // Subscribe to route params
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const productId = params.get('id');
        if (!productId) {
          this.error.set(true);
          this.loading.set(false);
        } else {
          this.loadProduct(Number(productId));
        }
      });
  }

  // Load product data
  private loadProduct(productId: number): void {
    this.loading.set(true);

    this.productService.getProduct(productId).pipe(
      catchError(() => {
        this.error.set(true);
        this.loading.set(false);
        this.toast.showError('products.errors.failed_to_load');
        return of(null);
      })
    ).subscribe(product => {
      if (product) {
        this.product.set(product);

        // Initialize selectedQuantity based on product's pieces_per_box
        this.selectedQuantity.set(getDefaultQuantity(product.pieces_per_box));

        // Load brand
        if (product.brand_id) {
          this.brandService.getBrand(product.brand_id).subscribe(brand => {
            this.brand.set(brand);
          });
        }
      }

      this.loading.set(false);
    });
  }

  // Add to cart method
  addToCart(event?: MouseEvent): void {
    const currentProduct = this.product();
    if (!currentProduct || this.isOutOfStock()) return;

    // Trigger fly-to-cart animation
    if (event) {
      const button = event.currentTarget as HTMLElement;
      this.flyToCartService.animate(button, currentProduct.image_url);
    }

    const quantity = this.selectedQuantity();

    this.cartService.setCartQuantity(currentProduct, quantity).subscribe({
      error: () => {
        this.toast.showError('products.cart.error');
      }
    });
  }

  // Navigate back to products list
  goBack(): void {
    this.router.navigate([ROUTES.PRODUCTS]);
  }
}
