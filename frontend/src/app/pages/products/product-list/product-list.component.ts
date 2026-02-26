/**
 * @fileoverview Product List Component
 * @description Displays products in grid or list view with filtering by category or brand,
 * search functionality, and quantity selection overlay for adding items to cart.
 */

import { Component, computed, inject, OnInit, signal, DestroyRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { UserPreferencesService, ViewMode } from '../../../core/services/user-preferences.service';
import { OverlayService } from '../../../core/services/overlay.service';
import { Product, Category, ProductFilter } from '../../../models/product.model';
import { Brand } from '../../../models/brand.model';
import { ProductCardComponent, AddToCartEvent, QuantitySelectorEvent } from '../components/product-card/product-card.component';
import { isOutOfStock as checkOutOfStock, isLowStock as checkLowStock } from '../../../shared/utils/stock.utils';
import { getEffectivePrice as calcEffectivePrice } from '../../../shared/utils/discount.utils';
import { generateBoxOptions, BoxOption } from '../../../shared/utils/box-options.utils';
import { DEFAULTS, ANIMATION, UI } from '../../../core/constants/app.constants';
import { HorizontalFilterComponent } from '../../../shared/components/horizontal-filter/horizontal-filter.component';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { UnitPipe } from '../../../shared/pipes/unit.pipe';

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
    CurrencyPipe,
    UnitPipe
  ],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private cartService = inject(CartService);
  private toast = inject(ToastMessageService);
  private translationService = inject(TranslationService);
  protected currencyService = inject(CurrencyService);
  private packagingTypeService = inject(PackagingTypeService);
  private flyToCartService = inject(FlyToCartService);
  private preferencesService = inject(UserPreferencesService);
  protected searchService = inject(SearchService);
  private elementRef = inject(ElementRef);
  private overlayService = inject(OverlayService);
  private destroyRef = inject(DestroyRef);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);
  activeCategoryId = signal<number | null>(null);
  activeBrandId = signal<number | null>(null);
  filterMode = signal<'categories' | 'brands'>('categories');
  loading = signal(true);
  layout = computed(() => this.preferencesService.productViewMode());
  filters = signal<ProductFilter>({
    active_only: true,
    sort_by: 'name',
    sort_order: 'asc'
  });

  selectedBoxOptions: { [key: number]: BoxOption | null } = {};
  showQuantitySelector = signal(false);
  activeProduct = signal<Product | null>(null);
  highlightedProductId = signal<number | null>(null);
  animationKey = signal(0);
  showMobileSearch = signal(false);

  @ViewChild('mobileSearchInput') mobileSearchInput?: ElementRef<HTMLInputElement>;

  readonly animationDelayMs = ANIMATION.STAGGER_DELAY;
  readonly skeletonGridItems = Array.from({ length: UI.SKELETON_GRID_COUNT }, (_, i) => i + 1);
  readonly skeletonListItems = Array.from({ length: UI.SKELETON_LIST_COUNT }, (_, i) => i + 1);

  ngOnInit(): void {
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadCategoriesAndProducts();
        this.loadBrands();
      });

    this.searchService.searchTriggered$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(query => {
        this.filters.update(f => ({ ...f, search: query }));
        this.loadProducts().subscribe();
      });

    if (this.categories().length === 0) {
      this.loadCategoriesAndProducts();
    }
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

  toggleViewMode(): void {
    this.preferencesService.toggleProductViewMode();
  }

  toggleFilterMode(): void {
    const newMode = this.filterMode() === 'categories' ? 'brands' : 'categories';
    this.filterMode.set(newMode);

    if (newMode === 'categories') {
      this.filters.update(f => {
        const { brand_id, ...rest } = f;
        return rest;
      });
    } else {
      this.filters.update(f => {
        const { category_id, ...rest } = f;
        return rest;
      });

      if (!this.activeBrandId() && this.brands().length > 0) {
        this.activeBrandId.set(this.brands()[0].id);
      }
    }

    this.loading.set(true);
    this.loadProducts().subscribe();
  }

  selectCategoryFromBar(categoryId: number | null): void {
    if (categoryId === null) return;
    this.activeCategoryId.set(categoryId);
    this.reloadWithAnimation();
  }

  selectBrand(brandId: number | null): void {
    if (brandId === null) return;

    this.activeBrandId.set(brandId);
    this.filters.update(f => ({ ...f, brand_id: brandId }));
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
        this.initializeBoxOption(product);
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
    const productId = this.activeProduct()?.id;
    this.closeQuantitySelector();

    if (productId) {
      setTimeout(() => {
        this.highlightedProductId.set(productId);
        setTimeout(() => this.highlightedProductId.set(null), ANIMATION.HIGHLIGHT_DURATION);
      }, ANIMATION.HIGHLIGHT_DELAY);
    }
  }

  getEffectivePrice(product: Product): number {
    return calcEffectivePrice(product.price, product.promotion);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = DEFAULTS.PLACEHOLDER_IMAGE;
  }

  getProductImageUrl(product: Product): string {
    return product.image_url || DEFAULTS.PLACEHOLDER_IMAGE;
  }

  viewToggleIcon = computed(() =>
    this.layout() === 'grid' ? 'pi pi-list' : 'pi pi-th-large'
  );

  getPiecesLabel(count: number): string {
    return count === 1
      ? 'products.product.quantity_selector.piece'
      : 'products.product.quantity_selector.pieces';
  }

  private loadCategoriesAndProducts(): void {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        this.categories.set(categories);

        if (!this.activeCategoryId() && !this.activeBrandId() && categories.length > 0) {
          this.setDefaultCategory(categories);
        }

        this.updateCategoryCounts();

        this.route.queryParams.pipe(
          tap(params => {
            if (!this.activeCategoryId() && !this.activeBrandId()) {
              if (params['brand']) {
                const brandId = Number(params['brand']);
                this.filterMode.set('brands');
                this.activeBrandId.set(brandId);
                this.filters.update(f => ({ ...f, brand_id: brandId }));
              } else if (params['category']) {
                const categoryId = Number(params['category']);
                this.filterMode.set('categories');
                this.activeCategoryId.set(categoryId);
              }
            }

            if (params['search']) {
              this.searchService.setQuery(params['search']);
              this.filters.update(f => ({ ...f, search: params['search'] }));
            }

            if (params['layout'] && (params['layout'] === 'grid' || params['layout'] === 'list')) {
              this.preferencesService.setProductViewMode(params['layout'] as ViewMode);
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
      this.filterMode.set('categories');
      this.activeCategoryId.set(categories[0].id);
    }
  }

  private loadProducts(): Observable<Product[]> {
    const currentFilters = { ...this.filters() };

    if (this.filterMode() === 'brands') {
      if (this.activeBrandId()) {
        currentFilters.brand_id = this.activeBrandId()!;
      }
      delete currentFilters.category_id;
    } else {
      const categoryId = this.activeCategoryId();
      if (!categoryId) {
        this.setProductsAndStopLoading([]);
        return of([]);
      }
      currentFilters.category_id = categoryId;
      delete currentFilters.brand_id;
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
    if (!result) {
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

  private loadBrands(): void {
    this.brandService.getBrands(true).subscribe({
      next: (brands) => this.brands.set(brands),
      error: () => this.toast.showError('brands.error_loading')
    });
  }
}
