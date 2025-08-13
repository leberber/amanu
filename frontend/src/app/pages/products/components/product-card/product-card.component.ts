import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// PrimeNG imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';

import { Product } from '../../../../models/product.model';
import { CurrencyService } from '../../../../core/services/currency.service';
import { UnitsService } from '../../../../core/services/units.service';
import { CartService } from '../../../../services/cart.service';
import { ProductQuantitySelectorComponent } from '../../../../shared/components/product-quantity-selector/product-quantity-selector.component';

export interface AddToCartEvent {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    CardModule,
    ButtonModule,
    TagModule,
    BadgeModule,
    ProductQuantitySelectorComponent
  ],
  template: `
    <div class="product-card surface-card border-round-lg overflow-hidden h-full flex flex-column hover:shadow-2">
      <!-- Product Image -->
      <a [routerLink]="['/products', product.id]" class="block relative overflow-hidden product-image-container">
        <img 
          [src]="product.image_url || 'assets/images/product-placeholder.jpg'"
          [alt]="product.name"
          class="w-full product-image"
          style="height: 220px; object-fit: cover;"
        >
        <!-- Overlay badges -->
        <div class="absolute top-0 left-0 w-full p-2 flex justify-content-between align-items-start">
          @if (product.is_organic) {
            <p-tag 
              severity="success" 
              [value]="'products.product.organic' | translate" 
              class="shadow-2"
              icon="pi pi-leaf"
            ></p-tag>
          }
          @if (isLowStock && !isOutOfStock) {
            <p-tag 
              severity="warning" 
              [value]="'products.stock.low_stock_title' | translate"
              class="shadow-2 ml-auto"
              icon="pi pi-exclamation-triangle"
            ></p-tag>
          }
        </div>
      </a>
    
      <!-- Product Info -->
      <div class="flex-grow-1 p-4 flex flex-column">
        <!-- Title and Category -->
        <div class="mb-2">
          <h4 class="m-0 mb-1 text-xl font-semibold">
            <a [routerLink]="['/products', product.id]" class="text-900 no-underline hover:text-primary transition-colors transition-duration-200">
              {{ product.name }}
            </a>
          </h4>
          <p class="text-sm text-500 m-0">{{ getCategoryName() }}</p>
        </div>
        
        <!-- Description -->
        <p class="text-600 text-sm mb-3 line-height-3" style="min-height: 2.5rem;">
          {{ product.description || ('products.default_description' | translate) }}
        </p>
        
        <!-- Price and Stock -->
        <div class="flex align-items-center justify-content-between mb-3">
          <div>
            <div class="text-xl font-bold text-900">
              {{ formatPrice(product.price) }}
            </div>
            <span class="text-xs text-600">{{ 'products.price_per' | translate }} {{ getUnitDisplay(product.unit) }}</span>
          </div>
          
          <!-- Stock indicator -->
          <div class="text-right">
            @if (isOutOfStock) {
              <span class="text-red-500 font-medium text-sm">
                <i class="pi pi-times-circle mr-1"></i>{{ 'products.stock.out_of_stock' | translate }}
              </span>
            } @else if (isLowStock) {
              <span class="text-orange-500 font-medium text-sm">
                <i class="pi pi-exclamation-circle mr-1"></i>{{ 'products.stock.items_left' | translate: {count: product.stock_quantity} }}
              </span>
            } @else {
              <span class="text-green-500 font-medium text-sm">
                <i class="pi pi-check-circle mr-1"></i>{{ 'products.stock.in_stock' | translate }}
              </span>
            }
          </div>
        </div>
        
        <!-- Quantity Selector and Add to Cart -->
        <div class="mt-auto">
          @if (!isOutOfStock) {
            <app-product-quantity-selector
              [(value)]="selectedQuantity"
              [unit]="product.unit"
              [stockQuantity]="product.stock_quantity"
              [quantityConfig]="product.quantity_config"
              [pricePerUnit]="product.price"
              [disabled]="!product.stock_quantity || product.stock_quantity === 0"
              [showStock]="true"
              (quantityChanged)="onQuantityChanged($event)">
            </app-product-quantity-selector>
            
            <!-- Add to cart button -->
            <button
              pButton
              type="button"
              [label]="getAddToCartLabel()"
              icon="pi pi-shopping-cart"
              class="p-button-primary w-full mt-3"
              [disabled]="!product.stock_quantity || product.stock_quantity === 0 || selectedQuantity === 0 || selectedQuantity > product.stock_quantity"
              (click)="addToCart()">
            </button>
          } @else {
            <button
              pButton
              [label]="'products.stock.out_of_stock' | translate"
              class="w-full p-button-secondary"
              icon="pi pi-times"
              [disabled]="true"
            ></button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    
    .product-card {
      border: 1px solid var(--surface-border);
      background: var(--surface-card);
      transition: all 0.3s ease;
    }
    
    .product-card:hover {
      border-color: var(--primary-color-light);
      transform: translateY(-2px);
    }
    
    .product-image-container {
      position: relative;
      overflow: hidden;
    }
    
    .product-image {
      transition: transform 0.3s ease;
    }
    
    .product-image-container:hover .product-image {
      transform: scale(1.05);
    }
    
    .no-underline {
      text-decoration: none;
    }
    
    .hover\\:text-primary:hover {
      color: var(--primary-color);
    }
    
    p-tag {
      font-size: 0.75rem;
    }
  `]
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Output() addToCartEvent = new EventEmitter<AddToCartEvent>();

  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  private cartService = inject(CartService);
  private translateService = inject(TranslateService);

  selectedQuantity = 1;

  get isOutOfStock(): boolean {
    return this.product.stock_quantity === 0;
  }

  get isLowStock(): boolean {
    return this.product.stock_quantity > 0 && this.product.stock_quantity < 20;
  }

  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitDisplay(unit);
  }

  getLowStockMessage(): string {
    return this.translateService.instant('products.stock.low_stock', { count: this.product.stock_quantity });
  }

  getCategoryName(): string {
    // TODO: Implement category name lookup
    return this.translateService.instant('products.category.default');
  }

  onQuantityChanged(quantity: number): void {
    this.selectedQuantity = quantity;
  }
  
  getAddToCartLabel(): string {
    if (this.selectedQuantity === 0) {
      return this.translateService.instant('products.product.add_to_cart');
    }
    
    let label = this.translateService.instant('products.add_quantity_to_cart', {
      quantity: this.selectedQuantity,
      unit: this.product.unit ? this.unitsService.getUnitDisplay(this.product.unit) : ''
    });
    
    if (this.product.price) {
      label += ` - ${this.currencyService.formatCurrency(this.product.price * this.selectedQuantity)}`;
    }
    
    return label;
  }

  addToCart(): void {
    this.addToCartEvent.emit({
      product: this.product,
      quantity: this.selectedQuantity
    });
  }
}