// src/app/pages/products/product-list/product-list.component.ts
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { switchMap, tap, map } from 'rxjs/operators';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService, MenuItem } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';

// Services and models
import { CartService } from '../../../services/cart.service';
import { ProductService } from '../../../services/product.service';
import { Product, Category, ProductFilter } from '../../../models/product.model';

interface SortOption {
  label: string;
  value: string;
}

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
    DropdownModule,
    InputTextModule,
    ToastModule,
    SelectButtonModule,
    CheckboxModule,
    MenuModule,
    SelectModule
  ],
  providers: [MessageService],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss'

})
export class ProductListComponent implements OnInit {
  // Services
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private cartService = inject(CartService);
  
  // Signals
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  selectedCategories = signal<Category[]>([]);
  loading = signal(true);
  showMobileFilters = signal(false);
  searchQuery = signal('');
  selectedSort = signal('name_asc');
  layout = signal<'grid' | 'list'>('grid');
  
  // For category checkbox state (binary)
  categorySelections: { [key: number]: boolean } = {};
  
  // For quantities (keeping as object for performance)
  productQuantities: { [key: number]: number } = {};
  
  // Filters signal with computed values for sort
  filters = signal<ProductFilter>({
    active_only: true,
    sort_by: 'name',
    sort_order: 'asc'
  });
  
  // Sort options
  sortOptions: SortOption[] = [
    { label: 'Name A-Z', value: 'name_asc' },
    { label: 'Name Z-A', value: 'name_desc' },
    { label: 'Price Low to High', value: 'price_asc' },
    { label: 'Price High to Low', value: 'price_desc' },
    { label: 'Newest First', value: 'created_at_desc' }
  ];
  
  // Computed sort menu items for mobile based on sort options
  sortMenuItems = computed(() => {
    return this.sortOptions.map(option => ({
      label: option.label,
      command: () => {
        this.selectedSort.set(option.value);
        this.onSortChange();
      }
    }));
  });
  
  // View options - modified for better mobile display
  viewOptions: LayoutOption[] = [
    { icon: 'pi pi-th-large', value: 'grid' },
    { icon: 'pi pi-list', value: 'list' }
  ];

  constructor() {
    // Setup effect to update filters when sort changes
    effect(() => {
      const sortValue = this.selectedSort();
      const [sortBy, sortOrder] = sortValue.split('_');
      this.filters.update(f => ({
        ...f,
        sort_by: sortBy as 'name' | 'price' | 'created_at',
        sort_order: sortOrder as 'asc' | 'desc'
      }));
    });

    // Effect to save layout preference in localStorage
    effect(() => {
      const currentLayout = this.layout();
      localStorage.setItem('product-list-layout', currentLayout);
    });
  }
  
  // Helper method to check if a category is selected
  isSelected(category: Category): boolean {
    return this.selectedCategories().includes(category);
  }
  
  // Handle category selection change with binary checkbox
  onCategorySelectionChange(category: Category): void {
    const isChecked = this.categorySelections[category.id];
    const currentSelected = this.selectedCategories();
    
    if (isChecked) {
      // Add to selection if not already there
      if (!this.isSelected(category)) {
        this.selectedCategories.set([...currentSelected, category]);
      }
    } else {
      // Remove from selection
      this.selectedCategories.set(
        currentSelected.filter(c => c.id !== category.id)
      );
    }
    
    this.onCategoryChange();
  }
  
  // Toggle mobile filters panel
  toggleMobileFilters(): void {
    this.showMobileFilters.update(show => !show);
  }
  
  // Select all categories
  selectAllCategories(): void {
    const allCategories = this.categories();
    this.selectedCategories.set([...allCategories]);
    
    // Update checkbox state
    allCategories.forEach(category => {
      this.categorySelections[category.id] = true;
    });
    
    this.onCategoryChange();
  }
  
  // Deselect all categories
  deselectAllCategories(): void {
    this.selectedCategories.set([]);
    
    // Update checkbox state
    this.categories().forEach(category => {
      this.categorySelections[category.id] = false;
    });
    
    this.onCategoryChange();
  }
  
  ngOnInit(): void {
    // Check if we have a stored layout preference
    const savedLayout = localStorage.getItem('product-list-layout');
    if (savedLayout === 'grid' || savedLayout === 'list') {
      this.layout.set(savedLayout);
    }
    
    this.productService.getCategories(true).subscribe({
      next: (categories) => {
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
          summary: 'Error',
          detail: 'Failed to load categories'
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
        
        this.products.set(allProducts);
        this.initializeQuantities(allProducts);
        this.loading.set(false);
        return allProducts;
      })
    );
  }
  
