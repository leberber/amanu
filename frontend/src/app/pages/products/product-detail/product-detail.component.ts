// src/app/pages/products/product-detail/product-detail.component.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ProductQuantitySelectorComponent } from '../../../shared/components/product-quantity-selector/product-quantity-selector.component';
import { BadgeModule } from 'primeng/badge';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Services and models
import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { UnitsService } from '../../../core/services/units.service';
import { Product, Category } from '../../../models/product.model';
import { PRODUCT } from '../../../core/constants/app.constants';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    CardModule,
    ToastModule,
    TagModule,
    SelectModule,
    ProductQuantitySelectorComponent,
    BadgeModule,
    TranslateModule
  ],
  providers: [MessageService],
  templateUrl: './product-detail.component.html'
})
export class ProductDetailComponent implements OnInit {
  // Dependency injection
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  public authService = inject(AuthService);
  
  // Signals
  product = signal<Product | null>(null);
  category = signal<Category | null>(null);
  relatedProducts = signal<Product[]>([]);
  loading = signal<boolean>(true);
  error = signal<boolean>(false);
  selectedQuantity = signal<number>(1);
  
  // For related products quantities
  productQuantities: { [key: number]: number } = {};
  
  // Computed values
  isOutOfStock = computed(() => {
    return this.product()?.stock_quantity === 0;
  });
  
  isLowStock = computed(() => {
    const product = this.product();
    return product ? (product.stock_quantity > 0 && product.stock_quantity < PRODUCT.LOW_STOCK_THRESHOLD) : false;
  });

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
    if (!currentProduct) return '';
    
    return this.getUnitDisplay(currentProduct.unit);
  });

  ngOnInit() {
    this.route.paramMap.pipe(
      switchMap(params => {
        const productId = params.get('id');
        if (!productId) {
          this.error.set(true);
          this.loading.set(false);
          return of(null);
        }
        
        return this.productService.getProduct(Number(productId)).pipe(
          catchError(error => {
            this.error.set(true);
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('common.error'),
              detail: this.translateService.instant('products.errors.failed_to_load')
            });
            return of(null);
          })
        );
      })
    ).subscribe(product => {
      if (product) {
        this.product.set(product);
        
        // Initialize selectedQuantity based on product's quantity config
        if (product.quantity_config?.type === 'list' && product.quantity_config.quantities && product.quantity_config.quantities.length > 0) {
          this.selectedQuantity.set(product.quantity_config.quantities[0]);
        } else {
          this.selectedQuantity.set(1);
        }
        
        // Load category
        this.productService.getCategory(product.category_id).subscribe(category => {
          this.category.set(category);
        });
        
        // Load related products (same category, excluding current product)
        this.productService.getProductsByCategory(product.category_id).subscribe(products => {
          const related = products.filter(p => p.id !== product.id).slice(0, 4);
          this.relatedProducts.set(related);
          
          // Initialize quantities for related products
          this.initializeRelatedProductQuantities(related);
        });
      }
      
      this.loading.set(false);
    });
  }
  
  // Initialize quantity inputs for related products
  private initializeRelatedProductQuantities(products: Product[]): void {
    products.forEach(product => {
      if (!this.productQuantities[product.id]) {
        // Set default quantity based on product's quantity config
        if (product.quantity_config?.type === 'list' && product.quantity_config.quantities && product.quantity_config.quantities.length > 0) {
          this.productQuantities[product.id] = product.quantity_config.quantities[0];
        } else {
          this.productQuantities[product.id] = 1;
        }
      }
    });
  }

  // Add to cart method for main product
  addToCart(): void {
    const currentProduct = this.product();
    if (!currentProduct || this.isOutOfStock()) return;
    
    const quantity = this.selectedQuantity();
    
    this.cartService.addToCart(currentProduct, quantity).subscribe({
      next: () => {
        // this.messageService.add({
        //   severity: 'success',
        //   summary: this.translateService.instant('products.cart.added_to_cart'),
        //   detail: this.translateService.instant('products.cart.added_message', {
        //     quantity: quantity,
        //     unit: this.getUnitDisplay(currentProduct.unit),
        //     name: currentProduct.name
        //   }),
        //   life: 3000
        // });
      },
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
  
  // Quick add to cart for related products
  addRelatedToCart(product: Product, event: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (product.stock_quantity === 0) {
      return;
    }
    
    const quantity = this.productQuantities[product.id] || 1;
    
    this.cartService.addToCart(product, quantity).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('products.cart.added_to_cart'),
          detail: this.translateService.instant('products.cart.added_message', {
            quantity: quantity,
            unit: this.getUnitDisplay(product.unit),
            name: product.name
          }),
          life: 3000
        });
      },
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
  
  
  // Get the display label for the selected quantity
  getSelectedQuantityLabel(productId: number): string {
    const quantity = this.productQuantities[productId];
    if (!quantity) return this.translateService.instant('products.product.select_quantity');
    
    const products = this.relatedProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return `${quantity} units`;
    
    return `${quantity} ${this.getUnitDisplay(product.unit)}`;
  }

  // Helper function to get proper unit display
  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit, true);
  }
  
  // Check if a product is out of stock
  isProductOutOfStock(product: Product): boolean {
    return product.stock_quantity === 0;
  }
  
  // Check if a product is low on stock
  isProductLowStock(product: Product): boolean {
    return product.stock_quantity > 0 && product.stock_quantity < PRODUCT.LOW_STOCK_THRESHOLD;
  }
  
  // Get stock message for a specific product
  getProductStockMessage(product: Product): string {
    return this.isProductOutOfStock(product) 
      ? this.translateService.instant('products.stock.out_of_stock')
      : this.translateService.instant('products.stock.low_stock', { count: product.stock_quantity });
  }
  
  // Get stock icon
  getStockIcon(product: Product): string {
    return this.isProductOutOfStock(product) 
      ? 'pi pi-exclamation-circle' 
      : 'pi pi-exclamation-triangle';
  }
  
  // Get stock color class
  getStockColorClass(product: Product): string {
    return this.isProductOutOfStock(product) ? 'text-red-500' : 'text-orange-500';
  }

  // Format price using CurrencyService
  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }
}