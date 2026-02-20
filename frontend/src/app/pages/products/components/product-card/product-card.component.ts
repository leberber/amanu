import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { OverlayBadgeModule } from 'primeng/overlaybadge';

import { Product } from '../../../../models/product.model';
import { CurrencyService } from '../../../../core/services/currency.service';
import { UnitsService } from '../../../../core/services/units.service';
import { FlyToCartService } from '../../../../core/services/fly-to-cart.service';
import { CartService } from '../../../../services/cart.service';
import { ProductQuantitySelectorComponent } from '../../../../shared/components/product-quantity-selector/product-quantity-selector.component';
import { CurrencyPipe } from '../../../../shared/pipes/currency.pipe';

export interface AddToCartEvent {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    ButtonModule,
    TagModule,
    OverlayBadgeModule,
    ProductQuantitySelectorComponent,
    CurrencyPipe
  ],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent implements OnInit {
  @Input() product!: Product;
  @Output() addToCartEvent = new EventEmitter<AddToCartEvent>();

  private currencyService = inject(CurrencyService);
  private unitsService = inject(UnitsService);
  private cartService = inject(CartService);
  private flyToCartService = inject(FlyToCartService);

  selectedQuantity = 1;
  
  ngOnInit() {
    // Initialize quantity based on product's quantity config
    if (this.product?.quantity_config?.type === 'list' && 
        this.product.quantity_config.quantities && 
        this.product.quantity_config.quantities.length > 0) {
      this.selectedQuantity = this.product.quantity_config.quantities[0];
    }
  }

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

  get hasPromotion(): boolean {
    return !!this.product.promotion;
  }

  get discountLabel(): string {
    if (!this.product.promotion) return '';
    if (this.product.promotion.discount_type === 'percentage') {
      return `-${this.product.promotion.discount_value}%`;
    }
    return `-${this.currencyService.formatCurrency(this.product.promotion.discount_value)}`;
  }

  get discountedPrice(): number {
    return this.product.promotion?.discounted_price || this.product.price;
  }

  get effectivePrice(): number {
    return this.hasPromotion ? this.discountedPrice : this.product.price;
  }

  get boxQuantity(): number | null {
    const config = this.product.quantity_config;
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

  get boxPrice(): number | null {
    if (this.boxQuantity) {
      return this.effectivePrice * this.boxQuantity;
    }
    return null;
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit);
  }



  onQuantityChanged(quantity: number): void {
    this.selectedQuantity = quantity;
  }
  


  addToCart(event: MouseEvent): void {
    // Trigger fly-to-cart animation from the button
    const button = event.currentTarget as HTMLElement;
    this.flyToCartService.animate(button, this.product.image_url);

    this.addToCartEvent.emit({
      product: this.product,
      quantity: this.selectedQuantity
    });
  }
}