  // Initialize quantity inputs for all products
  private initializeQuantities(products: Product[]): void {
    products.forEach(product => {
      if (!this.productQuantities[product.id]) {
        // Set default quantity to 5 for each product
        this.productQuantities[product.id] = 5;
      }
    });
  }
  
  // Helper method to sort products
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
    // Store layout preference in localStorage
    localStorage.setItem('product-list-layout', this.layout());
  }
  
  // Toggle between grid and list view
  toggleLayout(): void {
    // Switch to opposite layout
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

  // Unit display helper
  getUnitDisplay(unit: string): string {
    switch (unit) {
      case 'kg':
        return 'Kg';
      case 'gram':
        return 'g';
      case 'piece':
        return 'Piece';
      case 'bunch':
        return 'Bunch';
      case 'dozen':
        return 'Dozen';
      case 'pound':
        return 'lb';
      default:
        return unit;
    }
  }

  // Method to add product to cart with specific quantity
  addToCartWithQuantity(product: Product, quantity: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (product.stock_quantity === 0 || quantity <= 0) {
      return;
    }
    
    // Check if quantity is greater than stock and cap it if needed
    const actualQuantity = Math.min(quantity, product.stock_quantity);
    
    this.cartService.addToCart(product, actualQuantity).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Added to Cart',
          detail: `${actualQuantity} ${this.getUnitDisplay(product.unit)} of ${product.name} added to your cart`,
          life: 300
        });
      },
      error: (error) => {
        console.error('Error adding to cart:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to add item to cart',
          life: 3000
        });
      }
    });
  }

  // Add from select dropdown
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
  
  // Generate quantity options with a consistent step size and dynamic unit
  private generateQuantityOptions(product: Product, step: number = 5, max: number = 1000): { label: string; value: number }[] {
    const unitDisplay = this.getUnitDisplay(product.unit);
    
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => {
      const value = i * step;
      return {
        label: `${value} ${unitDisplay}`,
        value
      };
    }).slice(1); // remove 0
  }
  
  // Get select options with increments of 5 and dynamic unit
  getQuantityOptions(maxQuantity: number, productId?: number): any[] {
    // Find the product by id or by stock quantity
    let product: Product | undefined;
    
    if (productId) {
      product = this.products().find(p => p.id === productId);
    } else if (maxQuantity) {
      product = this.products().find(p => p.stock_quantity === maxQuantity) || 
               this.products().find(p => p.stock_quantity >= maxQuantity);
    }
    
    // Default to first product if we still don't have one
    if (!product && this.products().length > 0) {
      product = this.products()[0];
    }
    
    // If we have no products yet, use a default unit
    const unitDisplay = product ? this.getUnitDisplay(product.unit) : 'units';
    
    // Generate options with increments of 5
    const allOptions = product ? 
      this.generateQuantityOptions(product, 5, 1000) : 
      Array.from({ length: Math.floor(1000 / 5) + 1 }, (_, i) => {
        const value = i * 5;
        return { label: `${value} ${unitDisplay}`, value };
      }).slice(1);
    
    // Filter options to not exceed the max stock quantity
    const maxStock = maxQuantity || 5; // Default to at least showing 5 if no stock
    const filteredOptions = allOptions.filter(option => option.value <= maxStock);
    
    // If no options were added (very low stock), add at least one option
    if (filteredOptions.length === 0) {
      filteredOptions.push({
        label: `${maxStock} ${unitDisplay}`,
        value: maxStock
      });
    }
    
    return filteredOptions;
  }
  
  // Get the display label for the selected quantity with dynamic unit
  getSelectedQuantityLabel(productId: number): string {
    const quantity = this.productQuantities[productId];
    if (!quantity) return 'Select quantity';
    
    const product = this.products().find(p => p.id === productId);
    if (!product) return `${quantity} units`;
    
    return `${quantity} ${this.getUnitDisplay(product.unit)}`;
  }
  
  // Check if a product is out of stock
  isOutOfStock(product: Product): boolean {
    return product.stock_quantity === 0;
  }
  
  // Check if a product is low on stock
  isLowStock(product: Product): boolean {
    return product.stock_quantity > 0 && product.stock_quantity < 10;
  }
  
  // Get stock message
  getStockMessage(product: Product): string {
    return this.isOutOfStock(product) 
      ? 'Out of stock' 
      : `Only ${product.stock_quantity} left in stock`;
  }
  
  // Get stock icon
  getStockIcon(product: Product): string {
    return this.isOutOfStock(product) 
      ? 'pi pi-exclamation-circle' 
      : 'pi pi-exclamation-triangle';
  }
  
  // Get stock color class
  getStockColorClass(product: Product): string {
    return this.isOutOfStock(product) ? 'text-red-500' : 'text-orange-500';
  }
}