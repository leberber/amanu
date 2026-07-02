import { Component, inject, input, output, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { Product } from '../../../../models/product.model';
import { RouteHelpers, ROUTES } from '../../../../core/constants/routes.constants';
import { AuthService } from '../../../../services/auth.service';
import { CurrencyService } from '../../../../core/services/currency.service';
import { PackagingTypeService } from '../../../../core/services/packaging-type.service';
import { FlyToCartService } from '../../../../core/services/fly-to-cart.service';
import { CartService } from '../../../../services/cart.service';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { UnitPipe } from '../../../../shared/pipes/unit.pipe';
import {
  isOutOfStock as checkOutOfStock,
  isLowStock as checkLowStock
} from '../../../../shared/utils/stock.utils';
import {
  getEffectivePrice,
  hasGroupDiscount as checkHasGroupDiscount
} from '../../../../shared/utils/discount.utils';
import {
  generateBoxOptions,
  BoxOption
} from '../../../../shared/utils/box-options.utils';
import { DEFAULTS } from '../../../../core/constants/app.constants';
import { UnitsService } from '../../../../core/services/units.service';
import { ImageFallbackDirective } from '../../../../shared/directives/image-fallback.directive';

export interface AddToCartEvent {
  product: Product;
  quantity: number;
}

export interface QuantitySelectorEvent {
  product: Product;
  event: Event;
}

@Component({
  selector: 'app-product-list-item',
  standalone: true,
  imports: [
    RouterLink,
    AsyncPipe,
    TranslateModule,
    ButtonModule,
    CurrencyDisplayComponent,
    UnitPipe,
    ImageFallbackDirective
  ],
  templateUrl: './product-list-item.component.html',
  styleUrl: './product-list-item.component.scss'
})
export class ProductListItemComponent {
  // Inputs
  product = input.required<Product>();
  selectedBoxOption = input<BoxOption | null>(null);
  highlightCart = input<boolean>(false);

  // Outputs
  addToCartEvent = output<AddToCartEvent>();
  quantitySelectorEvent = output<QuantitySelectorEvent>();

  // Services
  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private flyToCartService = inject(FlyToCartService);
  private translateService = inject(TranslateService);
  private packagingTypeService = inject(PackagingTypeService);
  private authService = inject(AuthService);
  private unitsService = inject(UnitsService);

  unitHint(unit: string): string {
    const display = this.unitsService.getUnitDisplay(unit, true);
    return display.length > 4 ? 'u' : display;
  }

  packagingHint(): string {
    const p = this.product();
    if (!p.pieces_per_box) return '';
    const unit = this.unitHint(p.unit);
    const packaging = this.getPackagingTypeForCount(1);
    return `${p.pieces_per_box} ${unit}/${packaging}`;
  }

  readonly ROUTES = ROUTES;

  // Auth state
  isLoggedIn = this.authService.isLoggedIn$;

  // Group discount
  hasGroupDiscount = computed(() => checkHasGroupDiscount(this.product()));

  // Computed - route
  productDetailLink = computed(() => RouteHelpers.productDetail(this.product().id));

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

  // Computed - stock
  isOutOfStock = computed(() => checkOutOfStock(this.product()));
  isLowStock = computed(() => checkLowStock(this.product()));

  // Computed - price
  effectivePrice = computed(() => getEffectivePrice(this.product().price, this.product().promotion));

  // Computed - packaging
  piecesPerBox = computed(() => this.product().pieces_per_box || 1);
  boxOptions = computed(() => generateBoxOptions(this.product(), this.currencyService));

  // Methods
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

  getCartButtonIcon(): string {
    if (this.quantityMatchesCart()) return 'pi pi-check';
    if (this.isInCart()) return 'pi pi-refresh';
    return 'pi pi-cart-plus';
  }
}
