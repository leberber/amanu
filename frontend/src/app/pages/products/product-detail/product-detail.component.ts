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
// import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';

// Services and models
import { ProductService } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { Product, Category } from '../../../models/product.model';

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
    // TabViewModule,
    TagModule,
    SelectModule,
    BadgeModule
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
  public authService = inject(AuthService);
  
  // Signals
  product = signal<Product | null>(null);
  category = signal<Category | null>(null);
  relatedProducts = signal<Product[]>([]);
  loading = signal<boolean>(true);
  error = signal<boolean>(false);
  selectedQuantity = signal<number>(5);
  
  // For related products quantities
  productQuantities: { [key: number]: number } = {};
  
  // Computed values
  isOutOfStock = computed(() => {
    return this.product()?.stock_quantity === 0;
  });
  
  isLowStock = computed(() => {
    const product = this.product();
    return product ? (product.stock_quantity > 0 && product.stock_quantity < 10) : false;
  });
  
  stockMessage = computed(() => {
    const product = this.product();
    if (!product) return '';
    
    return this.isOutOfStock() 
      ? 'Out of stock' 
      : `Only ${product.stock_quantity} left in stock`;
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
              summary: 'Error',
              detail: 'Failed to load product'
            });
            return of(null);
          })
        );
      })
    ).subscribe(product => {
      if (product) {
        this.product.set(product);
        
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
        // Set default quantity to 5 for each product
        this.productQuantities[product.id] = 5;
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
        this.messageService.add({
          severity: 'success',
          summary: 'Added to Cart',
          detail: `${quantity} ${this.getUnitDisplay(currentProduct.unit)} of ${currentProduct.name} added to your cart`,
          life: 3000
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
  
  // Quick add to cart for related products
  addRelatedToCart(product: Product, event: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (product.stock_quantity === 0) {
      return;
    }
    
    const quantity = this.productQuantities[product.id] || 5;
    
    this.cartService.addToCart(product, quantity).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Added to Cart',
          detail: `${quantity} ${this.getUnitDisplay(product.unit)} of ${product.name} added to your cart`,
          life: 3000
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
  
  // Generate quantity options with a consistent step size
  getQuantityOptions(maxQuantity: number): any[] {
    const product = this.product();
    if (!product) return [];
    
    const unitDisplay = this.getUnitDisplay(product.unit);
    const step = 5;
    const max = 1000;
    
    // Generate options with increments of 5
    const allOptions = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => {
      const value = i * step;
      return {
        label: `${value} ${unitDisplay}`,
        value
      };
    }).slice(1); // remove 0
    
    // Filter options to not exceed the max stock quantity
    return allOptions.filter(option => option.value <= maxQuantity);
  }
  
  // Get quantity options for related products
  getRelatedQuantityOptions(product: Product): any[] {
    const unitDisplay = this.getUnitDisplay(product.unit);
    const step = 5;
    const max = 1000;
    
    // Generate options with increments of 5
    const allOptions = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => {
      const value = i * step;
      return {
        label: `${value} ${unitDisplay}`,
        value
      };
    }).slice(1); // remove 0
    
    // Filter options to not exceed the max stock quantity
    return allOptions.filter(option => option.value <= product.stock_quantity);
  }
  
  // Get the display label for the selected quantity
  getSelectedQuantityLabel(productId: number): string {
    const quantity = this.productQuantities[productId];
    if (!quantity) return 'Select quantity';
    
    const products = this.relatedProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return `${quantity} units`;
    
    return `${quantity} ${this.getUnitDisplay(product.unit)}`;
  }

  // Helper function to get proper unit display
  getUnitDisplay(unit: string): string {
    switch (unit) {
      case 'kg': return 'Kg';
      case 'gram': return 'g';
      case 'piece': return 'Piece';
      case 'bunch': return 'Bunch';
      case 'dozen': return 'Dozen';
      case 'pound': return 'lb';
      default: return unit;
    }
  }
  
  // Check if a product is out of stock
  isProductOutOfStock(product: Product): boolean {
    return product.stock_quantity === 0;
  }
  
  // Check if a product is low on stock
  isProductLowStock(product: Product): boolean {
    return product.stock_quantity > 0 && product.stock_quantity < 10;
  }
  
  // Get stock message for a specific product
  getProductStockMessage(product: Product): string {
    return this.isProductOutOfStock(product) 
      ? 'Out of stock' 
      : `Only ${product.stock_quantity} left in stock`;
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
}