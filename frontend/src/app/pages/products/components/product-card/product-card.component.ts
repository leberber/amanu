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
      <!-- Normal card content -->
      <ng-container *ngIf="!showQuantityGrid">
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
            <div class="text-xl font-bold text-900">
              {{ formatPrice(product.price) }}
            </div>
            <span class="text-xs text-600">per {{ getUnitDisplay(product.unit) }}</span>
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
              <app-product-quantity-selector
                mode="grid-overlay"
                [value]="selectedQuantity"
                [stockQuantity]="product.stock_quantity"
                [unit]="product.unit"
                [quantityConfig]="product.quantity_config"
                [compact]="true"
                customClass="w-6rem"
                (valueChange)="selectedQuantity = $event"
                (gridToggled)="showQuantityGrid = $event"
              ></app-product-quantity-selector>
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
      </ng-container>

      <!-- Quantity grid view -->
      <ng-container *ngIf="showQuantityGrid">
        <div class="quantity-grid-view p-4">
          <div class="flex align-items-center justify-content-between mb-3">
            <h4 class="m-0">{{ 'Select Quantity' | translate }}</h4>
            <button
              pButton
              type="button"
              icon="pi pi-times"
              class="p-button-rounded p-button-text p-button-sm"
              (click)="showQuantityGrid = false">
            </button>
          </div>
          
          <div class="quantity-grid">
            <button
              *ngFor="let qty of getQuantityOptions()"
              type="button"
              [ngClass]="{'selected': qty === selectedQuantity}"
              class="qty-grid-button"
              (click)="selectQuantity(qty)">
              <span class="qty-value">{{ qty }}</span>
              <span class="qty-unit text-xs">{{ getUnitDisplay(product.unit) }}</span>
            </button>
          </div>
          
          <div class="mt-3 pt-3 border-top-1 surface-border">
            <button
              pButton
              icon="pi pi-cart-plus"
              [label]="'Add ' + selectedQuantity + ' ' + getUnitDisplay(product.unit) + ' to Cart' | translate"
              class="w-full"
              (click)="addToCart()">
            </button>
          </div>
        </div>
      </ng-container>
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

    /* Quantity grid view styles */
    .quantity-grid-view {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .quantity-grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
      gap: 0.5rem;
      padding: 1rem 0;
      overflow-y: auto;
      max-height: 300px;
    }

    .qty-grid-button {
      background: var(--surface-50);
      border: 2px solid var(--surface-200);
      border-radius: 8px;
      padding: 0.75rem 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .qty-grid-button:hover {
      background: var(--surface-100);
      border-color: var(--primary-200);
      transform: translateY(-2px);
    }

    .qty-grid-button.selected {
      background: var(--primary-100);
      border-color: var(--primary-500);
      color: var(--primary-700);
    }

    .qty-value {
      font-size: 1rem;
      font-weight: 600;
    }

    .qty-unit {
      opacity: 0.7;
    }

    /* Scrollbar styling */
    .quantity-grid::-webkit-scrollbar {
      width: 4px;
    }

    .quantity-grid::-webkit-scrollbar-track {
      background: var(--surface-100);
      border-radius: 4px;
    }

    .quantity-grid::-webkit-scrollbar-thumb {
      background: var(--surface-300);
      border-radius: 4px;
    }

    .quantity-grid::-webkit-scrollbar-thumb:hover {
      background: var(--surface-400);
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

  selectedQuantity = 1; // Default quantity
  showQuantityGrid = false;

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

  getQuantityOptions(): number[] {
    const options: number[] = [];
    
    // Use quantity config if available
    if (this.product.quantity_config) {
      if (this.product.quantity_config.type === 'list' && this.product.quantity_config.quantities) {
        // Filter quantities based on stock
        return this.product.quantity_config.quantities.filter(qty => qty <= this.product.stock_quantity);
      } else if (this.product.quantity_config.type === 'range') {
        const min = this.product.quantity_config.min || 0.5;
        const max = Math.min(this.product.quantity_config.max || 100, this.product.stock_quantity);
        const step = min < 1 ? 0.5 : 1;
        
        for (let i = min; i <= max; i += step) {
          options.push(i);
        }
        return options;
      }
    }
    
    // Fallback to default behavior
    const max = Math.min(this.product.stock_quantity, 100);
    for (let i = 1; i <= max; i++) {
      options.push(i);
    }
    
    return options;
  }

  selectQuantity(qty: number): void {
    this.selectedQuantity = qty;
  }

  addToCart(): void {
    this.addToCartEvent.emit({
      product: this.product,
      quantity: this.selectedQuantity
    });
    // Reset the view after adding to cart
    this.showQuantityGrid = false;
  }
}