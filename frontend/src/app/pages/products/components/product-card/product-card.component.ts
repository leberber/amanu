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
    RouterLink,
    TranslateModule,
    ButtonModule,
    TagModule,
    OverlayBadgeModule,
    ProductQuantitySelectorComponent
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

  formatPrice(price: number): string {
    return this.currencyService.formatCurrency(price);
  }

  getUnitDisplay(unit: string): string {
    return this.unitsService.getUnitTranslated(unit);
  }



  onQuantityChanged(quantity: number): void {
    this.selectedQuantity = quantity;
  }
  


  addToCart(): void {
    this.addToCartEvent.emit({
      product: this.product,
      quantity: this.selectedQuantity
    });
  }
}