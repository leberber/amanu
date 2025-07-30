import { Component, computed, effect, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin, of, Subscription } from 'rxjs';
import { switchMap, tap, map } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { TranslationService } from '../../../services/translation.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { UnitsService } from '../../../core/services/units.service';
import { Product, Category, ProductFilter } from '../../../models/product.model';
import { PRODUCT } from '../../../core/constants/app.constants';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

interface LayoutOption {
  icon: string;
  value: 'grid' | 'list';
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    BadgeModule,
    CommonModule,
    FormsModule,
    AccordionModule,
    RouterLink,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    SelectButtonModule,
    CheckboxModule,
    MenuModule,
    SelectModule,
    TranslateModule,
    LoadingStateComponent,
    EmptyStateComponent
  ],
  providers: [MessageService],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss'
})
export class ProductListComponent implements OnInit, OnDestroy {
  // Signals
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  selectedCategories = signal<Category[]>([]);
  loading = signal(true);
  showMobileFilters = signal(false);
  searchQuery = signal('');
  selectedSort = signal('name_asc');
  layout = signal<'grid' | 'list'>('grid');
  filters = signal<ProductFilter>({
    active_only: true,
    sort_by: 'name',
    sort_order: 'asc'
  });
  
  // State properties
  categorySelections: { [key: number]: boolean } = {};
  productQuantities: { [key: number]: number } = {};
  
  // UI properties
  viewOptions: LayoutOption[] = [
    { icon: 'pi pi-th-large', value: 'grid' },
    { icon: 'pi pi-list', value: 'list' }
  ];
  
  sortOptions: any[] = [];
  
  sortMenuItems = computed(() => {
    return this.sortOptions.map(option => ({
      label: option.label,
      command: () => {
        this.selectedSort.set(option.value);
        this.onSortChange();
      }
    }));
  });
  
  // Subscriptions
  private languageSubscription?: Subscription;
  
  // Services
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private cartService = inject(CartService);
  private translateService = inject(TranslateService);
  private translationService = inject(TranslationService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  
  // Public methods
  isSelected(category: Category): boolean {
    return this.selectedCategories().includes(category);
  }
  
  onCategorySelectionChange(category: Category): void {
    const isChecked = this.categorySelections[category.id];
    const currentSelected = this.selectedCategories();
    
    if (isChecked) {
      if (!this.isSelected(category)) {
        this.selectedCategories.set([...currentSelected, category]);
      }
    } else {
      this.selectedCategories.set(
        currentSelected.filter(c => c.id !== category.id)
      );
    }
    
    this.onCategoryChange();
  }
  
  toggleMobileFilters(): void {
    this.showMobileFilters.update(show => !show);
  }
  
  selectAllCategories(): void {
    const allCategories = this.categories();
    this.selectedCategories.set([...allCategories]);
    
    allCategories.forEach(category => {
      this.categorySelections[category.id] = true;
    });
    
    this.onCategoryChange();
  }
  
  deselectAllCategories(): void {
    this.selectedCategories.set([]);
    
    this.categories().forEach(category => {
      this.categorySelections[category.id] = false;
    });
    
    this.onCategoryChange();
  }
  
  // Lifecycle hooks
  ngOnInit(): void {
    this.sortOptions = [
      { label: this.translateService.instant('products.sort.name_asc'), value: 'name_asc' },
      { label: this.translateService.instant('products.sort.name_desc'), value: 'name_desc' },
      { label: this.translateService.instant('products.sort.price_asc'), value: 'price_asc' },
      { label: this.translateService.instant('products.sort.price_desc'), value: 'price_desc' },
      { label: this.translateService.instant('products.sort.newest'), value: 'created_at_desc' },
      { label: this.translateService.instant('products.sort.oldest'), value: 'created_at_asc' }
    ];
    
    effect(() => {
      const sortValue = this.selectedSort();
      const [sortBy, sortOrder] = sortValue.split('_');
      this.filters.update(f => ({
        ...f,
        sort_by: sortBy as 'name' | 'price' | 'created_at',
        sort_order: sortOrder as 'asc' | 'desc'
      }));
    });

    effect(() => {
      const currentLayout = this.layout();
      localStorage.setItem('product-list-layout', currentLayout);
    });
    
    const savedLayout = localStorage.getItem('product-list-layout');
    if (savedLayout === 'grid' || savedLayout === 'list') {
      this.layout.set(savedLayout);
    }
    
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      this.loadCategoriesAndProducts();
    });
    
