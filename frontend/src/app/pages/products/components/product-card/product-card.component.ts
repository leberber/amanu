import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';

import { Product } from '../../../../models/product.model';
import { CurrencyService } from '../../../../core/services/currency.service';
import { FlyToCartService } from '../../../../core/services/fly-to-cart.service';
import { CartService } from '../../../../services/cart.service';
import { CurrencyPipe } from '../../../../shared/pipes/currency.pipe';

export interface AddToCartEvent {
  product: Product;
  quantity: number;
}

export interface BoxOption {
  boxes: number;
  pieces: number;
  price: number;
  label: string;
}

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    TranslateModule,
    ButtonModule,
    TagModule,
    SelectModule,
    CurrencyPipe
  ],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent implements OnInit {
  @Input() product!: Product;
  @Output() addToCartEvent = new EventEmitter<AddToCartEvent>();

  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private flyToCartService = inject(FlyToCartService);

  selectedOption: BoxOption | null = null;

  ngOnInit() {
    // Select first option by default
    const options = this.boxOptions;
    if (options.length > 0) {
      this.selectedOption = options[0];
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

  get effectivePrice(): number {
    return this.product.promotion?.discounted_price || this.product.price;
  }

  get piecesPerBox(): number {
    return this.product.pieces_per_box || 1;
  }

  get maxBoxes(): number {
    if (this.piecesPerBox <= 0) return 0;
    return Math.floor(this.product.stock_quantity / this.piecesPerBox);
  }

  get boxOptions(): BoxOption[] {
    const options: BoxOption[] = [];
    const max = Math.min(this.maxBoxes, 10); // Limit to 10 options

    for (let i = 1; i <= max; i++) {
      const pieces = i * this.piecesPerBox;
      const price = pieces * this.effectivePrice;
      options.push({
        boxes: i,
        pieces,
        price,
        label: `${i} ${i === 1 ? 'box' : 'boxes'} • ${pieces} pc • ${this.currencyService.formatCurrency(price)}`
      });
    }

    return options;
  }

  get selectedQuantity(): number {
    return this.selectedOption?.pieces || this.piecesPerBox;
  }

  addToCart(event: MouseEvent): void {
    const option = this.selectedOption;
    if (!option) return;

    // Trigger fly-to-cart animation
    const button = event.currentTarget as HTMLElement;
    this.flyToCartService.animate(button, this.product.image_url);

    this.addToCartEvent.emit({
      product: this.product,
      quantity: option.pieces
    });
  }
}
