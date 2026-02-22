import { Component, inject, input, output, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { Product } from '../../../../models/product.model';
import { CurrencyService } from '../../../../core/services/currency.service';
import { FlyToCartService } from '../../../../core/services/fly-to-cart.service';
import { CartService } from '../../../../services/cart.service';
import { CurrencyPipe } from '../../../../shared/pipes/currency.pipe';
import { ImageFallbackDirective } from '../../../../shared/directives/image-fallback.directive';
import {
  isOutOfStock as checkOutOfStock,
  isLowStock as checkLowStock
} from '../../../../shared/utils/stock.utils';
import {
  formatDiscountLabel,
  getEffectivePrice,
  hasPromotion as checkHasPromotion
} from '../../../../shared/utils/discount.utils';
import {
  generateBoxOptions,
  BoxOption
} from '../../../../shared/utils/box-options.utils';

export interface AddToCartEvent {
  product: Product;
  quantity: number;
}

export interface QuantitySelectorEvent {
  product: Product;
  event: Event;
}

export type { BoxOption };

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    ButtonModule,
    TagModule,
    CurrencyPipe,
    ImageFallbackDirective
  ],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  // Signal-based inputs/outputs
  product = input.required<Product>();
  addToCartEvent = output<AddToCartEvent>();
  quantitySelectorEvent = output<QuantitySelectorEvent>();

  // Input for selected option (managed by parent)
  selectedBoxOption = input<BoxOption | null>(null);

  // Input for highlight animation (triggered by parent after confirm)
  highlightCart = input<boolean>(false);

  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private flyToCartService = inject(FlyToCartService);

  openQuantitySelector(event: Event): void {
    event.stopPropagation();
    this.quantitySelectorEvent.emit({
      product: this.product(),
      event
    });
  }

  // Computed signals using shared utilities
  isInCart = computed(() => this.cartService.isProductInCart(this.product().id));

  quantityInCart = computed(() => this.cartService.getProductQuantityInCart(this.product().id));

  isOutOfStock = computed(() => checkOutOfStock(this.product()));

  isLowStock = computed(() => checkLowStock(this.product()));

  hasPromotion = computed(() => checkHasPromotion(this.product().promotion));

  discountLabel = computed(() => formatDiscountLabel(this.product().promotion, this.currencyService));

  effectivePrice = computed(() => getEffectivePrice(this.product().price, this.product().promotion));

  piecesPerBox = computed(() => this.product().pieces_per_box || 1);

  boxOptions = computed(() => generateBoxOptions(this.product(), this.currencyService));

  selectedQuantity = computed(() => this.selectedBoxOption()?.pieces || this.piecesPerBox());

  addToCart(event: MouseEvent): void {
    const option = this.selectedBoxOption();
    if (!option) return;

    // Trigger fly-to-cart animation
    const button = event.currentTarget as HTMLElement;
    this.flyToCartService.animate(button, this.product().image_url);

    this.addToCartEvent.emit({
      product: this.product(),
      quantity: option.pieces
    });
  }
}
