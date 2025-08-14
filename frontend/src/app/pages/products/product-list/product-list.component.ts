import { Component, computed, effect, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, forkJoin, of, Subscription, Subject } from 'rxjs';
import { switchMap, tap, map, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { TranslationService } from '../../../services/translation.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { UnitsService } from '../../../core/services/units.service';
import { Product, Category, ProductFilter } from '../../../models/product.model';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ProductCardComponent, AddToCartEvent } from '../components/product-card/product-card.component';
import { ProductFiltersComponent } from '../components/product-filters/product-filters.component';
import { ProductToolbarComponent, SortOption, ViewMode } from '../components/product-toolbar/product-toolbar.component';
import { ProductQuantitySelectorComponent } from '../../../shared/components/product-quantity-selector/product-quantity-selector.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ToastModule,
    DrawerModule,
    TagModule,
    ButtonModule,
    OverlayBadgeModule,
    TranslateModule,
    LoadingStateComponent,
    EmptyStateComponent,
    ProductCardComponent,
    ProductFiltersComponent,
    ProductToolbarComponent,
    ProductQuantitySelectorComponent
  ],
  providers: [MessageService],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  // Services
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private translationService = inject(TranslationService);
  protected currencyService = inject(CurrencyService);
  protected unitsService = inject(UnitsService);

  // State signals
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  selectedCategories = signal<Category[]>([]);
  appliedCategories = signal<Category[]>([]); // Actually applied filters
  loading = signal(true);
  showMobileFilters = signal(false);
  searchQuery = signal('');
  appliedSearchQuery = signal(''); // Actually applied search
  selectedSort = signal<SortOption>('name_asc'); // Always sort alphabetically
  layout = signal<ViewMode>('grid');
  filters = signal<ProductFilter>({
    active_only: true,
    sort_by: 'name',
    sort_order: 'asc'
  });
  productQuantities: { [key: number]: number } = {};

  // Subscriptions
  private languageSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private searchSubject = new Subject<string>();

  // Computed values
  activeFilterCount = computed(() => {
    const allCategoriesApplied = this.appliedCategories().length === this.categories().length;
    const hasSearch = this.appliedSearchQuery().trim() !== '';
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

    // Save layout preference
    effect(() => {
      const currentLayout = this.layout();
      if (currentLayout) {
        localStorage.setItem('product-list-layout', currentLayout);
      }
    });
  }

  ngOnInit(): void {
    // Load saved layout preference
    const savedLayout = localStorage.getItem('product-list-layout');
    if (savedLayout === 'grid' || savedLayout === 'list') {
      this.layout.set(savedLayout as ViewMode);
    } else {
      // Set default based on screen size if no saved preference
      const isMobile = window.innerWidth < 768;
      this.layout.set(isMobile ? 'list' : 'grid');
    }

    // Subscribe to language changes
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      this.loadCategoriesAndProducts();
    });

    // Set up search debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(500), // Wait 500ms after user stops typing
      distinctUntilChanged() // Only emit if value is different from previous
    ).subscribe(searchQuery => {
      this.searchQuery.set(searchQuery);
      this.appliedSearchQuery.set(searchQuery);
      this.filters.update(f => ({ ...f, search: searchQuery }));
      this.loadProducts().subscribe();
    });

    this.loadCategoriesAndProducts();
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
  }

  // Public methods for template
  onCategoriesChange(categories: Category[]): void {
    this.selectedCategories.set(categories);
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.set(true);
  }

  applyFilters(): void {
    // Update applied filters
    this.appliedCategories.set([...this.selectedCategories()]);
    this.appliedSearchQuery.set(this.searchQuery());
    
    this.loading.set(true);
    this.loadProducts().subscribe();
  }

  applyMobileFilters(): void {
    this.showMobileFilters.set(false);
    this.applyFilters();
  }

  handleFiltersApplied(): void {
    if (this.showMobileFilters()) {
      this.applyMobileFilters();
    } else {
      this.applyFilters();
    }
  }

  onSearch(): void {
    this.appliedSearchQuery.set(this.searchQuery());
    this.filters.update(f => ({ ...f, search: this.searchQuery() }));
    this.loadProducts().subscribe();
  }

  onSearchInput(query: string): void {
    this.searchSubject.next(query);
  }

  clearFilters(): void {
    this.filters.set({
      active_only: true,
      sort_by: 'name',
      sort_order: 'asc'
    });
    this.selectedCategories.set([...this.categories()]);
    this.appliedCategories.set([...this.categories()]);
    this.searchQuery.set('');
    this.appliedSearchQuery.set('');
    this.selectedSort.set('name_asc');
    this.loadProducts().subscribe();
    this.showMobileFilters.set(false);
  }

  hasActiveFilters(): boolean {
    if (this.searchQuery().trim() !== '') return true;
    
    const allCategories = this.categories();
    const selectedCategories = this.selectedCategories();
    return allCategories.length > 0 && selectedCategories.length !== allCategories.length;
  }

  onAddToCart(event: AddToCartEvent): void {
    this.handleAddToCart(event.product, event.quantity);
  }

  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit);
  }

  isOutOfStock(product: Product): boolean {
    return product.stock_quantity === 0;
  }


  quickAddToCart(product: Product): void {
    const quantity = this.productQuantities[product.id] || 1;
    this.handleAddToCart(product, quantity);
  }

  getProductQuantity(productId: number): number {
    if (this.productQuantities[productId]) {
      return this.productQuantities[productId];
    }
    
    // Find the product to get its config
    const product = this.products().find(p => p.id === productId);
    if (product?.quantity_config?.type === 'list' && product.quantity_config.quantities && product.quantity_config.quantities.length > 0) {
      return product.quantity_config.quantities[0];
    }
    
    return 1;
  }

  setProductQuantity(productId: number, quantity: number): void {
    this.productQuantities[productId] = quantity;
  }
  
  getAddToCartLabel(product: Product): string {
    return 'Add to Cart';
  }


  getLowStockMessage(product: Product): string {
    return this.translateService.instant('products.stock.low_stock', { count: product.stock_quantity });
  }

  // Private methods
  private loadCategoriesAndProducts(): void {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.selectedCategories.set([...categories]);
        this.appliedCategories.set([...categories]);
        
        // Load all products to calculate counts
        this.updateCategoryCounts();

        this.route.queryParams.pipe(
          tap(params => {
            if (params['category']) {
              const categoryId = Number(params['category']);
              this.filters.update(f => ({ ...f, category_id: categoryId }));
              
              const selectedCategory = this.categories().find(c => c.id === categoryId);
              if (selectedCategory) {
                this.selectedCategories.set([selectedCategory]);
              }
            }
            
            if (params['search']) {
              this.searchQuery.set(params['search']);
              this.filters.update(f => ({ ...f, search: params['search'] }));
            }
            
            if (params['layout'] && (params['layout'] === 'grid' || params['layout'] === 'list')) {
              this.layout.set(params['layout']);
            }
            
            this.loading.set(true);
          }),
          switchMap(() => this.loadProducts())
        ).subscribe();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('products.filters.error')
        });
        this.loading.set(false);
      }
    });
  }

  private loadProducts(): Observable<Product[]> {
    const selectedCats = this.selectedCategories();
    
    if (selectedCats.length === 0) {
      this.products.set([]);
      this.loading.set(false);
      return of([]);
    }
    
    if (selectedCats.length === 1) {
      const currentFilters = { ...this.filters(), category_id: selectedCats[0].id };
      return this.productService.getProducts(currentFilters).pipe(
        tap(products => {
          this.products.set(products);
          products.forEach(p => {
            if (!this.productQuantities[p.id]) {
              // For list type, set to first available option
              if (p.quantity_config?.type === 'list' && p.quantity_config.quantities && p.quantity_config.quantities.length > 0) {
                this.productQuantities[p.id] = p.quantity_config.quantities[0];
              } else {
                this.productQuantities[p.id] = 1;
              }
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
            // For list type, set to first available option
            if (p.quantity_config?.type === 'list' && p.quantity_config.quantities && p.quantity_config.quantities.length > 0) {
              this.productQuantities[p.id] = p.quantity_config.quantities[0];
            } else {
              this.productQuantities[p.id] = 1;
            }
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
        // Successfully added to cart - no toast notification
      },
      error: (error: any) => {
        console.error('Error adding to cart:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('products.cart.error'),
          life: 3000
        });
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
}