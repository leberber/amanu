import { Component, inject, OnInit, signal, DestroyRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { TranslateModule } from '@ngx-translate/core';

import { CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { TranslationService } from '../../../services/translation.service';
import { SearchService } from '../../../services/search.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { PackagingTypeService } from '../../../core/services/packaging-type.service';
import { FlyToCartService } from '../../../core/services/fly-to-cart.service';
import { BrandService } from '../../../core/services/brand.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { OverlayService } from '../../../core/services/overlay.service';
import { CrossSellNotificationService } from '../../../core/services/cross-sell-notification.service';
import { Product, Category, ProductFilter } from '../../../models/product.model';
import { Brand } from '../../../models/brand.model';
import { ProductCardComponent, AddToCartEvent, QuantitySelectorEvent } from '../components/product-card/product-card.component';
import { isOutOfStock as checkOutOfStock, isLowStock as checkLowStock } from '../../../shared/utils/stock.utils';
import { getEffectivePrice as calcEffectivePrice } from '../../../shared/utils/discount.utils';
import { generateBoxOptions, BoxOption } from '../../../shared/utils/box-options.utils';
import { DEFAULTS } from '../../../core/constants/app.constants';
import { ANIMATION, UI } from '../../../core/constants/ui.constants';
import { ROUTES } from '../../../core/constants/routes.constants';
import { HorizontalFilterComponent } from '../../../shared/components/horizontal-filter/horizontal-filter.component';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { UnitPipe } from '../../../shared/pipes/unit.pipe';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    RouterLink,
    ToastModule,
    ButtonModule,
    TranslateModule,
    ProductCardComponent,
    HorizontalFilterComponent,
    SearchInputComponent,
    CurrencyDisplayComponent,
    UnitPipe,
    ImageFallbackDirective
  ],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private cartService = inject(CartService);
  private toast = inject(ToastMessageService);
  private translationService = inject(TranslationService);
  protected currencyService = inject(CurrencyService);
  private packagingTypeService = inject(PackagingTypeService);
  private flyToCartService = inject(FlyToCartService);
  protected searchService = inject(SearchService);
  private elementRef = inject(ElementRef);
  private overlayService = inject(OverlayService);
  private crossSellNotification = inject(CrossSellNotificationService);
  private destroyRef = inject(DestroyRef);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  categoryBrands = signal<Brand[]>([]);
  allBrands = signal<Brand[]>([]);
  activeCategoryId = signal<number | null>(null);
  activeBrandId = signal<number | null>(null);
  filterMode = signal<'category' | 'brand'>('category');
  loading = signal(true);
  filters = signal<ProductFilter>({
    active_only: true,
    sort_by: 'name',
    sort_order: 'asc'
  });

  readonly routes = ROUTES;
  showNewArrivalsBanner = signal(this.shouldShowBanner());

  selectedBoxOptions: { [key: number]: BoxOption | null } = {};
  showQuantitySelector = signal(false);
  activeProduct = signal<Product | null>(null);
  highlightedProductId = signal<number | null>(null);
  animationKey = signal(0);
  showMobileSearch = signal(false);

  @ViewChild('mobileSearchInput') mobileSearchInput?: ElementRef<HTMLInputElement>;

  readonly animationDelayMs = ANIMATION.STAGGER_DELAY;
  readonly skeletonGridItems = Array.from({ length: UI.SKELETON_GRID_COUNT }, (_, i) => i + 1);

  ngOnInit(): void {
    // BehaviorSubject emits immediately on subscribe, so no separate load call needed
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadCategoriesAndProducts();
      });

    this.searchService.searchTriggered$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(query => {
        this.filters.update(f => ({ ...f, search: query }));
        this.loadProducts().subscribe();
      });
  }

  private shouldShowBanner(): boolean {
    const dismissed = localStorage.getItem('new_arrivals_banner_dismissed_at');
    if (!dismissed) return true;
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return Date.now() - Number(dismissed) > threeDaysMs;
  }

  dismissNewArrivalsBanner(): void {
    localStorage.setItem('new_arrivals_banner_dismissed_at', String(Date.now()));
    this.showNewArrivalsBanner.set(false);
  }

  openMobileSearch(): void {
    this.showMobileSearch.set(true);
    this.overlayService.open('mobile-search-open');
    setTimeout(() => this.mobileSearchInput?.nativeElement?.focus(), UI.FOCUS_DELAY);
  }

  closeMobileSearch(): void {
    this.showMobileSearch.set(false);
    this.overlayService.close('mobile-search-open');
  }

  submitMobileSearch(): void {
    this.searchService.search();
    this.closeMobileSearch();
  }

  clearMobileSearch(): void {
    this.searchService.clear();
    this.mobileSearchInput?.nativeElement?.focus();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchService.setQuery(value);
  }

  selectBrandFromTopBar(brandId: number | null): void {
    this.activeBrandId.set(brandId);
    if (brandId) {
      this.filters.update(f => ({ ...f, brand_id: brandId }));
    } else {
      this.filters.update(f => { const { brand_id, ...rest } = f; return rest; });
    }
    this.reloadWithAnimation();
  }

  selectCategoryFromBar(categoryId: number | null): void {
    if (categoryId === null) return;
    this.activeCategoryId.set(categoryId);
    this.activeBrandId.set(null);
    this.filters.update(f => { const { brand_id, ...rest } = f; return rest; });
    this.updateUrlParams({ category: categoryId, brand: null });
    this.loadBrandsForCategory(categoryId);
    this.reloadWithAnimation();
  }

  selectBrand(brandId: number | null): void {
    this.activeBrandId.set(brandId);
    if (brandId) {
      this.filters.update(f => ({ ...f, brand_id: brandId }));
      this.updateUrlParams({ brand: brandId });
    } else {
      this.filters.update(f => { const { brand_id, ...rest } = f; return rest; });
      this.updateUrlParams({ brand: null });
    }
    this.reloadWithAnimation();
  }

  onAddToCart(event: AddToCartEvent): void {
    this.handleAddToCart(event.product, event.quantity);
  }

  onQuantitySelectorOpen(event: QuantitySelectorEvent): void {
    this.openQuantitySelector(event.product, event.event);
  }

  isOutOfStock(product: Product): boolean {
    return checkOutOfStock(product);
  }

  isLowStock(product: Product): boolean {
    return checkLowStock(product);
  }

  getPackagingTypeForCount(product: Product, count: number): string {
    return this.packagingTypeService.getPackagingTypeForCount(product.packaging_type || 'carton', count);
  }

  isProductInCart(productId: number): boolean {
    return this.cartService.isInCart(productId);
  }

  getCartQuantity(productId: number): number {
    return this.cartService.getQuantity(productId);
  }

  getBoxOptions(product: Product): BoxOption[] {
    return generateBoxOptions(product, this.currencyService);
  }

  getSelectedBoxOption(productId: number): BoxOption | null {
    if (!this.selectedBoxOptions[productId]) {
      const product = this.products().find(p => p.id === productId);
      if (product) {
        this.initializeBoxOption(product, this.getCartQuantity(productId));
      }
    }
    return this.selectedBoxOptions[productId] || null;
  }

  addToCartFromList(product: Product, event?: MouseEvent): void {
    const option = this.selectedBoxOptions[product.id];
    if (!option) return;

    if (event) {
      const button = event.currentTarget as HTMLElement;
      this.flyToCartService.animate(button, product.image_url);
    }

    this.handleAddToCart(product, option.pieces);
  }

  openQuantitySelector(product: Product, event: Event): void {
    event.stopPropagation();
    this.activeProduct.set(product);
    this.showQuantitySelector.set(true);
    this.overlayService.open('quantity-overlay-open');
    this.initializeBoxOption(product, this.getCartQuantity(product.id));
  }

  private initializeBoxOption(product: Product, cartQuantity = 0): void {
    const options = this.getBoxOptions(product);
    if (options.length === 0) return;

    if (cartQuantity > 0) {
      const matchingOption = options.find(opt => opt.pieces === cartQuantity);
      this.selectedBoxOptions[product.id] = matchingOption || options[0];
    } else if (!this.selectedBoxOptions[product.id]) {
      this.selectedBoxOptions[product.id] = options[0];
    }
  }

  quantityMatchesCart(productId: number): boolean {
    const selectedOption = this.selectedBoxOptions[productId];
    const cartQuantity = this.getCartQuantity(productId);
    return selectedOption ? selectedOption.pieces === cartQuantity : false;
  }

  closeQuantitySelector(): void {
    this.showQuantitySelector.set(false);
    this.activeProduct.set(null);
    this.overlayService.close('quantity-overlay-open');
  }

  selectBoxOption(option: BoxOption): void {
    const product = this.activeProduct();
    if (product) {
      this.selectedBoxOptions[product.id] = option;
    }
  }

  confirmQuantitySelection(): void {
    const product = this.activeProduct();
    const option = product ? this.selectedBoxOptions[product.id] : null;
    this.closeQuantitySelector();

    if (product && option) {
      this.handleAddToCart(product, option.pieces);
    }
  }

  getEffectivePrice(product: Product): number {
    return calcEffectivePrice(product.price, product.promotion);
  }

  getProductImageUrl(product: Product): string {
    return product.image_url || DEFAULTS.PLACEHOLDER_IMAGE;
  }

  getPiecesLabel(count: number): string {
    return count === 1
      ? 'products.product.quantity_selector.piece'
      : 'products.product.quantity_selector.pieces';
  }

  private loadAllBrands(): void {
    this.brandService.getBrands(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(brands => this.allBrands.set(brands));
  }

  private loadBrandsForCategory(categoryId: number): void {
    this.brandService.getBrandsByCategory(categoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(brands => this.categoryBrands.set(brands));
  }

  private loadCategoriesAndProducts(): void {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        this.categories.set(categories);

        this.updateCategoryCounts();

        this.route.queryParams.pipe(
          tap(params => {
            if (params['category']) {
              const categoryId = Number(params['category']);
              this.activeCategoryId.set(categoryId);
              this.filterMode.set('category');
              if (params['brand']) {
                const brandId = Number(params['brand']);
                this.activeBrandId.set(brandId);
                this.filters.update(f => ({ ...f, brand_id: brandId }));
              }
              this.loadBrandsForCategory(categoryId);
            } else if (params['brand']) {
              // Navigated from home via brand chip — auto brand mode
              const brandId = Number(params['brand']);
              this.filterMode.set('brand');
              this.activeBrandId.set(brandId);
              this.filters.update(f => ({ ...f, brand_id: brandId }));
              if (this.allBrands().length === 0) {
                this.loadAllBrands();
              }
            } else if (!this.activeCategoryId() && categories.length > 0) {
              this.filterMode.set('category');
              this.setDefaultCategory(categories);
            }

            if (params['search']) {
              this.searchService.setQuery(params['search']);
              this.filters.update(f => ({ ...f, search: params['search'] }));
            }

            this.loading.set(true);
          }),
          switchMap(() => this.loadProducts())
        ).subscribe();
      },
      error: () => {
        this.toast.showError('products.filters.error');
        this.loading.set(false);
      }
    });
  }

  private setDefaultCategory(categories: Category[]): void {
    if (categories.length > 0) {
      this.activeCategoryId.set(categories[0].id);
      this.loadBrandsForCategory(categories[0].id);
    }
  }

  private loadProducts(): Observable<Product[]> {
    const currentFilters = { ...this.filters() };

    if (currentFilters.search) {
      // Search across everything — ignore active category/brand filters
      delete currentFilters.category_id;
      delete currentFilters.brand_id;
    } else if (this.filterMode() === 'brand') {
      // Brand mode: filter by selected brand only, no category constraint
      delete currentFilters.category_id;
      const brandId = this.activeBrandId();
      if (brandId) {
        currentFilters.brand_id = brandId;
      } else {
        delete currentFilters.brand_id;
      }
    } else {
      // Category mode (default)
      const categoryId = this.activeCategoryId();
      if (!categoryId) {
        this.setProductsAndStopLoading([]);
        return of([]);
      }
      currentFilters.category_id = categoryId;

      const brandId = this.activeBrandId();
      if (brandId) {
        currentFilters.brand_id = brandId;
      } else {
        delete currentFilters.brand_id;
      }
    }

    return this.productService.getProducts(currentFilters).pipe(
      tap(products => this.setProductsAndStopLoading(products))
    );
  }

  private setProductsAndStopLoading(products: Product[]): void {
    this.products.set(products);
    this.loading.set(false);
  }

  private handleAddToCart(product: Product, quantity: number): void {
    const result = this.cartService.setQuantity(product, quantity);
    if (result) {
      this.crossSellNotification.checkAndNotify(product.id, product.name);
    } else {
      this.toast.showError('products.cart.error');
    }
  }

  private reloadWithAnimation(): void {
    this.scrollToTop();
    this.animationKey.update(k => k + 1);
    this.loading.set(true);
    this.loadProducts().subscribe();
  }

  private scrollToTop(): void {
    setTimeout(() => {
      const hostElement = this.elementRef.nativeElement as HTMLElement;
      hostElement.scrollTop = 0;
    }, 0);
  }

  private updateCategoryCounts(): void {
    this.productService.getProducts({ active_only: true }).subscribe({
      next: (allProducts) => {
        const categories = this.categories();
        categories.forEach(category => {
          category.product_count = allProducts.filter(p => p.category_id === category.id).length;
        });
        this.categories.set([...categories]);
      }
    });
  }


  private updateUrlParams(params: { category?: number | null; brand?: number | null }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
