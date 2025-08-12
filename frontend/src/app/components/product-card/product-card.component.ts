import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// PrimeNG imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { BadgeModule } from 'primeng/badge';

import { Product } from '../../models/product.model';
import { CurrencyService } from '../../core/services/currency.service';
import { UnitsService } from '../../core/services/units.service';
import { CartService } from '../../services/cart.service';

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
    SelectModule,
    BadgeModule
  ],
  template: `
    <div class="product-card surface-card border-round-lg overflow-hidden h-full flex flex-column transition-all transition-duration-300 hover:shadow-4">
      <!-- Product Image -->
      <a [routerLink]="['/products', product.id]" class="block relative overflow-hidden product-image-container">
        <img 
          [src]="product.image_url || 'assets/images/product-placeholder.jpg'"
          [alt]="product.name"
          class="w-full product-image transition-all transition-duration-300"
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
              [value]="'Limited Stock' | translate"
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
          {{ product.description || 'Fresh, high-quality produce delivered to your door' }}
        </p>
        
        <!-- Price and Stock -->
        <div class="flex align-items-center justify-content-between mb-3">
          <div>
            <div class="text-2xl font-bold text-900">
              {{ formatPrice(product.price) }}
            </div>
            <span class="text-sm text-600">per {{ getUnitDisplay(product.unit) }}</span>
          </div>
          
          <!-- Stock indicator -->
          <div class="text-right">
            @if (isOutOfStock) {
              <span class="text-red-500 font-medium text-sm">
                <i class="pi pi-times-circle mr-1"></i>Out of Stock
              </span>
            } @else if (isLowStock) {
              <span class="text-orange-500 font-medium text-sm">
                <i class="pi pi-exclamation-circle mr-1"></i>{{ product.stock_quantity }} left
              </span>
            } @else {
              <span class="text-green-500 font-medium text-sm">
                <i class="pi pi-check-circle mr-1"></i>In Stock
              </span>
            }
          </div>
        </div>
        
        <!-- Actions -->
        <div class="mt-auto">
          @if (!isOutOfStock) {
            <div class="flex gap-2">
              <p-select
                [(ngModel)]="selectedQuantity"
                [options]="quantityOptions"
                optionLabel="label"
                optionValue="value"
                [placeholder]="'Qty' | translate"
                styleClass="w-6rem"
              ></p-select>
              <button
                pButton
                icon="pi pi-cart-plus"
                [label]="'Add to Cart' | translate"
                class="flex-1 font-semibold"
                (click)="addToCart()"
                [disabled]="!selectedQuantity"
              ></button>
            </div>
          } @else {
            <button
              pButton
              [label]="'Out of Stock' | translate"
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
    }
    
    .product-card:hover {
      border-color: var(--primary-color-light);
      transform: translateY(-2px);
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

  selectedQuantity = 5; // Default quantity

  get isOutOfStock(): boolean {
    return this.product.stock_quantity === 0;
  }

  get isLowStock(): boolean {
    return this.product.stock_quantity > 0 && this.product.stock_quantity < 20;
  }

  get quantityOptions(): any[] {
    const max = Math.min(this.product.stock_quantity, 100);
    const options = [];
    const minQty = 5;
    const increment = 5;
    
    for (let i = minQty; i <= max; i += increment) {
      options.push({
        label: `${i} ${this.getUnitDisplay(this.product.unit)}`,
        value: i
      });
    }
    
    return options;
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
    // This would ideally come from a category service or be part of the product model
    // For now, returning a placeholder
    return 'Fresh Produce';
  }

  addToCart(): void {
    this.addToCartEvent.emit({
      product: this.product,
      quantity: this.selectedQuantity
    });
  }
}