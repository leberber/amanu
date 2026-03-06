import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TranslateModule } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { ImageLightboxComponent } from '../../../shared/components/image-lightbox/image-lightbox.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { UnitsService } from '../../../core/services/units.service';
import { PackagingTypeService } from '../../../core/services/packaging-type.service';
import { TranslationService } from '../../../services/translation.service';
import { Product } from '../../../models/product.model';
import { Brand } from '../../../models/brand.model';
import { ROUTES } from '../../../core/constants/routes.constants';
import { getDefaultQuantity } from '../../../shared/utils/quantity.utils';
import { FlyToCartService } from '../../../core/services/fly-to-cart.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { BrandService } from '../../../core/services/brand.service';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';
import { isOutOfStock as checkOutOfStock, isLowStock as checkLowStock } from '../../../shared/utils/stock.utils';
import { formatDiscountLabel, getEffectivePrice, hasPromotion as checkHasPromotion } from '../../../shared/utils/discount.utils';
import { CrossSellNotificationService } from '../../../core/services/cross-sell-notification.service';
import { VolumeDiscountService } from '../../../services/volume-discount.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    ToastModule,
    ButtonModule,
    TagModule,
    TranslateModule,
    PageLayoutComponent,
    ErrorStateComponent,
    ImageLightboxComponent,
    CurrencyPipe,
    ImageFallbackDirective
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class ProductDetailComponent implements OnInit {
  // Services
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
  private crossSellNotification = inject(CrossSellNotificationService);
  private volumeDiscountService = inject(VolumeDiscountService);
  private destroyRef = inject(DestroyRef);
  private packagingTypeService = inject(PackagingTypeService);

  // Constants
  readonly ROUTES = ROUTES;

  // State
  product = signal<Product | null>(null);
  brand = signal<Brand | null>(null);
  loading = signal(true);
  error = signal(false);
  selectedQuantity = signal(1);
  showLightbox = signal(false);
  private currentLanguage = signal(this.translationService.getCurrentLanguage());

  // Computed - stock
  isOutOfStock = computed(() => checkOutOfStock(this.product()));
  isLowStock = computed(() => checkLowStock(this.product()));
  stockInCartons = computed(() => {
    const p = this.product();
    if (!p) return 0;
    return Math.floor(p.stock_quantity / (p.pieces_per_box || 1));
  });

  // Computed - display
  unitDisplay = computed(() => {
    this.currentLanguage();
    const p = this.product();
    return p ? this.unitsService.getUnitDisplay(p.unit, true) : '';
  });

  // Computed - cart
  isInCart = computed(() => {
    this.cartService.items();
    const p = this.product();
    return p ? this.cartService.isInCart(p.id) : false;
  });

  quantityInCart = computed(() => {
    this.cartService.items();
    const p = this.product();
    return p ? this.cartService.getQuantity(p.id) : 0;
  });

  quantityMatchesCart = computed(() => {
    const cartQty = this.quantityInCart();
    return cartQty > 0 && cartQty === this.selectedQuantity();
  });

  // Computed - promotion
  hasPromotion = computed(() => checkHasPromotion(this.product()?.promotion));
  discountLabel = computed(() => formatDiscountLabel(this.product()?.promotion, this.currencyService, this.product()?.pieces_per_box || 1));
  discountedPrice = computed(() => {
    const p = this.product();
    return getEffectivePrice(p?.price || 0, p?.promotion);
  });
  savingsAmount = computed(() => {
    const p = this.product();
    if (!p || !this.hasPromotion()) return 0;
    return p.price - this.discountedPrice();
  });

  // Computed - volume discount (free units)
  volumeDiscount = computed(() => {
    const p = this.product();
    if (!p) return null;
    const discounts = this.volumeDiscountService.getCachedDiscounts();
    return discounts.find(d => d.product_id === p.id) || null;
  });

  hasFreeUnitsPromotion = computed(() => {
    const vd = this.volumeDiscount();
    return vd?.discount_type === 'free_units';
  });

  volumeDiscountMinCartons = computed(() => {
    const vd = this.volumeDiscount();
    if (!vd) return 0;
    // min_quantity is already in cartons
    return vd.min_quantity;
  });

  volumeDiscountFreeCartons = computed(() => {
    const vd = this.volumeDiscount();
    if (!vd || vd.discount_type !== 'free_units') return 0;
    // discount_value for free_units is already in cartons
    return vd.discount_value;
  });

  // Computed - selected quantity in cartons
  selectedCartons = computed(() => {
    const p = this.product();
    if (!p) return 0;
    return Math.floor(this.selectedQuantity() / (p.pieces_per_box || 1));
  });

  // Computed - check if current selection qualifies for free units
  qualifiesForFreeUnits = computed(() => {
    if (!this.hasFreeUnitsPromotion()) return false;
    return this.selectedCartons() >= this.volumeDiscountMinCartons();
  });

  // Computed - how many free cartons earned
  freeCartonsEarned = computed(() => {
    if (!this.qualifiesForFreeUnits()) return 0;
    const minCartons = this.volumeDiscountMinCartons();
    const freePerSet = this.volumeDiscountFreeCartons();
    // Calculate how many complete sets of min_quantity
    const sets = Math.floor(this.selectedCartons() / minCartons);
    return sets * freePerSet;
  });

  // Computed - total cartons including free ones
  totalCartonsWithFree = computed(() => {
    return this.selectedCartons() + this.freeCartonsEarned();
  });

  // Computed - original price as if paying for all cartons (including free)
  originalPriceWithFree = computed(() => {
    const p = this.product();
    if (!p) return 0;
    const totalCartons = this.totalCartonsWithFree();
    const pricePerCarton = p.price * (p.pieces_per_box || 1);
    return totalCartons * pricePerCarton;
  });

  // Computed - stock percentage
  stockPercentage = computed(() => {
    const p = this.product();
    if (!p || !p.stock_quantity) return 0;
    const maxStock = (p.pieces_per_box || 1) * 20; // Assume 20 boxes is "full"
    return Math.min((p.stock_quantity / maxStock) * 100, 100);
  });

  // Computed - page layout
  pageTitle = computed(() => this.product()?.name || '');
  pageSubtitle = computed(() => this.brand()?.name || '');
  mobilePageTitle = computed(() => this.product()?.name || '');
  mobileSubtitle = computed(() => this.brand()?.name || '');

  ngOnInit(): void {
    this.subscribeToLanguageChanges();
    this.subscribeToRouteChanges();
  }

  getPackagingTypeForCount(count: number): string {
    return this.packagingTypeService.getPackagingTypeForCount(this.product()?.packaging_type || 'carton', count);
  }

  incrementQuantity(): void {
    const p = this.product();
    if (!p) return;
    const step = p.pieces_per_box || 1;
    const maxQty = p.stock_quantity || Infinity;
    if (this.selectedQuantity() + step <= maxQty) {
      this.selectedQuantity.set(this.selectedQuantity() + step);
    }
  }

  decrementQuantity(): void {
    const p = this.product();
    if (!p) return;
    const step = p.pieces_per_box || 1;
    if (this.selectedQuantity() > step) {
      this.selectedQuantity.set(this.selectedQuantity() - step);
    }
  }

  addToCart(event?: MouseEvent): void {
    const p = this.product();
    if (!p || this.isOutOfStock()) return;

    if (event) {
      this.flyToCartService.animate(event.currentTarget as HTMLElement, p.image_url);
    }

    if (this.cartService.setQuantity(p, this.selectedQuantity())) {
      this.crossSellNotification.checkAndNotify(p.id, p.name);
    } else {
      this.toast.showError('products.cart.error');
    }
  }

  goBack(): void {
    this.router.navigate([ROUTES.PRODUCTS]);
  }

  openLightbox(): void {
    if (this.product()?.image_url) {
      this.showLightbox.set(true);
    }
  }

  closeLightbox(): void {
    this.showLightbox.set(false);
  }

  // Private methods
  private subscribeToLanguageChanges(): void {
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(lang => {
        this.currentLanguage.set(lang);
        const p = this.product();
        if (p) this.loadProduct(p.id);
      });
  }

  private subscribeToRouteChanges(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (!id) {
          this.error.set(true);
          this.loading.set(false);
        } else {
          this.loadProduct(Number(id));
        }
      });
  }

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
        this.selectedQuantity.set(getDefaultQuantity(product.pieces_per_box));

        // Load brand
        if (product.brand_id) {
          this.brandService.getBrand(product.brand_id).subscribe(brand => this.brand.set(brand));
        }
      }
      this.loading.set(false);
    });
  }
}