    this.loadCategoriesAndProducts();
  }

  ngOnDestroy(): void {
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  private loadCategoriesAndProducts(): void {
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
        console.log('Categories loaded with translations:', categories);
        this.categories.set(categories);
        this.selectedCategories.set([...categories]);
        
        // Initialize category selection state
        categories.forEach(category => {
          this.categorySelections[category.id] = true;
        });
        
        this.route.queryParams.pipe(
          tap(params => {
            if (params['category']) {
              const categoryId = Number(params['category']);
              this.filters.update(f => ({ ...f, category_id: categoryId }));
              
              const selectedCategory = this.categories().find(c => c.id === categoryId);
              if (selectedCategory) {
                // Reset all selections to false
                categories.forEach(cat => {
                  this.categorySelections[cat.id] = false;
                });
                // Set only the selected category to true
                this.categorySelections[categoryId] = true;
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

  loadProducts(): Observable<Product[]> {
    const selectedCats = this.selectedCategories();
    
    // If no categories selected, return empty array
    if (selectedCats.length === 0) {
      this.products.set([]);
      this.loading.set(false);
      return of([]);
    }
    
    // If only one category selected, use simple API call
    if (selectedCats.length === 1) {
      const currentFilters = { ...this.filters(), category_id: selectedCats[0].id };
      return this.productService.getProducts(currentFilters).pipe(
        tap(products => {
          console.log('Products loaded with translations:', products);
          this.products.set(products);
          this.initializeQuantities(products);
          this.loading.set(false);
        })
      );
    }
    
    // For multiple categories, make multiple calls and combine results
    this.loading.set(true);
    
    // Create an array of observables, one for each category
    const categoryObservables = selectedCats.map(category => {
      const categoryFilter = { ...this.filters(), category_id: category.id };
      return this.productService.getProducts(categoryFilter);
    });
    
    // Combine all the results
    return forkJoin(categoryObservables).pipe(
      map(results => {
        // Flatten the array of arrays and remove duplicates
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
        
        // Sort the combined results according to the current sort option
        this.sortProducts(allProducts);
        
        console.log('Combined products loaded with translations:', allProducts);
        this.products.set(allProducts);
        this.initializeQuantities(allProducts);
        this.loading.set(false);
        return allProducts;
      })
    );
  }
  
  private initializeQuantities(products: Product[]): void {
    products.forEach(product => {
      if (!this.productQuantities[product.id]) {
        this.productQuantities[product.id] = 5;
      }
    });
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

  onSortChange(): void {
    this.loadProducts().subscribe();
  }

  onCategoryChange(): void {
    this.loadProducts().subscribe();
  }

  onSearch(): void {
    this.filters.update(f => ({ ...f, search: this.searchQuery() }));
    this.loadProducts().subscribe();
  }

  onLayoutChange(): void {
    localStorage.setItem('product-list-layout', this.layout());
  }
  
  toggleLayout(): void {
    const newLayout = this.layout() === 'grid' ? 'list' : 'grid';
    this.layout.set(newLayout);
    this.onLayoutChange();
  }

  clearFilters(): void {
    this.filters.set({
      active_only: true,
      sort_by: 'name',
      sort_order: 'asc'
    });
    
    // Reset category selections
    const allCategories = this.categories();
    this.selectedCategories.set([...allCategories]);
    
    // Update checkbox state
    allCategories.forEach(category => {
      this.categorySelections[category.id] = true;
    });
    
    this.searchQuery.set('');
    this.selectedSort.set('name_asc');
    this.loadProducts().subscribe();
    this.showMobileFilters.set(false);
  }

  hasActiveFilters(): boolean {
    if (this.searchQuery().trim() !== '') {
      return true;
    }
    
    const allCategories = this.categories();
    const selectedCategories = this.selectedCategories();
    if (allCategories.length > 0 && selectedCategories.length !== allCategories.length) {
      return true;
    }
    
    return false;
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitDisplay(unit);
  }

  addToCartWithQuantity(product: Product, quantity: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (product.stock_quantity === 0 || quantity <= 0) {
      return;
    }
    
    const actualQuantity = Math.min(quantity, product.stock_quantity);
    
    this.cartService.addToCart(product, actualQuantity).subscribe({
      next: () => {},
      error: (error) => {
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

  addToCart(event: Event, product: Product): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (product.stock_quantity === 0) {
      return;
    }
    
    const quantity = this.productQuantities[product.id] || 5;
    this.addToCartWithQuantity(product, quantity, event);
  }
  
  private generateQuantityOptions(product: Product, step: number = 5, max: number = 1000): { label: string; value: number }[] {
    const unitDisplay = this.getUnitDisplay(product.unit);
    
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => {
      const value = i * step;
      return {
        label: `${value} ${unitDisplay}`,
        value
      };
    }).slice(1);
  }
  
  getQuantityOptions(maxQuantity: number, productId?: number): any[] {
    let product: Product | undefined;
    
    if (productId) {
      product = this.products().find(p => p.id === productId);
    } else if (maxQuantity) {
      product = this.products().find(p => p.stock_quantity === maxQuantity) || 
               this.products().find(p => p.stock_quantity >= maxQuantity);
    }
    
    if (!product && this.products().length > 0) {
      product = this.products()[0];
    }
    
    const unitDisplay = product ? this.getUnitDisplay(product.unit) : 'units';
    
    const allOptions = product ? 
      this.generateQuantityOptions(product, 5, 1000) : 
      Array.from({ length: Math.floor(1000 / 5) + 1 }, (_, i) => {
        const value = i * 5;
        return { label: `${value} ${unitDisplay}`, value };
      }).slice(1);
    
    const maxStock = maxQuantity || 5;
    const filteredOptions = allOptions.filter(option => option.value <= maxStock);
    
    if (filteredOptions.length === 0) {
      filteredOptions.push({
        label: `${maxStock} ${unitDisplay}`,
        value: maxStock
      });
    }
    
    return filteredOptions;
  }
  
  getSelectedQuantityLabel(productId: number): string {
    const quantity = this.productQuantities[productId];
    if (!quantity) return this.translateService.instant('products.product.select_quantity');
    
    const product = this.products().find(p => p.id === productId);
    if (!product) return `${quantity} units`;
    
    return `${quantity} ${this.getUnitDisplay(product.unit)}`;
  }
  
  isOutOfStock(product: Product): boolean {
    return product.stock_quantity === 0;
  }
  
  isLowStock(product: Product): boolean {
    return product.stock_quantity > 0 && product.stock_quantity < PRODUCT.LOW_STOCK_THRESHOLD;
  }
  
  getStockMessage(product: Product): string {
    return this.isOutOfStock(product) 
      ? this.translateService.instant('products.stock.out_of_stock')
      : this.translateService.instant('products.stock.low_stock', { count: product.stock_quantity });
  }
  
  getStockIcon(product: Product): string {
    return this.isOutOfStock(product) 
      ? 'pi pi-exclamation-circle' 
      : 'pi pi-exclamation-triangle';
  }
  
  getStockColorClass(product: Product): string {
    return this.isOutOfStock(product) ? 'text-red-500' : 'text-orange-500';
  }
  
  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }
}