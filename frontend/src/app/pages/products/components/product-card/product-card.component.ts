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
    <div class="surface-card h-full flex flex-column border-1 surface-border hover:border-primary-300 transition-all transition-duration-300 hover:shadow-3 hover:border-round md:hover:-translate-y-1 border-round-0 md:border-round">
      <!-- Product Image -->
      <a [routerLink]="['/products', product.id]" class="block relative overflow-hidden">
        <img 
          [src]="product.image_url || 'assets/images/product-placeholder.jpg'"
          [alt]="product.name"
          class="w-full hover:scale-105 transition-all transition-duration-300"
          style="height: 220px; object-fit: cover;"
        >
        <!-- Overlay badges -->
        <div class="absolute top-0 left-0 w-full p-2 flex justify-content-between align-items-start">
          <div class="flex align-items-start gap-2">
            @if (product.is_organic) {
              <p-tag 
                severity="success" 
                [value]="'products.tags.organic' | translate" 
                class="shadow-2 flex-shrink-0 w-auto text-xs"
                icon="pi pi-leaf"
              ></p-tag>
            }
          </div>
          @if (isLowStock && !isOutOfStock) {
            <p-tag 
              severity="warning" 
              [value]="'products.stock.low_stock_title' | translate"
              class="shadow-2 text-xs"
              icon="pi pi-exclamation-triangle"
            ></p-tag>
          }
        </div>
      </a>
    
      <!-- Product Info -->
      <div class="flex-grow-1 p-3 md:p-4 flex flex-column">
        <!-- Title and Category -->
        <div class="mb-2">
          <h4 class="m-0 mb-2 text-xl font-medium">
            <a [routerLink]="['/products', product.id]" class="text-900 no-underline hover:text-primary transition-colors transition-duration-200">
              {{ product.name }}
            </a>
          </h4>
        </div>
        
        <!-- Description -->
        <div class="text-600 text-sm mb-2 line-height-2">
          {{ product.description || ('products.default_description' | translate) }}
        </div>
        
        <!-- Price and Stock -->
        <div class="flex align-items-center justify-content-between mb-3">
          <div>
            <div class="text-base font-semibold text-900">
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
            
            <!-- Add to cart button and quantity display -->
            <div class="flex align-items-center gap-2 py-2">
              <div class="flex-1">
                @if (isInCart) {
                  <span class="text-xs text-green-500">
                    <i class="pi pi-check-circle mr-1 text-xs"></i>
                    {{ quantityInCart }} {{ 'products.cart.in_cart' | translate }} ({{ formatPrice(product.price * quantityInCart) }})
                  </span>
                }
              </div>
              <button
                pButton
                type="button"
                [label]="('common.add' | translate) + ' (' + selectedQuantity + ')'"
                icon="pi pi-shopping-cart"
                class="p-button-primary text-sm"
                style="height: 2.25rem; padding: 0 1rem; width: 35%;"
                [disabled]="!product.stock_quantity || product.stock_quantity === 0 || selectedQuantity === 0 || selectedQuantity > product.stock_quantity"
                (click)="addToCart()">
              </button>
            </div>
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
    
    .no-underline {
      text-decoration: none;
    }
    
    /* Mobile-specific border styling */
    @media (max-width: 768px) {
      .surface-card {
        border-left: none !important;
        border-right: none !important;
        border-top: none !important;
        border-bottom: 2px solid var(--surface-border) !important;
        border-radius: 0 !important;
        margin-bottom: 0.5rem;
      }
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

  get isInCart(): boolean {
    return this.cartService.isProductInCart(this.product.id);
  }

  get quantityInCart(): number {
    return this.cartService.getProductQuantityInCart(this.product.id);
  }

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
    return this.unitsService.getUnitTranslated(unit);
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
    return this.translateService.instant('products.cart.add_to_cart');
  }

  getQuantityOptions(): any[] {
    if (this.product.quantity_config?.type === 'list' && this.product.quantity_config.quantities) {
      return this.product.quantity_config.quantities
        .filter(qty => qty <= this.product.stock_quantity)
        .map(value => ({
          label: `${value} ${this.unitsService.getUnitTranslated(this.product.unit)}`,
          value: value
        }));
    }
    
    // Default options for range or no config
    const options = [];
    const max = Math.min(this.product.stock_quantity || 10, 10);
    for (let i = 1; i <= max; i++) {
      options.push({
        label: `${i} ${this.unitsService.getUnitTranslated(this.product.unit)}`,
        value: i
      });
    }
    return options;
  }

  addToCart(): void {
    this.addToCartEvent.emit({
      product: this.product,
      quantity: this.selectedQuantity
    });
  }
}