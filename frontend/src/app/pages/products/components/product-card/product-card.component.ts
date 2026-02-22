import { Component, inject, OnInit, input, output, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { Product } from '../../../../models/product.model';
import { CurrencyService } from '../../../../core/services/currency.service';
import { FlyToCartService } from '../../../../core/services/fly-to-cart.service';
import { OverlayService } from '../../../../core/services/overlay.service';
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
export class ProductCardComponent implements OnInit {
  // Signal-based inputs/outputs
  product = input.required<Product>();
  addToCartEvent = output<AddToCartEvent>();

  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private flyToCartService = inject(FlyToCartService);
  private overlayService = inject(OverlayService);

  // State signals
  selectedOption = signal<BoxOption | null>(null);
  showQuantitySelector = signal(false);

  ngOnInit() {
    // Select first option by default
    const options = this.boxOptions();
    if (options.length > 0) {
      this.selectedOption.set(options[0]);
    }
  }

  openQuantitySelector(event: Event): void {
    event.stopPropagation();
    this.showQuantitySelector.set(true);
    this.overlayService.open('quantity-overlay-open');
  }

  closeQuantitySelector(): void {
    this.showQuantitySelector.set(false);
    this.overlayService.close('quantity-overlay-open');
  }

  selectOption(option: BoxOption): void {
    this.selectedOption.set(option);
  }

  confirmSelection(): void {
    this.closeQuantitySelector();
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

  selectedQuantity = computed(() => this.selectedOption()?.pieces || this.piecesPerBox());

  addToCart(event: MouseEvent): void {
    const option = this.selectedOption();
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
