import { Component, computed, effect, inject, OnInit, signal, OnDestroy, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, of } from 'rxjs';
import { switchMap, tap, map } from 'rxjs/operators';

import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { TranslationService } from '../../../services/translation.service';
import { SearchService } from '../../../services/search.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { UnitsService } from '../../../core/services/units.service';
import { FlyToCartService } from '../../../core/services/fly-to-cart.service';
import { BrandService } from '../../../core/services/brand.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { UserPreferencesService, ViewMode } from '../../../core/services/user-preferences.service';
import { Product, Category, ProductFilter } from '../../../models/product.model';
import { getDefaultQuantity } from '../../../shared/utils/quantity.utils';
import { Brand } from '../../../models/brand.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ProductCardComponent, AddToCartEvent } from '../components/product-card/product-card.component';

export type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'created_at_desc';
import { ProductQuantitySelectorComponent } from '../../../shared/components/product-quantity-selector/product-quantity-selector.component';
import { HorizontalFilterComponent } from '../../../shared/components/horizontal-filter/horizontal-filter.component';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';
import { CurrencyPipe } from '../../../shared/pipes/currency.pipe';
import { UnitPipe } from '../../../shared/pipes/unit.pipe';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ToastModule,
    TagModule,
    ButtonModule,
    OverlayBadgeModule,
    TooltipModule,
    TranslateModule,
    EmptyStateComponent,
    ProductCardComponent,
    ProductQuantitySelectorComponent,
    HorizontalFilterComponent,
    SearchInputComponent,
    CurrencyPipe,
    UnitPipe
  ],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  // Services
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private brandService = inject(BrandService);
  private cartService = inject(CartService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private translationService = inject(TranslationService);
  protected currencyService = inject(CurrencyService);
  protected unitsService = inject(UnitsService);
  private flyToCartService = inject(FlyToCartService);
  private preferencesService = inject(UserPreferencesService);
  private searchService = inject(SearchService);

  // State signals
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);
  selectedCategories = signal<Category[]>([]);
  appliedCategories = signal<Category[]>([]); // Actually applied filters
  activeCategoryId = signal<number | null>(null); // For category bar - null means "All"
  activeBrandId = signal<number | null>(null); // For brand filter - null means "All Brands"
  categoryBarExpanded = signal(true); // Category bar visibility
  filterMode = signal<'categories' | 'brands'>('categories'); // Toggle between categories and brands
  loading = signal(true);
  selectedSort = signal<SortOption>('name_asc'); // Always sort alphabetically
  // Layout is now managed by UserPreferencesService
  layout = computed(() => this.preferencesService.productViewMode());
  filters = signal<ProductFilter>({
    active_only: true,
    sort_by: 'name',
    sort_order: 'asc'
  });
  productQuantities: { [key: number]: number } = {};

  // Mobile category bar - compact on scroll down, full on scroll up
  compactCategoryBar = false;
  showMobileToolbar = signal(false);
  private lastScrollY = 0;

  private destroyRef = inject(DestroyRef);

  // Computed values
  activeFilterCount = computed(() => {
    const allCategoriesApplied = this.appliedCategories().length === this.categories().length;
    const hasSearch = this.searchService.hasActiveSearch();
    let count = 0;
    if (!allCategoriesApplied && this.appliedCategories().length > 0) count++;
    if (hasSearch) count++;
    return count;
  });

  constructor() {
    // React to sort changes
    effect(() => {
      const sortValue = this.selectedSort();
      if (!sortValue) return;

      const [sortBy, sortOrder] = sortValue.split('_') as [string, string];
      this.filters.update(f => ({
        ...f,
        sort_by: sortBy as 'name' | 'price' | 'created_at',
        sort_order: sortOrder as 'asc' | 'desc'
      }));
    });
  }

  ngOnInit(): void {
    // Subscribe to language changes - automatically cleaned up on destroy
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadCategoriesAndProducts();
        this.loadBrands();
      });

    // Subscribe to search service
    this.searchService.searchTriggered$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(query => {
        this.filters.update(f => ({ ...f, search: query }));
        this.loadProducts().subscribe();
      });

    // Set up scroll listener for mobile header (opposite of bottom nav)
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    }

    this.loadCategoriesAndProducts();
  }

  ngOnDestroy(): void {
    // Subscriptions are automatically cleaned up by takeUntilDestroyed
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll);
    }
  }

  // Scroll handler for mobile header - compact categories on scroll down, full on scroll up
  private handleScroll = (): void => {
    const currentScrollY = window.scrollY;
    const scrollDifference = currentScrollY - this.lastScrollY;

    if (currentScrollY <= 50) {
      // At the top - full size categories
      this.compactCategoryBar = false;
    } else if (scrollDifference > 0) {
      // Scrolling down - compact categories to save space
      this.compactCategoryBar = true;
    } else if (scrollDifference < 0) {
      // Scrolling up - expand categories
      this.compactCategoryBar = false;
    }

    this.lastScrollY = currentScrollY;
  };

  // Public methods for template
  onCategoriesChange(categories: Category[]): void {
    this.selectedCategories.set(categories);
  }

  toggleMobileToolbar(): void {
    this.showMobileToolbar.update(v => !v);
  }

  toggleFilterMode(): void {
    const newMode = this.filterMode() === 'categories' ? 'brands' : 'categories';
    this.filterMode.set(newMode);

    // Clear the OTHER mode's filter when switching
    if (newMode === 'categories') {
      // Switching TO categories - clear brand filter
      this.filters.update(f => {
        const { brand_id, ...rest } = f;
        return rest;
      });
    } else {
      // Switching TO brands - clear category filter and auto-select first brand if none selected
      this.filters.update(f => {
        const { category_id, ...rest } = f;
        return rest;
      });

      // Auto-select first brand if no brand is currently selected
      if (!this.activeBrandId() && this.brands().length > 0) {
        this.activeBrandId.set(this.brands()[0].id);
      }
    }

    // Reload products with the cleared filter
    this.loading.set(true);
    this.loadProducts().subscribe();
  }

  // Category bar selection
  selectCategoryFromBar(categoryId: number | null): void {
    if (categoryId === null) {
      return; // No "All" option anymore
    }

    this.activeCategoryId.set(categoryId);

    // Single category selected
    const category = this.categories().find(c => c.id === categoryId);
    if (category) {
      this.selectedCategories.set([category]);
      this.appliedCategories.set([category]);
    }

    this.loading.set(true);
    this.loadProducts().subscribe();
  }

  // Brand filter selection
  selectBrand(brandId: number | null): void {
    if (brandId === null) {
      return; // No "All" option anymore
    }

    this.activeBrandId.set(brandId);
    this.filters.update(f => ({
      ...f,
      brand_id: brandId
    }));
    this.loading.set(true);
    this.loadProducts().subscribe();
  }

  isCategoryActive(categoryId: number | null): boolean {
    return this.activeCategoryId() === categoryId;
  }

  toggleCategoryBar(): void {
    this.categoryBarExpanded.update(v => !v);
  }

  applyFilters(): void {
    // Update applied filters
    this.appliedCategories.set([...this.selectedCategories()]);

    this.loading.set(true);
    this.loadProducts().subscribe();
  }

  handleFiltersApplied(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.filters.set({
      active_only: true,
      sort_by: 'name',
      sort_order: 'asc'
    });

    // Set first category as default
    const categories = this.categories();
    if (categories.length > 0) {
      this.activeCategoryId.set(categories[0].id);
      this.selectedCategories.set([categories[0]]);
      this.appliedCategories.set([categories[0]]);
    }

    this.activeBrandId.set(null);
    this.searchService.clear();
    this.selectedSort.set('name_asc');
    this.loadProducts().subscribe();
  }

  hasActiveFilters(): boolean {
    if (this.searchService.hasActiveSearch()) return true;

    const allCategories = this.categories();
    const selectedCategories = this.selectedCategories();
    return allCategories.length > 0 && selectedCategories.length !== allCategories.length;
  }

  onAddToCart(event: AddToCartEvent): void {
    this.handleAddToCart(event.product, event.quantity);
  }

  isOutOfStock(product: Product): boolean {
    return product.stock_quantity === 0;
  }


  quickAddToCart(product: Product, event?: MouseEvent): void {
    // Trigger fly-to-cart animation
    if (event) {
      const button = event.currentTarget as HTMLElement;
      this.flyToCartService.animate(button, product.image_url);
    }

    const quantity = this.productQuantities[product.id] || 1;
    this.handleAddToCart(product, quantity);
  }

  getProductQuantity(productId: number): number {
    if (this.productQuantities[productId]) {
      return this.productQuantities[productId];
    }
    
    // Find the product to get its config
    const product = this.products().find(p => p.id === productId);
    return getDefaultQuantity(product?.quantity_config);
  }

  setProductQuantity(productId: number, quantity: number): void {
    this.productQuantities[productId] = quantity;
  }

  getLowStockMessage(product: Product): string {
    return this.translateService.instant('products.stock.low_stock', { count: product.stock_quantity });
  }

  // Private methods
  private loadCategoriesAndProducts(): void {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        this.categories.set(categories);

        // Set first category as default if categories exist
        if (categories.length > 0) {
          this.activeCategoryId.set(categories[0].id);
          this.selectedCategories.set([categories[0]]);
          this.appliedCategories.set([categories[0]]);
        }

        // Load all products to calculate counts
        this.updateCategoryCounts();

        this.route.queryParams.pipe(
          tap(params => {
            if (params['category']) {
              const categoryId = Number(params['category']);
              this.filters.update(f => ({ ...f, category_id: categoryId }));

              const selectedCategory = this.categories().find(c => c.id === categoryId);
              if (selectedCategory) {
                this.activeCategoryId.set(categoryId);
                this.selectedCategories.set([selectedCategory]);
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

  private loadProducts(): Observable<Product[]> {
    const currentMode = this.filterMode();

    // In brands mode, use brand filter only (ignore category selection)
    if (currentMode === 'brands') {
      const currentFilters = { ...this.filters() };
      // Ensure brand_id is set if we have an active brand
      if (this.activeBrandId()) {
        currentFilters.brand_id = this.activeBrandId()!;
      }
      // Remove category_id since we're in brands mode
      delete currentFilters.category_id;

      return this.productService.getProducts(currentFilters).pipe(
        tap(products => {
          this.products.set(products);
          products.forEach(p => {
            if (!this.productQuantities[p.id]) {
              this.productQuantities[p.id] = getDefaultQuantity(p.quantity_config);
            }
          });
          this.loading.set(false);
        })
      );
    }

    // In categories mode, use category filter only (ignore brand selection)
    const selectedCats = this.selectedCategories();

    if (selectedCats.length === 0) {
      this.products.set([]);
      this.loading.set(false);
      return of([]);
    }

    if (selectedCats.length === 1) {
      const currentFilters = { ...this.filters(), category_id: selectedCats[0].id };
      // Remove brand_id since we're in categories mode
      delete currentFilters.brand_id;

      return this.productService.getProducts(currentFilters).pipe(
        tap(products => {
          this.products.set(products);
          products.forEach(p => {
            if (!this.productQuantities[p.id]) {
              // For list type, set to first available option
              this.productQuantities[p.id] = getDefaultQuantity(p.quantity_config);
            }
          });
          this.loading.set(false);
        })
      );
    }

    // Multiple categories
    this.loading.set(true);

    const categoryObservables = selectedCats.map(category => {
      const categoryFilter = { ...this.filters(), category_id: category.id };
      // Remove brand_id since we're in categories mode
      delete categoryFilter.brand_id;
      return this.productService.getProducts(categoryFilter);
    });

    return forkJoin(categoryObservables).pipe(
      map(results => {
        const allProducts: Product[] = [];
        const productIds = new Set<number>();

        results.forEach(categoryProducts => {
          categoryProducts.forEach(product => {
            if (!productIds.has(product.id)) {
              productIds.add(product.id);
              allProducts.push(product);
            }
          });
        });

        this.sortProducts(allProducts);
        this.products.set(allProducts);
        allProducts.forEach(p => {
          if (!this.productQuantities[p.id]) {
            this.productQuantities[p.id] = getDefaultQuantity(p.quantity_config);
          }
        });
        this.loading.set(false);
        return allProducts;
      })
    );
  }

  private sortProducts(products: Product[]): void {
    const [sortBy, sortOrder] = this.selectedSort().split('_');
    
    products.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private handleAddToCart(product: Product, quantity: number): void {
    this.cartService.addToCart(product, quantity).subscribe({
      next: () => {
        // Animation handles the visual feedback
      },
      error: () => {
        this.toast.showError('products.cart.error');
      }
    });
  }

  // Track by function for better performance
  trackByProductId(_index: number, product: Product): number {
    return product.id;
  }

  // Update category counts based on loaded products
  private updateCategoryCounts(): void {
    // Load all products without filters to get total counts
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

  // Load brands
  private loadBrands(): void {
    this.brandService.getBrands(true).subscribe({
      next: (brands) => {
        this.brands.set(brands);
      },
      error: () => {
        this.toast.showError('brands.error_loading');
      }
    });
  }

  increaseQuantity(productId: number): void {
    const currentQty = this.getProductQuantity(productId);
    const product = this.products().find(p => p.id === productId);
    
    if (product && currentQty < product.stock_quantity) {
      this.setProductQuantity(productId, currentQty + 1);
    }
  }

  decreaseQuantity(productId: number): void {
    const currentQty = this.getProductQuantity(productId);
    
    if (currentQty > 1) {
      this.setProductQuantity(productId, currentQty - 1);
    }
  }

  isProductInCart(productId: number): boolean {
    return this.cartService.isProductInCart(productId);
  }

  getCartQuantity(productId: number): number {
    return this.cartService.getProductQuantityInCart(productId);
  }

  getBoxQuantity(product: Product): number | null {
    const config = product.quantity_config;
    if (!config) return null;

    // For list type, use first quantity
    if (config.type === 'list' && config.quantities && config.quantities.length > 0) {
      return config.quantities[0];
    }

    // For range type, use min value
    if (config.type === 'range' && config.min) {
      return config.min;
    }

    return null;
  }

  getBoxPrice(product: Product): number | null {
    const boxQty = this.getBoxQuantity(product);
    if (boxQty) {
      const effectivePrice = product.promotion?.discounted_price || product.price;
      return effectivePrice * boxQty;
    }
    return null;
  }
}