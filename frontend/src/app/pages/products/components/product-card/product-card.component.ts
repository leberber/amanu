import { Component, inject, input, output, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { Product } from '../../../../models/product.model';
import { RouteHelpers } from '../../../../core/constants/routes.constants';
import { CurrencyService } from '../../../../core/services/currency.service';
import { PackagingTypeService } from '../../../../core/services/packaging-type.service';
import { FlyToCartService } from '../../../../core/services/fly-to-cart.service';
import { CartService } from '../../../../services/cart.service';
import { VolumeDiscountService } from '../../../../services/volume-discount.service';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { UnitPipe } from '../../../../shared/pipes/unit.pipe';
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
    CurrencyDisplayComponent,
    UnitPipe,
    ImageFallbackDirective
  ],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  // Inputs/Outputs
  product = input.required<Product>();
  addToCartEvent = output<AddToCartEvent>();
  quantitySelectorEvent = output<QuantitySelectorEvent>();
  selectedBoxOption = input<BoxOption | null>(null);
  highlightCart = input<boolean>(false);

  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private flyToCartService = inject(FlyToCartService);
  private translateService = inject(TranslateService);
  private packagingTypeService = inject(PackagingTypeService);
  private volumeDiscountService = inject(VolumeDiscountService);

  // Computed - cart
  isInCart = computed(() => {
    const cartItems = this.cartService.items();
    return cartItems.some(item => item.product_id === this.product().id);
  });

  quantityInCart = computed(() => {
    const cartItems = this.cartService.items();
    const item = cartItems.find(item => item.product_id === this.product().id);
    return item ? item.quantity : 0;
  });

  boxesInCart = computed(() => {
    const qty = this.quantityInCart();
    const piecesPerBox = this.product().pieces_per_box || 1;
    return Math.round(qty / piecesPerBox);
  });

  cartPackagingLabel = computed(() => {
    const boxes = this.boxesInCart();
    return this.getPackagingTypeForCount(boxes);
  });

  quantityMatchesCart = computed(() => {
    const selected = this.selectedBoxOption();
    const cartQty = this.quantityInCart();
    return selected ? selected.pieces === cartQty : false;
  });

  // Computed - route
  productDetailLink = computed(() => RouteHelpers.productDetail(this.product().id));

  // Computed - stock
  isOutOfStock = computed(() => checkOutOfStock(this.product()));
  isLowStock = computed(() => checkLowStock(this.product()));

  // Computed - promotion
  hasPromotion = computed(() => checkHasPromotion(this.product().promotion));
  discountLabel = computed(() => formatDiscountLabel(this.product().promotion, this.currencyService, this.product().pieces_per_box || 1));
  effectivePrice = computed(() => getEffectivePrice(this.product().price, this.product().promotion));

  // Computed - volume discount
  volumeDiscount = computed(() => {
    const discounts = this.volumeDiscountService.getCachedDiscounts();
    return discounts.find(d => d.product_id === this.product().id) || null;
  });

  hasFreeUnitsPromotion = computed(() => {
    const vd = this.volumeDiscount();
    return vd?.discount_type === 'free_units';
  });

  hasVolumeDiscountPromotion = computed(() => {
    const vd = this.volumeDiscount();
    return vd && vd.discount_type !== 'free_units';
  });

  // Computed - packaging
  piecesPerBox = computed(() => this.product().pieces_per_box || 1);
  boxOptions = computed(() => generateBoxOptions(this.product(), this.currencyService));
  selectedQuantity = computed(() => this.selectedBoxOption()?.pieces || this.piecesPerBox());

  openQuantitySelector(event: Event): void {
    event.stopPropagation();
    this.quantitySelectorEvent.emit({
      product: this.product(),
      event
    });
  }

  getPackagingTypeForCount(count: number): string {
    return this.packagingTypeService.getPackagingTypeForCount(this.product().packaging_type || 'carton', count);
  }

  addToCart(event: MouseEvent): void {
    const option = this.selectedBoxOption();
    if (!option) return;

    const button = event.currentTarget as HTMLElement;
    this.flyToCartService.animate(button, this.product().image_url);

    this.addToCartEvent.emit({
      product: this.product(),
      quantity: option.pieces
    });
  }
}
